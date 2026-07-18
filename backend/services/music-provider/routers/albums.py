"""
Albums router.
"""
import time
import logging
from fastapi import APIRouter, HTTPException

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.albums")


@router.get("/album/{browse_id}")
@cache_response(ttl_seconds=3600, prefix="album")
@with_retry()
def get_album(browse_id: str) -> dict:
    """Get album details and tracks by browseId."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_album(browse_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Album not found: {browse_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[album] browseId={browse_id} → {result.get('title', '?')} in {elapsed:.2f}s")
    return result


@router.get("/album/browse/{audio_playlist_id}")
@cache_response(ttl_seconds=3600, prefix="album_browse")
@with_retry()
def get_album_browse_id(audio_playlist_id: str) -> dict:
    """Convert an audioPlaylistId to a browseId."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_album_browse_id(audio_playlist_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Album not found for: {audio_playlist_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[album_browse] audioPlaylistId={audio_playlist_id} → {result} in {elapsed:.2f}s")
    return {"browseId": result}
