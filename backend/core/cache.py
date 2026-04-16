from __future__ import annotations

import time
from typing import Any


class SimpleTTLCache:
    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        value = self._store.get(key)
        if value is None:
            return None
        payload, expires_at = value
        if expires_at < time.time():
            self._store.pop(key, None)
            return None
        return payload

    def set(self, key: str, payload: Any, ttl_seconds: int) -> None:
        self._store[key] = (payload, time.time() + ttl_seconds)
