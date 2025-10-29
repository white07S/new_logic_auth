"""Utilities for managing per-user Azure CLI configuration directories."""

from __future__ import annotations

import os
import re
from pathlib import Path

import config


_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9_.-]+")


def sanitize_identifier(identifier: str) -> str:
    """Return a filesystem-safe identifier string."""

    if not identifier:
        return "anonymous"

    sanitized = _SANITIZE_PATTERN.sub("_", identifier.strip().lower())
    return sanitized or "anonymous"


def get_user_config_dir(identifier: str, *, create: bool = True) -> Path:
    """Return the path to the Azure CLI config dir for the given user.

    The directory is created if it does not already exist and permissions are
    restricted to the current user for safety.
    """

    base_dir = config.AZURE_CONFIG_BASE_DIR / "users"
    if create:
        base_dir.mkdir(parents=True, exist_ok=True)

    user_dir = base_dir / sanitize_identifier(identifier)

    if create:
        user_dir.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(user_dir, 0o700)
        except PermissionError:
            # On some filesystems chmod may be restricted (e.g. Windows). Ignore.
            pass

    return user_dir
