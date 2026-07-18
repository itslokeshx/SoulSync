"""
Thread-safe, self-cleaning cache service supporting both Upstash Redis REST API and in-memory storage.
"""
import os
import json
import logging
import hashlib
import urllib.request
import urllib.parse
import time
from typing import Optional, Any
from functools import wraps
from threading import Lock

logger = logging.getLogger("music-provider.cache")

# Thread-safe in-memory cache fallback
_memory_cache = {}
_memory_lock = Lock()

UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
USE_REDIS = bool(UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)

if USE_REDIS:
    logger.info("Cache service configured with Upstash Redis REST API")
else:
    logger.info("Cache service configured with in-memory storage")


def _redis_request(command: list) -> Optional[Any]:
    """Execute a Redis command via the Upstash REST API using urllib."""
    if not USE_REDIS:
        return None
    try:
        url = UPSTASH_REDIS_REST_URL.rstrip('/')
        # Upstash REST API expects command elements as JSON array in POST body
        req = urllib.request.Request(
            url,
            data=json.dumps(command).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if "error" in res_data:
                logger.error(f"Upstash Redis REST error: {res_data['error']}")
                return None
            return res_data.get("result")
    except Exception as e:
        logger.error(f"Upstash Redis REST call failed: {e}")
        return None


def get_cached(key: str) -> Optional[Any]:
    """Get a value from cache."""
    # 1. Try Redis first
    if USE_REDIS:
        result = _redis_request(["GET", key])
        if result is not None:
            try:
                return json.loads(result)
            except Exception:
                pass

    # 2. Fallback/Try in-memory
    with _memory_lock:
        entry = _memory_cache.get(key)
        if entry:
            val_str, expires_at = entry
            if expires_at is None or time.time() < expires_at:
                try:
                    return json.loads(val_str)
                except Exception:
                    pass
            else:
                del _memory_cache[key]
    return None


def set_cached(key: str, value: Any, ttl_seconds: int = 1800) -> None:
    """Set a value in the cache with a TTL (default: 30 minutes)."""
    try:
        val_str = json.dumps(value)
    except Exception as e:
        logger.error(f"Failed to serialize value for cache key {key}: {e}")
        return

    # 1. Set in Redis
    if USE_REDIS:
        _redis_request(["SET", key, val_str, "EX", str(ttl_seconds)])

    # 2. Set in-memory
    with _memory_lock:
        expires_at = time.time() + ttl_seconds
        _memory_cache[key] = (val_str, expires_at)


def cache_response(ttl_seconds: int = 1800, prefix: str = ""):
    """
    Decorator to cache route or function responses.
    Automatically generates unique cache keys based on function arguments.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create a unique key from function name, arguments, and keyword arguments
            # We stringify args and sort kwargs for consistency
            arg_str = f"{func.__name__}:{args}:{sorted(kwargs.items())}"
            h = hashlib.md5(arg_str.encode("utf-8")).hexdigest()
            key = f"mp:{prefix or func.__name__}:{h}"

            cached_val = get_cached(key)
            if cached_val is not None:
                # logger.debug(f"Cache HIT for key: {key}")
                return cached_val

            # logger.debug(f"Cache MISS for key: {key}")
            result = func(*args, **kwargs)
            set_cached(key, result, ttl_seconds)
            return result
        return wrapper
    return decorator
