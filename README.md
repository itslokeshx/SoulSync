<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=FF6B35&height=120&section=header&animation=fadeIn" width="100%"/>

# ✦ SoulSync

### Listen together. Feel together.

**Free, open-source music streaming — AI playlists, real-time listening sessions, native apps.**
No ads. No subscription. Ever.

[![Live App](https://img.shields.io/badge/Web_App-Live-FF6B35?style=for-the-badge&logoColor=white)](https://soul-sync-beta.vercel.app/)
[![Release](https://img.shields.io/github/v/release/itslokeshx/SoulSync?style=for-the-badge&color=FF6B35)](https://github.com/itslokeshx/SoulSync/releases)
[![License](https://img.shields.io/badge/License-MIT-FF6B35?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/itslokeshx/SoulSync?style=for-the-badge&color=FF6B35)](https://github.com/itslokeshx/SoulSync/stargazers)

</div>

---

## 📥 Downloads

|  Platform  |                                                   Link                                                   |   Requirement   |
| :--------: | :------------------------------------------------------------------------------------------------------: | :-------------: |
|   🌐 Web   |                     [soul-sync-beta.vercel.app](https://soul-sync-beta.vercel.app/)                      |   No install    |
| 💻 Windows | [SoulSync_2.1.0.exe](https://github.com/itslokeshx/SoulSync/releases/download/v2.1.0/SoulSync_2.1.0.exe) |   Windows 10+   |
|  🐧 Linux  | [soulsync_2.1.0.deb](https://github.com/itslokeshx/SoulSync/releases/download/v2.1.0/soulsync_2.1.0.deb) | Debian / Ubuntu |
| 📱 Android | [SoulSync_2.1.0.apk](https://github.com/itslokeshx/SoulSync/releases/download/v2.1.0/SoulSync_2.1.0.apk) |  Android 7.0+   |

---

## Why SoulSync?

| Feature                                     |    SoulSync    | Spotify Free | Spotify Premium |
| :------------------------------------------ | :------------: | :----------: | :-------------: |
| Ad-free                                     |       ✅       |      ❌      |       ✅        |
| AI Playlists                                |       ✅       |      ❌      |       ❌        |
| Listen Together + Chat                      |       ✅       |      ❌      |       ❌        |
| Offline Downloads                           |       ✅       |      ❌      |       ✅        |
| Originals-first Search                      |       ✅       |      ❌      |       ❌        |
| Playlist Import (Spotify, YT, Apple, Gaana) |       ✅       |      ❌      |       ❌        |
| Open Source                                 |     ✅ MIT     |      ❌      |       ❌        |
| **Price**                                   | **₹0 forever** |  ₹0 w/ ads   |   ₹119/month    |

---

## ✨ Core Features

### 🔍 Intelligent Search — 7 Ranking Signals

- **Originals first** — covers, karaokes, and tributes are automatically penalized
- **7-factor ranking** — play count (dominant), title/artist match, language preference
- **50 results** per query including artist and album sections
- **Redis cache** — 10-min TTL, repeat searches return in under 50ms

### 🤖 AI Playlist Generator

- **Mood-based** — describe a vibe, get 15 curated songs with a creative name
- **Song matching** — paste a list, AI finds JioSaavn matches automatically
- **Multi-key rotation** — up to 5 Groq API keys with auto-fallback
- **Universal import** — Spotify, YouTube Music, Apple Music, Gaana, or plain text

### 🎧 SoulLink — Listen Together

- **Real-time sync** — host controls (play, pause, seek, queue) sync to all guests
- **6-character room codes** — no account needed to join
- **Built-in chat** — message within the session
- **Heartbeat protocol** — auto-cleanup on disconnect

### 📱 Native Android App

- **Offline without login** — opens directly when offline
- **Lock screen controls** — play / pause / skip from notification
- **Background audio** — keeps playing when minimized
- **Haptic feedback** + swipe player (mini bar ↔ full screen)

### 🔗 Shareable Links

- Song links: `soul-sync-beta.vercel.app/s/:slug`
- Playlist links: `soul-sync-beta.vercel.app/p/:slug`
- **Rich previews** — album art in WhatsApp, iMessage, Telegram via OG meta tags

### ✈️ Offline Mode

| Scenario                |          Web           |          APK           |
| :---------------------- | :--------------------: | :--------------------: |
| Offline + logged in     | ✅ Downloads available | ✅ Downloads available |
| Offline + not logged in |   ❌ Login required    |   ✅ Opens directly    |

---

## ⚡ Performance

| Metric                   | Before | After  | Improvement |
| :----------------------- | :----: | :----: | :---------: |
| Search latency (cached)  |  1.2s  |  45ms  |  **−96%**   |
| Dashboard load (cached)  |  2.1s  |  95ms  |  **−95%**   |
| Results per query        |   20   |   50   |  **+150%**  |
| Original song at rank #1 | Never  | Always |     ✅      |
| Cache hit rate           |   0%   |  78%   |      —      |

---

## 🏗️ Architecture

```
┌──────────────────┐       ┌──────────────────┐
│    Web App       │       │   Android APK    │
│  (Vite + React)  │       │   (Capacitor)    │
└────────┬─────────┘       └────────┬─────────┘
         │                          │
         └────────────┬─────────────┘
                      │
          ┌───────────▼───────────┐
          │    Express API         │
          │   + Socket.io         │
          └───────────┬───────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    MongoDB        Redis         Groq
```

---

## 🛠️ Tech Stack

| Layer        | Technologies                                                                             |
| :----------- | :--------------------------------------------------------------------------------------- |
| **Frontend** | React 18.3 · TypeScript 5.7 · Vite 6.1 · Tailwind CSS 3.4 · Zustand 5 · TanStack Query 5 |
| **Mobile**   | Capacitor 8.1 · Android API 24+                                                          |
| **Backend**  | Node.js 18+ · Express 4.21 · Socket.io 4.8 · TypeScript 5.7                              |
| **Data**     | MongoDB 8.9 · Upstash Redis (90-day TTL)                                                 |
| **AI**       | Groq SDK · LLaMA 3.3 70B                                                                 |
| **Auth**     | Google OAuth 2.0 · JWT RS256 · httpOnly cookies                                          |
| **Infra**    | Vercel · Render · MongoDB Atlas                                                          |

---

## 🔒 Security

| Layer          | Implementation                           |
| :------------- | :--------------------------------------- |
| Authentication | Google OAuth 2.0 — no passwords stored   |
| Sessions       | httpOnly · Secure · SameSite cookies     |
| Headers        | Helmet: CORP, COOP, CSP on all responses |
| CORS           | Exact origin validation                  |
| Rate limiting  | 100 req/min global · 15 req/min AI       |
| JWT            | RS256, verified on every protected route |
| Validation     | Zod schemas on all REST endpoints        |

---

## 🚀 Quick Start

### Prerequisites

| Requirement    |       Version       | Notes            |
| :------------- | :-----------------: | :--------------- |
| Node.js        |        ≥ 18         | Required         |
| npm            |         ≥ 9         | Required         |
| MongoDB Atlas  |       Free M0       | Required         |
| Google Cloud   | OAuth 2.0 Client ID | Required         |
| Groq API       |      Free key       | AI features only |
| Android Studio |       Latest        | APK builds only  |

### Setup

```bash
# Clone the repo
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

# Install all dependencies
npm run install:all

# Configure environment
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Start dev servers (two terminals)
npm run dev:backend
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

> ⚠️ `JIOSAAVN_API` must be in `backend/.env` **without** the `VITE_` prefix.

---

## 🌍 Deployment

### Frontend → Vercel

1. Push to GitHub and import on [vercel.com](https://vercel.com)
2. Set all `VITE_*` environment variables
3. Deploy — `vercel.json` is already included
4. Add your deployed URL to Google OAuth authorized origins

### Backend → Render

1. Create a Web Service and connect your GitHub repo
2. Root directory: `backend`
3. Build command: `npm install --include=dev && npm run build`
4. Start command: `npm start`
5. Set all env vars — especially `JIOSAAVN_API` (no `VITE_` prefix)

### Android APK

```bash
cd frontend && npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

---

## 📡 API Reference

| Method | Endpoint                              | Description                       |
| :----: | :------------------------------------ | :-------------------------------- |
| `POST` | `/api/auth/google`                    | Authenticate with Google ID token |
| `GET`  | `/api/search?q=...&lang=...&limit=50` | 7-factor ranked search            |
| `GET`  | `/api/search/artist/:id`              | Top songs by artist               |
| `GET`  | `/api/search/album/:id`               | Full album tracklist              |
| `POST` | `/api/share/song`                     | Generate shareable song slug      |
| `POST` | `/api/share/playlist`                 | Generate shareable playlist slug  |
| `GET`  | `/api/share/s/:slug`                  | Get shared song (no auth)         |
| `GET`  | `/api/share/p/:slug`                  | Get shared playlist (no auth)     |
| `POST` | `/api/import/detect`                  | Detect platform from URL          |
| `GET`  | `/api/dashboard`                      | Personalized dashboard (auth)     |
| `GET`  | `/api/dashboard/guest`                | Guest dashboard                   |
| `POST` | `/api/ai/generate`                    | Generate playlist from mood       |
| `POST` | `/api/ai/match`                       | Match songs from list             |
| `POST` | `/api/session/create`                 | Create SoulLink room              |
| `POST` | `/api/session/join`                   | Join SoulLink room                |

---

## 🐛 Troubleshooting

<details>
<summary><b>Songs won't play / silent playback</b></summary>

Always call `normalizeSong()` before `loadAndPlay()`:

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

`isHost` must be a `ref`, not state, to prevent stale closures in socket listeners:

```typescript
const isHostRef = useRef(isHost);
isHostRef.current = isHost;
```

Also verify `socket.connected === true` and both users share the same 6-character code.

</details>

<details>
<summary><b>Search returns covers before originals</b></summary>

Verify `JIOSAAVN_API` (no `VITE_` prefix) is set in `backend/.env`. Clear Redis cache or wait for the 10-minute TTL.

</details>

<details>
<summary><b>APK won't install</b></summary>

Enable unknown sources: **Settings → Security → Install unknown apps → Allow**. Requires Android 7.0 (API 24)+.

</details>

<details>
<summary><b>Backend 502 / connection refused</b></summary>

First request after inactivity on Render's free tier takes 30–60s. The built-in self-ping at 13-min intervals mitigates cold starts.

</details>

<details>
<summary><b>Environment variables not loading</b></summary>
```bash
# ❌ Wrong — backend cannot read VITE_ prefix
VITE_JIOSAAVN_API=https://saavn.sumit.co/api

# ✅ Correct in backend/.env

JIOSAAVN_API=https://saavn.sumit.co/api

````

Always restart both dev servers after editing `.env` files.
</details>

---

## 🤝 Contributing
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
npm run dev:backend   # terminal 1
npm run dev:frontend  # terminal 2

# 5. Commit and push
git commit -m "feat: your feature description"
git push origin feat/your-feature

# 6. Open a pull request
````

**Commit convention:** `feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `chore`

**PR checklist:**

- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] No console errors
- [ ] Tested on Chrome, Firefox, Safari (web)
- [ ] Tested on Android (if APK changes)

[→ Browse good first issues](https://github.com/itslokeshx/SoulSync/labels/good%20first%20issue)

---

## 🙏 Acknowledgments

| Project                                                               | Role                     |
| :-------------------------------------------------------------------- | :----------------------- |
| [sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) | Music streaming backbone |
| [Groq Cloud](https://groq.com)                                        | LLaMA 3.3 70B inference  |
| [Ionic Capacitor](https://github.com/ionic-team/capacitor)            | Native Android bridge    |
| [Socket.io](https://github.com/socketio/socket.io)                    | Real-time duo sessions   |
| [Zustand](https://github.com/pmndrs/zustand)                          | State management         |
| [Framer Motion](https://github.com/framer/motion)                     | Animations               |

---

## 📄 License

Distributed under the [MIT License](LICENSE).

---

<div align="center">

**Built with ❤️ by [Loki](https://github.com/itslokeshx)**

_No ads. No paywalls. No limits._

[![GitHub](https://img.shields.io/badge/GitHub-itslokeshx-181717?style=flat-square&logo=github)](https://github.com/itslokeshx)
[![Twitter](https://img.shields.io/badge/Twitter-@itslokeshx-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://twitter.com/itslokeshx)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/itslokeshx)

_If SoulSync saved you ₹119/month — drop a ⭐_

<img src="https://capsule-render.vercel.app/api?type=waving&color=FF6B35&height=80&section=footer" width="100%"/>

</div>
