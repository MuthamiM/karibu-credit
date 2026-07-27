"""
Redis cache layer for Karibu Credit.
Provides async Redis connection management and cache-aside helpers.
Uses redis.asyncio for non-blocking operations within the FastAPI async loop.
"""

import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── TTL Constants ────────────────────────────────────────────────────────
CACHE_TTL_SHORT = 60        # 1 minute  — volatile data (dashboard stats)
CACHE_TTL_MEDIUM = 300      # 5 minutes — list queries
CACHE_TTL_LONG = 3600       # 1 hour    — rarely-changing data (products, settings)

# ─── Singleton Pool ───────────────────────────────────────────────────────
_redis_pool: Optional[aioredis.Redis] = None

# ─── Cache Metrics (in-memory counters) ───────────────────────────────────
_cache_hits = 0
_cache_misses = 0


async def init_redis() -> aioredis.Redis:
    """Create and store a global Redis connection pool. Called on app startup."""
    global _redis_pool
    _redis_pool = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    # Verify connectivity
    await _redis_pool.ping()
    logger.info("Redis connected at %s", settings.REDIS_URL)
    return _redis_pool


async def close_redis() -> None:
    """Gracefully close the Redis connection pool. Called on app shutdown."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
        logger.info("Redis connection closed")


def get_redis() -> aioredis.Redis:
    """Return the active Redis connection. Raises if pool not initialised."""
    if _redis_pool is None:
        raise RuntimeError("Redis pool is not initialised. Call init_redis() first.")
    return _redis_pool


# ─── Cache Helpers ────────────────────────────────────────────────────────

async def cache_get(key: str) -> Optional[Any]:
    """
    Retrieve a cached value by key.
    Returns the deserialised Python object, or None on miss.
    """
    global _cache_hits, _cache_misses
    try:
        r = get_redis()
        raw = await r.get(key)
        if raw is not None:
            _cache_hits += 1
            return json.loads(raw)
        _cache_misses += 1
        return None
    except Exception as exc:
        logger.warning("cache_get(%s) failed: %s", key, exc)
        _cache_misses += 1
        return None


async def cache_set(key: str, value: Any, ttl: int = CACHE_TTL_MEDIUM) -> bool:
    """
    Store a value in Redis with an expiration TTL (seconds).
    The value is JSON-serialised before storage.
    """
    try:
        r = get_redis()
        await r.set(key, json.dumps(value, default=str), ex=ttl)
        return True
    except Exception as exc:
        logger.warning("cache_set(%s) failed: %s", key, exc)
        return False


async def cache_delete(key: str) -> bool:
    """Delete a single cache key."""
    try:
        r = get_redis()
        await r.delete(key)
        return True
    except Exception as exc:
        logger.warning("cache_delete(%s) failed: %s", key, exc)
        return False


async def cache_invalidate_pattern(pattern: str) -> int:
    """
    Delete all keys matching a glob pattern (e.g. 'loans:*').
    Returns the number of keys deleted.
    """
    try:
        r = get_redis()
        deleted = 0
        async for key in r.scan_iter(match=pattern, count=100):
            await r.delete(key)
            deleted += 1
        if deleted:
            logger.info("Invalidated %d keys matching '%s'", deleted, pattern)
        return deleted
    except Exception as exc:
        logger.warning("cache_invalidate_pattern(%s) failed: %s", pattern, exc)
        return 0


def cache_stats() -> dict:
    """Return current in-memory cache hit/miss counters."""
    total = _cache_hits + _cache_misses
    return {
        "hits": _cache_hits,
        "misses": _cache_misses,
        "total_requests": total,
        "hit_rate": f"{(_cache_hits / total * 100):.1f}%" if total > 0 else "N/A",
        "redis_url": settings.REDIS_URL,
    }
