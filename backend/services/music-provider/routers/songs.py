"""
Songs, lyrics, watch queue, and related content router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from services.ytmusic_client import get_client, with_retry

router = APIRouter()
logger = logging.getLogger("music-provider.songs")


@router.get("/song/{video_id}")
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
