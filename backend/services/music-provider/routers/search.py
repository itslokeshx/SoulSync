"""
Search and suggestions router.
"""
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.search")


@router.get("/search")
@cache_response(ttl_seconds=900, prefix="search")
@with_retry()
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    filter: Optional[str] = Query(default="songs", description="Filter: songs, videos, albums, artists, playlists, podcasts"),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Search YouTube Music across all content types or filtered by type."""
    start = time.perf_counter()
    yt = get_client()

    kwargs: dict = {"query": q}
    if filter:
        kwargs["filter"] = filter
    if limit:
        kwargs["limit"] = limit

    results = yt.search(**kwargs)

    # Defensive filtering based on requested filter type
    if isinstance(results, list):
        if filter == "songs":
            results = [r for r in results if isinstance(r, dict) and r.get("resultType") in ("song", "video")]
        elif filter == "artists":
            results = [r for r in results if isinstance(r, dict) and r.get("resultType") == "artist"]
        elif filter == "albums":
            results = [r for r in results if isinstance(r, dict) and r.get("resultType") == "album"]
        elif filter == "playlists":
            results = [r for r in results if isinstance(r, dict) and r.get("resultType") == "playlist"]

    elapsed = time.perf_counter() - start
    logger.info(f"[search] q='{q}' filter={filter} → {len(results)} results in {elapsed:.2f}s")
    return {"results": results, "total": len(results), "query": q, "filter": filter}


@router.get("/suggestions")
@cache_response(ttl_seconds=900, prefix="suggestions")
@with_retry()
def get_suggestions(q: str = Query(..., min_length=1)) -> dict:
    """Get search suggestions/autocomplete for a query."""
    start = time.perf_counter()
    yt = get_client()
    results = yt.get_search_suggestions(q)
    elapsed = time.perf_counter() - start
    logger.info(f"[suggestions] q='{q}' → {len(results)} suggestions in {elapsed:.2f}s")
    return {"suggestions": results, "query": q}
