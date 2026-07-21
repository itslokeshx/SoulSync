import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.artists")


import re

def _resolve_browse_id(channel_id: str, yt) -> str:
    cleaned = channel_id.strip()
    if cleaned.startswith("UC") or cleaned.startswith("FEmusic_") or cleaned.startswith("MPREs_"):
        return cleaned

    # Split multi-artist string on comma, ampersand, 'and', or 'x'
    parts = [p.strip() for p in re.split(r'[,&]|\band\b|\bx\b', cleaned, flags=re.IGNORECASE) if p.strip()]
    primary_name = parts[0] if parts else cleaned

    try:
        search_res = yt.search(primary_name, filter="artists")
        if search_res and len(search_res) > 0:
            first_match = search_res[0]
            if first_match.get("browseId"):
                logger.info(f"[artist_resolve] '{channel_id}' -> resolved to primary artist '{primary_name}' (browseId: {first_match['browseId']})")
                return first_match["browseId"]
    except Exception as e:
        logger.warning(f"[artist_resolve] Search resolution failed for '{primary_name}': {e}")

    return primary_name


@cache_response(ttl_seconds=7200, prefix="artist")
@with_retry()
def _get_artist_sync(channel_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    
    target_id = _resolve_browse_id(channel_id, yt)
    
    try:
        result = yt.get_artist(target_id)
    except Exception as e:
        logger.warning(f"[artist] yt.get_artist failed for target_id='{target_id}' (original='{channel_id}'): {e}")
        # Secondary fallback: search for original channel_id as artist name
        try:
            search_res = yt.search(channel_id, filter="artists")
            if search_res and search_res[0].get("browseId"):
                result = yt.get_artist(search_res[0]["browseId"])
            else:
                result = None
        except Exception:
            result = None

    if result is None:
        raise HTTPException(status_code=404, detail=f"Artist not found: {channel_id}")
        
    elapsed = time.perf_counter() - start
    logger.info(f"[artist] channelId={channel_id} (target={target_id}) → {result.get('name', '?')} in {elapsed:.2f}s")
    return result


@router.get("/artist/{channel_id}")
async def get_artist(channel_id: str) -> dict:
    return await run_in_threadpool(_get_artist_sync, channel_id)


@cache_response(ttl_seconds=7200, prefix="artist_albums")
@with_retry()
def _get_artist_albums_sync(channel_id: str, params: Optional[str] = None) -> dict:
    start = time.perf_counter()
    yt = get_client()
    target_id = _resolve_browse_id(channel_id, yt)

    if not params:
        try:
            artist = yt.get_artist(target_id)
        except Exception:
            artist = {}
        albums_data = artist.get("albums", {})
        params = albums_data.get("params")
        browse_id = albums_data.get("browseId", target_id)
        if not params:
            return {"albums": albums_data.get("results", []), "count": len(albums_data.get("results", []))}
    else:
        browse_id = target_id

    try:
        result = yt.get_artist_albums(browse_id, params)
    except Exception as e:
        logger.warning(f"[artist_albums] Failed for browse_id='{browse_id}': {e}")
        result = []
    elapsed = time.perf_counter() - start
    logger.info(f"[artist_albums] channelId={channel_id} → {len(result)} albums in {elapsed:.2f}s")
    return {"albums": result, "count": len(result)}


@router.get("/artist/{channel_id}/albums")
async def get_artist_albums(
    channel_id: str,
    params: Optional[str] = Query(default=None),
) -> dict:
    return await run_in_threadpool(_get_artist_albums_sync, channel_id, params)
