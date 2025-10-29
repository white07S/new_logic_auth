"""Factory for creating per-user Azure OpenAI clients backed by Azure CLI creds."""

from __future__ import annotations

import os
import threading
from typing import Dict, Optional, Tuple

from azure.identity import AzureCliCredential
from openai import AzureOpenAI

import config
from azure_config import get_user_config_dir


_AZURE_SCOPE = "https://cognitiveservices.azure.com/.default"
_CLIENT_CACHE: Dict[Tuple[str, str, str, str], AzureOpenAI] = {}
_CREDENTIAL_CACHE: Dict[Tuple[str, str], AzureCliCredential] = {}
_CACHE_LOCK = threading.Lock()
_AZURE_ENV_LOCK = threading.Lock()


def _temporary_env(var_name: str, value: str):
    """Context manager to temporarily set an environment variable."""

    class _EnvGuard:
        def __enter__(self_nonlocal):
            self_nonlocal._orig = os.environ.get(var_name)
            os.environ[var_name] = value
            return None

        def __exit__(self_nonlocal, exc_type, exc, tb):
            if self_nonlocal._orig is None:
                os.environ.pop(var_name, None)
            else:
                os.environ[var_name] = self_nonlocal._orig

    return _EnvGuard()


def _build_token_provider(
    credential: AzureCliCredential,
    config_dir: str,
) -> callable:
    """Create a callable that obtains an Azure AD token using the CLI cache."""

    def _provider() -> str:
        with _AZURE_ENV_LOCK:
            with _temporary_env("AZURE_CONFIG_DIR", config_dir):
                token = credential.get_token(_AZURE_SCOPE)
        return token.token

    return _provider


def _get_or_create_credential(
    user_identifier: str,
    tenant_id: Optional[str],
    config_dir: str,
) -> AzureCliCredential:
    key = (user_identifier, tenant_id or "")
    with _CACHE_LOCK:
        credential = _CREDENTIAL_CACHE.get(key)
        if credential is not None:
            return credential

        with _AZURE_ENV_LOCK:
            with _temporary_env("AZURE_CONFIG_DIR", config_dir):
                credential = AzureCliCredential(tenant_id=tenant_id)
        _CREDENTIAL_CACHE[key] = credential
        return credential


def get_user_openai_client(
    user_identifier: str,
    *,
    tenant_id: Optional[str] = None,
    endpoint: Optional[str] = None,
    api_version: Optional[str] = None,
) -> AzureOpenAI:
    """Return a per-user Azure OpenAI client that refreshes via Azure CLI tokens."""

    if not user_identifier:
        raise ValueError("user_identifier is required")

    resolved_endpoint = (endpoint or config.AZURE_OPENAI_ENDPOINT).strip()
    if not resolved_endpoint:
        raise ValueError("An Azure OpenAI endpoint must be configured")

    resolved_api_version = (api_version or config.AZURE_OPENAI_API_VERSION).strip()
    resolved_tenant = (tenant_id or config.AZURE_OPENAI_TENANT_ID)

    user_config_dir = str(get_user_config_dir(user_identifier))

    cache_key = (user_identifier, resolved_endpoint, resolved_api_version, resolved_tenant or "")

    with _CACHE_LOCK:
        cached = _CLIENT_CACHE.get(cache_key)
        if cached is not None:
            return cached

        credential = _get_or_create_credential(
            user_identifier=user_identifier,
            tenant_id=resolved_tenant,
            config_dir=user_config_dir,
        )

        client = AzureOpenAI(
            azure_endpoint=resolved_endpoint,
            api_version=resolved_api_version,
            azure_ad_token_provider=_build_token_provider(
                credential=credential,
                config_dir=user_config_dir,
            ),
        )

        _CLIENT_CACHE[cache_key] = client
        return client
