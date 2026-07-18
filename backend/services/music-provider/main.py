"""
SoulSync Music Provider Service — FastAPI entry point.
Wraps ytmusicapi to provide a REST API for YouTube Music data.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import home, search, songs, artists, albums, playlists, podcasts
import uvicorn

app = FastAPI(
    title="SoulSync Music Provider",
    description="YouTube Music data service powered by ytmusicapi",
    version="1.0.0",
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
