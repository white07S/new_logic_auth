"""In-memory session store for authenticated Azure CLI users."""

from __future__ import annotations

import secrets
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class SessionRecord:
    session_id: str
    email: str
    username: str
    roles: List[str]
    azure_object_id: str
    azure_tenant_id: Optional[str]
    azure_config_dir: str
    user_identifier: str
    fingerprint: Optional[str]
    created_at: str
    last_seen_at: str


_SESSIONS: Dict[str, SessionRecord] = {}


def create_session(
    *,
    email: str,
    username: str,
    roles: List[str],
    azure_object_id: str,
    azure_tenant_id: Optional[str],
    azure_config_dir: str,
    user_identifier: str,
    fingerprint: Optional[str] = None,
) -> SessionRecord:
    """Create and cache a new authenticated session."""

    session_id = secrets.token_urlsafe(32)
    now = datetime.utcnow().isoformat()
    record = SessionRecord(
        session_id=session_id,
        email=email,
        username=username,
        roles=sorted(set(roles)),
        azure_object_id=azure_object_id,
        azure_tenant_id=azure_tenant_id,
        azure_config_dir=azure_config_dir,
        user_identifier=user_identifier,
        fingerprint=fingerprint,
        created_at=now,
        last_seen_at=now,
    )
    _SESSIONS[session_id] = record
    return record


def get_session(session_id: str) -> Optional[SessionRecord]:
    record = _SESSIONS.get(session_id)
    if record:
        touch_session(session_id)
    return record


def touch_session(session_id: str) -> None:
    if session_id in _SESSIONS:
        _SESSIONS[session_id].last_seen_at = datetime.utcnow().isoformat()


def delete_session(session_id: str) -> Optional[SessionRecord]:
    return _SESSIONS.pop(session_id, None)


def delete_sessions_by_fingerprint(fingerprint: str) -> int:
    to_remove = [sid for sid, record in _SESSIONS.items() if record.fingerprint == fingerprint]
    for sid in to_remove:
        _SESSIONS.pop(sid, None)
    return len(to_remove)


def list_sessions() -> List[dict]:
    return [asdict(record) for record in _SESSIONS.values()]


def get_sessions_for_user(azure_object_id: str) -> List[dict]:
    return [
        asdict(record)
        for record in _SESSIONS.values()
        if record.azure_object_id == azure_object_id
    ]
