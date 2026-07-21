import os
import asyncio
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import home, search, songs, artists, albums, playlists, podcasts
import uvicorn

async def ping_self_loop():
    await asyncio.sleep(15)
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
    import sys
    import os
    import shutil
    import subprocess
    
    py_dir = os.path.dirname(sys.executable)
    if py_dir and py_dir not in os.environ.get("PATH", "").split(os.pathsep):
        os.environ["PATH"] = py_dir + os.pathsep + os.environ.get("PATH", "")
        print(f"[startup] Added python binary directory to PATH: {py_dir}")

    possible_deno_paths = [
        os.path.expanduser("~/.deno/bin"),
        "/root/.deno/bin",
        "/home/render/.deno/bin",
        "/opt/render/.deno/bin",
        "/tmp/deno/bin",
    ]
    deno_found = False
    for deno_dir in possible_deno_paths:
        if os.path.isdir(deno_dir):
            if deno_dir not in os.environ.get("PATH", "").split(os.pathsep):
                os.environ["PATH"] = deno_dir + os.pathsep + os.environ.get("PATH", "")
                print(f"[startup] Added Deno binary directory to PATH: {deno_dir}")
            deno_path = os.path.join(deno_dir, "deno")
            if os.path.isfile(deno_path):
                print(f"[startup] Deno found at: {deno_path}")
                deno_found = True
                break
    if not deno_found:
        print("[startup] WARNING: Deno binary not found in standard paths")

    yt_cookies_env = os.getenv("YT_COOKIES")
    readonly_cookies = "/etc/secrets/cookies.txt"
    writable_cookies = "/tmp/cookies.txt"
    
    if yt_cookies_env and len(yt_cookies_env.strip()) > 50:
        try:
            os.makedirs(os.path.dirname(writable_cookies), exist_ok=True)
            with open(writable_cookies, "w", encoding="utf-8") as f:
                f.write(yt_cookies_env)
            print(f"[startup] YT_COOKIES environment variable written to writable path: {writable_cookies}")
        except Exception as e:
            print(f"[startup] Failed to write YT_COOKIES to writable path: {e}")
    elif os.path.exists(readonly_cookies):
        try:
            os.makedirs(os.path.dirname(writable_cookies), exist_ok=True)
            shutil.copy(readonly_cookies, writable_cookies)
            print(f"[startup] Cookies copied from secret to writable path: {writable_cookies}")
        except Exception as e:
            print(f"[startup] Failed to copy cookies to writable path: {e}")
    else:
        print("[startup] WARNING: cookies.txt not found at /etc/secrets/ and YT_COOKIES not set")

    keep_alive_task = asyncio.create_task(ping_self_loop())

    async def periodic_cookie_check():
        await asyncio.sleep(45)
        while True:
            try:
                health = check_cookies_health()
                if health.get("status") == "expired":
                    print(f"⚠️ [COOKIE ALERT] {health.get('message')}")
                elif health.get("status") == "healthy":
                    print("✅ [cookies] Health check passed — valid Netscape cookies active")
            except Exception as e:
                print(f"[cookies] Background health check error: {e}")
            await asyncio.sleep(30 * 60)

    cookie_check_task = asyncio.create_task(periodic_cookie_check())

    yield
    keep_alive_task.cancel()
    cookie_check_task.cancel()

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
    
    test_video_id = "dQw4w9WgXcQ"
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
        'socket_timeout': 8,
        'extractor_retries': 1,
        'retries': 1,
        'cookiefile': cookies_path,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info(url, download=False)
        res = {"status": "healthy", "message": "Cookies are healthy"}
    except Exception as e:
        err_msg = str(e)
        if "sign in" in err_msg.lower() or "bot" in err_msg.lower():
            res = {"status": "expired", "message": f"[cookies] expired — refresh needed: {err_msg}"}
        else:
            res = {"status": "error", "message": f"Cookie check failed: {err_msg}"}
    finally:
        import gc
        gc.collect()
    return res


from pydantic import BaseModel
from pathlib import Path

class CookieUpdatePayload(BaseModel):
    cookies: str


@app.post("/api/music/cookies/update")
async def update_cookies(payload: CookieUpdatePayload) -> dict:
    from starlette.concurrency import run_in_threadpool
    
    def do_update():
        writable_cookies = "/tmp/cookies.txt"
        local_cookies = Path(__file__).parent / "cookies.txt"
        
        try:
            with open(local_cookies, "w") as f:
                f.write(payload.cookies)
        except Exception as e:
            return {"status": "error", "message": f"Failed to write to local cookies: {e}"}
            
        try:
            os.makedirs(os.path.dirname(writable_cookies), exist_ok=True)
            with open(writable_cookies, "w") as f:
                f.write(payload.cookies)
        except Exception as e:
            return {"status": "error", "message": f"Failed to write to writable cookies: {e}"}
            
        try:
            from routers.songs import _stream_circuit_breaker
            _stream_circuit_breaker.record_success()
        except Exception as e:
            print(f"[cookies_update] Failed to reset circuit breaker: {e}")
            
        health_res = check_cookies_health()
        return {
            "status": "success",
            "message": "Cookies successfully updated",
            "health": health_res
        }
        
    return await run_in_threadpool(do_update)


@app.get("/api/music/cookies/health")
async def cookies_health() -> dict:
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(check_cookies_health)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "music-provider", "version": "1.0.0"}


if __name__ == "__main__":
    import multiprocessing
    workers = min(multiprocessing.cpu_count(), 4)
    uvicorn.run("main:app", host="0.0.0.0", port=4002, reload=True, workers=1)
