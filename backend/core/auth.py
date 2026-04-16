from __future__ import annotations

import os


def get_api_token() -> str:
    return os.getenv("SAT_API_TOKEN", "student-demo-token")


def is_valid_token(token: str) -> bool:
    return token == get_api_token()
