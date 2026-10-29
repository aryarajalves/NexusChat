import re
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional, Literal, List
from datetime import datetime

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError("A nova senha deve ter pelo menos 12 caracteres.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("A nova senha deve conter pelo menos uma letra maiúscula.")
        if not re.search(r"[a-z]", v):
            raise ValueError("A nova senha deve conter pelo menos uma letra minúscula.")
        if not re.search(r"\d", v):
            raise ValueError("A nova senha deve conter pelo menos um número.")
        if not re.search(r"[\W_]", v):
            raise ValueError("A nova senha deve conter pelo menos um caractere especial.")
        return v

class UserUpdate(BaseModel):
    role: Literal["admin", "user"]

class BulkDeleteRequest(BaseModel):
    ids: List[int]

class InviteCreate(BaseModel):
    role: Literal["admin", "user"]
    duration_hours: int = 24  # tempo para expirar o convite

class InviteResponse(BaseModel):
    id: int
    token: str
    role: str
    expires_at: datetime
    is_used: bool
    created_at: datetime
    invite_url: Optional[str] = None
    is_expired: Optional[bool] = False
    time_remaining: Optional[str] = None
    used_by_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class InviteValidateResponse(BaseModel):
    valid: bool
    role: Optional[str] = None
    detail: Optional[str] = None

def validate_password_strength_func(v: str) -> str:
    if len(v) < 12:
        raise ValueError("A senha deve ter no mínimo 12 caracteres.")
    if not re.search(r"[A-Z]", v):
        raise ValueError("A senha deve conter ao menos 1 letra maiúscula.")
    if not re.search(r"[a-z]", v):
        raise ValueError("A senha deve conter ao menos 1 letra minúscula.")
    if not re.search(r"\d", v):
        raise ValueError("A senha deve conter ao menos 1 número.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\/`~]", v):
        raise ValueError("A senha deve conter ao menos 1 caractere especial.")
    return v

class RegisterWithInvite(BaseModel):
    token: str
    name: str
    email: EmailStr
    password: str
    password_confirm: Optional[str] = None

    @field_validator("password")
    def validate_password_strength(cls, v: str) -> str:
        return validate_password_strength_func(v)

class RegisterInitiateResponse(BaseModel):
    message: str
    email: str
    requires_verification: bool = True

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str

class ResendCodeRequest(BaseModel):
    email: EmailStr
    invite_token: str


class PasswordResetRequestResponse(BaseModel):
    reset_url: str
    token: str
    expires_at: datetime
    user_email: str
    user_name: str

class PasswordResetConfirm(BaseModel):
    token: str
    password: str
    password_confirm: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return validate_password_strength_func(v)

class PasswordResetValidateResponse(BaseModel):
    valid: bool
    email: Optional[str] = None
    name: Optional[str] = None
    detail: Optional[str] = None

class UserCreateManual(BaseModel):
    name: str
    email: EmailStr
    password: str
    password_confirm: Optional[str] = None
    role: Literal["admin", "user"] = "user"

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return validate_password_strength_func(v)

