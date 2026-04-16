import asyncio
import json
import logging
import math
import time
from abc import ABC, abstractmethod
from hashlib import sha256
from typing import Any

try:
    import redis.asyncio as redis
except ImportError:  # pragma: no cover - optional dependency at runtime
    redis = None

from core.config import settings

logger = logging.getLogger(__name__)

if redis is not None:
    RedisError = redis.exceptions.RedisError
else:
    class RedisError(Exception):
        pass


class CacheBackendError(RuntimeError):
    """Raised when a cache backend is unavailable or returns an operational error."""


class BaseCache(ABC):
    @abstractmethod
    async def get(self, key: str) -> Any | None:
        raise NotImplementedError

    @abstractmethod
    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        raise NotImplementedError

    @abstractmethod
    async def increment(self, key: str, amount: int, ttl_seconds: int) -> int:
        raise NotImplementedError

    @abstractmethod
    async def close(self) -> None:
        raise NotImplementedError


class InMemoryTTLCache(BaseCache):
    def __init__(self, max_entries: int) -> None:
        self._store: dict[str, tuple[Any, float]] = {}
        self._lock = asyncio.Lock()
        self._max_entries = max_entries

    async def _evict_if_needed(self) -> None:
        if len(self._store) < self._max_entries:
            return
        now = time.monotonic()
        expired_keys = [k for k, (_, expires_at) in self._store.items() if expires_at <= now]
        for key in expired_keys:
            self._store.pop(key, None)
        if len(self._store) < self._max_entries:
            return

        oldest_key = min(self._store.items(), key=lambda item: item[1][1])[0]
        self._store.pop(oldest_key, None)

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            record = self._store.get(key)
            if record is None:
                return None
            payload, expires_at = record
            if expires_at <= time.monotonic():
                self._store.pop(key, None)
                return None
            return payload

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        async with self._lock:
            await self._evict_if_needed()
            self._store[key] = (value, time.monotonic() + ttl_seconds)

    async def increment(self, key: str, amount: int, ttl_seconds: int) -> int:
        async with self._lock:
            now = time.monotonic()
            existing = self._store.get(key)
            if existing is None or existing[1] <= now:
                value = amount
                expires_at = now + ttl_seconds
            else:
                existing_value, expires_at = existing
                value = int(existing_value) + amount
            self._store[key] = (value, expires_at)
            return value

    async def close(self) -> None:
        async with self._lock:
            self._store.clear()


class RedisTTLCache(BaseCache):
    def __init__(self, url: str) -> None:
        if redis is None:
            raise RuntimeError("Redis package is unavailable. Install redis>=5.0.0.")
        self._client = redis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> Any | None:
        try:
            value = await self._client.get(key)
            if value is None:
                return None
            return json.loads(value)
        except RedisError as exc:
            raise CacheBackendError("Redis get failed.") from exc

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        try:
            await self._client.set(key, json.dumps(value), ex=ttl_seconds)
        except RedisError as exc:
            raise CacheBackendError("Redis set failed.") from exc

    async def increment(self, key: str, amount: int, ttl_seconds: int) -> int:
        try:
            value = await self._client.incrby(key, amount)
            if value == amount:
                await self._client.expire(key, ttl_seconds)
            return int(value)
        except RedisError as exc:
            raise CacheBackendError("Redis increment failed.") from exc

    async def close(self) -> None:
        try:
            await self._client.aclose()
        except RedisError as exc:
            raise CacheBackendError("Redis close failed.") from exc


class CacheClient:
    def __init__(self, backend: BaseCache, default_ttl: int, fallback_backend: BaseCache | None = None) -> None:
        self.backend = backend
        self.fallback_backend = fallback_backend
        self.default_ttl = default_ttl

    @staticmethod
    def _canonicalize(value: Any) -> Any:
        if isinstance(value, dict):
            return {k: CacheClient._canonicalize(v) for k, v in sorted(value.items(), key=lambda x: x[0])}
        if isinstance(value, list):
            return [CacheClient._canonicalize(v) for v in value]
        if isinstance(value, tuple):
            return [CacheClient._canonicalize(v) for v in value]
        if isinstance(value, float):
            if math.isnan(value) or math.isinf(value):
                return None
        return value

    @staticmethod
    def make_key(prefix: str, payload: Any) -> str:
        encoded = json.dumps(CacheClient._canonicalize(payload), sort_keys=True, default=str, allow_nan=False)
        digest = sha256(encoded.encode("utf-8")).hexdigest()
        return f"{prefix}:{digest}"

    async def get(self, key: str) -> Any | None:
        try:
            return await self.backend.get(key)
        except CacheBackendError:
            if self.fallback_backend is None:
                raise
            logger.warning("Primary cache backend failed on GET; using fallback cache.")
            return await self.fallback_backend.get(key)

    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        try:
            await self.backend.set(key, value, ttl_seconds or self.default_ttl)
        except CacheBackendError:
            if self.fallback_backend is None:
                raise
            logger.warning("Primary cache backend failed on SET; using fallback cache.")
            await self.fallback_backend.set(key, value, ttl_seconds or self.default_ttl)

    async def increment(self, key: str, amount: int = 1, ttl_seconds: int | None = None) -> int:
        try:
            return await self.backend.increment(key, amount, ttl_seconds or self.default_ttl)
        except CacheBackendError:
            if self.fallback_backend is None:
                raise
            logger.warning("Primary cache backend failed on INCR; using fallback cache.")
            return await self.fallback_backend.increment(key, amount, ttl_seconds or self.default_ttl)

    async def close(self) -> None:
        close_errors: list[Exception] = []
        try:
            await self.backend.close()
        except CacheBackendError as exc:
            close_errors.append(exc)
        if self.fallback_backend is not None:
            try:
                await self.fallback_backend.close()
            except CacheBackendError as exc:
                close_errors.append(exc)
        if close_errors:
            raise close_errors[0]


def build_cache_client() -> CacheClient:
    if settings.redis_url:
        backend: BaseCache = RedisTTLCache(settings.redis_url)
        fallback = InMemoryTTLCache(max_entries=settings.cache_max_entries)
        return CacheClient(
            backend=backend,
            default_ttl=settings.cache_ttl_seconds,
            fallback_backend=fallback,
        )
    backend = InMemoryTTLCache(max_entries=settings.cache_max_entries)
    return CacheClient(backend=backend, default_ttl=settings.cache_ttl_seconds)
