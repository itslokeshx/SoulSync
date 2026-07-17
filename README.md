<div align="center">

# SoulSync

**Open-source music streaming — AI playlists, real-time listening sessions, offline-first, cross-platform.**

No advertisements. No subscription. No data resale. Ever.

[![Live Demo](https://img.shields.io/badge/Live-Visit_App-1DB954?style=flat-square)](https://soul-sync-beta.vercel.app)
[![Android](https://img.shields.io/badge/Android-v4.0_APK-3DDC84?style=flat-square&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/download/v4.0/SoulSync_4.0.apk)
[![Windows](https://img.shields.io/badge/Windows-v3.0.0-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/download/v3.0.0/SoulSync_3.0.0.exe)
[![Linux](https://img.shields.io/badge/Linux-v3.0.0_(.deb)-FCC624?style=flat-square&logo=linux&logoColor=black)](https://github.com/itslokeshx/SoulSync/releases/download/v3.0.0/soulsync_3.0.0.deb)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-4.0.0-6E56CF?style=flat-square)](version.json)

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=flat-square&logo=redis&logoColor=white)](https://upstash.com)

</div>

---

## At a Glance

SoulSync is a production-grade, open-source music streaming platform combining intelligent AI playlist generation, real-time shared listening, offline downloads, and a polished cross-platform experience — delivered at zero cost to the user. It is a deployed product with active users, not a reference implementation or tutorial project.

> **180+ active users · 6,000+ tracks streamed · 150+ AI-generated playlists**
> **96% search-latency reduction via Redis caching · 78% cache-hit rate**

---

## Platform Availability

| Platform | Distribution | Requirement |
|----------|--------------|-------------|
| Web | [soul-sync-beta.vercel.app](https://soul-sync-beta.vercel.app) | Any modern browser |
| Android | [SoulSync_4.0.apk](https://github.com/itslokeshx/SoulSync/releases/download/v4.0/SoulSync_4.0.apk) | Android 7.0+ (API 24+) |
| Windows | [SoulSync_3.0.0.exe](https://github.com/itslokeshx/SoulSync/releases/download/v3.0.0/SoulSync_3.0.0.exe) | Windows 10+ |
| Linux | [soulsync_3.0.0.deb](https://github.com/itslokeshx/SoulSync/releases/download/v3.0.0/soulsync_3.0.0.deb) | Debian / Ubuntu |

All current and historical builds are available on the [Releases](https://github.com/itslokeshx/SoulSync/releases) page.

---

## Differentiation

| Capability | SoulSync | Spotify Free | Spotify Premium |
|------------|:--------:|:------------:|:---------------:|
| Ad-free playback | ✅ | ❌ | ✅ |
| AI-generated playlists | ✅ | ❌ | ❌ |
| Listen Together + live chat | ✅ | ❌ | ❌ |
| Offline downloads | ✅ | ❌ | ✅ |
| Open source (MIT) | ✅ | ❌ | ❌ |
| **Price** | **Free, forever** | Free, with ads | ₹119 / month |

---

## Key Capabilities

### Intelligent Search — Seven-Signal Ranking

- **Originals prioritized** — covers, karaoke, and tribute tracks are algorithmically penalized
- **Seven-factor ranking** — play-count dominance, title and artist match strength, language preference, and three orthogonal correction signals
- **Fifty results per query** with dedicated artist and album sections
- **Redis-backed cache** — 10-minute TTL; repeat queries resolve in under 50 ms

### AI Playlist Generation

- **Mood-based synthesis** — a natural-language vibe yields 15 curated tracks plus a generated title
- **Song matching** — paste a list, AI resolves JioSaavn matches automatically
- **Multi-key rotation** — up to five Groq API keys with automatic failover and rate-limit-aware balancing
- **Universal import** — Spotify, YouTube Music, Apple Music, Gaana, or plain text

### SoulLink — Real-Time Listening Sessions

- **Host-controlled sync** — play, pause, seek, and queue changes propagate to all guests
- **6-character room codes** — no account required to join
- **In-session chat** — messaging layered over playback
- **Heartbeat protocol** — automatic room cleanup on disconnect

### Cross-Platform Native Experience

- **Offline-first Android** — opens directly without authentication when offline
- **System media controls** — lock-screen and notification playback, skip, and seek
- **Background audio** — continuous playback when the app is backgrounded
- **Haptic feedback** and swipe-driven player (mini bar ↔ full screen)
- **Dynamic release resolution** — download paths resolve the latest APK release asset directly from GitHub's API

### SoulSync Wrapped — Listening Analytics

- **Responsive viewport deck** — full-screen visual modal across mobile, tablet, and desktop
- **Live stats aggregation** — membership tenure, total minutes, play count, and liked tracks, computed from MongoDB in real time
- **Top tracks and vinyl visual** — renders the five most-played songs with a rotating album-art vinyl for the primary artist
- **Ticket pass infographic** — authentic concert ticket with perforated edges, barcodes, and cutouts

### Shareable Links

- Stable song URLs: `…/s/:slug` · Stable playlist URLs: `…/p/:slug`
- Rich previews via Open Graph metadata on WhatsApp, iMessage, and Telegram

---

## Performance

| Metric | Baseline | Optimized | Improvement |
|--------|---------:|----------:|-------------|
| Search latency (cached) | 1.2 s | 45 ms | **−96%** |
| Dashboard load (cached) | 2.1 s | 95 ms | **−95%** |
| Results per query | 20 | 50 | **+150%** |
| Original track at rank #1 | Never | Always | ✅ |
| Cache-hit rate | 0% | 78% | — |

---

## System Architecture

SoulSync is a monorepo with two deployable surfaces — a React/Vite/Capacitor frontend (Vercel + Android) and an Express/TypeScript backend (Render) — backed by MongoDB Atlas, Upstash Redis, and the Groq inference platform.

```
                        ┌─────────────────────────────────────┐
                        │          Client Surfaces            │
                        │  Web (Vercel) · Android (Capacitor) │
                        └─────────────────┬───────────────────┘
                                          │  HTTPS  +  WebSocket
                                          ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                    Express Backend (Render)                  │
        │                                                             │
        │  Middleware      auth · softAuth · rateLimiter · Helmet      │
        │  Routes          /auth · /search · /dashboard · /playlist    │
        │                  /ai · /import · /share · /session · /user   │
        │  Services        jiosaavn · searchRanker · searchEnhancer    │
        │                  groq (LLaMA 3.3 70B) · intentParser         │
        │                  dashboardEngine · importDetector · 5× importers │
        │  Real-time       Socket.io — duo:join, sync-play, sync-seek, │
        │                  sync-song-change, message, heartbeat (5 s)  │
        └───────────┬─────────────────┬──────────────────┬────────────┘
                    │                 │                  │
                    ▼                 ▼                  ▼
          ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
          │  MongoDB Atlas │ │ Upstash Redis  │ │    Groq AI     │
          │                │ │                │ │                │
          │  Users         │ │  Search cache  │ │  LLaMA 3.3 70B │
          │  Playlists     │ │  Dashboard     │ │  Multi-key     │
          │  ListenHist.   │ │  AI results    │ │  rotation      │
          │  DuoSessions   │ │  10–30 min TTL │ │                │
          │  Shares        │ │                │ │                │
          └────────────────┘ └────────────────┘ └────────────────┘
```

**Request flow:**

```
User Action → Zustand Store → API / Socket call → Express Route → Service Layer
                                                       │
                                                       ├── MongoDB (persist)
                                                       ├── Redis (cache)
                                                       └── Socket.io (real-time sync)
```

---

## Technology Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 18.3, TypeScript 5.7, Vite 6.1, Tailwind CSS 3.4, Zustand 5, TanStack Query 5 |
| Mobile | Capacitor 8.1 (Android API 24+) |
| Backend | Node.js 18+, Express 4.21, Socket.io 4.8, TypeScript 5.7 |
| Data | MongoDB Atlas, Upstash Redis (90-day TTL) |
| AI | Groq SDK, LLaMA 3.3 70B |
| Authentication | Google OAuth 2.0, JWT RS256, httpOnly cookies |
| Infrastructure | Vercel, Render, MongoDB Atlas |

---

## Security

| Layer | Implementation |
|-------|----------------|
| Authentication | Google OAuth 2.0 — no passwords stored |
| Session tokens | httpOnly · Secure · SameSite cookies |
| HTTP headers | Helmet: CORP, COOP, and CSP on all responses |
| CORS | Exact-origin validation |
| Rate limiting | 100 req/min global, 15 req/min on AI routes |
| Authorization | JWT (RS256), verified on every protected route |
| Input validation | Zod schemas on all REST endpoints |

---

## Getting Started

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | ≥ 18 | Runtime |
| npm | ≥ 9 | Package management |
| MongoDB Atlas | Free M0 tier | Primary database |
| Google Cloud | OAuth 2.0 Client ID | Authentication |
| Groq API key | Free tier | AI features (optional) |
| Android Studio | Latest | APK builds only |

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

# 2. Install all workspace dependencies
npm run install:all

# 3. Configure environment files
cp frontend/.env.example frontend/.env
cp backend/.env.example  backend/.env

# 4. Start development servers (two terminals)
npm run dev:backend    # Terminal 1 — http://localhost:4000
npm run dev:frontend   # Terminal 2 — http://localhost:5173
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

> **Note:** `JIOSAAVN_API` in `backend/.env` must not carry the `VITE_` prefix — that prefix is exclusive to client-exposed variables.

---

## Deployment

### Frontend → Vercel

1. Import the repository at [vercel.com](https://vercel.com).
2. Set every `VITE_*` environment variable.
3. Deploy — `vercel.json` is included.
4. Add the deployed origin to Google OAuth authorized JavaScript origins.

### Backend → Render

1. Create a Web Service connected to the repository; set the root directory to `backend`.
2. Build command: `npm install --include=dev && npm run build`
3. Start command: `npm start`
4. Set all backend environment variables — especially `JIOSAAVN_API` (no `VITE_` prefix).

### Android APK

```bash
cd frontend && npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
# Output → android/app/build/outputs/apk/release/app-release.apk
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/google` | Authenticate with a Google ID token |
| `GET` | `/api/search?q=...&lang=...&limit=50` | Seven-factor ranked search |
| `GET` | `/api/search/artist/:id` | Top tracks by artist |
| `GET` | `/api/search/album/:id` | Full album tracklist |
| `POST` | `/api/share/song` | Generate a shareable song slug |
| `POST` | `/api/share/playlist` | Generate a shareable playlist slug |
| `GET` | `/api/share/s/:slug` | Resolve a shared song (public) |
| `GET` | `/api/share/p/:slug` | Resolve a shared playlist (public) |
| `POST` | `/api/import/detect` | Detect source platform from a URL |
| `GET` | `/api/dashboard` | Personalized dashboard (auth) |
| `GET` | `/api/dashboard/guest` | Guest dashboard |
| `POST` | `/api/ai/generate` | Generate a playlist from a mood |
| `POST` | `/api/ai/match` | Resolve a song list to matches |
| `POST` | `/api/session/create` | Create a SoulLink room |
| `POST` | `/api/session/join` | Join a SoulLink room |
| `GET` | `/api/user/stats` | Wrapped statistics and timeline |

---

## Repository Structure

```
SoulSync/
├── backend/                       Express + Socket.io API
│   └── src/
│       ├── middleware/            auth · softAuth · rateLimiter
│       ├── models/                User · Playlist · ListeningHistory · DuoSession
│       ├── routes/                auth · search · dashboard · playlist
│       │                          ai · import · share · session · user
│       ├── services/              jiosaavn · searchRanker · groq
│       │   └── importers/         spotify · youtube · apple · gaana · text
│       └── socket/                Socket.io setup + duo room handlers
│
├── frontend/                      React + Vite + Capacitor
│   └── src/
│       ├── api/                   Backend + JioSaavn clients
│       ├── auth/                  AuthContext + ProtectedRoute
│       ├── capacitor/             Filesystem · Haptics · MusicControls · Network
│       ├── components/            cards · layout · player · ui · profile
│       ├── duo/                   SoulLink store, socket, hooks
│       ├── hooks/                 useDashboard · useSearch · useAuthGate · ...
│       ├── pages/                 Home · Search · Library · SoulLink · ...
│       ├── providers/             NetworkProvider · PlayerProvider
│       ├── store/                 player · queue · search · offline · ui · download
│       └── utils/                 offlineDB · normalizeSong · colorExtractor · ...
│
└── release/                       Packaged desktop builds (Windows / Linux)
```

---

## Troubleshooting

**Silent playback or songs failing to play**
Ensure `normalizeSong()` runs before `loadAndPlay()`. On the APK, wrap local files with `Capacitor.convertFileSrc()`:

```ts
const normalized = normalizeSong(song);
loadAndPlay(normalized);

if (Capacitor.isNativePlatform()) {
  audioUrl = Capacitor.convertFileSrc(localPath);
}
```

**SoulLink de-sync**
`isHost` must be held in a `ref` (not state) to avoid stale closures inside socket listeners:

```ts
const isHostRef = useRef(isHost);
isHostRef.current = isHost;
```

Confirm `socket.connected === true` and that both peers share the identical 6-character code.

**Covers appearing before originals**
Verify `JIOSAAVN_API` (no `VITE_` prefix) is set in `backend/.env`. Flush the Redis cache or wait for the 10-minute TTL to expire.

**APK installation failure**
Enable installation from unknown sources: **Settings → Security → Install unknown apps → Allow**. Requires Android 7.0 (API 24) or later.

**Backend 502 / connection refused**
The first request after idle time on Render's free tier can take 30–60 s. A built-in self-ping at 13-minute intervals mitigates cold starts.

**Environment variables not loading**
The backend cannot read `VITE_`-prefixed variables. Use `JIOSAAVN_API` (not `VITE_JIOSAAVN_API`) in `backend/.env`. Restart both dev servers after any `.env` change.

---

## Contributing

Contributions are welcome — bug fixes, features, and documentation improvements all move SoulSync forward.

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/SoulSync.git

# 2. Create a feature branch
git checkout -b feat/your-feature

# 3. Install, configure, and verify
npm run install:all
npm run typecheck

# 4. Commit using conventional prefixes, then push and open a PR
git commit -m "feat: your feature description"
git push origin feat/your-feature
```

**Commit prefixes:** `feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `chore`

**Pre-merge checklist**

- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] No console errors
- [ ] Verified on Chrome, Firefox, and Safari (web)
- [ ] Verified on Android (when APK-touching changes are included)

Browse [good first issues](https://github.com/itslokeshx/SoulSync/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) to find an approachable entry point.

---

## Acknowledgments

| Project | Contribution |
|---------|--------------|
| [sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) | Music streaming backbone |
| [Groq Cloud](https://groq.com) | LLaMA 3.3 70B inference |
| [Ionic Capacitor](https://capacitorjs.com) | Native Android bridge |
| [Socket.io](https://socket.io) | Real-time duo sessions |
| [Zustand](https://github.com/pmndrs/zustand) | Client state management |
| [Framer Motion](https://www.framer.com/motion/) | Interface animation |

---

## License

Distributed under the [MIT License](LICENSE). You are free to use, modify, and distribute this software.

---

<div align="center">

**Built by Loki**

*No ads. No paywalls. No limits. Simply music.*

If SoulSync earned your time, a star on the repository is appreciated.

</div>
