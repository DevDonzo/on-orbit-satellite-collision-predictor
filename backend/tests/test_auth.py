from core.auth import get_api_token, is_valid_token


def test_default_token_is_valid() -> None:
    token = get_api_token()
    assert is_valid_token(token)


def test_wrong_token_is_invalid() -> None:
    assert not is_valid_token("wrong-token")
