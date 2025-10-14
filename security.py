"""
Security middleware and utilities for the application.

Implements CSRF protection, security headers, CSP, and other security measures.
"""

import hashlib
import hmac
import logging
import secrets
import time
from typing import Optional, Dict, Any

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

import config

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add security headers from config
        for header, value in config.SECURITY_HEADERS.items():
            response.headers[header] = value

        # Build CSP header
        csp_parts = []
        for directive, value in config.CSP_DIRECTIVES.items():
            csp_parts.append(f"{directive} {value}")
        response.headers["Content-Security-Policy"] = "; ".join(csp_parts)

        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection middleware using double-submit cookie pattern."""

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
    CSRF_HEADER = "X-CSRF-Token"
    CSRF_COOKIE_NAME = "csrf_token"

    def get_cookie_name(self) -> str:
        """Get the appropriate CSRF cookie name based on environment."""
        is_production = config.ENVIRONMENT == "production"
        return f"__Host-{self.CSRF_COOKIE_NAME}" if is_production else self.CSRF_COOKIE_NAME

    async def dispatch(self, request: Request, call_next):
        # Skip CSRF check for safe methods
        if request.method in self.SAFE_METHODS:
            return await call_next(request)

        # Skip CSRF for public auth endpoints
        path = request.url.path
        csrf_exempt_paths = [
            "/api/authorize/start",
            "/api/authorize/status",
            "/api/authorize/complete",
        ]
        if any(path.startswith(exempt) for exempt in csrf_exempt_paths):
            return await call_next(request)

        # Get CSRF token from cookie
        cookie_name = self.get_cookie_name()
        csrf_cookie = request.cookies.get(cookie_name)

        # Get CSRF token from header
        csrf_header = request.headers.get(self.CSRF_HEADER)

        # Validate CSRF token
        if not csrf_cookie or not csrf_header:
            logger.warning(
                f"CSRF validation failed - missing token. "
                f"Cookie present: {bool(csrf_cookie)}, Header present: {bool(csrf_header)}"
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF validation failed - missing token"}
            )

        if not hmac.compare_digest(csrf_cookie, csrf_header):
            logger.warning("CSRF validation failed - token mismatch")
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF validation failed - invalid token"}
            )

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware using in-memory storage."""

    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts: Dict[str, list] = {}

    def get_client_ip(self, request: Request) -> str:
        """Get the client IP address from the request."""
        # Check for X-Forwarded-For header (behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        # Fall back to client host
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        # Get client identifier
        client_ip = self.get_client_ip(request)
        current_time = time.time()

        # Initialize or get request timestamps for this client
        if client_ip not in self.request_counts:
            self.request_counts[client_ip] = []

        # Remove timestamps older than 1 minute
        self.request_counts[client_ip] = [
            timestamp for timestamp in self.request_counts[client_ip]
            if current_time - timestamp < 60
        ]

        # Check rate limit
        if len(self.request_counts[client_ip]) >= self.requests_per_minute:
            logger.warning(f"Rate limit exceeded for client {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded. Please try again later."}
            )

        # Add current request timestamp
        self.request_counts[client_ip].append(current_time)

        return await call_next(request)


class SessionRotationMiddleware(BaseHTTPMiddleware):
    """Middleware to handle session rotation on authentication changes."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Check if this is an authentication-related endpoint
        path = request.url.path
        auth_endpoints = ["/api/authorize/complete", "/api/auth/logout"]

        if path in auth_endpoints and response.status_code == 200:
            # Session rotation will be handled by the endpoint itself
            # This middleware can track session rotation events
            logger.info(f"Session rotation triggered for path: {path}")

        return response


def generate_csrf_token() -> str:
    """Generate a secure CSRF token."""
    return secrets.token_urlsafe(32)


def validate_csrf_token(request_token: str, session_token: str) -> bool:
    """Validate a CSRF token using constant-time comparison."""
    if not request_token or not session_token:
        return False
    return hmac.compare_digest(request_token, session_token)


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash a password using PBKDF2 with SHA256."""
    if salt is None:
        salt = secrets.token_hex(32)

    # Use PBKDF2 with 100,000 iterations
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )

    return key.hex(), salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    """Verify a password against its hash."""
    new_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(new_hash, hashed)


def sanitize_user_input(input_str: str, max_length: int = 1000) -> str:
    """Sanitize user input to prevent XSS and injection attacks."""
    if not input_str:
        return ""

    # Truncate to max length
    input_str = input_str[:max_length]

    # Remove any potential HTML/script tags
    dangerous_patterns = [
        '<script', '</script', '<iframe', '</iframe',
        'javascript:', 'onerror=', 'onload=', 'onclick='
    ]

    for pattern in dangerous_patterns:
        if pattern.lower() in input_str.lower():
            logger.warning(f"Potentially malicious input detected: {pattern}")
            input_str = input_str.replace(pattern, "")
            input_str = input_str.replace(pattern.upper(), "")

    return input_str


class AuditLogger:
    """Audit logger for security-sensitive events."""

    @staticmethod
    def log_authentication(email: str, success: bool, ip: str, reason: Optional[str] = None):
        """Log authentication attempts."""
        event = {
            "event": "authentication",
            "email": email,
            "success": success,
            "ip": ip,
            "timestamp": time.time(),
            "reason": reason
        }
        if success:
            logger.info(f"Authentication successful: {event}")
        else:
            logger.warning(f"Authentication failed: {event}")

    @staticmethod
    def log_authorization(email: str, resource: str, action: str, allowed: bool):
        """Log authorization decisions."""
        event = {
            "event": "authorization",
            "email": email,
            "resource": resource,
            "action": action,
            "allowed": allowed,
            "timestamp": time.time()
        }
        if allowed:
            logger.info(f"Authorization granted: {event}")
        else:
            logger.warning(f"Authorization denied: {event}")

    @staticmethod
    def log_session_event(event_type: str, session_id: str, details: Dict[str, Any]):
        """Log session-related events."""
        event = {
            "event": "session",
            "type": event_type,
            "session_id": session_id,
            "details": details,
            "timestamp": time.time()
        }
        logger.info(f"Session event: {event}")


# Export middleware classes and utilities
__all__ = [
    "SecurityHeadersMiddleware",
    "CSRFMiddleware",
    "RateLimitMiddleware",
    "SessionRotationMiddleware",
    "generate_csrf_token",
    "validate_csrf_token",
    "hash_password",
    "verify_password",
    "sanitize_user_input",
    "AuditLogger",
]