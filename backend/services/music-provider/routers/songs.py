import time
import logging
import random
import threading
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Body
from starlette.concurrency import run_in_threadpool
from concurrent.futures import ThreadPoolExecutor

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.songs")

class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.state = "CLOSED"
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

_stream_circuit_breaker = CircuitBreaker(failure_threshold=15, recovery_timeout=10)

class InFlightResolution:
    def __init__(self):
        self.event = threading.Event()
        self.result = None
        self.error = None

_inflight_resolutions = {}
_inflight_lock = threading.Lock()
_stream_semaphore = threading.Semaphore(5)




def backfill_song_metadata_if_needed(result: dict, video_id: str) -> dict:
    if not result:
        return result
    
    details = result.setdefault("videoDetails", {})
    title = details.get("title")
    
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


@cache_response(ttl_seconds=86400, prefix="song")
@with_retry()
def _get_song_sync(video_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_song(video_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Song not found: {video_id}")
    
    result = backfill_song_metadata_if_needed(result, video_id)
    
    elapsed = time.perf_counter() - start
    logger.info(f"[song] videoId={video_id} in {elapsed:.2f}s")
    return result


@router.get("/song/{video_id}")
async def get_song(video_id: str) -> dict:
    return await run_in_threadpool(_get_song_sync, video_id)


@cache_response(ttl_seconds=86400, prefix="lyrics")
@with_retry()
def _get_lyrics_sync(browse_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_lyrics(browse_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Lyrics not found: {browse_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[lyrics] browseId={browse_id} in {elapsed:.2f}s")
    return result


@router.get("/lyrics/{browse_id}")
async def get_lyrics(browse_id: str) -> dict:
    return await run_in_threadpool(_get_lyrics_sync, browse_id)


@cache_response(ttl_seconds=900, prefix="watch")
@with_retry()
def _get_watch_playlist_sync(video_id: str, radio: bool = False, shuffle: bool = False) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_watch_playlist(
        videoId=video_id,
        radio=radio,
        shuffle=shuffle,
    )
    if result is None:
        raise HTTPException(status_code=404, detail=f"Watch playlist not found: {video_id}")
    
    if result and "tracks" in result:
        result["tracks"] = [
            t for t in result["tracks"]
            if isinstance(t, dict) and (t.get("title") or t.get("name")) and t.get("videoId")
        ]

    elapsed = time.perf_counter() - start
    track_count = len(result.get("tracks", []))
    logger.info(f"[watch] videoId={video_id} radio={radio} → {track_count} tracks in {elapsed:.2f}s")
    return result


@router.get("/watch/{video_id}")
async def get_watch_playlist(
    video_id: str,
    radio: bool = Query(default=False),
    shuffle: bool = Query(default=False),
) -> dict:
    return await run_in_threadpool(_get_watch_playlist_sync, video_id, radio, shuffle)


@cache_response(ttl_seconds=3600, prefix="related")
@with_retry()
def _get_song_related_sync(browse_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_song_related(browse_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Related content not found: {browse_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[related] browseId={browse_id} → {len(result)} sections in {elapsed:.2f}s")
    return {"sections": result, "count": len(result)}


@router.get("/related/{browse_id}")
async def get_song_related(browse_id: str) -> dict:
    return await run_in_threadpool(_get_song_related_sync, browse_id)


def _get_songs_batch_sync(video_ids: list[str]) -> dict:
    if not video_ids:
        return {"results": []}

    vids = video_ids[:10]

    def fetch_one(vid: str):
        try:
            return {"video_id": vid, "data": _get_song_sync(vid), "success": True}
        except Exception as e:
            logger.warning(f"Batch fetch failed for {vid}: {e}")
            return {"video_id": vid, "error": str(e), "success": False}

    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=min(len(vids), 4)) as executor:
        results = list(executor.map(fetch_one, vids))

    elapsed = time.perf_counter() - start
    logger.info(f"[songs/batch] Fetched {len(vids)} songs in {elapsed:.2f}s")
    return {"results": results}


@router.post("/songs/batch")
async def get_songs_batch(video_ids: list[str] = Body(embed=True)) -> dict:
    return await run_in_threadpool(_get_songs_batch_sync, video_ids)


def resolve_via_public_instances(video_id: str) -> Optional[str]:
    import urllib.request
    import json
    public_instances = [
        "https://iv.melmac.space",
        "https://invidious.privacydev.net",
        "https://invidious.projectsegfau.lt",
        "https://invidious.lunar.icu",
        "https://yewtu.be",
        "https://inv.tux.pizza",
    ]
    for inst in public_instances:
        try:
            url = f"{inst}/api/v1/videos/{video_id}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                data = json.loads(resp.read().decode())
                adaptive = data.get('adaptiveFormats', [])
                audio_formats = [f for f in adaptive if f.get('type', '').startswith('audio/')]
                if audio_formats:
                    audio_formats.sort(key=lambda x: int(x.get('bitrate', 0)), reverse=True)
                    stream_url = audio_formats[0].get('url')
                    if stream_url:
                        return stream_url
        except Exception:
            continue
    return None


_working_cookie_browser = None


@cache_response(ttl_seconds=10800, prefix="stream")
def _resolve_stream_sync(video_id: str) -> dict:
    if not _stream_circuit_breaker.allow_request():
        raise HTTPException(
            status_code=503,
            detail="YouTube streaming service is currently degraded (circuit breaker tripped)",
            headers={"X-Circuit-Breaker": "OPEN", "Retry-After": "30"},
        )

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
        res_future.event.wait(timeout=8)
        if res_future.error:
            raise res_future.error
        if res_future.result:
            return res_future.result
        raise HTTPException(status_code=504, detail="Stream resolution timed out")

    global _working_cookie_browser
    start = time.perf_counter()
    import yt_dlp
    import shutil
    import os
    from pathlib import Path
    
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    import sys
    py_dir = os.path.dirname(sys.executable)
    if py_dir and py_dir not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = py_dir + os.pathsep + os.environ.get("PATH", "")
    
    deno_bin = os.path.expanduser("~/.deno/bin")
    if deno_bin not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = deno_bin + os.pathsep + os.environ.get("PATH", "")

    last_err = None
    
    def build_ydl_opts(cookies_path: str = None, browser: str = None, is_fallback: bool = False, client_override: str = None) -> dict:
        opts = {
            'format': 'bestaudio/best',
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'socket_timeout': 4,
            'extractor_retries': 1,
            'retries': 1,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
        if cookies_path:
            opts['cookiefile'] = cookies_path
        if browser:
            opts['cookiesfrombrowser'] = (browser,)
        
        runtimes = {}
        deno_path = shutil.which("deno") or os.path.expanduser("~/.deno/bin/deno")
        if os.path.exists(deno_path):
            runtimes['deno'] = {'path': deno_path}
        node_path = shutil.which("node")
        if node_path:
            runtimes['node'] = {'path': node_path}
        if runtimes:
            opts['js_runtimes'] = runtimes

        yt_args = {}
        if client_override:
            yt_args['player_client'] = [client_override]
        else:
            yt_args['player_client'] = ['android', 'ios']

        po_token = os.getenv("YT_PO_TOKEN")
        if po_token:
            yt_args['po_token'] = [po_token]

        visitor_data = os.getenv("YT_VISITOR_DATA")
        if visitor_data:
            yt_args['visitor_data'] = [visitor_data]

        if yt_args:
            opts['extractor_args'] = {'youtube': yt_args}

        if 'android' in yt_args.get('player_client', []):
            opts['user_agent'] = 'com.google.android.youtube/19.29.37 (Linux; U; Android 11; US)'

        return opts

    from services.cookies_helper import get_shared_cookies_path
    cookie_file_path = get_shared_cookies_path()

    try:
        acquired = _stream_semaphore.acquire(timeout=5)
        if not acquired:
            exc = HTTPException(status_code=503, detail="Too many concurrent stream resolutions")
            res_future.error = exc
            raise exc

        try:
            time.sleep(random.uniform(0.05, 0.2))
            
            if cookie_file_path:
                ydl_opts = build_ydl_opts(cookies_path=cookie_file_path)
                try:
                    exists = os.path.exists(cookie_file_path)
                    size = os.path.getsize(cookie_file_path) if exists else 0
                    cookie_count = 0
                    sample_masked = []
                    if exists and size > 0:
                        with open(cookie_file_path, "r", encoding="utf-8", errors="ignore") as cf:
                            lines = cf.readlines()
                            for line in lines:
                                stripped = line.strip()
                                if stripped and not stripped.startswith("#"):
                                    cookie_count += 1
                            for line in lines[:5]:
                                parts = line.strip().split("\t")
                                if len(parts) >= 7:
                                    domain, name, val = parts[0], parts[5], parts[6]
                                    masked_val = val[:4] + "..." if len(val) > 4 else "***"
                                    sample_masked.append(f"{domain} | {name}={masked_val}")
                                else:
                                    sample_masked.append(line[:30].strip())
                    logger.info(
                        f"[cookies/debug] path={cookie_file_path} | exists={exists} | size={size}B | "
                        f"valid_cookies={cookie_count} | ydl_cookiefile={ydl_opts.get('cookiefile')} | "
                        f"sample={sample_masked}"
                    )
                except Exception as dbg_err:
                    logger.warning(f"[cookies/debug] Failed to log cookie metadata: {dbg_err}")

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
                    err_msg = str(e).lower()
                    if "confirm you are not a bot" in err_msg or "sign in to confirm" in err_msg or "bot" in err_msg or "no longer valid" in err_msg:
                        logger.error("[cookies] expired or flagged — refresh may be needed")
                    logger.warning(f"[song_stream] Failed to resolve with cookies file: {e}")
                    last_err = e
        
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
        
            for fallback_client in ['android', 'ios', 'tvhtml5']:
                ydl_opts = build_ydl_opts(is_fallback=True, client_override=fallback_client)
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(url, download=False)
                        stream_url = info.get('url')
                        if stream_url:
                            elapsed = time.perf_counter() - start
                            logger.info(f"[song_stream] resolved {video_id} in {elapsed:.2f}s via fallback client '{fallback_client}'")
                            result = {"url": stream_url}
                            res_future.result = result
                            _stream_circuit_breaker.record_success()
                            return result
                except Exception as e:
                    last_err = e
                    continue

            # Failover: If direct yt-dlp extraction was blocked by YouTube IP bot detection, resolve via public Invidious API instances
            public_stream_url = resolve_via_public_instances(video_id)
            if public_stream_url:
                elapsed = time.perf_counter() - start
                logger.info(f"[song_stream] resolved {video_id} in {elapsed:.2f}s via public instance fallback")
                result = {"url": public_stream_url}
                res_future.result = result
                _stream_circuit_breaker.record_success()
                return result

            err_msg = str(last_err).lower() if last_err else "stream extraction failed"
            if "confirm you are not a bot" in err_msg or "sign in to confirm" in err_msg or "bot" in err_msg:
                logger.error("[cookies] expired — refresh needed")
            logger.error(f"[song_stream] Failed to resolve {video_id}: {last_err}")
            exc = HTTPException(status_code=503, detail=str(last_err) if last_err else "Stream resolution unavailable")
            res_future.error = exc
            _stream_circuit_breaker.record_failure()
            raise exc
        finally:
            _stream_semaphore.release()

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
        import gc
        gc.collect()


@router.get("/song/{video_id}/stream")
async def get_song_stream(video_id: str) -> dict:
    res = await run_in_threadpool(_resolve_stream_sync, video_id)
    if not res or not isinstance(res, dict) or "url" not in res:
        raise HTTPException(status_code=503, detail="Invalid stream response structure")
    return res
