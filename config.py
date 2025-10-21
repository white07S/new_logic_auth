import os
import secrets
from pathlib import Path
from typing import Dict, List

# Environment configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")  # development | production

# Azure CLI session isolation
AZURE_CONFIG_BASE_DIR = Path(os.getenv("AZURE_CONFIG_BASE_DIR", "/tmp/azcfg"))

# Azure login
AZ_LOGIN_TIMEOUT = int(os.getenv("AZ_LOGIN_TIMEOUT", "300"))

# Microsoft Graph access
GRAPH_RESOURCE = os.getenv("GRAPH_RESOURCE", "https://graph.microsoft.com")
GRAPH_TOKEN_TTL_MINUTES = int(os.getenv("GRAPH_TOKEN_TTL_MINUTES", "1440"))  # 24 hours

# Refresh token configuration
REFRESH_TOKEN_TTL_MINUTES = int(os.getenv("REFRESH_TOKEN_TTL_MINUTES", "10080"))  # 7 days
ACCESS_TOKEN_TTL_MINUTES = int(os.getenv("ACCESS_TOKEN_TTL_MINUTES", "15"))  # 15 minutes

# Database (TinyDB JSON file)
DATABASE_FILE = os.getenv("DATABASE_FILE", "auth_system.json")

# Roles mapped to Azure AD group IDs
AZURE_ROLE_GROUP_MAPPING: Dict[str, List[str]] = {
    "admin": [gid for gid in os.getenv("AZURE_ADMIN_GROUP_IDS", "").split(",") if gid],
    "user": [gid for gid in os.getenv("AZURE_USER_GROUP_IDS", "").split(",") if gid],
}

# Default role assigned when no group mapping matches
# Empty string disables automatic authorization so users without mapped roles remain unauthorized
DEFAULT_ROLE = os.getenv("DEFAULT_ROLE", "").strip()

# Security settings
CSRF_SECRET_KEY = os.getenv("CSRF_SECRET_KEY", secrets.token_hex(32))
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", secrets.token_hex(32))

# CORS settings
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
CORS_ALLOW_CREDENTIALS = True

# Security headers configuration
SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
}

# Content Security Policy
CSP_DIRECTIVES = {
    "default-src": "'self'",
    "script-src": "'self' 'unsafe-inline'",  # Will tighten this with nonces
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: https:",
    "font-src": "'self' data:",
    "connect-src": "'self'",
    "frame-ancestors": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'"
}
