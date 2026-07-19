"""
Songs, lyrics, watch queue, and related content router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Body
from concurrent.futures import ThreadPoolExecutor

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.songs")


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
    global _working_cookie_browser
    start = time.perf_counter()
    import yt_dlp
    import shutil
    import os
    from pathlib import Path
    
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    node_path = shutil.which("node")
    js_runtimes = {}
    if node_path:
        js_runtimes['node'] = {'path': node_path}
        
    last_err = None
    
    # ── COOKIE FILE RESOLUTION ──────────────────────────────────────────────
    cookie_file_path = None
    yt_cookies_env = os.getenv("YT_COOKIES")
    if yt_cookies_env:
        try:
            temp_cookie_path = "/tmp/soulsync_cookies.txt"
            os.makedirs(os.path.dirname(temp_cookie_path), exist_ok=True)
            with open(temp_cookie_path, "w", encoding="utf-8") as f:
                f.write(yt_cookies_env)
            cookie_file_path = temp_cookie_path
            logger.info("[song_stream] Using YT_COOKIES environment variable")
        except Exception as e:
            logger.error(f"[song_stream] Failed to write YT_COOKIES temp file: {e}")
            
    if not cookie_file_path:
        local_cookie_path = Path(__file__).parent.parent / "cookies.txt"
        if local_cookie_path.exists():
            cookie_file_path = str(local_cookie_path)
            logger.info("[song_stream] Using local cookies.txt file")

    # 1. Try resolving using cookies file if available
    if cookie_file_path:
        ydl_opts = {
            'format': 'bestaudio',
            'quiet': True,
            'cookiefile': cookie_file_path,
        }
        if js_runtimes:
            ydl_opts['js_runtimes'] = js_runtimes
            
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                stream_url = info.get('url')
                if stream_url:
                    elapsed = time.perf_counter() - start
                    logger.info(f"[song_stream] resolved {video_id} in {elapsed:.2f}s using cookies file")
                    return {"url": stream_url}
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
            ydl_opts = {
                'format': 'bestaudio',
                'quiet': True,
                'cookiesfrombrowser': (browser,),
            }
            if js_runtimes:
                ydl_opts['js_runtimes'] = js_runtimes
                
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    stream_url = info.get('url')
                    if stream_url:
                        _working_cookie_browser = browser
                        elapsed = time.perf_counter() - start
                        logger.info(f"[song_stream] resolved {video_id} in {elapsed:.2f}s using cookies from browser '{browser}'")
                        return {"url": stream_url}
            except Exception as e:
                last_err = e
                continue

    # 3. Try guest mode fallback if all else failed
    ydl_opts = {
        'format': 'bestaudio',
        'quiet': True,
    }
    if js_runtimes:
        ydl_opts['js_runtimes'] = js_runtimes
        
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            stream_url = info.get('url')
            if stream_url:
                elapsed = time.perf_counter() - start
                logger.info(f"[song_stream] resolved {video_id} in {elapsed:.2f}s via guest fallback")
                return {"url": stream_url}
    except Exception as e:
        last_err = e

    logger.error(f"[song_stream] Failed to resolve {video_id}: {last_err}")
    raise HTTPException(status_code=500, detail=str(last_err))


