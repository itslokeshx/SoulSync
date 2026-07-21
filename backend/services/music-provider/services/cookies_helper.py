import os
import logging
import http.cookiejar
from pathlib import Path
from typing import Optional

logger = logging.getLogger("music-provider.cookies")

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
