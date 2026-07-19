"""
Playlists router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from services.ytmusic_client import get_client, with_retry
from services.cache import get_cached, set_cached, cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.playlists")


@router.get("/playlist/{playlist_id}")
@cache_response(ttl_seconds=1800, prefix="playlist")
@with_retry()
def get_playlist(
    playlist_id: str,
    limit: Optional[int] = Query(default=None, ge=1, le=5000),
) -> dict:
    """Get playlist details and tracks by playlistId or browseId."""
    start = time.perf_counter()
    dead_key = f"dead_playlist:{playlist_id}"
    
    # Check dead playlist cache
    if get_cached(dead_key):
        logger.info(f"[playlist] id={playlist_id} is marked as DEAD, returning empty stub")
        return {"tracks": [], "title": "Stale/Inactive Playlist", "id": playlist_id, "browseId": playlist_id, "is_dead": True}

    # Check if this is a podcast series
    is_podcast_id = playlist_id.startswith("MPSP") or "podcast" in playlist_id.lower()
    
    yt = get_client()

    if is_podcast_id:
        try:
            podcast = yt.get_podcast(playlist_id)
            tracks = []
            author = podcast.get("author") or {}
            author_name = author.get("name") if isinstance(author, dict) else str(author)
            for ep in podcast.get("episodes", []):
                tracks.append({
                    "videoId": ep.get("videoId"),
                    "title": ep.get("title"),
                    "artists": [{"name": author_name or "Unknown Author"}],
                    "album": {"name": podcast.get("title")},
                    "duration": ep.get("duration"),
                    "thumbnails": ep.get("thumbnails"),
                    "videoType": ep.get("videoType")
                })
            elapsed = time.perf_counter() - start
            logger.info(f"[playlist] podcast series id={playlist_id} → {len(tracks)} episodes in {elapsed:.2f}s")
            return {
                "id": playlist_id,
                "browseId": playlist_id,
                "title": podcast.get("title"),
                "description": podcast.get("description"),
                "thumbnails": podcast.get("thumbnails"),
                "tracks": tracks
            }
        except Exception as e:
            logger.error(f"[playlist] Failed to fetch podcast series {playlist_id}: {e}")

    kwargs: dict = {"playlistId": playlist_id}
    if limit:
        kwargs["limit"] = limit

    try:
        result = yt.get_playlist(**kwargs)
        if result is None:
            raise HTTPException(status_code=404, detail=f"Playlist not found: {playlist_id}")
        elapsed = time.perf_counter() - start
        track_count = len(result.get("tracks", []))
        logger.info(f"[playlist] id={playlist_id} → {track_count} tracks in {elapsed:.2f}s")
        return result
    except KeyError as e:
        is_structural = any(k in str(e) for k in ("contents", "secondSubtitle", "tabs"))
        if is_structural:
            # Fallback to get_podcast on structural error (just in case the prefix check missed it)
            try:
                logger.info(f"[playlist] Structural error on standard playlist, attempting podcast fallback for {playlist_id}...")
                podcast = yt.get_podcast(playlist_id)
                tracks = []
                author = podcast.get("author") or {}
                author_name = author.get("name") if isinstance(author, dict) else str(author)
                for ep in podcast.get("episodes", []):
                    tracks.append({
                        "videoId": ep.get("videoId"),
                        "title": ep.get("title"),
                        "artists": [{"name": author_name or "Unknown Author"}],
                        "album": {"name": podcast.get("title")},
                        "duration": ep.get("duration"),
                        "thumbnails": ep.get("thumbnails"),
                        "videoType": ep.get("videoType")
                    })
                return {
                    "id": playlist_id,
                    "browseId": playlist_id,
                    "title": podcast.get("title"),
                    "description": podcast.get("description"),
                    "thumbnails": podcast.get("thumbnails"),
                    "tracks": tracks
                }
            except Exception as pe:
                logger.warning(f"[playlist] Podcast fallback also failed: {pe}")
            
            logger.warning(f"[playlist] id={playlist_id} got structural KeyError: {e}. Marking as DEAD.")
            set_cached(dead_key, True, ttl_seconds=86400)
            return {"tracks": [], "title": "Stale/Inactive Playlist", "id": playlist_id, "browseId": playlist_id, "is_dead": True}
        raise
    except Exception as e:
        # Increment failure count for other transient exceptions
        fail_key = f"playlist_fails:{playlist_id}"
        fails = (get_cached(fail_key) or 0) + 1
        set_cached(fail_key, fails, ttl_seconds=3600)
        if fails >= 3:
            logger.warning(f"[playlist] id={playlist_id} failed {fails} times. Marking as DEAD.")
            set_cached(dead_key, True, ttl_seconds=86400)
            return {"tracks": [], "title": "Stale/Inactive Playlist", "id": playlist_id, "browseId": playlist_id, "is_dead": True}
        raise


@router.get("/playlist/{playlist_id}/suggestions")
@cache_response(ttl_seconds=1800, prefix="playlist_suggestions")
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
