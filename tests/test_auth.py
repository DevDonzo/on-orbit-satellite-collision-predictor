from jose import jwt

from core.auth import authenticate_user, create_access_token
from core.config import settings


def test_authenticate_demo_user_success() -> None:
    user = authenticate_user(settings.auth_demo_user, settings.auth_demo_password)
    assert user is not None
    assert user.username == settings.auth_demo_user


def test_authenticate_demo_user_failure() -> None:
    user = authenticate_user(settings.auth_demo_user, "incorrect-password")
    assert user is None


def test_jwt_contains_required_claims() -> None:
    token = create_access_token({"sub": settings.auth_demo_user})
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )
    assert payload["sub"] == settings.auth_demo_user
    assert payload["iss"] == settings.jwt_issuer
    assert payload["aud"] == settings.jwt_audience
    assert "jti" in payload
