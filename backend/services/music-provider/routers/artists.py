import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.artists")


@cache_response(ttl_seconds=7200, prefix="artist")
@with_retry()
def _get_artist_sync(channel_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_artist(channel_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Artist not found: {channel_id}")
    elapsed = time.perf_counter() - start
    logger.info(f"[artist] channelId={channel_id} → {result.get('name', '?')} in {elapsed:.2f}s")
    return result


@router.get("/artist/{channel_id}")
async def get_artist(channel_id: str) -> dict:
    return await run_in_threadpool(_get_artist_sync, channel_id)


@cache_response(ttl_seconds=7200, prefix="artist_albums")
@with_retry()
def _get_artist_albums_sync(channel_id: str, params: Optional[str] = None) -> dict:
    start = time.perf_counter()
    yt = get_client()

    if not params:
        artist = yt.get_artist(channel_id)
        albums_data = artist.get("albums", {})
        params = albums_data.get("params")
        browse_id = albums_data.get("browseId", channel_id)
        if not params:
            return {"albums": albums_data.get("results", []), "count": len(albums_data.get("results", []))}
    else:
        browse_id = channel_id

    result = yt.get_artist_albums(browse_id, params)
    elapsed = time.perf_counter() - start
    logger.info(f"[artist_albums] channelId={channel_id} → {len(result)} albums in {elapsed:.2f}s")
    return {"albums": result, "count": len(result)}


@router.get("/artist/{channel_id}/albums")
async def get_artist_albums(
    channel_id: str,
    params: Optional[str] = Query(default=None),
) -> dict:
    return await run_in_threadpool(_get_artist_albums_sync, channel_id, params)
