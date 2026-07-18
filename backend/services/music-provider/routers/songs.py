"""
Songs, lyrics, watch queue, and related content router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Body
from concurrent.futures import ThreadPoolExecutor

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


@router.post("/songs/batch")
def get_songs_batch(video_ids: list[str] = Body(embed=True)) -> dict:
    """Get metadata for multiple songs in parallel using a thread pool."""
    if not video_ids:
        return {"results": []}

    # Limit batch size to 30 to prevent rate-limiting or uvicorn starvation
    vids = video_ids[:30]

    def fetch_one(vid: str):
        try:
            yt = get_client()
            return {"video_id": vid, "data": yt.get_song(vid), "success": True}
        except Exception as e:
            logger.warning(f"Batch fetch failed for {vid}: {e}")
            return {"video_id": vid, "error": str(e), "success": False}

    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=min(len(vids), 15)) as executor:
        results = list(executor.map(fetch_one, vids))

    elapsed = time.perf_counter() - start
    logger.info(f"[songs/batch] Fetched {len(vids)} songs in {elapsed:.2f}s")
    return {"results": results}
