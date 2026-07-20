import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool

from services.ytmusic_client import get_client, with_retry
from services.cache import cache_response

router = APIRouter()
logger = logging.getLogger("music-provider.home")


@cache_response(ttl_seconds=3600, prefix="home")
@with_retry()
def _get_home_sync(limit: int = 6) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_home(limit=limit)
    elapsed = time.perf_counter() - start
    logger.info(f"[home] Fetched {len(result)} sections in {elapsed:.2f}s")
    return {"sections": result, "count": len(result)}


@router.get("/home")
async def get_home(limit: int = Query(default=6, ge=1, le=20)) -> dict:
    return await run_in_threadpool(_get_home_sync, limit)


@cache_response(ttl_seconds=7200, prefix="charts")
@with_retry()
def _get_charts_sync(country: Optional[str] = None) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_charts(country=country) if country else yt.get_charts()
    elapsed = time.perf_counter() - start
    logger.info(f"[charts] Fetched charts{' for ' + country if country else ''} in {elapsed:.2f}s")
    return result


@router.get("/charts")
async def get_charts(country: Optional[str] = Query(default=None)) -> dict:
    return await run_in_threadpool(_get_charts_sync, country)


@cache_response(ttl_seconds=86400, prefix="mood_categories")
@with_retry()
def _get_mood_categories_sync() -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_mood_categories()
    elapsed = time.perf_counter() - start
    logger.info(f"[moods] Fetched {len(result)} categories in {elapsed:.2f}s")
    return {"categories": result}


@router.get("/moods")
async def get_mood_categories() -> dict:
    return await run_in_threadpool(_get_mood_categories_sync)


@cache_response(ttl_seconds=7200, prefix="mood_playlists")
@with_retry()
def _get_mood_playlists_sync(params: str) -> dict:
    start = time.perf_counter()
    yt = get_client()
    result = yt.get_mood_playlists(params)
    elapsed = time.perf_counter() - start
    logger.info(f"[moods] Fetched {len(result)} playlists in {elapsed:.2f}s")
    return {"playlists": result, "count": len(result)}


@router.get("/moods/{params:path}")
async def get_mood_playlists(params: str) -> dict:
    return await run_in_threadpool(_get_mood_playlists_sync, params)
