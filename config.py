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

# Session cookie lifetime (minutes)
GRAPH_TOKEN_TTL_MINUTES = int(os.getenv("GRAPH_TOKEN_TTL_MINUTES", "1440"))  # 24 hours

# Roles mapped to Azure AD group IDs
AZURE_ROLE_GROUP_MAPPING: Dict[str, List[str]] = {
    "admin": [gid for gid in os.getenv("AZURE_ADMIN_GROUP_IDS", "").split(",") if gid],
    "user": [gid for gid in os.getenv("AZURE_USER_GROUP_IDS", "").split(",") if gid],
}

# Optional default role assigned when no group mapping matches
DEFAULT_ROLE = os.getenv("DEFAULT_ROLE", "").strip()

# Security settings
CSRF_SECRET_KEY = os.getenv("CSRF_SECRET_KEY", secrets.token_hex(32))
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", secrets.token_hex(32))

# CORS settings
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
CORS_ALLOW_CREDENTIALS = True

# Azure OpenAI settings
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "")
AZURE_OPENAI_TENANT_ID = os.getenv("AZURE_OPENAI_TENANT_ID")

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
