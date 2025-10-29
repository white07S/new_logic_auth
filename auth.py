import asyncio
import json
import logging
import os
import re
import shutil
from pathlib import Path
from typing import Dict, Optional

from fastapi import Response

import config
from azure_config import get_user_config_dir, sanitize_identifier

logger = logging.getLogger(__name__)

# In-memory storage for Azure authorization sessions
auth_sessions: Dict[str, Dict] = {}


class AzureLoginError(Exception):
    """Raised when the Azure CLI flow cannot be completed."""


def _build_user_identifier(
    *, email: Optional[str], user_name: Optional[str], azure_object_id: Optional[str]
) -> str:
    base = (user_name or (email.split("@")[0] if email else None) or azure_object_id or "user").strip()
    suffix = (azure_object_id or "").replace("-", "")[:12]
    identifier = f"{base}-{suffix}" if suffix else base
    return sanitize_identifier(identifier)


def verify_fingerprint(stored_fingerprint: str, provided_fingerprint: str) -> bool:
    """Ensure the browser fingerprint matches the stored value."""
    return stored_fingerprint == provided_fingerprint


def set_session_cookie(response: Response, session_id: str, *, max_age_seconds: int) -> None:
    """Set the session identifier cookie."""

    is_production = config.ENVIRONMENT == "production"
    cookie_prefix = "__Host-" if is_production else ""

    response.set_cookie(
        key=f"{cookie_prefix}session_id",
        value=session_id,
        httponly=True,
        max_age=max_age_seconds,
        samesite="strict" if is_production else "lax",
        secure=is_production,
        path="/",
    )


def clear_session_cookies(response: Response):
    """Remove authentication cookies from the response."""
    is_production = config.ENVIRONMENT == "production"
    cookie_prefix = "__Host-" if is_production else ""

    # Delete all auth-related cookies
    response.delete_cookie(f"{cookie_prefix}session_id", path="/")
    response.delete_cookie(f"{cookie_prefix}fingerprint", path="/")
    response.delete_cookie(f"{cookie_prefix}csrf_token", path="/")

    # Also delete old format cookies during transition
    response.delete_cookie("fingerprint", path="/")
    response.delete_cookie("session_id", path="/")


async def _run_az_command(command: list, env: Dict[str, str]) -> str:
    """Execute an Azure CLI command and return stdout."""
    logger.debug("Executing command: %s", " ".join(command))
    proc = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        error_output = stderr.decode() or stdout.decode()
        logger.error("Command failed: %s", error_output.strip())
        raise AzureLoginError(error_output.strip())
    return stdout.decode()


def _resolve_roles(group_ids: Optional[list]) -> Dict[str, list]:
    """Map Azure AD group IDs to application roles."""
    matched_roles = []
    group_ids = set(group_ids or [])

    for role, configured_groups in config.AZURE_ROLE_GROUP_MAPPING.items():
        for gid in configured_groups:
            if gid and gid in group_ids:
                matched_roles.append(role)
                break

    if not matched_roles and config.DEFAULT_ROLE:
        matched_roles.append(config.DEFAULT_ROLE)

    return {"roles": sorted(set(matched_roles))}


async def run_az_login(session_id: str, config_dir: Path):
    """
    Runs `az login --use-device-code --output json` in an isolated AZURE_CONFIG_DIR,
    parses the device code + URL, and stores the resulting authentication details.
    """
    logger.debug("Starting Azure login process for session %s", session_id)

    env = os.environ.copy()
    env["AZURE_CONFIG_DIR"] = str(config_dir)

    proc = await asyncio.create_subprocess_exec(
        "az",
        "login",
        "--use-device-code",
        "--output",
        "json",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env=env,
    )

    user_code = None
    verification_uri = None
    json_lines = []
    seen_first_json = False

    promoted_to_user_dir = False

    try:
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            text = line.decode("utf-8", errors="ignore").strip()
            logger.debug("Azure CLI output: %s", text)

            if not seen_first_json:
                code_match = re.search(r"code\s+([A-Z0-9\-]+)", text)
                url_match = re.search(r"(https?://\S+)", text)
                if code_match:
                    user_code = code_match.group(1)
                if url_match:
                    verification_uri = url_match.group(1)
                if user_code and verification_uri:
                    auth_sessions[session_id].update(
                        {
                            "user_code": user_code,
                            "verification_uri": verification_uri,
                            "status": "waiting_for_user",
                        }
                    )
                    seen_first_json = True
                    continue

                if text.startswith("[") or text.startswith("{"):
                    seen_first_json = True

            if seen_first_json:
                json_lines.append(text)

        try:
            await asyncio.wait_for(proc.wait(), timeout=config.AZ_LOGIN_TIMEOUT)
        except asyncio.TimeoutError:
            proc.kill()
            auth_sessions[session_id].update(
                {
                    "status": "timeout",
                    "message": "Login timed out",
                }
            )
            return

        if not json_lines:
            auth_sessions[session_id].update(
                {
                    "status": "error",
                    "message": "No JSON payload returned from az login",
                }
            )
            return

        raw_json = "\n".join(json_lines)

        try:
            accounts = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse az login output: %s", exc)
            auth_sessions[session_id].update(
                {
                    "status": "error",
                    "message": "Malformed JSON from az login",
                }
            )
            return

        if not isinstance(accounts, list) or not accounts:
            auth_sessions[session_id].update(
                {
                    "status": "error",
                    "message": "Unexpected login response",
                }
            )
            return

        # Gather additional user context
        try:
            user_info_raw = await _run_az_command(
                ["az", "ad", "signed-in-user", "show", "--output", "json"],
                env,
            )
            user_info = json.loads(user_info_raw)
            azure_object_id = user_info.get("id") or user_info.get("objectId")
            email = user_info.get("userPrincipalName") or user_info.get("mail")
            user_name = user_info.get("mailNickname") or (
                email.split("@")[0] if email else None
            )

            member_of_raw = await _run_az_command(
                [
                    "az",
                    "rest",
                    "--method",
                    "GET",
                    "--uri",
                    f"https://graph.microsoft.com/v1.0/users/{azure_object_id}/memberOf",
                    "--headers",
                    "ConsistencyLevel=eventual",
                ],
                env,
            )
            member_of = json.loads(member_of_raw)
            group_ids = [
                entry.get("id")
                for entry in member_of.get("value", [])
                if entry.get("@odata.type") == "#microsoft.graph.group"
            ]

            roles_info = _resolve_roles(group_ids)
            roles = roles_info["roles"]

            if not email or not roles:
                auth_sessions[session_id].update(
                    {
                        "status": "completed",
                        "authorized": False,
                        "email": email,
                        "message": "User not authorized for any roles",
                    }
                )
                return

            primary_account = accounts[0]
            tenant_id = (
                primary_account.get("tenantId")
                or primary_account.get("homeTenantId")
                or user_info.get("tenantId")
            )

            user_identifier = _build_user_identifier(
                email=email,
                user_name=user_name,
                azure_object_id=azure_object_id,
            )

            target_dir = get_user_config_dir(user_identifier, create=False)
            target_dir.parent.mkdir(parents=True, exist_ok=True)
            if target_dir.exists():
                shutil.rmtree(target_dir, ignore_errors=True)
            shutil.move(str(config_dir), str(target_dir))
            try:
                os.chmod(target_dir, 0o700)
            except PermissionError:
                pass
            promoted_to_user_dir = True

            auth_sessions[session_id].update(
                {
                    "status": "completed",
                    "authorized": True,
                    "email": email,
                    "user_name": user_name,
                    "roles": roles,
                    "azure_object_id": azure_object_id,
                    "azure_tenant_id": tenant_id,
                    "azure_config_dir": str(target_dir),
                    "user_identifier": user_identifier,
                    "message": f"Authorization successful, welcome {user_name or email}",
                }
            )
            logger.info(
                "Authorization successful for %s (roles=%s)",
                email,
                roles,
            )
        except AzureLoginError as exc:
            auth_sessions[session_id].update(
                {
                    "status": "error",
                    "message": str(exc),
                }
            )
        except json.JSONDecodeError as exc:
            auth_sessions[session_id].update(
                {
                    "status": "error",
                    "message": f"Unable to parse Azure CLI response: {exc}",
                }
            )
    finally:
        if proc.returncode is None:
            proc.kill()
        if not promoted_to_user_dir and config_dir.exists():
            # Only remove the temporary directory if it wasn't promoted to a user cache
            shutil.rmtree(config_dir, ignore_errors=True)
