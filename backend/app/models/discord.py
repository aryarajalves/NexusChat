from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    icon_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    description = Column(String(255), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now)

    owner = relationship("User", foreign_keys=[owner_id])
    channels = relationship("Channel", back_populates="server", cascade="all, delete-orphan", order_by="Channel.position")
    members = relationship("ServerMember", back_populates="server", cascade="all, delete-orphan")
    invites = relationship("ServerInvite", back_populates="server", cascade="all, delete-orphan")
    roles = relationship("ServerRole", back_populates="server", cascade="all, delete-orphan", order_by="ServerRole.position")


class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(20), default="TEXT", nullable=False)  # "TEXT", "VOICE"
    category = Column(String(100), default="Canais de Texto", nullable=False)
    position = Column(Integer, default=0, nullable=False)
    is_private = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    server = relationship("Server", back_populates="channels")
    messages = relationship("Message", back_populates="channel", cascade="all, delete-orphan", order_by="Message.id")
    allowed_roles = relationship("ChannelRolePermission", back_populates="channel", cascade="all, delete-orphan")


class ChannelRolePermission(Base):
    __tablename__ = "channel_role_permissions"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("server_roles.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        UniqueConstraint("channel_id", "role_id", name="uq_channel_role"),
        Index("idx_channel_role_channel_id", "channel_id"),
        Index("idx_channel_role_role_id", "role_id"),
    )

    channel = relationship("Channel", back_populates="allowed_roles")
    role = relationship("ServerRole", back_populates="channel_permissions")


class ServerRole(Base):
    __tablename__ = "server_roles"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(20), default="#99aab5", nullable=False)
    position = Column(Integer, default=0, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    hoist = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now)

    server = relationship("Server", back_populates="roles")
    members = relationship("ServerMember", back_populates="custom_role")
    channel_permissions = relationship("ChannelRolePermission", back_populates="role", cascade="all, delete-orphan")


class ServerMember(Base):
    __tablename__ = "server_members"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    nickname = Column(String(100), nullable=True)
    role = Column(String(20), default="MEMBER", nullable=False)  # "OWNER", "ADMIN", "MEMBER"
    role_id = Column(Integer, ForeignKey("server_roles.id", ondelete="SET NULL"), nullable=True, index=True)
    joined_at = Column(DateTime, default=utc_now)

    server = relationship("Server", back_populates="members")
    user = relationship("User")
    custom_role = relationship("ServerRole", back_populates="members", foreign_keys=[role_id])


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(String(2000), nullable=False)
    attachment_url = Column(String(500), nullable=True)
    attachment_type = Column(String(50), nullable=True)
    attachment_size = Column(Integer, nullable=True)  # Em bytes (máximo 50MB = 52428800)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    is_edited = Column(Boolean, default=False, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_messages_channel_id_id", "channel_id", "id"),
    )

    channel = relationship("Channel", back_populates="messages")
    author = relationship("User")
    reply_to = relationship("Message", remote_side=[id])
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")


class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    emoji = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=utc_now)

    message = relationship("Message", back_populates="reactions")
    user = relationship("User")


class ServerInvite(Base):
    __tablename__ = "server_invites"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    max_uses = Column(Integer, nullable=True)  # None = ilimitado
    current_uses = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    server = relationship("Server", back_populates="invites")
    created_by = relationship("User")


class DMConversation(Base):
    __tablename__ = "dm_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user2_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint('user1_id', 'user2_id', name='uq_dm_conversation_users'),
    )

    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    messages = relationship("DMMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="DMMessage.id")


class DMMessage(Base):
    __tablename__ = "dm_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("dm_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(String(2000), nullable=False)
    attachment_url = Column(String(500), nullable=True)
    attachment_type = Column(String(50), nullable=True)
    attachment_size = Column(Integer, nullable=True)  # Em bytes
    reply_to_id = Column(Integer, ForeignKey("dm_messages.id"), nullable=True)
    is_edited = Column(Boolean, default=False, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_dm_messages_conversation_id_id", "conversation_id", "id"),
    )

    conversation = relationship("DMConversation", back_populates="messages")
    author = relationship("User")
    reply_to = relationship("DMMessage", remote_side=[id])
    reactions = relationship("DMMessageReaction", back_populates="message", cascade="all, delete-orphan")


class DMMessageReaction(Base):
    __tablename__ = "dm_message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("dm_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    emoji = Column(String(32), nullable=False)
    created_at = Column(DateTime, default=utc_now)

    message = relationship("DMMessage", back_populates="reactions")
    user = relationship("User")


class ChannelReadState(Base):
    __tablename__ = "channel_read_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    last_read_message_id = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("user_id", "channel_id", name="uq_channel_read_state_user_channel"),
    )


class DMReadState(Base):
    __tablename__ = "dm_read_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("dm_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    last_read_message_id = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("user_id", "conversation_id", name="uq_dm_read_state_user_conversation"),
    )


