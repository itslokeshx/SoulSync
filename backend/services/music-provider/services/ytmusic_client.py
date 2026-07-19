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
    adapter = TimeoutHTTPAdapter(pool_connections=5, pool_maxsize=5, timeout=10)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    # Inject browser-like user agent and headers
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://music.youtube.com",
        "Referer": "https://music.youtube.com/",
    })
    
    # Load cookies if available
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
_RESET_COOLDOWN_SECONDS = 30.0


def reset_client_to_guest():
    """
    Reset the client to a clean guest-mode session.

    Rate-limited: under sustained blocking (YouTube rejecting both cookie
    and guest requests), every failing request would otherwise trigger a
    full session rebuild + new YTMusic() init (each doing network I/O),
    all while holding one of only 10 global semaphore slots. That turns
    a block into a resource-exhaustion cascade across every endpoint.
    Only actually rebuild once per cooldown window; otherwise just log
    and move on so failures return fast instead of piling up.
    """
    global _client, _last_reset_time
    now = time.monotonic()
    if now - _last_reset_time < _RESET_COOLDOWN_SECONDS:
        logger.warning(
            "Skipping YTMusic client reset (cooldown active, "
            f"{_RESET_COOLDOWN_SECONDS - (now - _last_reset_time):.0f}s remaining)"
        )
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


from threading import Semaphore, Lock

# Limit concurrent outbound YouTube Music calls (kept low for 512MB Render free tier)
_yt_semaphore = Semaphore(3)

# ── Circuit breaker ──────────────────────────────────────────────────────
# If YouTube is actively blocking us (auth/parse failures), retrying each
# request 3x with sleeps just piles up load on top of an already-failing
# upstream and holds semaphore slots longer, making the pile-up worse.
# Once we see repeated failures in a short window, trip the breaker and
# fail new requests immediately (no retries, no sleeps) until the cooldown
# passes, so the service stays responsive instead of queuing everything
# behind guaranteed-to-fail calls.
_breaker_lock = Lock()
_consecutive_failures = 0
_breaker_tripped_until: float = 0.0
_BREAKER_THRESHOLD = 8
_BREAKER_COOLDOWN_SECONDS = 20.0


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


def with_retry(max_retries: int = 3, base_delay: float = 0.5):
    """
    Decorator that adds retry logic with exponential backoff.
    On permanent failure, raises HTTPException(503).
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if _breaker_is_open():
                raise HTTPException(
                    status_code=503,
                    detail="YouTube Music service temporarily degraded — failing fast, retry shortly",
                )

            last_error = None
            with _yt_semaphore:
                for attempt in range(max_retries):
                    try:
                        result = func(*args, **kwargs)
                        _record_success()
                        return result
                    except HTTPException:
                        raise  # Don't retry HTTP exceptions we raise ourselves
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
                                continue
                                

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
            _record_failure()
            raise HTTPException(
                status_code=503,
                detail=f"YouTube Music service error: {str(last_error)[:200]}",
            )
        return wrapper
    return decorator
