"""
Artists router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.artists")


@router.get("/artist/{channel_id}")
@cache_response(ttl_seconds=3600, prefix="artist")
@with_retry()
def get_artist(channel_id: str) -> dict:
    """Get artist details by channel/browse ID."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_artist(channel_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Artist not found: {channel_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[artist] channelId={channel_id} → {result.get('name', '?')} in {elapsed:.2f}s")
    return result


@router.get("/artist/{channel_id}/albums")
@cache_response(ttl_seconds=3600, prefix="artist_albums")
@with_retry()
def get_artist_albums(
    channel_id: str,
    params: Optional[str] = Query(default=None),
) -> dict:
    """Get artist's albums. Requires params from artist's albums section."""
    start = time.perf_counter()
    yt = get_client()

    if not params:
        # If no params provided, get them from the artist data
        artist = yt.get_artist(channel_id)
        albums_data = artist.get("albums", {})
        params = albums_data.get("params")
        browse_id = albums_data.get("browseId", channel_id)
        if not params:
            # Return inline album results if available
            return {"albums": albums_data.get("results", []), "count": len(albums_data.get("results", []))}
    else:
        browse_id = channel_id

    result = yt.get_artist_albums(browse_id, params)
    elapsed = time.perf_counter() - start
    logger.info(f"[artist_albums] channelId={channel_id} → {len(result)} albums in {elapsed:.2f}s")
    return {"albums": result, "count": len(result)}
