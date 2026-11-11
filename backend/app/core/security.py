import hmac
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from jose import jwt
from app.core.config import settings

# Argon2id hasher com custo de memória configurado (padrão de memória 64MB = 65536 KiB, 3 iterações)
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB de memória RAM
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID  # Argon2id
)

def _apply_pepper(password: str) -> str:
    """
    Aplica pepper secreto via HMAC-SHA256 antes de calcular o hash Argon2id.
    Isso impede que atacantes que obtenham um dump do banco consigam quebrar os hashes
    sem ter a chave secreta do servidor (pepper).
    """
    pepper_key = settings.SECURITY_PASSWORD_PEPPER.encode("utf-8")
    return hmac.new(pepper_key, password.encode("utf-8"), hashlib.sha256).hexdigest()

def get_password_hash(password: str) -> str:
    peppered = _apply_pepper(password)
    return ph.hash(peppered)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    peppered = _apply_pepper(plain_password)
    try:
        return ph.verify(hashed_password, peppered)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        # Fallback para senhas salvas anteriormente com bcrypt (para retrocompatibilidade)
        try:
            import bcrypt
            password_bytes = plain_password[:72].encode("utf-8")
            hashed_bytes = hashed_password.encode("utf-8")
            return bcrypt.checkpw(password_bytes, hashed_bytes)
        except Exception:
            return False
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": int(now.timestamp()),
        "jti": str(uuid.uuid4()),
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except Exception:
        return None
