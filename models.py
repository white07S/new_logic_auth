from pydantic import BaseModel
from typing import Optional, List

# Azure Auth Models
class AuthStartResponse(BaseModel):
    session_id: str
    user_code: str
    verification_uri: str

class AuthStatusResponse(BaseModel):
    status: str  # 'pending', 'completed', 'timeout', 'error'
    authorized: Optional[bool] = None
    email: Optional[str] = None
    user_name: Optional[str] = None
    message: Optional[str] = None

class AuthCompleteRequest(BaseModel):
    session_id: str
    fingerprint: str

# Token Models
class TokenData(BaseModel):
    email: str
    username: str
    roles: List[str]
    session_id: str
    azure_object_id: str
    azure_tenant_id: Optional[str] = None
    azure_config_dir: str
    user_identifier: str
    fingerprint: Optional[str] = None
    created_at: str
    last_seen_at: Optional[str] = None

class AzureChatRequest(BaseModel):
    message: str

# User Models
class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    roles: List[str]
    is_active: bool = True
    created_at: str
    last_seen_at: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    username: str
    roles: List[str]

# Device Models
class DeviceInfo(BaseModel):
    fingerprint: str
    created_at: str
    last_seen_at: Optional[str] = None
