import os
import logging
import http.cookiejar
from pathlib import Path
from typing import Optional

SOULSYNC_COOKIE_PATH = "/tmp/soulsync_cookies.txt"
READONLY_COOKIES = "/etc/secrets/cookies.txt"
LOCAL_COOKIES_PATH = str(Path(__file__).parent.parent / "cookies.txt")

def get_shared_cookies_path() -> Optional[str]:
    """
    Returns the single unified cookie file path used across all microservice components
    (songs.py, ytmusic_client.py, yt-dlp, and ytmusicapi).
    """
    if os.path.exists(SOULSYNC_COOKIE_PATH) and os.path.getsize(SOULSYNC_COOKIE_PATH) > 50:
        return SOULSYNC_COOKIE_PATH

    yt_cookies_env = os.getenv("YT_COOKIES")
    if yt_cookies_env and len(yt_cookies_env.strip()) > 50:
        try:
            cookie_content = yt_cookies_env.strip().replace("\\n", "\n")
            os.makedirs(os.path.dirname(SOULSYNC_COOKIE_PATH), exist_ok=True)
            with open(SOULSYNC_COOKIE_PATH, "w", encoding="utf-8") as f:
                f.write(cookie_content)
            logger.info(f"[cookies_helper] Written YT_COOKIES to shared path: {SOULSYNC_COOKIE_PATH}")
            return SOULSYNC_COOKIE_PATH
        except Exception as e:
            logger.error(f"[cookies_helper] Failed to write YT_COOKIES to {SOULSYNC_COOKIE_PATH}: {e}")

    if os.path.exists(READONLY_COOKIES) and os.path.getsize(READONLY_COOKIES) > 50:
        return READONLY_COOKIES

    if os.path.exists(LOCAL_COOKIES_PATH) and os.path.getsize(LOCAL_COOKIES_PATH) > 50:
        return LOCAL_COOKIES_PATH

    return None

def auto_extract_and_save_cookies(force_refresh: bool = False) -> Optional[str]:
    """
    In development mode, automatically extracts cookies from Chrome/Firefox/Brave
    and saves them to the local cookies.txt file.
    Returns the path to the cookies file if successful, otherwise None.
    """
    local_cookies_path = Path(__file__).parent.parent / "cookies.txt"
    
    # In production, we don't extract from browser
    if os.getenv("RENDER_EXTERNAL_URL") or os.getenv("NODE_ENV") == "production":
        return None

    # If cookies.txt already exists and we are not forcing refresh, use it
    if not force_refresh and local_cookies_path.exists() and local_cookies_path.stat().st_size > 0:
        return str(local_cookies_path)

    # Try extracting from browsers in order of popularity
    try:
        from yt_dlp.cookies import extract_cookies_from_browser
    except ImportError:
        logger.warning("[cookies_helper] yt_dlp is not available for cookie extraction")
        return None
    
    browsers = ['chrome', 'firefox', 'brave', 'chromium', 'opera', 'vivaldi', 'edge']
    for browser in browsers:
        try:
            logger.info(f"[cookies_helper] Attempting cookie extraction from: {browser}")
            cj = extract_cookies_from_browser(browser)
            if cj:
                mcj = http.cookiejar.MozillaCookieJar(str(local_cookies_path))
                for cookie in cj:
                    mcj.set_cookie(cookie)
                mcj.save(ignore_discard=True, ignore_expires=True)
                logger.info(f"[cookies_helper] Successfully saved extracted {browser} cookies to {local_cookies_path}")
                return str(local_cookies_path)
        except Exception as e:
            logger.debug(f"[cookies_helper] Failed to extract from {browser}: {e}")
            continue

    logger.warning("[cookies_helper] Could not auto-extract cookies from any installed browser.")
    return None
