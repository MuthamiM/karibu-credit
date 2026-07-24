from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None, extra_claims: dict = None
) -> str:
    """
    Creates a JSON Web Token (JWT) for user authentication.
    
    Args:
        subject: The unique identifier for the user (usually user ID).
        expires_delta: Optional custom expiration time.
        extra_claims: Optional dictionary of additional claims (e.g. {"purpose": "password_reset"}).
        
    Returns:
        A signed JWT string.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {"exp": expire, "sub": str(subject)}
    if extra_claims:
        to_encode.update(extra_claims)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against its hashed version.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Generates a secure bcrypt hash for a given plaintext password.
    """
    return pwd_context.hash(password)

def decode_access_token(token: str) -> int:
    """
    Decodes a JWT and returns the user ID stored in its subject claim.
    Raises jose.JWTError if the token is invalid, tampered, or expired.
    """
    payload = decode_token_payload(token)
    return int(payload["sub"])

def decode_token_payload(token: str) -> dict:
    """
    Decodes a JWT and returns the full payload dictionary.
    Raises jose.JWTError if the token is invalid, tampered, or expired.
    """
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    return payload
