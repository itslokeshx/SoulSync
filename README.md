<div align="center">

<pre>
███████╗ ██████╗ ██╗   ██╗██╗     ███████╗██╗   ██╗███╗   ██╗ ██████╗
██╔════╝██╔═══██╗██║   ██║██║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝
███████╗██║   ██║██║   ██║██║     ███████╗ ╚████╔╝ ██╔██╗ ██║██║
╚════██║██║   ██║██║   ██║██║     ╚════██║  ╚██╔╝  ██║╚██╗██║██║
███████║╚██████╔╝╚██████╔╝███████╗███████║   ██║   ██║ ╚████║╚██████╗
╚══════╝ ╚═════╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝
</pre>

**Listen together. Feel together.**

*Free, open-source music streaming — AI playlists, real-time duo sessions, intelligent search, native Android.*
*No ads. No limits. No subscription. Ever.*

<br/>

[![Web App](https://img.shields.io/badge/Launch%20Web%20App-1DB954?style=for-the-badge&logo=vercel&logoColor=white)](https://soul-sync-beta.vercel.app/)
[![Download APK](https://img.shields.io/badge/Download%20APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

<sub>Android 7.0+ required · No Play Store needed · <a href="https://github.com/itslokeshx/SoulSync/releases">All Releases</a></sub>

</div>

<br/>

---

## Overview

SoulSync gives you everything Spotify Premium charges ₹119/month for — completely free. Built on a single codebase that ships both a web app and a native Android APK, it combines a 7-factor intelligent search engine, AI-powered playlist generation via Groq's LLaMA 3.3 70B, real-time synchronized listening sessions, and seamless offline support.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | TypeScript 5.7 · React 18.3 · Vite 6.1 · Tailwind CSS 3.4 · Zustand 5 · Framer Motion 12 · TanStack Query 5 |
| **Mobile** | Capacitor 8.1 · Android API 24+ · Capacitor Filesystem · Capacitor Network · Capacitor Haptics |
| **Backend** | Node.js 18+ · Express 4.21 · Socket.io 4.8 · TypeScript 5.7 · Zod · Helmet |
| **Data** | MongoDB 8.9 · Upstash Redis · 90-day TTL on listening history |
| **AI** | Groq SDK · LLaMA 3.3 70B · Multi-key rotation · Redis cache |
| **Auth** | Google OAuth 2.0 · JWT RS256 · httpOnly cookies |
| **Infra** | Vercel · Render · MongoDB Atlas |

---

## Features

### 🔍 Intelligent Search

A 7-factor ranking engine — originals always rank first.

| Signal | Weight | Effect |
|---|---|---|
| Play count | Dominant · 0–80 pts | 2.1B-play original always beats a 5K-play cover |
| Cover penalty | Hard · −100 pts | "cover", "karaoke", "tribute", "recreation" → buried |
| Title match | Strong · 0–50 pts | Exact phrase ranks above partial overlap |
| Artist match | Medium · 0–20 pts | Queried artist name boosts their own songs |
| Original markers | Bonus · +15 pts | "official audio", "official video" boosted |
| Language preference | Soft · +10 pts | Your preferred language surfaces first |
| Stream URL check | Required · −50 if missing | Unplayable songs automatically buried |

- 50 results per search · artists section · albums section · full deduplication
- Redis cache — 10-min TTL, repeat searches return in under 50ms

---

### 🤖 AI Playlist Engine

```
User input  ──▶  Groq LLaMA 3.3 70B  ──▶  Optimized search queries
                                                       │
NLP pipeline  ◀──  500+ artist dict · mood tokens · language detection
      │
      ▼
7-factor ranker  ──▶  Deduplicated results  ──▶  Confidence scoring  ──▶  Save
```

- **Mood-based generation** — describe a vibe, get 15 songs with a creative playlist name
- **Song list mode** — paste song names, AI matches from JioSaavn automatically
- **Confidence scoring** — high / partial / none per match
- **Multi-key rotation** — up to 5 Groq API keys, round-robin with auto-fallback
- **Universal import** — Spotify, YouTube Music, Apple Music, Gaana, or plain text — zero API keys

---

### 🎧 SoulLink — Listen Together

Create a room → share the 6-character code → everything syncs in real time.

```
Host                    Server                   Guest
 ├── song-change ──────▶ ──── song-change ───────▶
 ├── play ──────────────▶ ──── play ─────────────▶
 ├── seek ──────────────▶ ──── seek ─────────────▶
 │◀── message ─────────── ◀─── message ───────────┤
 └── heartbeat (5s) ────▶ ◀─── heartbeat ─────────┘
```

| Event | Direction | Purpose |
|---|---|---|
| `duo:join` | Client → Server | Join room with code, name, role |
| `duo:sync-song-change` | Client ↔ Server | Sync current song + queue |
| `duo:sync-play` | Client ↔ Server | Sync play + timestamp |
| `duo:sync-seek` | Client ↔ Server | Sync seek position |
| `duo:message` | Client ↔ Server | In-session chat |
| `duo:end-session` | Client → Server | End session for both |

Built-in chat overlay. Beautiful recap card on session end. Powered by Socket.io with heartbeat and disconnect cleanup.

---

### 📱 Native Android APK

One codebase. One backend. Two platforms. Zero compromise.

| Feature | Description |
|---|---|
| Instant offline | Opens directly — no login screen required when offline |
| Native file storage | Songs saved to device via `@capacitor/filesystem` |
| Lock screen controls | Play, pause, skip from Android lock screen |
| Background audio | Music keeps playing when app is minimized |
| Haptic feedback | Every tap, like, skip, seek feels native |
| Native Google Sign-In | Bottom sheet — no popup |
| Native share sheet | Share songs via any installed app |
| Swipe-up player | Mini bar → full screen immersive view |
| Swipe-down minimize | Full player → collapses to mini bar |

---

### 🔗 Sharing

- Song links — `soul-sync-beta.vercel.app/s/:slug` — plays without an account
- Playlist links — `soul-sync-beta.vercel.app/p/:slug` — full playlist, no login required
- Rich OG meta tags — preview cards in WhatsApp, iMessage, Telegram
- Dominant color gradient from album art as animated background
- Share from full player, song context menu, or playlist page header
- Never expires — stored permanently in MongoDB, stream URLs auto-refreshed

---

### ✈️ Offline Mode

| Scenario | Web | APK |
|---|---|---|
| Online + logged in | Full access | Full access |
| Online + not logged in | → Login required | → Login required |
| Offline + logged in | Downloaded songs only | Downloaded songs only |
| **Offline + not logged in** | ❌ Login page | ✅ Opens directly |

`NetworkProvider` is the single source of truth for online/offline state across the entire app. Seamless reconnection with no reload. Yellow offline banner and green "Back online" toast.

---

## SoulSync vs Spotify

| Feature | SoulSync | Spotify Free | Spotify Premium |
|---|:---:|:---:|:---:|
| Ad-free listening | ✅ Always | ❌ Every song | ✅ Paid |
| AI Playlist Builder | ✅ Free | ❌ | ❌ |
| Listen Together + chat | ✅ Free | ❌ | ✅ Paid, no chat |
| Song Downloads | ✅ Free | ❌ | ✅ Paid |
| Originals-first search | ✅ | ❌ | ❌ |
| Share — no account to play | ✅ | ❌ | ❌ |
| Playlist import | ✅ Spotify · YT · Apple | ❌ | ❌ |
| Offline without login | ✅ APK | ❌ | ❌ |
| 10+ Indian languages | ✅ | ❌ | ❌ |
| Open source | ✅ MIT | ❌ | ❌ |
| **Price** | **₹0 forever** | ₹0 with ads | **₹119/month** |

---

## Architecture

```
┌──────────────── WEB BROWSER ─────────────────┐   ┌─────────── ANDROID APK ──────────┐
│                                              │   │                                  │
│  Auth → Zustand → Router → IndexedDB         │   │  Auth → Zustand → Router         │
│  NetworkProvider                             │   │  Capacitor Filesystem            │
│                                              │   │  NetworkProvider                 │
│  ┌─ AppLayout ─────────────────────────────┐ │   │  ┌─ Mobile Layout ─────────────┐ │
│  │  Sidebar · Pages · PlayerBar · Duo     │ │   │  │  BottomNav · MiniPlayer     │ │
│  └─────────────────────────────────────────┘ │   │  │  FullScreenPlayer · Queue  │ │
└──────────────────────┬───────────────────────┘   │  └─────────────────────────────┘ │
                       │                           └──────────────┬───────────────────┘
                       │         REST API + WebSocket             │
                       └─────────────────────┬────────────────────┘
                                             │
                           ┌─────────────────▼─────────────────┐
                           │          RENDER BACKEND            │
                           │        Express + Socket.io         │
                           │                                    │
                           │  /auth  /search  /playlist         │
                           │  /user  /ai  /session              │
                           │  /dashboard  /share  /import       │
                           │                                    │
                           │  MongoDB Atlas  ·  Redis Cache     │
                           │  Groq AI  ·  saavn.sumit.co        │
                           └────────────────────────────────────┘
```

### Data Models

| Model | Key Fields |
|---|---|
| **User** | googleId, email, name, photo, preferences, likedSongs[], totalListeningTime |
| **Playlist** | userId, name, songs[], isPublic, isAIGenerated, tags[], songCount, totalDuration |
| **ListeningHistory** | userId, songId, title, artist, source — 90-day TTL |
| **DuoSession** | host/guest, roomCode, currentSong, playState, messages[] |
| **Share** | slug (nanoid), type (song/playlist), data, createdAt, viewCount |
| **Import** | userId, sourceUrl, platform, songs[], status |

### Zustand Stores

| Store | Manages |
|---|---|
| `playerStore` | Current song, play/pause, time, volume, shuffle, repeat, isExpanded |
| `queueStore` | Song queue, history, add/remove/reorder |
| `searchStore` | Query, results (songs + artists + albums), filters |
| `duoStore` | SoulLink session state + sessionStorage persistence |
| `offlineStore` | Downloaded songs, offline flag, cached user |

---

## Performance

| Metric | Before | After | Δ |
|---|---|---|---|
| Search latency (cached) | 1.2s | 45ms | −96% |
| Dashboard load (cached) | 2.1s | 95ms | −95% |
| Results per query | 20 | 50 | +150% |
| Original song at rank #1 | Never | Always | ✅ |
| Cache hit rate | 0% | 78% | — |

| Optimization | Detail |
|---|---|
| Parallel API calls | `/search/songs` + `/search` in parallel — 2× data, same latency |
| Redis search cache | 10-min TTL — repeat searches < 50ms |
| Redis dashboard cache | 30-min TTL — repeat loads < 100ms |
| Redis AI cache | 30-min TTL — no duplicate Groq calls |
| Deduplication engine | Parallel results merged, best play-count kept |
| Debounced search | 200ms delay + AbortController on stale requests |
| Skeleton loaders | Grid-matched shimmer — CLS 0.02 |
| 13-min self-ping | Prevents Render cold starts |

---

## Security

| Layer | Implementation |
|---|---|
| Authentication | Google OAuth 2.0 — no passwords stored |
| Sessions | httpOnly, Secure, SameSite cookies (web) · Capacitor Preferences (APK) |
| Headers | Helmet: CORP, COOP, CSP on all responses |
| CORS | Exact origin validation — Vercel URL + `capacitor://localhost` |
| Rate limiting | 100 req/min global · 15 req/min AI endpoints |
| JWT | RS256, verified on every protected route |
| Validation | Zod schemas on all REST endpoints |
| APK secrets | No secrets in APK — all sensitive ops server-side |
| Share links | Read-only — slugs cannot modify any user data |

---

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

> ⚠️ `JIOSAAVN_API` must be set in `backend/.env` **without** the `VITE_` prefix. The `VITE_` prefix only resolves in the frontend bundle — it is always `undefined` on the server.

---

## Deployment

### Frontend → Vercel

```
1. Push to GitHub
2. Import on vercel.com → set all VITE_* env vars
3. Deploy — vercel.json is included
4. Add deployed URL to Google OAuth authorized origins
```

### Backend → Render

```
1. Create Web Service → connect GitHub repo
2. Root directory: backend
3. Build: npm install --include=dev && npm run build
4. Start: npm start
5. Set all env vars — especially JIOSAAVN_API (no VITE_ prefix)
```

### Android APK

```bash
# Build web bundle
cd frontend && npm run build

# Sync to Android
npx cap sync android

# Build release APK
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk

# Or open in Android Studio
npx cap open android
# Build → Generate Signed Bundle / APK → APK → Release
```

**Install on device:**
```
1. Download SoulSync.apk from Releases
2. Settings → Security → Enable "Install from unknown sources"
3. Open the APK file → Install
```

---

## API Reference

**`POST /api/auth/google`** — Authenticate with Google ID token.
```json
{ "idToken": "..." }  →  { "user": {...}, "isNewUser": true }
```

**`GET /api/search?q=...&lang=...&limit=50`** — 7-factor ranked search.
```json
→  { "songs": [...50], "artists": [...], "albums": [...] }
```

**`GET /api/search/artist/:id`** — Top songs sorted by popularity.

**`GET /api/search/album/:id`** — Full album tracklist.

**`POST /api/share/song`** · **`POST /api/share/playlist`** — Generate shareable slug. Auth required.
```json
{ "song": {...} }  →  { "slug": "abc123", "url": "https://..." }
```

**`GET /api/share/s/:slug`** · **`GET /api/share/p/:slug`** — Retrieve share. No auth. URLs auto-refreshed.

**`POST /api/import/detect`** — Detect platform and extract songs from URL.
```json
{ "url": "https://open.spotify.com/playlist/..." }  →  { "platform": "spotify", "songs": [...] }
```

**`GET /api/dashboard`** (auth) · **`GET /api/dashboard/guest`** — Personalized or guest dashboard.

**`POST /api/ai/generate`** · **`POST /api/ai/match`** — Generate playlist from mood or match a song list.

**`POST /api/session/create`** · **`POST /api/session/join`** — SoulLink duo sessions.

---

## Project Structure

```
SoulSync/
├── frontend/
│   ├── capacitor.config.ts
│   ├── android/
│   └── src/
│       ├── providers/
│       │   └── NetworkProvider.tsx         # App-wide online/offline state
│       ├── pages/
│       │   ├── Dashboard.tsx               # 3×3 swipeable grid
│       │   ├── SearchPage.tsx              # 50 songs + artists + albums
│       │   ├── ArtistPage.tsx
│       │   ├── AlbumPage.tsx
│       │   ├── SharePage.tsx               # Public share link player
│       │   └── Downloads.tsx               # Sort, search, swipe-to-delete
│       ├── components/
│       │   ├── dashboard/
│       │   │   ├── QuickPlaySlider.tsx     # 3×3 grid with slide tabs
│       │   │   ├── DashboardHeader.tsx     # Greeting + mood chips
│       │   │   └── MoodChips.tsx
│       │   └── player/
│       │       ├── MobilePlayerFull.tsx    # Swipe-down, minimize
│       │       └── AudioEngine.tsx         # URL decode, event guards
│       └── utils/
│           ├── normalizeSong.ts            # Handles all API response shapes
│           └── platform.ts                # getBaseUrl() for APK vs web
│
└── backend/
    └── src/
        ├── routes/
        │   ├── search.ts                   # Parallel fetch + 7-factor ranker
        │   ├── dashboard.ts                # 3-slide grid sections
        │   ├── share.ts
        │   └── import.ts
        └── services/
            ├── jiosaavn.ts                 # saavn.sumit.co API wrapper
            ├── searchRanker.ts             # 7-factor ranking engine
            └── queryBuilder.ts             # Intelligent query expansion
```

---

## Troubleshooting

<details>
<summary><b>Songs won't play / silent playback</b></summary>

Ensure `normalizeSong()` is called before `loadAndPlay()`:
```typescript
const normalized = normalizeSong(song);
loadAndPlay(normalized);
```
On APK, use `Capacitor.convertFileSrc()` for downloaded files:
```typescript
if (Capacitor.isNativePlatform()) {
  audioUrl = Capacitor.convertFileSrc(localPath);
}
```
</details>

<details>
<summary><b>SoulLink desync</b></summary>

`isHost` must be a `ref`, not state, to avoid stale closures in socket listeners:
```typescript
const isHostRef = useRef(isHost);
isHostRef.current = isHost;
```
Also verify `socket.connected === true` and both users are using the exact same 6-character code.
</details>

<details>
<summary><b>Search returns covers before originals</b></summary>

Check that `JIOSAAVN_API` (no `VITE_` prefix) is set in `backend/.env`. Clear Redis cache or wait for the 10-minute TTL. Verify `searchRanker.ts` is imported in `routes/search.ts`.
</details>

<details>
<summary><b>APK won't install</b></summary>

Enable unknown sources: **Settings → Security → Install unknown apps → Allow**. Requires Android 7.0 (API 24)+. Uninstall any older version before upgrading.
</details>

<details>
<summary><b>Backend 502 / connection refused</b></summary>

First request after inactivity on Render's free tier takes 30–60s. Self-ping at 13-min intervals mitigates this. Verify `VITE_BACKEND_URL` uses `https://` and `JIOSAAVN_API` is set in Render's dashboard — not just in a local `.env` file.
</details>

<details>
<summary><b>Environment variables not loading</b></summary>

```bash
# ❌ Wrong — backend cannot read VITE_ prefix
VITE_JIOSAAVN_API=https://saavn.sumit.co/api

# ✅ Correct in backend/.env
JIOSAAVN_API=https://saavn.sumit.co/api

# ✅ Correct in frontend/.env
VITE_JIOSAAVN_API=https://saavn.sumit.co/api
```
Always restart both dev servers after changing `.env` files.
</details>

---

## Contributing

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/SoulSync.git

# 2. Create a branch
git checkout -b feat/your-feature

# 3. Install and configure
npm run install:all
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# 4. Develop and verify
npm run typecheck
npm run dev:backend    # terminal 1
npm run dev:frontend   # terminal 2

# 5. Commit
git commit -m "feat: your feature description"

# 6. Open a pull request
```

**Commit convention:** `feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `chore`

**PR checklist:**
- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] No console errors
- [ ] Tested on Chrome, Firefox, Safari (web)
- [ ] Tested on Android (APK changes)
- [ ] Existing features unaffected

[Browse good first issues →](https://github.com/itslokeshx/SoulSync/labels/good%20first%20issue)

---

## License

[MIT License](LICENSE) · Copyright © 2025–2026 Lokesh Kumar

---

## Acknowledgments

| Project | Role |
|---|---|
| [sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) | Music streaming backbone |
| [Groq Cloud](https://groq.com) | LLaMA 3.3 70B inference |
| [Ionic Capacitor](https://github.com/ionic-team/capacitor) | Native Android bridge |
| [Socket.io](https://github.com/socketio/socket.io) | Real-time duo sessions |
| [Zustand](https://github.com/pmndrs/zustand) | State management |
| [Framer Motion](https://github.com/framer/motion) | Animations |

---

<div align="center">

<br/>

**Built with ❤️ by [Loki](https://github.com/itslokeshx)**

*No ads. No paywalls. No limits.*

[![GitHub](https://img.shields.io/badge/GitHub-itslokeshx-181717?style=flat-square&logo=github)](https://github.com/itslokeshx)
[![Twitter](https://img.shields.io/badge/Twitter-@itslokeshx-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://twitter.com/itslokeshx)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/itslokeshx)

*If this saved you ₹119/month — drop a ⭐*

</div>