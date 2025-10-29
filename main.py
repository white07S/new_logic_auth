import asyncio
import logging
import uuid
from datetime import datetime
import secrets

from fastapi import Depends, FastAPI, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware

import config
from auth import (
    auth_sessions,
    clear_session_cookies,
    run_az_login,
    set_session_cookie,
)
from models import (
    AuthCompleteRequest,
    AuthStartResponse,
    AuthStatusResponse,
    AzureChatRequest,
    UserResponse,
)
from rbac import get_current_user, require_admin, require_user, get_cookie_name
from session_manager import (
    create_session,
    delete_session,
    delete_sessions_by_fingerprint,
    get_session,
    get_sessions_for_user,
    list_sessions,
)
from test_routes import router as test_router
from azure_client import get_user_openai_client

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="Azure Auth with RBAC")

# Include test routes
app.include_router(test_router)

# Import security middleware
from security import (
    SecurityHeadersMiddleware,
    CSRFMiddleware,
    RateLimitMiddleware,
    SessionRotationMiddleware,
    AuditLogger
)

# Add security middleware (order matters - add in reverse order of execution)
# These execute from bottom to top
app.add_middleware(SessionRotationMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
app.add_middleware(SecurityHeadersMiddleware)

# Add CORS middleware (should be last/outermost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=config.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-CSRF-Token"],  # Allow frontend to read CSRF token header
)


# ============= AZURE AUTH API =============

@app.post("/api/authorize/start", response_model=AuthStartResponse)
async def start_authorization():
    """Start the Azure device code authorization process."""
    session_id = str(uuid.uuid4())
    logger.info("Starting authorization session %s", session_id)

    config.AZURE_CONFIG_BASE_DIR.mkdir(parents=True, exist_ok=True)
    session_config_dir = config.AZURE_CONFIG_BASE_DIR / session_id
    session_config_dir.mkdir(parents=True, exist_ok=True)

    auth_sessions[session_id] = {
        "status": "starting",
        "created_at": datetime.utcnow().isoformat(),
        "user_code": None,
        "verification_uri": None,
    }

    asyncio.create_task(run_az_login(session_id, session_config_dir))

    for _ in range(50):
        await asyncio.sleep(0.2)
        session = auth_sessions.get(session_id, {})
        if session.get("user_code") and session.get("verification_uri"):
            return AuthStartResponse(
                session_id=session_id,
                user_code=session["user_code"],
                verification_uri=session["verification_uri"],
            )

    raise HTTPException(status_code=500, detail="Failed to start authorization")


@app.get("/api/authorize/status", response_model=AuthStatusResponse)
async def check_authorization_status(session_id: str):
    """Check the status of an authorization session."""
    session = auth_sessions.get(session_id)

    if not session:
        return AuthStatusResponse(status="error", message="Session not found")

    status = session.get("status", "unknown")

    if status == "completed":
        return AuthStatusResponse(
            status="completed",
            authorized=session.get("authorized"),
            email=session.get("email"),
            user_name=session.get("user_name"),
            message=session.get("message"),
        )
    if status in {"starting", "waiting_for_user"}:
        return AuthStatusResponse(status="pending")
    if status == "timeout":
        return AuthStatusResponse(status="timeout", message=session.get("message"))
    if status == "error":
        return AuthStatusResponse(status="error", message=session.get("message"))

    return AuthStatusResponse(status="pending")


@app.post("/api/authorize/complete")
async def complete_authorization(request: AuthCompleteRequest, response: Response):
    """Finalize authorization and establish an in-memory session."""

    session = auth_sessions.get(request.session_id)

    if not session or session.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Invalid or incomplete session")

    if not session.get("authorized"):
        raise HTTPException(status_code=403, detail="User not authorized")

    fingerprint = request.fingerprint
    if not fingerprint:
        raise HTTPException(status_code=400, detail="Fingerprint required")

    email = session.get("email")
    user_name = session.get("user_name") or (email.split("@")[0] if email else None)
    roles = session.get("roles", [])
    azure_object_id = session.get("azure_object_id")
    azure_tenant_id = session.get("azure_tenant_id")
    azure_config_dir = session.get("azure_config_dir")

    if not email or not azure_object_id or not azure_config_dir:
        raise HTTPException(
            status_code=400,
            detail="Azure user identity information incomplete",
        )

    session_record = create_session(
        email=email,
        username=user_name or email,
        roles=roles,
        azure_object_id=azure_object_id,
        azure_tenant_id=azure_tenant_id,
        azure_config_dir=azure_config_dir,
        user_identifier=session.get("user_identifier") or azure_object_id,
        fingerprint=fingerprint,
    )

    max_age_seconds = config.GRAPH_TOKEN_TTL_MINUTES * 60
    set_session_cookie(response, session_record.session_id, max_age_seconds=max_age_seconds)

    is_production = config.ENVIRONMENT == "production"
    cookie_prefix = "__Host-" if is_production else ""

    response.set_cookie(
        key=f"{cookie_prefix}fingerprint",
        value=fingerprint,
        httponly=True,
        max_age=max_age_seconds,
        samesite="strict" if is_production else "lax",
        secure=is_production,
        path="/",
    )

    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=f"{cookie_prefix}csrf_token",
        value=csrf_token,
        httponly=False,
        max_age=max_age_seconds,
        samesite="strict" if is_production else "lax",
        secure=is_production,
        path="/",
    )

    AuditLogger.log_session_event(
        "created",
        session_record.session_id,
        {
            "email": email,
            "azure_object_id": azure_object_id,
            "azure_config_dir": azure_config_dir,
        },
    )

    auth_sessions.pop(request.session_id, None)

    return {
        "success": True,
        "message": "Authentication completed successfully",
        "csrf_token": csrf_token,
    }


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    """Logout the current user and invalidate stored session."""

    def get_cookie_value(possible_names):
        for name in possible_names:
            value = request.cookies.get(name)
            if value:
                return value
        return None

    def build_cookie_names(base_name: str) -> list[str]:
        candidates = [
            base_name,
            get_cookie_name(base_name),
            f"__Host-{base_name}",
        ]
        return [name for name in dict.fromkeys(candidates) if name]

    deleted_session = False

    session_id = get_cookie_value(build_cookie_names("session_id"))
    if session_id:
        deleted_session = delete_session(session_id) is not None

    if not deleted_session:
        fingerprint = get_cookie_value(build_cookie_names("fingerprint"))
        if fingerprint:
            deleted_session = delete_sessions_by_fingerprint(fingerprint) > 0

    if not deleted_session:
        logger.info("Logout request received but no session record matched cookies")

    clear_session_cookies(response)
    response.delete_cookie("fingerprint")

    return {"message": "Logged out successfully"}


# ============= API ENDPOINTS =============


@app.get("/api/me", response_model=UserResponse)
async def get_current_user_info(current_user=Depends(get_current_user)):
    """Return the currently authenticated user's profile."""

    AuditLogger.log_session_event(
        "access",
        current_user.session_id,
        {"endpoint": "/api/me", "email": current_user.email},
    )

    return UserResponse(
        id=current_user.azure_object_id,
        email=current_user.email,
        username=current_user.username,
        roles=current_user.roles,
        created_at=current_user.created_at,
        last_seen_at=current_user.last_seen_at,
    )


@app.get("/api/check-auth")
async def check_auth(request: Request, current_user=Depends(get_current_user)):
    """Check if user is authenticated and return session state."""

    is_production = config.ENVIRONMENT == "production"
    csrf_cookie_name = "__Host-csrf_token" if is_production else "csrf_token"
    csrf_token = request.cookies.get(csrf_cookie_name)

    return {
        "authenticated": True,
        "user": {
            "id": current_user.azure_object_id,
            "email": current_user.email,
            "username": current_user.username,
            "roles": current_user.roles,
        },
        "session": {
            "id": current_user.session_id,
            "azure_config_dir": current_user.azure_config_dir,
            "created_at": current_user.created_at,
            "last_seen_at": current_user.last_seen_at,
            "azure_tenant_id": current_user.azure_tenant_id,
            "user_identifier": current_user.user_identifier,
        },
        "csrf_token": csrf_token,
    }


@app.get("/api/session/info")
async def get_session_info(current_user=Depends(get_current_user)):
    """Get detailed session information.

    Provides session details for the frontend to display token status
    and other session-related information.
    """
    session = get_session(current_user.session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.session_id,
        "email": session.email,
        "username": session.username,
        "roles": session.roles,
        "created_at": session.created_at,
        "last_seen_at": session.last_seen_at,
        "azure_tenant_id": session.azure_tenant_id,
        "azure_config_dir": session.azure_config_dir,
        "user_identifier": session.user_identifier,
        "fingerprint": session.fingerprint,
    }


@app.get("/api/admin/sessions")
async def get_all_sessions(current_user=Depends(require_admin)):
    """Get all active sessions (Admin only)."""
    sessions = list_sessions()
    return {
        "total_sessions": len(sessions),
        "sessions": sessions,
    }


@app.get("/api/me/devices")
async def get_my_devices(current_user=Depends(get_current_user)):
    """Get all devices for current user."""
    devices = get_sessions_for_user(current_user.azure_object_id)
    return {
        "total_devices": len(devices),
        "devices": devices,
    }


@app.post("/api/azure/chat-test")
async def azure_chat_test(
    request: AzureChatRequest,
    current_user=Depends(get_current_user),
):
    """Execute a simple Azure OpenAI chat completion using the caller's credentials."""

    if not config.AZURE_OPENAI_DEPLOYMENT:
        raise HTTPException(
            status_code=500,
            detail="AZURE_OPENAI_DEPLOYMENT is not configured",
        )

    client = get_user_openai_client(
        current_user.user_identifier,
        tenant_id=current_user.azure_tenant_id,
    )

    request_id = str(uuid.uuid4())

    try:
        completion = await asyncio.to_thread(
            client.chat.completions.create,
            model=config.AZURE_OPENAI_DEPLOYMENT,
            messages=[{"role": "user", "content": request.message}],
            temperature=0.2,
            extra_headers={"x-ms-client-request-id": request_id},
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Azure OpenAI chat call failed")
        raise HTTPException(status_code=502, detail="Azure OpenAI request failed") from exc

    content = ""
    if getattr(completion, "choices", None):
        content = completion.choices[0].message.content or ""

    usage = getattr(completion, "usage", None)
    if hasattr(usage, "model_dump"):
        usage = usage.model_dump()

    AuditLogger.log_session_event(
        "azure_chat",
        current_user.session_id,
        {
            "request_id": request_id,
            "message_length": len(request.message or ""),
            "response_length": len(content),
        },
    )

    return {
        "response": content,
        "request_id": request_id,
        "usage": usage,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
