# SoulSync Wiki

Welcome to the SoulSync documentation. SoulSync is a free, open-source music streaming platform with AI-generated playlists, real-time shared listening sessions, offline playback, and native Android support.

- **Live app:** [soul-sync-beta.vercel.app](https://soul-sync-beta.vercel.app)
- **Repository:** [github.com/itslokeshx/SoulSync](https://github.com/itslokeshx/SoulSync)
- **License:** MIT
- **Current stable release:** v5.0

**Quick facts:** 180+ active users, 8,000+ songs streamed, 145+ playlists created — free forever, no ads, fully open source, available on Web, Windows, Linux, and Android.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Features](#features)
3. [Architecture](#architecture)
4. [API Reference](#api-reference)
5. [Contributing](#contributing)
6. [FAQ](#faq)
7. [Changelog](#changelog)

---

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | Required |
| npm | ≥ 9 | Required |
| MongoDB Atlas | Free M0 instance | Required for persistence |
| Google Cloud | OAuth 2.0 Client ID | Required for authentication |
| Groq API | Free key | Required for AI playlist features |

### Installation

```bash
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

npm run install:all

cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Fill in the required values in both `.env` files: MongoDB connection string, Google OAuth client credentials, and Groq API key(s).

### Running the App

```bash
npm run dev:backend   # Express server on http://localhost:4000
npm run dev:frontend  # Vite dev server on http://localhost:5173
```

### Verifying the Setup

- Visit `http://localhost:5173` — you should see the guest dashboard.
- Sign in with Google to confirm OAuth is wired correctly.
- Try the AI playlist generator to confirm your Groq key is valid.
- Open a SoulLink room from two browser tabs to confirm Socket.io connectivity.

### Type Checking

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

### Downloads

| Platform | Link | Requirement |
|---|---|---|
| Web | [soul-sync-beta.vercel.app](https://soul-sync-beta.vercel.app) | None |
| Windows | `SoulSync_3.0.0.exe` | Windows 10+ |
| Linux | `soulsync_3.0.0.deb` | Debian/Ubuntu |
| Android | [SoulSync_v5.apk](https://github.com/itslokeshx/SoulSync/releases/download/v5.0/SoulSync_v5.apk) | Android 7.0+ |

---

## Features

### AI Playlist Generation
Generates playlists from natural-language prompts (e.g. "late night drive under rain") using GPT OSS 120B served via Groq. Supports matching pasted song lists against catalog metadata and importing playlists from Spotify, YouTube Music, Apple Music, or plain text. Multi-key rotation across Groq API keys handles rate limits, with a 30-minute result cache.

### Search
A seven-factor ranking engine scores results by play count, title/artist match quality, language preference, and popularity. Covers, karaoke, and instrumental versions are demoted below original tracks. Returns up to 50 results per query, grouped into songs, artists, and albums, cached in Redis with a 10-minute TTL.

### Dashboards
**Guest Dashboard** — shown to users who are not signed in. Surfaces worldwide trending tracks, new releases, editorial/curated playlists, top artists, and feature highlights.  
**Personalized Dashboard** — shown to signed-in users, blending 70% listening history with 30% dynamic exploration ("Made For You") to balance familiarity with discovery.

### Auto Song Suggestion (Infinite Playback)
When the play queue drops below 100 remaining tracks, SoulSync automatically refetches related songs — first from taste-aware recommenders, falling back to JioSaavn-related tracks if exhausted, so playback never runs dry.

### SoulLink — Shared Listening Sessions
Real-time synchronized listening rooms over WebSockets. Host controls sync instantly to all participants via six-character join codes, no account required. Includes in-room chat and heartbeat-based connection monitoring. Rebuilt in v5 for improved stability, following an earlier redesign in v2.1.0.

### Android App
Native build via Capacitor: offline playback without network access or login, lockscreen media controls, background audio, gesture-driven mini-player, and public-storage downloads (`Documents/SoulSync/`) so files are visible to other apps like VLC.

### SoulSync Wrapped
A full-screen, portal-rendered listening story: spinning vinyl infographic for your top artist, a shareable concert-pass card, and real-time stats aggregated from listening history.

### Announcements Engine
Delayed in-app popups for new features/maintenance notices, with persistent unread badges across navigation until expiry or dismissal.

### Sleep Timer
Presets (5–60 min), custom minute entry (1–240), and an "end of track" mode.

### Feedback & Support
In-app feedback drawer with history and unread-reply tracking, an admin triage dashboard (`/admin`) for sorting by status, and in-app support chat on the Profile page (added in v5).

### Desktop Apps
Native Windows (`.exe`) and Linux (`.deb`) clients with offline-capable local sessions and secure Google Auth via custom protocols.

---

## Architecture

### Overview

```
┌────────────────────┐     ┌────────────────────┐
│    Web Frontend     │     │   Android (APK)     │
│  React + Zustand    │     │  React + Capacitor   │
└──────────┬──────────┘     └──────────┬──────────┘
           │      REST API + WebSocket (Socket.io)    │
           └─────────────────────┬─────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   Backend (Express 4 +    │
                    │      Socket.io 4)          │
                    └──────┬──────┬──────┬───────┘
                           │      │      │
                ┌──────────▼┐ ┌───▼────┐ ┌▼──────────┐
                │ MongoDB   │ │ Redis  │ │ Groq API  │
                │ Atlas     │ │(Upstash│ │(LLM infer-│
                │           │ │)       │ │ ence)     │
                └───────────┘ └────────┘ └───────────┘
```

### Frontend
React 18.3 + TypeScript 5.7, Vite 6.1, Tailwind CSS 3.4, Zustand 5 (split into `playerStore`, `queueStore`, `searchStore`, `duoStore`, `offlineStore`, `uiStore`). Capacitor 8.1 wraps the same codebase for Android.

### Backend
Node.js 18+, Express 4.21, Socket.io 4.8, TypeScript 5.7. Middleware: `auth.ts` (JWT), `softAuth.ts` (optional auth for guest routes), `rateLimiter.ts`, Helmet.

**Routes**

| Route | Purpose |
|---|---|
| `/api/auth/google` | Google OAuth 2.0 |
| `/api/search` | Ranked search |
| `/api/search/artist/:id` | Artist top songs |
| `/api/search/album/:id` | Album tracklist |
| `/api/dashboard` | Personalized dashboard sections |
| `/api/dashboard/guest` | Guest dashboard sections |
| `/api/playlist/*` | Playlist CRUD |
| `/api/ai/generate` | Mood/prompt-based playlist generation |
| `/api/ai/match` | Song list matching |
| `/api/import/detect` | External playlist platform detection |
| `/api/share/song`, `/api/share/playlist` | Share slug generation |
| `/api/share/s/:slug`, `/api/share/p/:slug` | Public share retrieval |
| `/api/session/create`, `/api/session/join` | SoulLink room management |
| `/api/user/*` | Profile, preferences, stats |
| `/api/user/stats` | Real-time timeline metrics, top songs/artists |
| `/api/feedback` | Feedback and support |

**Services:** `jiosaavn.ts`, `searchRanker.ts`, `searchEnhancer.ts`, `groq.ts`, `intentParser.ts`, `redis.ts`, `mongodb.ts`, `dashboardEngine.ts`, `importDetector.ts`

**Socket.io Events:** `duo:join`, `duo:sync-song-change`, `duo:sync-play`, `duo:sync-seek`, `duo:message`, `duo:end-session`, `heartbeat` (5s)

### Data Layer
MongoDB Atlas (Users, Playlists, ListeningHistory, DuoSessions, Feedback), Upstash Redis (search/dashboard/AI caches, 10–30 min TTL), Groq Cloud (GPT OSS 120B, 5-key failover rotation).

### Hosting
Vercel (frontend) · Render (backend) · MongoDB Atlas (database)

---

## API Reference

Base URL (local): `http://localhost:4000`. Auth via JWT (RS256) in httpOnly cookies after Google OAuth. Routes marked **Auth optional** support guest and authenticated requests via `softAuth`.

- **`GET /api/auth/google`** — Google OAuth 2.0 login
- **`GET /api/search?q=...`** — Auth optional. Ranked search, up to 50 results
- **`GET /api/search/artist/:id`** / **`GET /api/search/album/:id`**
- **`GET /api/dashboard`** — Auth required. Personalized sections
- **`GET /api/dashboard/guest`** — No auth. Global/aggregate sections
- **`/api/playlist/*`** — Auth required. CRUD
- **`POST /api/ai/generate`** — Auth required. Prompt → AI playlist (GPT OSS 120B)
- **`POST /api/ai/match`** — Auth required. Resolve song titles to catalog metadata
- **`POST /api/import/detect`** — Detect playlist source platform
- **`POST /api/share/song`** / **`POST /api/share/playlist`** — Generate share slug
- **`GET /api/share/s/:slug`** / **`GET /api/share/p/:slug`** — Public retrieval
- **`POST /api/session/create`** / **`POST /api/session/join`** — Auth optional. SoulLink rooms
- **`GET/PUT /api/user/*`**, **`GET /api/user/stats`** — Auth required
- **`POST /api/feedback`** — Auth required

**Socket.io Events**

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `duo:join` | Client → Server | `{ roomCode }` | Join a room |
| `duo:sync-song-change` | Bidirectional | `{ song, queue }` | Sync track/queue |
| `duo:sync-play` | Bidirectional | `{ isPlaying, timestamp }` | Sync play/pause |
| `duo:sync-seek` | Bidirectional | `{ position }` | Sync seek position |
| `duo:message` | Bidirectional | `{ text, sender }` | In-room chat |
| `duo:end-session` | Client → Server | `{ roomCode }` | End session |
| `heartbeat` | Bidirectional | — | Liveness check (5s) |

---

## Contributing

- **Report bugs:** Open a detailed issue with reproduction steps.
- **Suggest features:** Share ideas via an issue.
- **UI/UX polish:** Improve mobile responsiveness, animations, or styling.
- **Code contributions:** Submit PRs for open issues.
- **Documentation:** Improve guides or comments.

### Pull Request Workflow

```bash
git clone https://github.com/YOUR_USERNAME/SoulSync.git
cd SoulSync
git checkout -b feat/my-awesome-feature
npm run install:all
# make changes
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
git commit -m "feat: add awesome new feature"
git push origin feat/my-awesome-feature
```

### Commit Style (Conventional Commits)

| Prefix | Meaning |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `style:` | Formatting, no logic change |
| `refactor:` | Restructuring, no behavior change |
| `perf:` | Performance optimization |
| `chore:` | Build/dependency updates |

### Security Issues
Avoid public issues for vulnerabilities — use the in-app support chat or contact the maintainer directly.

---

## FAQ

**Is SoulSync really free?** Yes — no ads, no subscription, fully open source (MIT).

**Do I need an account?** No. Guests get dashboard, search, and playback. Account needed for personalization, playlists, offline downloads, and SoulLink history.

**Where does the catalog come from?** JioSaavn API — strongest in Hindi, English, Punjabi, Tamil, Telugu, and other South Asian languages, alongside 50M+ songs across 15+ languages total.

**What AI model powers playlists?** GPT OSS 120B via Groq Cloud (previously LLaMA 3.3 70B in earlier versions).

**What is SoulLink?** Real-time shared listening rooms via six-character codes, synced playback, and chat.

**Is there a mobile app?** Yes — native Android via Capacitor. No iOS currently.

**Where do downloaded songs go on Android?** Public `Documents/SoulSync/` folder, so other apps (VLC, file managers) can see them, as of v2.1.0.

**How do I report a bug?** [GitHub Issues](https://github.com/itslokeshx/SoulSync/issues) or the in-app feedback/support chat.

**Was there a recent outage?** Yes — an API outage affecting search, playback, and AI playlists was fully resolved; v5.0 is the current stable build.

---

## Changelog

### v5.0 (Latest)
- New guest dashboard (worldwide trending, new releases, editorial playlists, top artists) alongside retained personalized dashboard for logged-in users.
- AI playlist generation and import/matching upgraded to **GPT OSS 120B**.
- SoulLink rebuilt for improved sync stability and reconnect handling.
- New in-app support chat on the Profile page.

### v4.0
- **Auto Song Suggestion:** infinite playback queue auto-fill with taste-aware recommender + JioSaavn fallback.
- **Announcements Engine:** delayed popup + persistent unread badges across nav.
- **Feedback Portal & Admin Panel:** in-app feedback drawer, `/admin` triage dashboard, permanent delete.
- **Recommender Updates:** 70/30 balanced "Made For You" engine; refined Wrapped analytics.

### v3.0.0
- **Live Wrapped Listening Story:** full-screen portal overlay, vinyl disc infographic, concert-pass card, real-time timeline stats.
- **Premium Profile Redesign:** glassmorphic panels, animated metric glows.
- **Playlist Fix:** normalized JioSaavn song schema to fix 400 errors when adding to playlists.
- New endpoint: `GET /api/user/stats`.

### v2.1.0
- **Desktop Apps:** Windows (`.exe`) and Linux (`.deb`) clients with offline capability and native Google Auth.
- **Public Storage Downloads:** Android downloads moved to `Documents/SoulSync/` with sanitized, friendly filenames for external player compatibility.
- **Playback:** autoplay, fixed transition pauses, improved SoulLink sync, better shuffle.
- **SoulLink Redesign:** responsive side-by-side desktop layout, improved messaging UI.
- Multiple mobile APK stability fixes (disappearing downloads, local audio import, storage cleanup).

### v2.0
- Major search overhaul, YT Music-style dashboard, offline downloads, sharing, importing, plus 10 bug fixes.

### v1.0
- First public release: AI playlist builder (LLaMA 3.3 70B), SoulLink real-time duo sessions, personalized dashboard, offline downloads/local import, lock screen controls, 50M+ songs across 15+ languages.

---

*For full technical detail on any release, see [GitHub Releases](https://github.com/itslokeshx/SoulSync/releases).*
