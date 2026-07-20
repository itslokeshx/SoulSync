import time
import logging
from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.albums")


@cache_response(ttl_seconds=7200, prefix="album")
@with_retry()
def _get_album_sync(browse_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_album(browse_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Album not found: {browse_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[album] browseId={browse_id} → {result.get('title', '?')} in {elapsed:.2f}s")
    return result


@router.get("/album/{browse_id}")
async def get_album(browse_id: str) -> dict:
    return await run_in_threadpool(_get_album_sync, browse_id)


@cache_response(ttl_seconds=7200, prefix="album_browse")
@with_retry()
def _get_album_browse_id_sync(audio_playlist_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_album_browse_id(audio_playlist_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Album not found for: {audio_playlist_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[album_browse] audioPlaylistId={audio_playlist_id} → {result} in {elapsed:.2f}s")
    return {"browseId": result}


@router.get("/album/browse/{audio_playlist_id}")
async def get_album_browse_id(audio_playlist_id: str) -> dict:
    return await run_in_threadpool(_get_album_browse_id_sync, audio_playlist_id)
