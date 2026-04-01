<div align="center">

# ✦ SoulSync

**Listen together. Feel together.**

Free, open-source music streaming with AI playlists, real-time listening sessions, and native apps. No ads. No subscription. Ever.

---

### Quick Access

| [🌐 Web App](https://soul-sync-beta.vercel.app/) | [💻 Windows](https://github.com/itslokeshx/SoulSync/releases/download/v2.1.0/SoulSync_2.1.0.exe) | [🐧 Linux](https://github.com/itslokeshx/SoulSync/releases/download/v2.1.0/soulsync_2.1.0.deb) | [📱 Android](https://github.com/itslokeshx/SoulSync/releases/download/v2.1.0/SoulSync_2.1.0.apk) |
| :---: | :---: | :---: | :---: |

[All Releases →](https://github.com/itslokeshx/SoulSync/releases)

---

### Why SoulSync?

| Feature | SoulSync | Spotify Free | Spotify Premium |
| :--- | :---: | :---: | :---: |
| Ad-free | ✅ | ❌ | ✅ |
| AI Playlists | ✅ | ❌ | ❌ |
| Listen Together + Chat | ✅ | ❌ | ❌ (no chat) |
| Offline Downloads | ✅ | ❌ | ✅ |
| Originals-first Search | ✅ | ❌ | ❌ |
| Playlist Import | ✅ (Spotify, YT, Apple, Gaana) | ❌ | ❌ |
| Open Source | ✅ MIT | ❌ | ❌ |
| **Price** | **₹0 forever** | ₹0 w/ ads | **₹119/month** |

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18.3 · TypeScript 5.7 · Vite 6.1 · Tailwind CSS 3.4 · Zustand 5 · TanStack Query 5 |
| **Mobile** | Capacitor 8.1 · Android API 24+ |
| **Backend** | Node.js 18+ · Express 4.21 · Socket.io 4.8 · TypeScript 5.7 |
| **Data** | MongoDB 8.9 · Upstash Redis (90-day TTL) |
| **AI** | Groq SDK · LLaMA 3.3 70B |
| **Auth** | Google OAuth 2.0 · JWT RS256 · httpOnly cookies |
| **Infra** | Vercel · Render · MongoDB Atlas |

---

## Core Features

### 🔍 7-Factor Intelligent Search
- **Originals first** — songs with "cover", "karaoke", "tribute" are automatically penalized
- **7 ranking signals** — play count (dominant), title/artist match, language preference
- **50 results** per query with artists and albums sections
- **Redis cache** — 10-min TTL, repeat searches return in under 50ms

### 🤖 AI Playlist Generator
- **Mood-based** — describe a vibe, get 15 songs with a creative name
- **Song matching** — paste a list of songs, AI finds matches from JioSaavn
- **Multi-key rotation** — up to 5 Groq API keys with auto-fallback
- **Universal import** — Spotify, YouTube Music, Apple Music, Gaana, or plain text

### 🎧 Listen Together (SoulLink)
- **Real-time sync** — host plays, pause, seeks, queue changes sync to all guests
- **6-character room codes** — simple sharing, no account needed to join
- **Built-in chat** — message within the session
- **Heartbeat protocol** — auto-cleanup on disconnect

### 📱 Native Android App
- **Offline without login** — opens directly when offline
- **Lock screen controls** — play/pause/skip from Android notification
- **Background audio** — keeps playing when minimized
- **Haptic feedback** — native tap responses
- **Swipe player** — mini bar ↔ full screen

### 🔗 Shareable Links
- **Song links** — `soul-sync-beta.vercel.app/s/:slug` — plays without account
- **Playlist links** — `soul-sync-beta.vercel.app/p/:slug` — no login required
- **Rich previews** — OG meta tags show album art in WhatsApp, iMessage, Telegram

### ✈️ Offline Mode
| Scenario | Web | APK |
| :--- | :--- | :--- |
| Offline + logged in | ✅ Downloads | ✅ Downloads |
| Offline + not logged in | ❌ Login required | ✅ Opens directly |

---

## Architecture

```
┌──────────────┐      ┌──────────────┐
│   Web App    │      │ Android APK │
│  (Vite/React)│      │ (Capacitor) │
└──────┬───────┘      └──────┬───────┘
       │                     │
       └─────────┬───────────┘
                 │
        ┌────────▼────────┐
        │   Express API   │
        │   + Socket.io   │
        └────────┬────────┘
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
  MongoDB     Redis       Groq
```

**Key stores (Zustand):**
- `playerStore` — play state, queue, volume
- `searchStore` — query, results
- `duoStore` — session state
- `offlineStore` — downloaded songs

---

## Performance

| Metric                   | Before | After  | Δ     |
| ------------------------ | ------ | ------ | ----- |
| Search latency (cached)  | 1.2s   | 45ms   | −96%  |
| Dashboard load (cached)  | 2.1s   | 95ms   | −95%  |
| Results per query        | 20     | 50     | +150% |
| Original song at rank #1 | Never  | Always | ✅    |
| Cache hit rate           | 0%     | 78%    | —     |

| Optimization          | Detail                                                          |
| --------------------- | --------------------------------------------------------------- |
| Parallel API calls    | `/search/songs` + `/search` in parallel — 2× data, same latency |
| Redis search cache    | 10-min TTL — repeat searches < 50ms                             |
| Redis dashboard cache | 30-min TTL — repeat loads < 100ms                               |
| Redis AI cache        | 30-min TTL — no duplicate Groq calls                            |
| Deduplication engine  | Parallel results merged, best play-count kept                   |
| Debounced search      | 200ms delay + AbortController on stale requests                 |
| Skeleton loaders      | Grid-matched shimmer — CLS 0.02                                 |
| 13-min self-ping      | Prevents Render cold starts                                     |

---

## Security

| Layer          | Implementation                                                         |
| -------------- | ---------------------------------------------------------------------- |
| Authentication | Google OAuth 2.0 — no passwords stored                                 |
| Sessions       | httpOnly, Secure, SameSite cookies (web) · Capacitor Preferences (APK) |
| Headers        | Helmet: CORP, COOP, CSP on all responses                               |
| CORS           | Exact origin validation — Vercel URL + `capacitor://localhost`         |
| Rate limiting  | 100 req/min global · 15 req/min AI endpoints                           |
| JWT            | RS256, verified on every protected route                               |
| Validation     | Zod schemas on all REST endpoints                                      |
| APK secrets    | No secrets in APK — all sensitive ops server-side                      |
| Share links    | Read-only — slugs cannot modify any user data                          |

---

## Getting Started

### Prerequisites

| Requirement    | Version             | Notes           |
| -------------- | ------------------- | --------------- |
| Node.js        | ≥ 18                | Required        |
| npm            | ≥ 9                 | Required        |
| MongoDB Atlas  | Free M0             | Required        |
| Google Cloud   | OAuth 2.0 Client ID | Required        |
| Groq API       | Free key            | AI features     |
| Android Studio | Latest              | APK builds only |

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

[MIT License](LICENSE).

---

## Acknowledgments

| Project                                                               | Role                     |
| --------------------------------------------------------------------- | ------------------------ |
| [sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) | Music streaming backbone |
| [Groq Cloud](https://groq.com)                                        | LLaMA 3.3 70B inference  |
| [Ionic Capacitor](https://github.com/ionic-team/capacitor)            | Native Android bridge    |
| [Socket.io](https://github.com/socketio/socket.io)                    | Real-time duo sessions   |
| [Zustand](https://github.com/pmndrs/zustand)                          | State management         |
| [Framer Motion](https://github.com/framer/motion)                     | Animations               |

---

<div align="center">

<br/>

**Built with ❤️ by [Loki](https://github.com/itslokeshx)**

_No ads. No paywalls. No limits._

[![GitHub](https://img.shields.io/badge/GitHub-itslokeshx-181717?style=flat-square&logo=github)](https://github.com/itslokeshx)
[![Twitter](https://img.shields.io/badge/Twitter-@itslokeshx-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://twitter.com/itslokeshx)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/itslokeshx)

_If this saved you ₹119/month — drop a ⭐_

</div>
