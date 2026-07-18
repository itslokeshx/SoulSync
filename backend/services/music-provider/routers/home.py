"""
Home, Charts, and Moods router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.home")


@router.get("/home")
@cache_response(ttl_seconds=3600, prefix="home")
@with_retry()
def get_home(limit: int = Query(default=6, ge=1, le=20)) -> dict:
    """Get the YouTube Music home feed with discovery sections."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_home(limit=limit)
    elapsed = time.perf_counter() - start
    logger.info(f"[home] Fetched {len(result)} sections in {elapsed:.2f}s")
    return {"sections": result, "count": len(result)}


@router.get("/charts")
@cache_response(ttl_seconds=3600, prefix="charts")
@with_retry()
def get_charts(country: Optional[str] = Query(default=None)) -> dict:
    """Get YouTube Music charts, optionally filtered by country code (e.g., 'IN')."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_charts(country=country) if country else yt.get_charts()
    elapsed = time.perf_counter() - start
    logger.info(f"[charts] Fetched charts{' for ' + country if country else ''} in {elapsed:.2f}s")
    return result


@router.get("/moods")
@cache_response(ttl_seconds=86400, prefix="mood_categories")
@with_retry()
def get_mood_categories() -> dict:
    """Get all mood/genre categories for browsing."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_mood_categories()
    elapsed = time.perf_counter() - start
    logger.info(f"[moods] Fetched {len(result)} categories in {elapsed:.2f}s")
    return {"categories": result}


@router.get("/moods/{params:path}")
@cache_response(ttl_seconds=3600, prefix="mood_playlists")
@with_retry()
def get_mood_playlists(params: str) -> dict:
    """Get playlists for a specific mood/genre category."""
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_mood_playlists(params)
    elapsed = time.perf_counter() - start
    logger.info(f"[moods] Fetched {len(result)} playlists in {elapsed:.2f}s")
    return {"playlists": result, "count": len(result)}
