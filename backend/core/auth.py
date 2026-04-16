from datetime import datetime, timedelta, timezone
import json
from typing import Annotated, Any
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from core.config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=settings.token_url)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    username: str | None = None


class User(BaseModel):
    username: str
    disabled: bool = False


class UserRecord(BaseModel):
    username: str
    hashed_password: str
    disabled: bool = False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _build_user_db() -> dict[str, UserRecord]:
    if settings.auth_users_json:
        loaded = json.loads(settings.auth_users_json)
        if not isinstance(loaded, list):
            raise ValueError("SCP_AUTH_USERS_JSON must be a JSON array of user records.")
        users = [UserRecord.model_validate(item) for item in loaded]
        if not users:
            raise ValueError("SCP_AUTH_USERS_JSON cannot be an empty array.")
        return {user.username: user for user in users}

    demo_user = UserRecord(
        username=settings.auth_demo_user,
        hashed_password=get_password_hash(settings.auth_demo_password),
        disabled=False,
    )
    return {demo_user.username: demo_user}


_USER_DB: dict[str, UserRecord] = _build_user_db()


def authenticate_user(username: str, password: str) -> User | None:
    user_record = _USER_DB.get(username.strip())
    if user_record is None:
        return None
    if not verify_password(password, user_record.hashed_password):
        return None
    return User(username=user_record.username, disabled=user_record.disabled)


def create_access_token(
    data: dict[str, Any], expires_delta: timedelta | None = None
) -> str:
    payload = data.copy()
    expire_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload.update(
        {
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "iat": datetime.now(timezone.utc),
            "nbf": datetime.now(timezone.utc),
            "exp": expire_at,
            "jti": str(uuid4()),
        }
    )
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def get_access_token_ttl_seconds() -> int:
    return settings.access_token_expire_minutes * 60


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    credential_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
        )
        username = payload.get("sub")
        if username is None:
            raise credential_exception
        token_data = TokenData(username=username)
    except JWTError as exc:
        raise credential_exception from exc

    user_record = _USER_DB.get((token_data.username or "").strip())
    if user_record is None:
        raise credential_exception
    return User(username=user_record.username, disabled=user_record.disabled)


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
