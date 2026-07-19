"""
Singleton YTMusic instance manager with retry logic.
"""
import os
import time
import logging
from typing import Optional
from pathlib import Path
from functools import wraps

from ytmusicapi import YTMusic
from fastapi import HTTPException

logger = logging.getLogger("music-provider")

_client: Optional[YTMusic] = None


import requests
from requests.adapters import HTTPAdapter

class TimeoutHTTPAdapter(HTTPAdapter):
    def __init__(self, *args, timeout=10, **kwargs):
        self.timeout = timeout
        super().__init__(*args, **kwargs)

    def send(self, request, **kwargs):
        if "timeout" not in kwargs or kwargs["timeout"] is None:
            kwargs["timeout"] = self.timeout
        return super().send(request, **kwargs)

def create_session() -> requests.Session:
    session = requests.Session()
    adapter = TimeoutHTTPAdapter(pool_connections=40, pool_maxsize=40, timeout=10)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session



def get_client() -> YTMusic:
    """
    Get or create the singleton YTMusic instance.

    Auth priority:
    1. oauth.json (authenticated — full API access)
    2. Browser auth (guest mode — public endpoints only)
    """
    global _client
    if _client is not None:
        return _client

    oauth_path = Path(__file__).parent.parent / "oauth.json"
    auth_type = os.getenv("YTMUSIC_AUTH_TYPE", "guest")
    session = create_session()

    try:
        if auth_type == "oauth" and oauth_path.exists():
            _client = YTMusic(str(oauth_path), requests_session=session)
            logger.info("YTMusic initialized with OAuth authentication and custom session pool")
        else:
            _client = YTMusic(requests_session=session)
            logger.info("YTMusic initialized in guest/browser mode and custom session pool")
    except Exception as e:
        logger.warning(f"Primary YTMusic init failed ({e}), falling back to guest mode")
        try:
            _client = YTMusic()
            logger.info("YTMusic initialized in guest mode (fallback)")
        except Exception as e2:
            logger.error(f"All YTMusic init methods failed: {e2}")
            raise HTTPException(status_code=503, detail="YouTube Music service unavailable")

    return _client


from threading import Semaphore

# Limit to 10 concurrent outbound YouTube Music calls across all threads
_yt_semaphore = Semaphore(10)


def with_retry(max_retries: int = 3, base_delay: float = 0.5):
    """
    Decorator that adds retry logic with exponential backoff.
    On permanent failure, raises HTTPException(503).
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            with _yt_semaphore:
                for attempt in range(max_retries):
                    try:
                        return func(*args, **kwargs)
                    except HTTPException:
                        raise  # Don't retry HTTP exceptions we raise ourselves
                    except Exception as e:
                        last_error = e
                        if attempt < max_retries - 1:
                            delay = base_delay * (2 ** attempt)
                            logger.warning(
                                f"[{func.__name__}] Attempt {attempt + 1}/{max_retries} "
                                f"failed: {e}. Retrying in {delay:.1f}s..."
                            )
                            time.sleep(delay)
                        else:
                            logger.error(
                                f"[{func.__name__}] All {max_retries} attempts failed: {e}"
                            )
            raise HTTPException(
                status_code=503,
                detail=f"YouTube Music service error: {str(last_error)[:200]}",
            )
        return wrapper
    return decorator
