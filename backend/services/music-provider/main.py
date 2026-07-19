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
    # Add virtualenv bin directory to PATH so that executables like node from nodejs-wheel are found
    import sys
    import os
    import shutil
    import subprocess
    
    py_dir = os.path.dirname(sys.executable)
    if py_dir and py_dir not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = py_dir + os.pathsep + os.environ.get("PATH", "")
        print(f"[startup] Added python binary directory to PATH: {py_dir}")


    # Copy cookies from read-only /etc/secrets/ to writable /tmp/
    import shutil
    readonly_cookies = "/etc/secrets/cookies.txt"
    writable_cookies = "/tmp/cookies.txt"
    if os.path.exists(readonly_cookies):
        try:
            os.makedirs(os.path.dirname(writable_cookies), exist_ok=True)
            shutil.copy(readonly_cookies, writable_cookies)
            print(f"[startup] Cookies copied to writable path: {writable_cookies}")
        except Exception as e:
            print(f"[startup] Failed to copy cookies to writable path: {e}")
    else:
        print("[startup] WARNING: cookies.txt not found at /etc/secrets/")

    keep_alive_task = asyncio.create_task(ping_self_loop())
    
    async def run_startup_check():
        await asyncio.sleep(5)
        try:
            from fastapi.concurrency import run_in_threadpool
            status = await run_in_threadpool(check_cookies_health)
            if status["status"] == "healthy":
                print(f"[CookieHealth] SUCCESS: {status['message']}")
            else:
                print(f"[CookieHealth] WARNING: {status['message']}")
        except Exception as e:
            print(f"[CookieHealth] Error during startup health check: {e}")

    asyncio.create_task(run_startup_check())

    yield
    keep_alive_task.cancel()

app = FastAPI(
    title="SoulSync Music Provider",
    description="YouTube Music data service powered by ytmusicapi",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"[GlobalHandler] Unhandled exception: {exc}")
    return JSONResponse(status_code=502, content={"error": f"Upstream service error: {exc}"})


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


def check_cookies_health() -> dict:
    import yt_dlp
    import os
    from pathlib import Path
    
    test_video_id = "dQw4w9WgXcQ"  # Never Gonna Give You Up
    url = f"https://www.youtube.com/watch?v={test_video_id}"
    
    readonly_cookies = "/etc/secrets/cookies.txt"
    writable_cookies = "/tmp/cookies.txt"
    local_cookies = Path(__file__).parent / "cookies.txt"
    
    cookies_path = None
    if os.path.exists(readonly_cookies):
        cookies_path = writable_cookies
    elif os.path.exists(writable_cookies):
        cookies_path = writable_cookies
    elif local_cookies.exists():
        cookies_path = str(local_cookies)
        
    if not cookies_path:
        return {"status": "no_cookies", "message": "No cookies file found"}
        
    opts = {
        'format': 'bestaudio',
        'quiet': True,
        'no_plugins': True,
        'cookiefile': cookies_path,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info(url, download=False)
        return {"status": "healthy", "message": "Cookies are healthy"}
    except Exception as e:
        err_msg = str(e)
        if "sign in" in err_msg.lower() or "bot" in err_msg.lower():
            return {"status": "expired", "message": f"Cookies expired or flagged: {err_msg}"}
        return {"status": "error", "message": f"Cookie check failed: {err_msg}"}


@app.get("/api/music/cookies/health")
def cookies_health() -> dict:
    """Check YouTube authentication cookies health status."""
    return check_cookies_health()


@app.get("/health")
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "music-provider", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=4002, reload=True)
