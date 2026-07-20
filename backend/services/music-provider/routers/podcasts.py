import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.podcasts")


@cache_response(ttl_seconds=7200, prefix="podcast")
@with_retry()
def _get_podcast_sync(playlist_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    try:
        result = yt.get_podcast(playlist_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Podcast not found: {str(e)[:200]}")
    elapsed = time.perf_counter() - start
    logger.info(f"[podcast] id={playlist_id} in {elapsed:.2f}s")
    return result


@router.get("/podcast/{playlist_id}")
async def get_podcast(playlist_id: str) -> dict:
    return await run_in_threadpool(_get_podcast_sync, playlist_id)


@cache_response(ttl_seconds=7200, prefix="episode")
@with_retry()
def _get_episode_sync(video_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    try:
        result = yt.get_episode(video_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Episode not found: {str(e)[:200]}")
    elapsed = time.perf_counter() - start
    logger.info(f"[episode] videoId={video_id} in {elapsed:.2f}s")
    return result


@router.get("/episode/{video_id}")
async def get_episode(video_id: str) -> dict:
    return await run_in_threadpool(_get_episode_sync, video_id)


@cache_response(ttl_seconds=7200, prefix="channel")
@with_retry()
def _get_channel_sync(channel_id: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    try:
        result = yt.get_channel(channel_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Channel not found: {str(e)[:200]}")
    elapsed = time.perf_counter() - start
    logger.info(f"[channel] channelId={channel_id} in {elapsed:.2f}s")
    return result


@router.get("/channel/{channel_id}")
async def get_channel(channel_id: str) -> dict:
    return await run_in_threadpool(_get_channel_sync, channel_id)


@cache_response(ttl_seconds=7200, prefix="channel_episodes")
@with_retry()
def _get_channel_episodes_sync(channel_id: str, params: Optional[str] = None) -> dict:
    start = time.perf_counter()
    yt = get_client()
    try:
        if params:
            result = yt.get_channel_episodes(channel_id, params)
        else:
            channel = yt.get_channel(channel_id)
            podcasts_data = channel.get("podcasts", {})
            p = podcasts_data.get("params")
            if not p:
                return {"episodes": [], "count": 0}
            result = yt.get_channel_episodes(channel_id, p)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Channel episodes error: {str(e)[:200]}")
    elapsed = time.perf_counter() - start
    logger.info(f"[channel_episodes] channelId={channel_id} in {elapsed:.2f}s")
    return {"episodes": result, "count": len(result) if isinstance(result, list) else 0}


@router.get("/channel/{channel_id}/episodes")
async def get_channel_episodes(
    channel_id: str,
    params: Optional[str] = Query(default=None),
) -> dict:
    return await run_in_threadpool(_get_channel_episodes_sync, channel_id, params)
