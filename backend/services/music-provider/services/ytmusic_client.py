import os
import time
import random
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
    adapter = TimeoutHTTPAdapter(pool_connections=15, pool_maxsize=15, timeout=10)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://music.youtube.com",
        "Referer": "https://music.youtube.com/",
    })
    
    import http.cookiejar
    from pathlib import Path
    
    readonly_cookies = "/etc/secrets/cookies.txt"
    writable_cookies = "/tmp/cookies.txt"
    local_cookies = Path(__file__).parent.parent / "cookies.txt"
    
    cookies_path = None
    if os.path.exists(readonly_cookies):
        cookies_path = readonly_cookies
    elif os.path.exists(writable_cookies):
        cookies_path = writable_cookies
    elif local_cookies.exists():
        cookies_path = str(local_cookies)
        
    if cookies_path:
        try:
            cj = http.cookiejar.MozillaCookieJar(cookies_path)
            cj.load(ignore_discard=True, ignore_expires=True)
            session.cookies.update(cj)
            logger.info(f"Successfully loaded Netscape cookies from {cookies_path} into YTMusic session")
        except Exception as e:
            logger.error(f"Failed to load Netscape cookies into YTMusic session: {e}")
            
    return session



_last_reset_time: float = 0.0
_RESET_COOLDOWN_SECONDS = 2.0


def reset_client_to_guest():
    global _client, _last_reset_time
    now = time.monotonic()
    if now - _last_reset_time < _RESET_COOLDOWN_SECONDS:
        return
    _last_reset_time = now

    logger.warning("Resetting YTMusic client to guest mode fallback due to auth/parse failure")
    try:
        session = create_session()
        session.cookies.clear()
        _client = YTMusic(requests_session=session)
        logger.info("YTMusic client successfully reset to clean guest mode")
    except Exception as e:
        logger.error(f"Failed to reset YTMusic client to guest mode: {e}")
        _client = None


def get_client() -> YTMusic:
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


from threading import Semaphore, Lock

_yt_semaphore = Semaphore(10)
_throttle_lock = Lock()
_last_request_time: float = 0.0

_breaker_lock = Lock()
_consecutive_failures = 0
_breaker_tripped_until: float = 0.0
_BREAKER_THRESHOLD = 5
_BREAKER_COOLDOWN_SECONDS = 10.0


def _record_failure():
    global _consecutive_failures, _breaker_tripped_until
    with _breaker_lock:
        _consecutive_failures += 1
        if _consecutive_failures >= _BREAKER_THRESHOLD:
            _breaker_tripped_until = time.monotonic() + _BREAKER_COOLDOWN_SECONDS
            logger.error(
                f"[circuit-breaker] Tripped after {_consecutive_failures} consecutive "
                f"failures — failing fast for {_BREAKER_COOLDOWN_SECONDS:.0f}s"
            )


def _record_success():
    global _consecutive_failures
    with _breaker_lock:
        _consecutive_failures = 0


def _breaker_is_open() -> bool:
    return time.monotonic() < _breaker_tripped_until


def with_retry(max_retries: int = 2, base_delay: float = 0.2):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            global _last_request_time
            if _breaker_is_open():
                raise HTTPException(
                    status_code=503,
                    detail="YouTube Music service temporarily degraded — failing fast, retry shortly",
                )

            last_error = None
            acquired = _yt_semaphore.acquire(timeout=3)
            if not acquired:
                raise HTTPException(
                    status_code=503,
                    detail="Service overloaded — too many concurrent requests",
                )
            try:
                for attempt in range(max_retries):
                    try:
                        with _throttle_lock:
                            now = time.monotonic()
                            diff = now - _last_request_time
                            if diff < 0.1:
                                time.sleep(0.1 - diff)
                            _last_request_time = time.monotonic()
                        result = func(*args, **kwargs)
                        _record_success()
                        return result
                    except HTTPException:
                        raise
                    except Exception as e:
                        last_error = e
                        err_str = str(e).lower()
                        is_auth_or_parse_fail = (
                            "unauthorized" in err_str or
                            "auth" in err_str or
                            "login" in err_str or
                            "sign in" in err_str or
                            "expecting value" in err_str or
                            "json" in err_str
                        )
                        if is_auth_or_parse_fail:
                            logger.warning(
                                f"[{func.__name__}] Auth/Parse failure detected: {e}. "
                                f"Attempting immediate guest mode fallback."
                            )
                            reset_client_to_guest()

                        if attempt < max_retries - 1:
                            delays = [0.2, 0.5, 1.2]
                            delay = delays[min(attempt, len(delays) - 1)]
                            jitter = random.uniform(0, delay * 0.3)
                            sleep_time = delay + jitter
                            logger.warning(
                                f"[{func.__name__}] Attempt {attempt + 1}/{max_retries} "
                                f"failed: {e}. Retrying in {sleep_time:.2f}s..."
                            )
                            time.sleep(sleep_time)
                        else:
                            logger.error(
                                f"[{func.__name__}] All {max_retries} attempts failed: {e}"
                            )
            finally:
                _yt_semaphore.release()

            _record_failure()
            raise HTTPException(
                status_code=503,
                detail=f"YouTube Music service error: {str(last_error)[:200]}",
            )
        return wrapper
    return decorator
