import os
import logging
import http.cookiejar
from pathlib import Path
from typing import Optional

logger = logging.getLogger("music-provider.cookies")

SOULSYNC_COOKIE_PATH = "/tmp/soulsync_cookies.txt"
READONLY_COOKIES = "/etc/secrets/cookies.txt"
LOCAL_COOKIES_PATH = str(Path(__file__).parent.parent / "cookies.txt")

def sanitize_netscape_cookies(raw_content: str) -> tuple[str, int, int]:
    """
    Sanitizes raw Netscape cookie content string.
    - Preserves header '# Netscape HTTP Cookie File' and comments.
    - Validates every cookie line has exactly 7 tab-separated fields.
    - Repairs 6-field cookies (e.g. missing value field) by appending an empty value.
    - Filters out unrepairable malformed lines.
    Returns (sanitized_content, valid_count, removed_count).
    """
    lines = raw_content.splitlines()
    sanitized_lines = ["# Netscape HTTP Cookie File", "# https://curl.haxx.se/rfc/cookie_spec.html", ""]
    
    valid_count = 0
    removed_count = 0
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            if not stripped.startswith("# Netscape"):
                sanitized_lines.append(stripped)
            continue
        
        parts = line.split("\t")
        
        # If space-separated instead of tab-separated, attempt space splitting repair
        if len(parts) < 6 and " " in stripped and "\t" not in line:
            space_parts = stripped.split()
            if len(space_parts) >= 6:
                parts = space_parts
                
        # If 6 fields (missing value column), append empty value column
        if len(parts) == 6:
            parts.append("")
            
        if len(parts) == 7:
            domain, include_sub, path, secure, expiry, name, val = [p.strip() for p in parts]
            if domain and name:
                sanitized_lines.append(f"{domain}\t{include_sub.upper()}\t{path}\t{secure.upper()}\t{expiry}\t{name}\t{val}")
                valid_count += 1
                continue
                
        logger.warning(f"[cookies] Skipping malformed cookie: {line[:80]}")
        removed_count += 1

    return "\n".join(sanitized_lines) + "\n", valid_count, removed_count

def sanitize_and_save_cookie_file(file_path: str) -> bool:
    """
    Reads, sanitizes, and overwrites the specified cookie file in place.
    Ensures http.cookiejar and yt-dlp receive a 100% valid Netscape format file.
    """
    try:
        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            return False
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        sanitized_content, valid_count, removed_count = sanitize_netscape_cookies(content)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(sanitized_content)
        logger.info(f"[cookies/sanitizer] Sanitized '{file_path}': {valid_count} valid cookies kept, {removed_count} malformed cookies removed/repaired")
        return True
    except Exception as e:
        logger.error(f"[cookies/sanitizer] Failed to sanitize cookie file '{file_path}': {e}")
        return False

def get_shared_cookies_path() -> Optional[str]:
    """
    Returns the single unified cookie file path used across all microservice components
    (songs.py, ytmusic_client.py, yt-dlp, and ytmusicapi).
    """
    if os.path.exists(SOULSYNC_COOKIE_PATH) and os.path.getsize(SOULSYNC_COOKIE_PATH) > 50:
        sanitize_and_save_cookie_file(SOULSYNC_COOKIE_PATH)
        return SOULSYNC_COOKIE_PATH

    yt_cookies_env = os.getenv("YT_COOKIES")
    if yt_cookies_env and len(yt_cookies_env.strip()) > 50:
        try:
            cookie_content = yt_cookies_env.strip().replace("\\n", "\n")
            sanitized_content, valid_count, removed_count = sanitize_netscape_cookies(cookie_content)
            os.makedirs(os.path.dirname(SOULSYNC_COOKIE_PATH), exist_ok=True)
            with open(SOULSYNC_COOKIE_PATH, "w", encoding="utf-8") as f:
                f.write(sanitized_content)
            logger.info(f"[cookies_helper] Written sanitized YT_COOKIES to shared path: {SOULSYNC_COOKIE_PATH} ({valid_count} valid, {removed_count} removed)")
            return SOULSYNC_COOKIE_PATH
        except Exception as e:
            logger.error(f"[cookies_helper] Failed to write YT_COOKIES to {SOULSYNC_COOKIE_PATH}: {e}")

    if os.path.exists(READONLY_COOKIES) and os.path.getsize(READONLY_COOKIES) > 50:
        sanitize_and_save_cookie_file(READONLY_COOKIES)
        return READONLY_COOKIES

    if os.path.exists(LOCAL_COOKIES_PATH) and os.path.getsize(LOCAL_COOKIES_PATH) > 50:
        sanitize_and_save_cookie_file(LOCAL_COOKIES_PATH)
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
