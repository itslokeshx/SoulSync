import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.search")


@cache_response(ttl_seconds=900, prefix="search")
@with_retry()
def _search_sync(q: str, filter: Optional[str] = "songs", limit: int = 20) -> dict:
    start = time.perf_counter()
    yt = get_client()

    kwargs: dict = {"query": q}
    if filter:
        kwargs["filter"] = filter
    if limit:
        kwargs["limit"] = limit

    results = yt.search(**kwargs)

    if isinstance(results, list):
        filtered_results = []
        for r in results:
            if not isinstance(r, dict):
                continue
            
            title = r.get("title") or r.get("name") or r.get("artist")
            if not title:
                title_obj = r.get("title")
                name_obj = r.get("name")
                if isinstance(title_obj, dict) and title_obj.get("text"):
                    title = title_obj["text"]
                    r["title"] = title
                elif isinstance(name_obj, dict) and name_obj.get("text"):
                    title = name_obj["text"]
                    r["name"] = title

            if not title:
                logger.warning(f"Filtering out search result without title/name: {r.get('videoId') or r.get('browseId')}")
                continue

            if filter == "songs":
                if r.get("resultType") in ("song", "video"):
                    filtered_results.append(r)
            elif filter == "artists":
                if r.get("resultType") == "artist":
                    filtered_results.append(r)
            elif filter == "albums":
                if r.get("resultType") == "album":
                    filtered_results.append(r)
            elif filter == "playlists":
                if r.get("resultType") == "playlist":
                    filtered_results.append(r)
            elif filter == "podcasts":
                if r.get("resultType") == "podcast":
                    filtered_results.append(r)
            elif filter == "episodes":
                if r.get("resultType") == "episode":
                    filtered_results.append(r)
            else:
                filtered_results.append(r)
        results = filtered_results

    elapsed = time.perf_counter() - start
    logger.info(f"[search] q='{q}' filter={filter} → {len(results)} results in {elapsed:.2f}s")
    return {"results": results, "total": len(results), "query": q, "filter": filter}


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    filter: Optional[str] = Query(default="songs", description="Filter: songs, videos, albums, artists, playlists, podcasts"),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    return await run_in_threadpool(_search_sync, q, filter, limit)


@cache_response(ttl_seconds=900, prefix="suggestions")
@with_retry()
def _get_suggestions_sync(q: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    results = yt.get_search_suggestions(q)
    elapsed = time.perf_counter() - start
    logger.info(f"[suggestions] q='{q}' → {len(results)} suggestions in {elapsed:.2f}s")
    return {"suggestions": results, "query": q}


@router.get("/suggestions")
async def get_suggestions(q: str = Query(..., min_length=1)) -> dict:
    return await run_in_threadpool(_get_suggestions_sync, q)
