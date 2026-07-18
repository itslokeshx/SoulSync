# SoulSync Architecture Weaknesses Audit

**Date:** 2026-07-18  
**Auditor:** Automated Architecture Review  
**Codebase Version:** 4.0.0

---

## 1. Single Point of Failure — **CRITICAL**

The entire backend is a **single Node.js process** running on Render free tier (port 4000). This process handles:
- Authentication (Google OAuth + JWT)
- Song search and streaming (via `youtubei.js`)
- AI playlist generation (Groq API)
- WebSocket rooms (SoulLink)
- Recommendations engine
- Analytics and history
- Admin panel

**Impact:** If the process crashes (OOM, unhandled rejection, `youtubei.js` rate-limit), **all features go down simultaneously**. Render free tier has 512MB RAM — the recommendation engine alone is 62KB of code with significant in-memory data structures.

**Mitigation:** Extract `music-provider-svc` (Python/FastAPI) as a separate service. Critical path isolation means a `youtubei.js` crash doesn't kill auth or WebSocket.

---

## 2. Monolith Risk — **HIGH**

All concerns are mixed in the same service:
- **Auth** (JWT + Google OAuth) shares the process with **streaming** (deciphering YouTube URLs)
- **AI** (Groq API calls) shares with **real-time** (Socket.IO)
- **Analytics** (MongoDB writes) blocks the same event loop as **search**

The codebase has 14 route files and 16 service files all running in one process. The `recommendationEngine.ts` alone is 62KB — a mini-service in disguise.

---

## 3. Scaling Bottlenecks — **HIGH**

Several operations are synchronous/CPU-intensive:
- `resolveRealStreamUrl()` — deciphers YouTube stream URLs (CPU-bound via `youtubei.js`)
- `searchEnhancer.ts` — 1,222 lines of query parsing, scoring, and expansion
- `rankSongs()` in `searchRanker.ts` — O(n²) scoring for each search result
- Cache warm-up on boot: 20 sequential searches with 400ms pacing

Under 180+ concurrent users, these block the event loop for incoming requests.

---

## 4. Redis Usage — **MEDIUM**

Redis (Upstash REST API) is used **only as a cache** (`GET`/`SET`/`DEL`/`INCR`):
- Search result caching (TTL 180s–3600s)
- Suggestion caching (TTL 30s)
- AI playlist caching (TTL 1800s)
- Rate limiting counters

**Not used as a message queue or pub/sub.** No race condition risk identified in current usage.

**Gap:** When extracting microservices, Redis should also serve as a **pub/sub bus** for inter-service events (play events → analytics).

---

## 5. API Rate Limiting — **MEDIUM**

Rate limiting exists (`rateLimiter.ts`) with:
- Production: 300 requests / 60 seconds per IP
- Development: 1000 requests / 60 seconds

**However**, there is **no rate limiting on `youtubei.js` calls** specifically. Each search triggers 4+ parallel API calls to YouTube Music:
- `searchSongsHybrid` → YouTube Music
- `searchSongs` (fallback queries) → YouTube Music
- `searchAll` → YouTube Music
- `searchArtists` → YouTube Music

A single user search = 4-6 YouTube Music API calls. At 180 users, that's potentially 1000+ YTM calls/minute. YouTube may throttle or block the IP.

---

## 6. ytmusicapi Gap Analysis — **HIGH**

Current backend uses `youtubei.js` (JavaScript) for YouTube Music. Moving to `ytmusicapi` (Python) provides:

| Feature | Current (`youtubei.js`) | New (`ytmusicapi`) |
|---|---|---|
| Song search | ✅ `yt.music.search()` | ✅ `yt.search()` |
| Stream URL | ✅ `yt.getInfo()` + decipher | ❌ Not available |
| Lyrics | ❌ Not implemented | ✅ `yt.get_lyrics()` |
| Home feed | ❌ Not implemented | ✅ `yt.get_home()` |
| Charts | ❌ Not implemented | ✅ `yt.get_charts()` |
| Mood playlists | ❌ Not implemented | ✅ `yt.get_mood_categories()` |
| Watch queue | ✅ `yt.music.getUpNext()` | ✅ `yt.get_watch_playlist()` |
| Podcasts | ❌ Not implemented | ✅ Full podcast API |
| Artist details | ✅ `yt.music.getArtist()` | ✅ `yt.get_artist()` |
| Album details | ✅ `yt.music.getAlbum()` | ✅ `yt.get_album()` |

**Critical:** `ytmusicapi` does NOT provide stream URL deciphering. The existing `youtubei.js` stream proxy MUST be retained for audio playback.

---

## 7. Authentication Flow — **MEDIUM**

Authentication is **global/per-process**:
- JWT middleware (`auth.ts`, `softAuth.ts`) verifies tokens in the monolith
- Google OAuth callback (`auth.ts`) handles the full flow
- Tokens stored in cookies (web) or Capacitor Preferences (mobile)

**For microservices:** Each service would need JWT verification. Current approach of embedding `JWT_SECRET` in every service is a secret sprawl risk. Should centralize via an auth service or shared JWT verification library.

---

## 8. Frontend Direct API Calls — **MEDIUM**

The frontend has `VITE_JIOSAAVN_API` pointing to `https://saavn.sumit.co/api`:
- `frontend/src/api/jiosaavn.ts` has `getSongById()` calling `JIOSAAVN_EXTERNAL` directly
- Other functions route through the backend proxy

**Security concern:** Direct frontend → external API calls:
1. Expose the API endpoint in client-side JavaScript
2. Bypass backend rate limiting
3. Mix data sources (some from backend, some from external)

**Note:** Despite the variable name, `jiosaavn.ts` actually routes most calls through the backend (`/api/search/smart`). Only `getSongById()` calls external directly — and the external JioSaavn API appears to be legacy/unused since `youtubei.js` replaced it.

---

## Feature-to-Service Mapping

| Feature | Current Location | Proposed Microservice |
|---|---|---|
| Song search | `search.ts` + `searchEnhancer.ts` | Music Discovery Service |
| Stream proxy | `search.ts` `/stream` endpoint | Music Provider Service (keep `youtubei.js`) |
| AI playlist synthesis | `ai.ts` + `groq.ts` | AI Service |
| SoulLink WebSocket rooms | `socket/` | Realtime Service |
| Listening history & analytics | `user.ts` + models | Analytics Service |
| User auth (Google OAuth + JWT) | `auth.ts` | Auth Service |
| YouTube Music API | `youtubeMusicService.ts` | Music Provider Service |
| YT Music discovery (new) | Not yet integrated | Music Provider Service (Python) |
| Redis cache layer | `redis.ts` | Shared Infrastructure |
| Recommendations engine | `recommendationEngine.ts` | Recommendation Service |
| Podcast browsing | Not present | Music Discovery Service (Python) |
| User preferences | `user.ts` | Auth Service |
| Playlists CRUD | `playlist.ts` | Playlist Service or Auth Service |
| Dashboard/Mixes | `dashboard.ts` + `mixes.ts` | Recommendation Service |
| Import | `import.ts` | Import Service (or AI Service) |
| Admin | `admin.ts` + `feedback.ts` | Admin Service (or Auth Service) |
