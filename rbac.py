import logging
from typing import List, Optional

from fastapi import Cookie, Depends, HTTPException, Request, status

import config
from auth import verify_fingerprint
from models import TokenData
from session_manager import get_session

logger = logging.getLogger(__name__)


def get_cookie_name(base_name: str) -> str:
    """Get the appropriate cookie name based on environment."""
    is_production = config.ENVIRONMENT == "production"
    return f"__Host-{base_name}" if is_production else base_name


async def get_current_user(
    request: Request,
    session_id_cookie: Optional[str] = Cookie(None, alias="session_id"),
    fingerprint_cookie: Optional[str] = Cookie(None, alias="fingerprint"),
) -> TokenData:
    """Resolve the current authenticated user using the session cookie."""

    session_cookie_name = get_cookie_name("session_id")
    fingerprint_cookie_name = get_cookie_name("fingerprint")

    session_id = request.cookies.get(session_cookie_name) or session_id_cookie
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session = get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stored_fingerprint = session.fingerprint
    actual_fingerprint = (
        request.cookies.get(fingerprint_cookie_name) or fingerprint_cookie
    )

    if stored_fingerprint and actual_fingerprint:
        if not verify_fingerprint(stored_fingerprint, actual_fingerprint):
            logger.warning(
                "Fingerprint mismatch for user session %s", session.session_id
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Device fingerprint mismatch",
            )

    return TokenData(
        email=session.email,
        username=session.username,
        roles=session.roles,
        session_id=session.session_id,
        azure_object_id=session.azure_object_id,
        azure_tenant_id=session.azure_tenant_id,
        azure_config_dir=session.azure_config_dir,
        user_identifier=session.user_identifier,
        fingerprint=session.fingerprint,
        created_at=session.created_at,
        last_seen_at=session.last_seen_at,
    )


async def get_current_active_user(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    """Dependency to ensure user is active."""
    return current_user


class RoleChecker:
    """Dependency class to check if user has required roles."""

    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    async def __call__(
        self, current_user: TokenData = Depends(get_current_user)
    ) -> TokenData:
        """Check if user has any of the required roles."""
        if not any(role in current_user.roles for role in self.allowed_roles):
            logger.warning(
                "User %s with roles %s attempted to access resource requiring %s",
                current_user.email,
                current_user.roles,
                self.allowed_roles,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {', '.join(self.allowed_roles)}",
            )
        return current_user


# Predefined role checkers
require_admin = RoleChecker(["admin"])
require_user = RoleChecker(["user", "admin"])  # Both user and admin can access


def has_permission(user: TokenData, required_roles: List[str]) -> bool:
    """Check if user has any of the required roles."""
    return any(role in user.roles for role in required_roles)
