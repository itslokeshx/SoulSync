"""
Songs, lyrics, watch queue, and related content router.
"""
import time
import logging
import random
import threading
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Body
from concurrent.futures import ThreadPoolExecutor

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.songs")

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF-OPEN
        self.last_state_change = time.time()
        self._lock = threading.Lock()
        
    def record_failure(self):
        with self._lock:
            self.failures += 1
            if self.failures >= self.failure_threshold:
                if self.state != "OPEN":
                    self.state = "OPEN"
                    self.last_state_change = time.time()
                    logger.error("[CircuitBreaker] Failure threshold reached. State changed to OPEN. Failing fast.")
                    
    def record_success(self):
        with self._lock:
            self.failures = 0
            self.state = "CLOSED"
            
    def allow_request(self) -> bool:
        with self._lock:
            if self.state == "CLOSED":
                return True
            if self.state == "OPEN":
                if time.time() - self.last_state_change > self.recovery_timeout:
                    self.state = "HALF-OPEN"
                    logger.warning("[CircuitBreaker] Recovery timeout passed. Trying HALF-OPEN request.")
                    return True
                return False
            return True

_stream_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)

class InFlightResolution:
    def __init__(self):
        self.event = threading.Event()
        self.result = None
        self.error = None

_inflight_resolutions = {}
_inflight_lock = threading.Lock()
_stream_semaphore = threading.Semaphore(4)




def backfill_song_metadata_if_needed(result: dict, video_id: str) -> dict:
    if not result:
        return result
    
    details = result.setdefault("videoDetails", {})
    title = details.get("title")
    
    # If title is missing or empty, try to backfill from get_watch_playlist
    if not title:
        logger.warning(f"Song metadata title is missing for {video_id}. Attempting backfill via watch playlist...")
        try:
            yt = get_client()
            watch = yt.get_watch_playlist(videoId=video_id, limit=5)
            if watch and watch.get("tracks"):
                track = watch["tracks"][0]
                if track.get("videoId") == video_id or not details.get("videoId"):
                    details["title"] = track.get("title")
                    details["videoId"] = video_id
                    if "author" not in details or not details["author"]:
                        details["author"] = track.get("artists", [{}])[0].get("name") if track.get("artists") else None
                    if "lengthSeconds" not in details or not details["lengthSeconds"]:
                        details["lengthSeconds"] = str(track.get("lengthSeconds", 0))
                    if "thumbnail" not in details or not details["thumbnail"]:
                        details["thumbnail"] = {
                            "thumbnails": track.get("thumbnail", [])
                        }
                    logger.info(f"Successfully backfilled metadata for {video_id} using watch playlist.")
        except Exception as e:
            logger.error(f"Failed to backfill metadata for {video_id}: {e}")
            
    return result


@router.get("/song/{video_id}")
@cache_response(ttl_seconds=86400, prefix="song")
@with_retry()
def get_song(video_id: str) -> dict:
    """Get full song metadata by videoId."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_song(video_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Song not found: {video_id}")
    
    result = backfill_song_metadata_if_needed(result, video_id)
    
    elapsed = time.perf_counter() - start
    logger.info(f"[song] videoId={video_id} in {elapsed:.2f}s")
    return result


@router.get("/lyrics/{browse_id}")
@cache_response(ttl_seconds=86400, prefix="lyrics")
@with_retry()
def get_lyrics(browse_id: str) -> dict:
    """Get song lyrics by lyrics browseId."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_lyrics(browse_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Lyrics not found: {browse_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[lyrics] browseId={browse_id} in {elapsed:.2f}s")
    return result


@router.get("/watch/{video_id}")
@cache_response(ttl_seconds=900, prefix="watch")
@with_retry()
def get_watch_playlist(
    video_id: str,
    radio: bool = Query(default=False),
    shuffle: bool = Query(default=False),
) -> dict:
    """Get the watch/autoplay queue for a song."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_watch_playlist(
        videoId=video_id,
        radio=radio,
        shuffle=shuffle,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"Watch playlist not found: {video_id}")
    
    # Defensive metadata filtering for tracks in watch playlist
    if result and "tracks" in result:
        result["tracks"] = [
            t for t in result["tracks"]
            if isinstance(t, dict) and (t.get("title") or t.get("name")) and t.get("videoId")
        ]

    elapsed = time.perf_counter() - start
    track_count = len(result.get("tracks", []))
    logger.info(f"[watch] videoId={video_id} radio={radio} → {track_count} tracks in {elapsed:.2f}s")
    return result


@router.get("/related/{browse_id}")
@cache_response(ttl_seconds=3600, prefix="related")
@with_retry()
def get_song_related(browse_id: str) -> dict:
    """Get related content for a song by its related browseId."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_song_related(browse_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Related content not found: {browse_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[related] browseId={browse_id} → {len(result)} sections in {elapsed:.2f}s")
    return {"sections": result, "count": len(result)}


@router.post("/songs/batch")
def get_songs_batch(video_ids: list[str] = Body(embed=True)) -> dict:
    """Get metadata for multiple songs in parallel using a thread pool."""
    if not video_ids:
        return {"results": []}

    # Limit batch size to 30 to prevent rate-limiting or uvicorn starvation
    vids = video_ids[:30]

    def fetch_one(vid: str):
        try:
            # Call the cached get_song handler directly to benefit from caching!
            return {"video_id": vid, "data": get_song(vid), "success": True}
        except Exception as e:
            logger.warning(f"Batch fetch failed for {vid}: {e}")
            return {"video_id": vid, "error": str(e), "success": False}

    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=min(len(vids), 15)) as executor:
        results = list(executor.map(fetch_one, vids))

    elapsed = time.perf_counter() - start
    logger.info(f"[songs/batch] Fetched {len(vids)} songs in {elapsed:.2f}s")
    return {"results": results}


_working_cookie_browser = None


@router.get("/song/{video_id}/stream")
@cache_response(ttl_seconds=3600, prefix="stream")
def get_song_stream(video_id: str) -> dict:
    """Get direct streaming audio URL for a song using yt-dlp with cookie extraction fallback."""
    # 1. Circuit breaker fast fail
    if not _stream_circuit_breaker.allow_request():
        raise HTTPException(
            status_code=503,
            detail="YouTube streaming service is currently degraded (circuit breaker tripped)"
        )

    # 2. Request deduplication check
    res_future = None
    is_initiator = False
    with _inflight_lock:
        if video_id in _inflight_resolutions:
            res_future = _inflight_resolutions[video_id]
        else:
            res_future = InFlightResolution()
            _inflight_resolutions[video_id] = res_future
            is_initiator = True

    if not is_initiator:
        # Wait for the initiator thread to complete the resolution
        res_future.event.wait()
        if res_future.error:
            raise res_future.error
        return res_future.result

    # Initiator logic
    global _working_cookie_browser
    start = time.perf_counter()
    import yt_dlp
    import shutil
    import os
    from pathlib import Path
    
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Ensure virtualenv bin directory is in PATH for this request/process context
    import sys
    py_dir = os.path.dirname(sys.executable)
    if py_dir and py_dir not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = py_dir + os.pathsep + os.environ.get("PATH", "")

    node_path = shutil.which("node")
    js_runtimes = {}
    if node_path:
        js_runtimes['node'] = {'path': node_path}
        
    last_err = None
    
    # Helper to construct ydl options cleanly
    def build_ydl_opts(cookies_path: str = None, browser: str = None) -> dict:
        opts = {
            'format': 'bestaudio',
            'quiet': True,
            'no_plugins': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
        if js_runtimes:
            opts['js_runtimes'] = js_runtimes
        if cookies_path:
            opts['cookiefile'] = cookies_path
        if browser:
            opts['cookiesfrombrowser'] = (browser,)
        return opts

    # ── COOKIE FILE RESOLUTION ──────────────────────────────────────────────
    READONLY_COOKIES = "/etc/secrets/cookies.txt"
    WRITABLE_COOKIES = "/tmp/cookies.txt"
    
    def get_cookies_path() -> Optional[str]:
        if os.path.exists(READONLY_COOKIES):
            try:
                os.makedirs(os.path.dirname(WRITABLE_COOKIES), exist_ok=True)
                shutil.copy(READONLY_COOKIES, WRITABLE_COOKIES)
                return WRITABLE_COOKIES
            except Exception as e:
                logger.error(f"[song_stream] Failed to copy read-only secret cookies: {e}")
                
        yt_cookies_env = os.getenv("YT_COOKIES")
        if yt_cookies_env:
            try:
                temp_cookie_path = "/tmp/soulsync_cookies.txt"
                os.makedirs(os.path.dirname(temp_cookie_path), exist_ok=True)
                with open(temp_cookie_path, "w", encoding="utf-8") as f:
                    f.write(yt_cookies_env)
                return temp_cookie_path
            except Exception as e:
                logger.error(f"[song_stream] Failed to write YT_COOKIES to temp file: {e}")
                
        local_cookie_path = Path(__file__).parent.parent / "cookies.txt"
        if local_cookie_path.exists():
            return str(local_cookie_path)
            
        return None

    cookie_file_path = get_cookies_path()

    try:
        # Acquire semaphore slot to limit concurrency
        with _stream_semaphore:
            time.sleep(random.uniform(0.1, 0.4))
            
            # 1. Try resolving using cookies file if available
            if cookie_file_path:
                ydl_opts = build_ydl_opts(cookies_path=cookie_file_path)
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(url, download=False)
                        stream_url = info.get('url')
                        if stream_url:
                            elapsed = time.perf_counter() - start
                            logger.info(f"[song_stream] resolved {video_id} in {elapsed:.2f}s using cookies file")
                            result = {"url": stream_url}
                            res_future.result = result
                            _stream_circuit_breaker.record_success()
                            return result
                except Exception as e:
                    logger.warning(f"[song_stream] Failed to resolve with cookies file: {e}")
                    last_err = e
        
            # 2. Try resolving using cookies from common browsers (skip on Render/headless)
            is_render = os.getenv("RENDER") == "true"
            if not is_render:
                browsers = ['chrome', 'firefox', 'brave', 'chromium', 'opera', 'vivaldi', 'edge']
                if _working_cookie_browser and _working_cookie_browser in browsers:
                    browsers.remove(_working_cookie_browser)
                    browsers.insert(0, _working_cookie_browser)
                    
                for browser in browsers:
                    ydl_opts = build_ydl_opts(browser=browser)
                    try:
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            info = ydl.extract_info(url, download=False)
                            stream_url = info.get('url')
                            if stream_url:
                                _working_cookie_browser = browser
                                elapsed = time.perf_counter() - start
                                logger.info(f"[song_stream] resolved {video_id} in {elapsed:.2f}s using cookies from browser '{browser}'")
                                result = {"url": stream_url}
                                res_future.result = result
                                _stream_circuit_breaker.record_success()
                                return result
                    except Exception as e:
                        last_err = e
                        continue
        
            # 3. Try guest mode fallback if all else failed
            ydl_opts = build_ydl_opts()
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    stream_url = info.get('url')
                    if stream_url:
                        elapsed = time.perf_counter() - start
                        logger.info(f"[song_stream] resolved {video_id} in {elapsed:.2f}s via guest fallback")
                        result = {"url": stream_url}
                        res_future.result = result
                        _stream_circuit_breaker.record_success()
                        return result
            except Exception as e:
                last_err = e

            # If we get here, all resolution paths failed
            logger.error(f"[song_stream] Failed to resolve {video_id}: {last_err}")
            exc = HTTPException(status_code=500, detail=str(last_err))
            res_future.error = exc
            _stream_circuit_breaker.record_failure()
            raise exc

    except Exception as e:
        if not isinstance(e, HTTPException):
            e = HTTPException(status_code=500, detail=str(e))
        res_future.error = e
        _stream_circuit_breaker.record_failure()
        raise e
    finally:
        with _inflight_lock:
            if _inflight_resolutions.get(video_id) is res_future:
                del _inflight_resolutions[video_id]
        res_future.event.set()

