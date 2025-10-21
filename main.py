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
    clear_auth_cookies,
    hash_token,
    run_az_login,
    set_auth_cookies,
)
from database import db
from models import (
    AuthCompleteRequest,
    AuthStartResponse,
    AuthStatusResponse,
    TokenResponse,
    UserResponse,
)
from rbac import get_current_user, require_admin, require_user, get_cookie_name
from test_routes import router as test_router

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
    """Complete authorization and persist session tied to Graph token.

    Returns minimal success response - client should fetch user data from /api/me endpoint.
    """
    session = auth_sessions.get(request.session_id)

    if not session or session.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Invalid or incomplete session")

    if not session.get("authorized"):
        raise HTTPException(status_code=403, detail="User not authorized")

    graph_token = session.get("graph_token")
    if not graph_token:
        raise HTTPException(
            status_code=400, detail="Graph token missing from session response"
        )

    fingerprint = request.fingerprint
    if not fingerprint:
        raise HTTPException(status_code=400, detail="Fingerprint required")

    email = session.get("email")
    user_name = session.get("user_name")
    roles = session.get("roles", [])
    azure_object_id = session.get("azure_object_id")
    azure_tenant_id = session.get("azure_tenant_id")
    token_expires_at = session.get("graph_token_expires_at")
    original_expires_on = session.get("graph_token_original_expires_on")

    if not email or not azure_object_id:
        raise HTTPException(
            status_code=400, detail="Azure user identity information incomplete"
        )

    user_record = db.create_or_update_user(
        azure_object_id=azure_object_id,
        email=email,
        username=user_name or email.split("@")[0],
        roles=roles,
    )

    # Generate secure session ID
    session_id = secrets.token_urlsafe(32)
    device_id = str(uuid.uuid4())
    token_hash = hash_token(graph_token)

    # Store session in database
    db.create_session(
        user_id=user_record["id"],
        username=user_record["username"],
        device_id=device_id,
        fingerprint=fingerprint,
        token_hash=token_hash,
        token_expires_at=token_expires_at,
        azure_object_id=azure_object_id,
        azure_tenant_id=azure_tenant_id,
        azure_token_expires_on=original_expires_on,
        session_id=session_id,  # Store session ID for rotation tracking
    )

    # Set secure cookies
    set_auth_cookies(response, graph_token, session_id)

    # Set fingerprint as HttpOnly cookie
    is_production = config.ENVIRONMENT == "production"
    cookie_prefix = "__Host-" if is_production else ""

    response.set_cookie(
        key=f"{cookie_prefix}fingerprint",
        value=fingerprint,
        httponly=True,  # Changed to HttpOnly for security
        max_age=config.GRAPH_TOKEN_TTL_MINUTES * 60,
        samesite="strict" if is_production else "lax",
        secure=is_production,
        path="/"
    )

    # Generate CSRF token
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=f"{cookie_prefix}csrf_token",
        value=csrf_token,
        httponly=False,  # JavaScript needs to read this for CSRF protection
        max_age=config.GRAPH_TOKEN_TTL_MINUTES * 60,
        samesite="strict" if is_production else "lax",
        secure=is_production,
        path="/"
    )

    # Clean up auth session
    auth_sessions.pop(request.session_id, None)

    # Return minimal response - no sensitive data
    return {
        "success": True,
        "message": "Authentication completed successfully",
        "csrf_token": csrf_token  # Client needs this for subsequent requests
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
        """Return cookie name variants for legacy and __Host- prefixed formats."""
        candidates = [
            base_name,
            get_cookie_name(base_name),
            f"__Host-{base_name}",
        ]
        # Use dict.fromkeys to deduplicate while preserving order
        return [name for name in dict.fromkeys(candidates) if name]

    deleted_session = False

    graph_access_token = get_cookie_value(build_cookie_names("graph_access_token"))
    if graph_access_token:
        token_hash = hash_token(graph_access_token)
        if db.get_session_by_token_hash(token_hash):
            deleted_session = db.delete_session_by_token_hash(token_hash)

    if not deleted_session:
        session_id = get_cookie_value(build_cookie_names("session_id"))
        if session_id:
            deleted_session = db.delete_session_by_session_id(session_id)

    if not deleted_session:
        fingerprint = get_cookie_value(build_cookie_names("fingerprint"))
        if fingerprint:
            deleted_session = db.delete_sessions_by_fingerprint(fingerprint) > 0

    if not deleted_session:
        logger.info("Logout request received but no session record matched cookies")

    clear_auth_cookies(response)
    response.delete_cookie("fingerprint")

    return {"message": "Logged out successfully"}


# ============= API ENDPOINTS =============


@app.get("/api/me", response_model=UserResponse)
async def get_current_user_info(current_user=Depends(get_current_user)):
    """Get current user information.

    This endpoint is used by the frontend to fetch user data after authentication.
    All user data is fetched from the server, eliminating localStorage dependency.
    """
    user = db.get_user_by_id(current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Log session access
    AuditLogger.log_session_event(
        "access",
        current_user.session_id,
        {"endpoint": "/api/me", "user_id": current_user.user_id}
    )

    return UserResponse(**user)


@app.get("/api/check-auth")
async def check_auth(request: Request, current_user=Depends(get_current_user)):
    """Check if user is authenticated and return session state.

    This endpoint is used by the frontend to check authentication status
    without relying on localStorage. Returns all necessary session data.
    """
    # Get CSRF token from cookie for frontend
    is_production = config.ENVIRONMENT == "production"
    csrf_cookie_name = f"__Host-csrf_token" if is_production else "csrf_token"
    csrf_token = request.cookies.get(csrf_cookie_name)

    response_data = {
        "authenticated": True,
        "user": {
            "id": current_user.user_id,
            "email": current_user.email,
            "roles": current_user.roles,
        },
        "session": {
            "id": current_user.session_id,
            "record_id": current_user.session_record_id,
            "device_id": current_user.device_id,
            "expires_at": current_user.token_expires_at,
        },
        "csrf_token": csrf_token,  # Frontend needs this for API requests
    }

    # Fetch additional user details
    user = db.get_user_by_id(current_user.user_id)
    if user:
        response_data["user"]["username"] = user.get("username")
        response_data["user"]["is_active"] = user.get("is_active", True)
        response_data["user"]["last_login"] = user.get("last_login")

    return response_data


@app.get("/api/session/info")
async def get_session_info(current_user=Depends(get_current_user)):
    """Get detailed session information.

    Provides session details for the frontend to display token status
    and other session-related information.
    """
    session = None

    if current_user.session_id:
        session = db.get_session_by_session_id(current_user.session_id)

    if not session and current_user.session_record_id:
        session = db.get_session_by_id(current_user.session_record_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.get("session_id"),
        "device_id": session.get("device_id"),
        "created_at": session.get("created_at"),
        "last_used_at": session.get("last_used_at"),
        "expires_at": session.get("token_expires_at"),
        "rotated": session.get("rotated", False),
    }


@app.get("/api/admin/sessions")
async def get_all_sessions(current_user=Depends(require_admin)):
    """Get all active sessions (Admin only)."""
    sessions = db.list_sessions()
    return {
        "total_sessions": len(sessions),
        "sessions": sessions,
    }


@app.get("/api/me/devices")
async def get_my_devices(current_user=Depends(get_current_user)):
    """Get all devices for current user."""
    devices = db.get_user_devices(current_user.user_id)
    return {
        "total_devices": len(devices),
        "devices": devices,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
