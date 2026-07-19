"""
SoulSync Music Provider Service — FastAPI entry point.
Wraps ytmusicapi to provide a REST API for YouTube Music data.
"""
import os
import asyncio
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import home, search, songs, artists, albums, playlists, podcasts
import uvicorn

async def ping_self_loop():
    await asyncio.sleep(15)  # Wait for startup
    # Render automatically sets RENDER_EXTERNAL_URL for web services
    self_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("MUSIC_PROVIDER_URL")
    if not self_url:
        print("[KeepAlive] No RENDER_EXTERNAL_URL or MUSIC_PROVIDER_URL set — skipping self-ping")
        return

    health_url = f"{self_url.rstrip('/')}/health"
    print(f"[KeepAlive] Self-ping active every 14 min → {health_url}")
    
    async with httpx.AsyncClient() as client:
        while True:
            try:
                response = await client.get(health_url, timeout=10.0)
                print(f"[KeepAlive] Pinged {health_url} → {response.status_code}")
            except Exception as e:
                print(f"[KeepAlive] Ping failed: {e}")
            await asyncio.sleep(14 * 60)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    keep_alive_task = asyncio.create_task(ping_self_loop())
    yield
    keep_alive_task.cancel()

app = FastAPI(
    title="SoulSync Music Provider",
    description="YouTube Music data service powered by ytmusicapi",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(home.router, prefix="/api/music", tags=["Home & Discovery"])
app.include_router(search.router, prefix="/api/music", tags=["Search"])
app.include_router(songs.router, prefix="/api/music", tags=["Songs"])
app.include_router(artists.router, prefix="/api/music", tags=["Artists"])
app.include_router(albums.router, prefix="/api/music", tags=["Albums"])
app.include_router(playlists.router, prefix="/api/music", tags=["Playlists"])
app.include_router(podcasts.router, prefix="/api/music", tags=["Podcasts"])


@app.get("/health")
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "music-provider", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=4002, reload=True)
