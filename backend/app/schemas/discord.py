from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict

# --- Servidores ---
class ServerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Nome do servidor")
    icon_url: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=255)

class ServerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon_url: Optional[str] = Field(None, max_length=500)
    banner_url: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=255)

class ChannelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    server_id: int
    name: str
    type: str  # TEXT ou VOICE
    category: str
    position: int
    is_private: bool = False
    allowed_role_ids: List[int] = []
    created_at: datetime

class ServerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    icon_url: Optional[str] = None
    banner_url: Optional[str] = None
    description: Optional[str] = None
    owner_id: int
    created_at: datetime
    channels: List[ChannelResponse] = []
    members_count: int = 1

# --- Canais ---
class ChannelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field("TEXT", pattern="^(TEXT|VOICE)$")
    category: str = Field("Canais de Texto", max_length=100)
    position: Optional[int] = 0
    is_private: Optional[bool] = False
    allowed_role_ids: Optional[List[int]] = []

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        # Padroniza nomes de canais de texto com hífens e minúsculas
        return v.strip().lower().replace(" ", "-")

class ChannelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    position: Optional[int] = None
    is_private: Optional[bool] = None
    allowed_role_ids: Optional[List[int]] = None

# --- Mensagens ---
MAX_MESSAGE_CONTENT_LENGTH = 2000
MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

class MessageCreate(BaseModel):
    content: Optional[str] = Field("", max_length=MAX_MESSAGE_CONTENT_LENGTH)
    attachment_url: Optional[str] = Field(None, max_length=500)
    attachment_type: Optional[str] = Field(None, max_length=50)
    attachment_size: Optional[int] = Field(None, le=MAX_ATTACHMENT_SIZE_BYTES)
    reply_to_id: Optional[int] = None

class ReactionSummary(BaseModel):
    emoji: str
    count: int
    user_ids: List[int] = []
    reacted_by_me: bool = False

class ReactionCreate(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=32)

class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CONTENT_LENGTH)

class MessageForwardRequest(BaseModel):
    target_channel_id: int

class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    channel_id: int
    author_id: int
    author_name: str
    author_email: str
    author_avatar_url: Optional[str] = None
    content: Optional[str] = ""
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_size: Optional[int] = None
    reply_to_id: Optional[int] = None
    is_edited: bool = False
    is_pinned: bool = False
    reactions: List[ReactionSummary] = []
    author_role_color: Optional[str] = None
    author_role_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# --- Cargos (Roles) ---
class ServerRoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field("#99aab5", max_length=20)
    position: Optional[int] = 0
    is_admin: Optional[bool] = False
    hoist: Optional[bool] = True

class ServerRoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, max_length=20)
    position: Optional[int] = None
    is_admin: Optional[bool] = None
    hoist: Optional[bool] = None

class ServerRoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    server_id: int
    name: str
    color: str
    position: int
    is_admin: bool
    hoist: bool
    created_at: datetime
    members_count: int = 0

class ServerMemberRoleUpdate(BaseModel):
    role_id: Optional[int] = None


# --- Membros ---
class ServerMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    server_id: int
    user_id: int
    name: str
    email: str
    avatar_url: Optional[str] = None
    nickname: Optional[str] = None
    role: str  # OWNER, ADMIN, MEMBER
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    role_color: Optional[str] = None
    joined_at: datetime

# --- Convites ---
class ServerInviteCreate(BaseModel):
    max_uses: Optional[int] = Field(None, ge=1, le=1000)
    expires_in_hours: Optional[int] = Field(24, ge=1, le=720)

class ServerInviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    server_id: int
    server_name: str
    code: str
    max_uses: Optional[int] = None
    current_uses: int
    expires_at: Optional[datetime] = None
    created_at: datetime


class ServerInvitePublicInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    server_id: int
    server_name: str
    server_icon: Optional[str] = None
    members_count: int = 1
    expires_at: Optional[datetime] = None
    is_expired: bool = False
    inviter_name: Optional[str] = None


# --- Mensagens Diretas (DMs) ---
class DMConversationCreate(BaseModel):
    target_user_id: int


class DMUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    avatar_url: Optional[str] = None
    is_active: bool


class DMConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    other_user: DMUserSummary
    last_message: Optional[MessageResponse] = None
    created_at: datetime
    updated_at: datetime


# --- Busca de Mensagens ---
class MessageSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total: int
    channel_id: Optional[int] = None
    server_id: Optional[int] = None
    conversation_id: Optional[int] = None
    query: Optional[str] = None
    messages: List[MessageResponse] = []


