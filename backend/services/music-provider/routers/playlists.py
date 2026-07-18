"""
Playlists router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from services.ytmusic_client import get_client, with_retry

router = APIRouter()
logger = logging.getLogger("music-provider.playlists")


@router.get("/playlist/{playlist_id}")
@with_retry()
def get_playlist(
    playlist_id: str,
    limit: Optional[int] = Query(default=None, ge=1, le=5000),
) -> dict:
    """Get playlist details and tracks by playlistId or browseId."""
    start = time.perf_counter()
    yt = get_client()
    kwargs: dict = {"playlistId": playlist_id}
    if limit:
        kwargs["limit"] = limit
    result = yt.get_playlist(**kwargs)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Playlist not found: {playlist_id}")
    elapsed = time.perf_counter() - start
    track_count = len(result.get("tracks", []))
    logger.info(f"[playlist] id={playlist_id} → {track_count} tracks in {elapsed:.2f}s")
    return result


@router.get("/playlist/{playlist_id}/suggestions")
@with_retry()
def get_playlist_suggestions(playlist_id: str) -> dict:
    """Get track suggestions for a playlist. Requires authentication."""
    start = time.perf_counter()
    yt = get_client()
    try:
        result = yt.get_playlist_suggestions(playlist_id)
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Auth required or unavailable: {str(e)[:200]}")
    elapsed = time.perf_counter() - start
    logger.info(f"[playlist_suggestions] id={playlist_id} in {elapsed:.2f}s")
    return {"suggestions": result}
