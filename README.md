<div align="center">

<br/>

<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1rem 1rem;
    background: transparent;
  }
  .ascii {
    font-family: 'Courier New', Courier, monospace;
    font-weight: 900;
    white-space: pre;
    line-height: 1.15;
    user-select: none;
    background: linear-gradient(135deg, #1ed760 0%, #1db954 60%, #1aa34a 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-size: clamp(4px, 1.65vw, 13px);
    letter-spacing: 0;
  }
  .tagline {
    margin-top: 0.75rem;
    font-family: 'Courier New', monospace;
    font-size: clamp(9px, 1.4vw, 13px);
    color: #a0a0a0;
    letter-spacing: 0.15em;
    text-transform: lowercase;
  }
  .tagline span {
    color: #1ed760;
    font-weight: 900;
  }
</style>
<div class="wrap">
  <div class="ascii">
███████╗ ██████╗ ██╗   ██╗██╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗
██╔════╝██╔═══██╗██║   ██║██║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
███████╗██║   ██║██║   ██║██║     ███████╗ ╚████╔╝ ██╔██╗ ██║██║     
╚════██║██║   ██║██║   ██║██║     ╚════██║  ╚██╔╝  ██║╚██╗██║██║     
███████║╚██████╔╝╚██████╔╝███████╗███████║   ██║   ██║ ╚████║╚██████╗
╚══════╝ ╚═════╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝</div>
  <div class="tagline"><span>listen together.</span> feel together.</div>
</div>

**Free, open-source music streaming — AI playlists, real-time duo sessions, intelligent search, native Android. No ads. No limits. No subscription. Ever.**

<br/>

[![Web App](https://img.shields.io/badge/🌐_Launch_Web_App-soul--sync--beta.vercel.app-1DB954?style=for-the-badge)](https://soul-sync-beta.vercel.app/)
&nbsp;
[![Download APK](https://img.shields.io/badge/📱_Download_APK-Android_5.2_MB-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

[![Stars](https://img.shields.io/github/stars/itslokeshx/SoulSync?style=social)](https://github.com/itslokeshx/SoulSync)
[![Forks](https://img.shields.io/github/forks/itslokeshx/SoulSync?style=social)](https://github.com/itslokeshx/SoulSync/fork)
[![Issues](https://img.shields.io/github/issues/itslokeshx/SoulSync)](https://github.com/itslokeshx/SoulSync/issues)
[![License](https://img.shields.io/github/license/itslokeshx/SoulSync)](LICENSE)

<sub>Android 7.0+ required · No Play Store needed · <a href="https://github.com/itslokeshx/SoulSync/releases">All Releases</a></sub>

</div>

<br/>

---

<br/>

## Overview

SoulSync is a full-stack music streaming application that gives you everything Spotify Premium charges ₹119/month for — completely free. Built on a single codebase that ships both a web app and a native Android APK, it combines an intelligent 7-factor search engine, AI-powered playlist generation via Groq's LLaMA 3.3 70B, real-time synchronized listening sessions, and seamless offline support.

<br/>

## Tech Stack

<div align="center">

| Layer | Technologies |
|---|---|
| **Frontend** | TypeScript 5.7 · React 18.3 · Vite 6.1 · Tailwind CSS 3.4 · Zustand 5 · Framer Motion 12 · TanStack Query 5 |
| **Mobile** | Capacitor 8.1 · Android API 24+ · Capacitor Filesystem · Capacitor Network · Capacitor Haptics |
| **Backend** | Node.js 18+ · Express 4.21 · Socket.io 4.8 · TypeScript 5.7 · Zod · Helmet |
| **Data** | MongoDB 8.9 · Upstash Redis · Listening History TTL (90-day) |
| **AI** | Groq SDK · LLaMA 3.3 70B · Multi-key rotation · Redis cache (30 min) |
| **Auth** | Google OAuth 2.0 · JWT (RS256) · httpOnly cookies |
| **Infra** | Vercel (frontend) · Render (backend) · MongoDB Atlas |

</div>

<br/>

---

<br/>

## Features

### 🔍 Intelligent Search

A 7-factor ranking engine that guarantees originals rank first — every time.

| Signal | Weight | Effect |
|---|---|---|
| **Play count** | Dominant (0–80 pts) | Ed Sheeran (2.1B plays) always beats any cover (5K plays) |
| **Cover penalty** | Hard (−100 pts) | "recreation", "cover", "karaoke", "tribute" → buried |
| **Title match** | Strong (0–50 pts) | Exact phrase ranks above partial word overlap |
| **Artist match** | Medium (0–20 pts) | Queried artist name boosts their own songs |
| **Original markers** | Bonus (+15 pts) | "official audio", "official video" boosted |
| **Language preference** | Soft (+10 pts) | Your preferred language surfaces first |
| **Stream URL check** | Required (−50 if missing) | Unplayable songs automatically buried |

- **50 results** per search — up from 20
- **Artists section** — artist profile card surfaces above songs
- **Albums section** — full tracklist in results
- **Deduplication** — parallel API calls merged, keeping highest play-count version
- **Redis cache** — 10-minute TTL, repeat searches return in under 50ms

<br/>

### 🤖 AI Playlist Engine

```
User Input → Groq LLaMA 3.3 70B → Optimized search queries
     ↓                                        ↓
NLP Pipeline ← 500+ artist dictionary · mood tokenization · language detection
     ↓
7-Factor Ranker → Deduplicated results → Confidence scoring → One-click save
```

- **Mood-based generation** — describe a vibe, get 15 matching songs with a creative playlist name
- **Song list mode** — paste song names, AI matches from JioSaavn automatically
- **Confidence scoring** — high / partial / none with relevance-based ranking
- **Multi-key rotation** — up to 5 Groq API keys with round-robin and auto-fallback
- **Universal playlist import** — Spotify, YouTube Music, Apple Music, Gaana, or plain text — zero API keys, zero logins

<br/>

### 🎧 SoulLink — Real-Time Listening Sessions

```
Host creates session → 6-character code
Guest joins with code → Instant sync

Host                    Server                  Guest
 ├── song-change ──────▶│──── song-change ──────▶│
 ├── play ──────────────▶│──── play ──────────────▶│
 ├── seek ──────────────▶│──── seek ──────────────▶│
 │◀── message ──────────│◀─── message ────────────┤
 └── heartbeat (5s) ────▶│◀─── heartbeat ──────────┘
```

| Socket Event | Direction | Purpose |
|---|---|---|
| `duo:join` | Client → Server | Join room with code, name, role |
| `duo:sync-song-change` | Client ↔ Server | Sync current song + queue |
| `duo:sync-play` | Client ↔ Server | Sync play action + timestamp |
| `duo:sync-seek` | Client ↔ Server | Sync seek position |
| `duo:message` | Client ↔ Server | In-session chat |
| `duo:end-session` | Client → Server | End session for both |

Beautiful session recap card on end. Powered by Socket.io rooms with heartbeat and disconnect cleanup.

<br/>

### 📱 Native Android APK

One codebase. One backend. Two platforms. Zero compromise.

| Feature | Description |
|---|---|
| **Instant offline** | Opens directly into app with no login screen when offline |
| **Native file storage** | Songs saved to device via `@capacitor/filesystem` |
| **Lock screen controls** | Play, pause, skip from Android lock screen |
| **Background audio** | Music keeps playing when app is minimized |
| **Haptic feedback** | Every tap, like, skip, seek feels native |
| **Native Google Sign-In** | Bottom sheet — no popup, fully native |
| **Native share sheet** | Share songs via any installed app |
| **Swipe-up player** | Swipe up from mini bar → full screen immersive view |
| **Swipe-down minimize** | Drag down on full player → collapses to mini bar |

<br/>

### 🔗 Sharing

- **Song links** — `soul-sync-beta.vercel.app/s/:slug` — plays without an account
- **Playlist links** — `soul-sync-beta.vercel.app/p/:slug` — full playlist, no login required
- Rich OG meta tags — beautiful preview cards in WhatsApp, iMessage, Telegram
- Dominant color gradient from album art as animated background
- Share from the full player, song context menu, or playlist page
- Never expires — stored permanently in MongoDB, stream URLs auto-refreshed

<br/>

### ✈️ Offline Mode

| Scenario | Web | APK |
|---|---|---|
| Online + logged in | Full access | Full access |
| Online + not logged in | → Login required | → Login required |
| Offline + logged in | Downloaded songs only | Downloaded songs only |
| **Offline + not logged in** | ❌ → Login page | ✅ Opens directly |

`NetworkProvider` wraps the entire app as a single source of truth for online/offline state. Seamless reconnection — no reload, no interruption. Yellow offline bar and green "Back online" toast.

<br/>

---

<br/>

## Architecture

```
┌─────────────── WEB BROWSER ──────────────────┐  ┌────────── ANDROID APK ──────────┐
│                                              │  │                                 │
│  Auth → Zustand → Router → IndexedDB         │  │  Auth → Zustand → Router →      │
│  NetworkProvider                             │  │  Capacitor Filesystem           │
│                                              │  │  NetworkProvider                │
│  ┌── AppLayout ──────────────────────────┐  │  │                                 │
│  │ Sidebar  Pages  PlayerBar  DuoPanel  │  │  │  ┌── Mobile Layout ───────────┐  │
│  └──────────────────────────────────────┘  │  │  │ BottomNav  MiniPlayer      │  │
│                                              │  │  │ FullScreenPlayer  Queue   │  │
└───────────────────┬──────────────────────────┘  │  └────────────────────────────┘  │
                    │                             └────────────┬────────────────────┘
                    │        REST API + WebSocket              │
                    └──────────────────┬───────────────────────┘
                                       │
                      ┌────────────────▼────────────────┐
                      │          RENDER BACKEND          │
                      │        Express + Socket.io       │
                      │                                  │
                      │  /auth  /search  /playlist       │
                      │  /user  /ai  /session            │
                      │  /dashboard  /share  /import     │
                      │                                  │
                      │  MongoDB Atlas · Redis Cache     │
                      │  Groq AI · saavn.sumit.co        │
                      └──────────────────────────────────┘
```

### Data Models

| Model | Key Fields |
|---|---|
| **User** | googleId, email, name, photo, preferences (languages/eras/moods), likedSongs[], totalListeningTime |
| **Playlist** | userId, name, description, songs[], isPublic, isAIGenerated, tags[], songCount, totalDuration |
| **ListeningHistory** | userId, songId, title, artist, source — 90-day TTL |
| **DuoSession** | host/guest, roomCode, currentSong, playState, messages[] |
| **Share** | slug (nanoid), type (song/playlist), data, createdAt, viewCount |
| **Import** | userId, sourceUrl, platform, songs[], status, createdAt |

### Zustand Stores

| Store | Manages |
|---|---|
| `playerStore` | Current song, play/pause, time, volume, shuffle, repeat, isExpanded |
| `queueStore` | Song queue, history, add/remove/reorder |
| `searchStore` | Query, results (songs + artists + albums), filters |
| `duoStore` | SoulLink session state + sessionStorage persistence |
| `offlineStore` | Downloaded songs, offline mode flag, cached user |

<br/>

---

<br/>

## SoulSync vs Spotify

<div align="center">

| Feature | SoulSync | Spotify Free | Spotify Premium |
|---|:---:|:---:|:---:|
| **Ad-free listening** | ✅ Always | ❌ Ads every song | ✅ Paid |
| **AI Playlist Builder** | ✅ Free, unlimited | ❌ | ❌ |
| **Listen Together (Duo)** | ✅ Free + built-in chat | ❌ | ✅ Paid, no chat |
| **Song Downloads** | ✅ Free, stored locally | ❌ | ✅ Paid only |
| **Intelligent Search** | ✅ Originals-first, 50 results | ❌ Keyword only | ❌ Keyword only |
| **Song & Playlist Sharing** | ✅ No account to play | ✅ Account needed | ✅ Account needed |
| **Playlist Import** | ✅ From Spotify/YT/Apple | ❌ | ❌ |
| **Offline without login** | ✅ APK exclusive | ❌ | ❌ |
| **Indian Language Support** | ✅ 10+ languages | ❌ Poor regional | ❌ Poor regional |
| **Open Source** | ✅ MIT License | ❌ Closed | ❌ Closed |
| **Monthly Price** | **₹0 forever** | ₹0 with ads | **₹119/month** |

</div>

<br/>

---

<br/>

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | Required |
| npm | ≥ 9 | Required |
| MongoDB Atlas | Free M0 | Required |
| Google Cloud | OAuth 2.0 Client ID | Required |
| Groq API | Free key | AI features |
| Android Studio | Latest | APK builds only |

### Quick Start

```bash
# Clone
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

# Install all dependencies
npm run install:all

# Configure environment
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Start backend
npm run dev:backend

# Start frontend (new terminal)
npm run dev:frontend

# Open http://localhost:5173
```

### Environment Variables

**`frontend/.env`**
```env
VITE_BACKEND_URL=https://your-soulsync-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_JIOSAAVN_API=https://saavn.sumit.co/api
VITE_DUO_BACKEND=https://your-soulsync-backend.onrender.com
VITE_FRONTEND_URL=https://soul-sync-beta.vercel.app
```

**`backend/.env`**
```env
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://soul-sync-beta.vercel.app

MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/soulsync
JWT_SECRET=your-64-char-hex-secret
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

GROQ_KEY_1=gsk_xxxxx
GROQ_KEY_2=gsk_xxxxx
JIOSAAVN_API=https://saavn.sumit.co/api

UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxx
```

> **Important:** `JIOSAAVN_API` must be set in `backend/.env` without the `VITE_` prefix. The `VITE_` prefix only resolves in the frontend bundle — it is always `undefined` on the server.

<br/>

---

<br/>

## Deployment

### Frontend → Vercel

```
1. Push repo to GitHub
2. Import on vercel.com → set VITE_* env vars
3. Deploy — vercel.json is included
4. Add deployed URL to Google OAuth authorized origins
```

### Backend → Render

```
1. Create Web Service → connect GitHub repo
2. Root directory: backend
3. Build command: npm install --include=dev && npm run build
4. Start command: npm start
5. Set all backend env vars including JIOSAAVN_API
```

### Android APK

```bash
# Build web bundle
cd frontend && npm run build

# Sync to Android
npx cap sync android

# Build via command line
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Or open in Android Studio
npx cap open android
# Build → Generate Signed Bundle / APK → APK → Release
```

**Install on device:**
```
1. Download SoulSync.apk
2. Settings → Security → Enable "Install from unknown sources"
3. Open APK → Tap Install
```

<br/>

---

<br/>

## API Reference

### `POST /api/auth/google`
Authenticate with Google ID token.
```json
Request:  { "idToken": "..." }
Response: { "user": {...}, "isNewUser": true }
```

### `GET /api/search?q=...&lang=...&limit=50`
Intelligent 7-factor ranked search.
```json
Response: { "songs": [...50], "artists": [...], "albums": [...], "query": "..." }
```

### `GET /api/search/artist/:id` · `GET /api/search/album/:id`
Artist top songs (sorted by popularity) and full album tracklist.

### `POST /api/share/song` · `POST /api/share/playlist`
Generate a shareable slug. Requires auth.
```json
Request:  { "song": {...} }
Response: { "slug": "abc123", "url": "https://..." }
```

### `GET /api/share/s/:slug` · `GET /api/share/p/:slug`
Retrieve shared song or playlist. No auth required. Stream URLs auto-refreshed.

### `POST /api/import/detect`
Detect platform and extract songs from a playlist URL.
```json
Request:  { "url": "https://open.spotify.com/playlist/..." }
Response: { "platform": "spotify", "songs": [...] }
```

### `GET /api/dashboard` (auth) · `GET /api/dashboard/guest`
Personalized or guest dashboard with 3×3 quick-play grid, time-based mix, trending, and mood sections.

### `GET /api/ai/generate` · `POST /api/ai/match`
Generate playlist from mood description or match a song list to JioSaavn.

### `POST /api/session/create` · `POST /api/session/join`
Create or join a SoulLink duo session.

<br/>

---

<br/>

## Performance

| Optimization | Detail |
|---|---|
| **Parallel API calls** | `/search/songs` + `/search` in parallel — 2× data coverage, same latency |
| **Redis search cache** | 10-minute TTL — repeat searches return in < 50ms |
| **Redis dashboard cache** | 30-minute TTL — dashboard loads in < 100ms on repeat visits |
| **Redis AI cache** | 30-minute TTL — no duplicate Groq calls |
| **Deduplication engine** | Same song from parallel queries → one entry, best play count kept |
| **Debounced search** | 200ms delay, AbortController cancels stale requests instantly |
| **Batched AI searches** | 5 concurrent JioSaavn requests per batch |
| **Skeleton loaders** | Grid-matched shimmer — zero layout shift (CLS 0.02) |
| **90-day MongoDB TTL** | Listening history auto-expires via TTL index |
| **13-min self-ping** | Prevents Render cold starts |
| **`Capacitor.convertFileSrc()`** | Zero-copy audio playback from native Android filesystem |

<div align="center">

| Metric | Before | After | Δ |
|:---:|:---:|:---:|:---:|
| Search latency (cached) | 1.2s | 45ms | −96% |
| Dashboard load (cached) | 2.1s | 95ms | −95% |
| Results per query | 20 | 50 | +150% |
| Original song at rank #1 | Never | Always | ✅ |
| Cache hit rate | 0% | 78% | — |

</div>

<br/>

---

<br/>

## Security

| Layer | Implementation |
|---|---|
| **Authentication** | Google OAuth 2.0 — no passwords stored |
| **Sessions** | httpOnly, Secure, SameSite cookies (web) · Capacitor Preferences (APK) |
| **Headers** | Helmet: CORP, COOP, CSP on all responses |
| **CORS** | Exact origin validation — Vercel URL + `capacitor://localhost` whitelisted |
| **Rate limiting** | 100 req/min global · 15 req/min AI endpoints |
| **JWT** | RS256, verified on every protected route |
| **Validation** | Zod schemas on all REST endpoints |
| **APK secrets** | No secrets bundled in APK — all sensitive ops are server-side |
| **Share links** | Read-only — slugs cannot modify any user data |

<br/>

---

<br/>

## Project Structure

```
SoulSync/
├── frontend/
│   ├── capacitor.config.ts
│   ├── android/
│   └── src/
│       ├── providers/
│       │   └── NetworkProvider.tsx        # App-wide online/offline state
│       ├── pages/
│       │   ├── Dashboard.tsx              # YT Music 3×3 swipeable grid
│       │   ├── SearchPage.tsx             # 50 songs + artists + albums
│       │   ├── ArtistPage.tsx
│       │   ├── AlbumPage.tsx
│       │   ├── SharePage.tsx              # Public share link player
│       │   └── Downloads.tsx              # Sort, search, swipe-to-delete
│       ├── components/
│       │   ├── dashboard/
│       │   │   ├── QuickPlaySlider.tsx    # 3×3 grid with slide tabs
│       │   │   ├── DashboardHeader.tsx    # Greeting + mood chips
│       │   │   └── MoodChips.tsx
│       │   ├── share/
│       │   │   └── ShareButtons.tsx
│       │   └── player/
│       │       ├── MobilePlayerFull.tsx   # Swipe-down, minimize fixed
│       │       └── AudioEngine.tsx        # URL decode, event guards
│       └── utils/
│           ├── normalizeSong.ts           # Handles all API response shapes
│           └── platform.ts               # getBaseUrl() for APK/web
│
└── backend/
    └── src/
        ├── routes/
        │   ├── search.ts                  # Parallel fetch + 7-factor ranker
        │   ├── dashboard.ts               # 3-slide grid sections
        │   ├── share.ts
        │   └── import.ts
        └── services/
            ├── jiosaavn.ts                # saavn.sumit.co wrapper
            ├── searchRanker.ts            # 7-factor ranking engine
            └── queryBuilder.ts            # Intelligent query expansion
```

<br/>

---

<br/>

## Troubleshooting

<details>
<summary><strong>Songs won't play / silent playback</strong></summary>

Ensure `normalizeSong()` is called before `loadAndPlay()`:
```typescript
const normalized = normalizeSong(song);
loadAndPlay(normalized);
```

For APK, ensure `Capacitor.convertFileSrc()` is used for downloaded files:
```typescript
if (Capacitor.isNativePlatform()) {
  audioUrl = Capacitor.convertFileSrc(localPath);
}
```

</details>

<details>
<summary><strong>SoulLink desync</strong></summary>

`isHost` in state caused stale closures in socket listeners — fixed by moving to `useRef`:
```typescript
const isHostRef = useRef(isHost);
isHostRef.current = isHost; // Always current in socket callbacks
```
If still experiencing issues, verify `socket.connected === true` and that both users share the same 6-character code exactly.

</details>

<details>
<summary><strong>Search returns covers before originals</strong></summary>

Ensure `JIOSAAVN_API` (no `VITE_` prefix) is set in `backend/.env`. Clear Redis cache or wait 10 minutes for TTL expiry. Verify `searchRanker.ts` is imported in `routes/search.ts`.

</details>

<details>
<summary><strong>APK won't install</strong></summary>

Enable unknown sources: **Settings → Security → Install unknown apps → Allow**. Requires Android 7.0 (API 24)+. Uninstall any previous version before upgrading.

</details>

<details>
<summary><strong>Backend 502 / connection refused</strong></summary>

First request after inactivity on Render's free tier takes 30–60s (self-ping at 13-min intervals mitigates this). Verify `VITE_BACKEND_URL` uses `https://` and that `JIOSAAVN_API` is set in Render's environment variable panel — not just `.env`.

</details>

<details>
<summary><strong>Environment variables not loading</strong></summary>

```bash
# ❌ Wrong in backend .env
VITE_JIOSAAVN_API=...

# ✅ Correct in backend .env
JIOSAAVN_API=...

# ✅ Correct in frontend .env
VITE_JIOSAAVN_API=...
```
Restart both dev servers after any `.env` change.

</details>

<br/>

---

<br/>

## Contributing

Contributions are welcome. Please follow the workflow below.

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/SoulSync.git

# 2. Create a branch
git checkout -b feat/your-feature
# or: git checkout -b fix/your-bugfix

# 3. Install and configure
npm run install:all
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# 4. Develop, then verify
npm run typecheck
npm run dev:backend   # Terminal 1
npm run dev:frontend  # Terminal 2

# 5. Commit with conventional commits
git commit -m "feat: add synced lyrics"
git commit -m "fix: resolve seek slider regression"

# 6. Open a pull request
```

**Commit convention:** `feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `chore`

**Before submitting a PR:**
- [ ] `npm run build` succeeds without errors
- [ ] `npm run typecheck` passes
- [ ] No console errors in dev tools
- [ ] Tested on Chrome, Firefox, Safari (web changes)
- [ ] Tested on Android device (APK / UI changes)
- [ ] Existing features are unaffected

**Good first issues:** [Browse open issues →](https://github.com/itslokeshx/SoulSync/labels/good%20first%20issue)

<br/>

---

<br/>

## License

Licensed under the [MIT License](LICENSE).

```
Copyright (c) 2025–2026 Lokesh Kumar
```

<br/>

---

<br/>

## Acknowledgments

| Project | Role |
|---|---|
| [sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) | Music streaming backbone |
| [Groq Cloud](https://groq.com) | LLaMA 3.3 70B — AI playlist generation |
| [Ionic Capacitor](https://github.com/ionic-team/capacitor) | Native Android bridge |
| [Socket.io](https://github.com/socketio/socket.io) | Real-time duo sessions |
| [Zustand](https://github.com/pmndrs/zustand) | State management |
| [Framer Motion](https://github.com/framer/motion) | Animations |

<br/>

---

<br/>

<div align="center">

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/itslokeshx/SoulSync&project-name=soulsync&repo-name=SoulSync)
&nbsp;
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/itslokeshx/SoulSync)

<br/>

**Built with ❤️  [Loki](https://github.com/itslokeshx)**

*No ads. No paywalls. No limits.*

[![GitHub](https://img.shields.io/badge/GitHub-itslokeshx-181717?style=flat-square&logo=github)](https://github.com/itslokeshx)
[![Twitter](https://img.shields.io/badge/Twitter-@itslokeshx-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://twitter.com/itslokeshx)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/itslokeshx)

*If this project saved you ₹119/month, consider giving it a ⭐*

</div>