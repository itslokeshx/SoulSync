"""
Podcasts, episodes, and channels router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from services.ytmusic_client import get_client, with_retry

router = APIRouter()
logger = logging.getLogger("music-provider.podcasts")


@router.get("/podcast/{playlist_id}")
@with_retry()
def get_podcast(playlist_id: str) -> dict:
    """Get podcast details and episodes."""
    start = time.perf_counter()
    yt = get_client()
    try:
        result = yt.get_podcast(playlist_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Podcast not found: {str(e)[:200]}")
    elapsed = time.perf_counter() - start
    logger.info(f"[podcast] id={playlist_id} in {elapsed:.2f}s")
    return result


@router.get("/episode/{video_id}")
@with_retry()
def get_episode(video_id: str) -> dict:
    """Get episode details by videoId."""
    start = time.perf_counter()
    yt = get_client()
    try:
        result = yt.get_episode(video_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Episode not found: {str(e)[:200]}")
    elapsed = time.perf_counter() - start
    logger.info(f"[episode] videoId={video_id} in {elapsed:.2f}s")
    return result


@router.get("/channel/{channel_id}")
@with_retry()
def get_channel(channel_id: str) -> dict:
    """Get podcast channel details."""
    start = time.perf_counter()
    yt = get_client()
    try:
        result = yt.get_channel(channel_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Channel not found: {str(e)[:200]}")
    elapsed = time.perf_counter() - start
    logger.info(f"[channel] channelId={channel_id} in {elapsed:.2f}s")
    return result


@router.get("/channel/{channel_id}/episodes")
@with_retry()
def get_channel_episodes(
    channel_id: str,
    params: Optional[str] = Query(default=None),
) -> dict:
    """Get episodes for a podcast channel."""
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
