<p align="center">
  <img src="https://img.shields.io/badge/SoulSync-Music-1DB954?style=for-the-badge&logo=spotify&logoColor=white" alt="SoulSync" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
</p>

<h1 align="center">🎧 SoulSync</h1>
<p align="center">
  <strong>Listen together. Feel together.</strong><br/>
  A premium music streaming app with real-time Duo Live Sync — built with React, Tailwind CSS, Socket.io & the JioSaavn API.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-duo-live-sync--how-it-works">Duo Sync</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-getting-started">Setup</a> •
  <a href="#-deployment">Deploy</a>
</p>

---

## ✨ Features

### 🎵 Core Music Experience

- **Full music streaming** powered by the JioSaavn API — millions of songs
- **Smart search** with debounced input — search songs, artists, albums instantly
- **High-quality playback** — auto-selects 320kbps → 160kbps → 96kbps
- **Queue management** — view, reorder, and auto-fill queue with recommendations
- **Shuffle & Repeat** — shuffle mode, repeat-one, repeat-all, repeat-off
- **Volume control** with mute toggle and slider
- **Seekbar** — scrub through songs with real-time progress
- **Recently Played** — persistent history across sessions (localStorage)
- **Liked Songs** — heart any song, dedicated liked songs view (localStorage)
- **Dynamic backgrounds** — album art color extraction for immersive gradients
- **Keyboard-friendly** — full playback control without touching the mouse

### 🏠 Curated Dashboard

- **5 hand-picked sections** with 50 curated songs:
  - 🔥 **Scorching Right Now** — Tamil viral & chart-dominating tracks
  - 💫 **Can't Stop Streaming** — Tamil streaming favorites & loop hits
  - 🌙 **Late Night Feels** — Tamil romantic & emotional essentials
  - 💖 **Love & Longing** — English emotional & couple-sync vibes
  - 🌍 **Worldwide Anthems** — Global viral & replay giants
- **12 Browse categories** — Fresh Drops, Kollywood, Anirudh, Rahman, Heartstrings, Charts, Melody Lane, Reels, Unwind, Dancefloor, Sid Sriram, On Repeat
- **Smart individual song search** — each curated song is searched individually for accurate results
- **API response caching** — sessionStorage cache with 15-min TTL, batched requests, exponential backoff on 429s

### 🎧 Duo Live Sync

- **Real-time listening with a partner** — create a room, share the code, listen together
- **Forced song sync** — both partners are always on the same song
- **Play / Pause / Seek sync** — every action mirrors instantly via WebSocket
- **WhatsApp-style chat** — persistent messaging within the Duo session
- **Song history** — tracks every song played during the session
- **Session persistence** — survives page reloads via sessionStorage + auto-rejoin
- **Heartbeat system** — live partner connection monitoring
- **End-of-session card** — beautiful recap with song history when session ends
- **DuoMobileBar** — floating bar showing current synced song + LIVE indicator on mobile

### 📱 Responsive Design

- **Desktop** — full sidebar + main content + player bar layout
- **Mobile** — bottom nav, swipe-friendly, full-screen Duo panel, safe area support
- **Glass morphism UI** — frosted glass panels, gradient overlays, smooth animations
- **Premium transitions** — Framer Motion powered fade/slide animations
- **Adaptive player** — compact mobile player with expandable full-screen view

---

## 🎧 Duo Live Sync — How It Works

```
┌──────────────┐                    ┌──────────────────┐                    ┌──────────────┐
│   Partner A  │───── Socket.io ────│   Backend Server  │───── Socket.io ────│   Partner B  │
│   (Host)     │                    │   Express + WS    │                    │   (Guest)    │
└──────────────┘                    └──────────────────┘                    └──────────────┘

Flow:
1. Host creates room       → POST /api/session/create → gets 6-char room code
2. Guest joins with code   → POST /api/session/join   → validates & joins
3. Both connect WebSocket  → duo:join                 → server sends full room state
4. Host's song syncs       → duo:sync-song-change     → guest auto-switches
5. Play/Pause/Seek         → duo:sync-play/pause/seek → mirrors in real-time
6. Chat messages           → duo:message              → instant delivery
7. Either ends session     → duo:end-session          → both get end card
```

### Socket Events

| Event                  | Direction       | Purpose                           |
| ---------------------- | --------------- | --------------------------------- |
| `duo:join`             | Client → Server | Join a room with code, name, role |
| `duo:session-state`    | Server → Client | Full room state on join           |
| `duo:partner-joined`   | Server → Client | Notify when partner connects      |
| `duo:sync-song-change` | Client ↔ Server | Sync current song + queue         |
| `duo:sync-play`        | Client ↔ Server | Sync play action + timestamp      |
| `duo:sync-pause`       | Client ↔ Server | Sync pause action                 |
| `duo:sync-seek`        | Client ↔ Server | Sync seek position                |
| `duo:message`          | Client ↔ Server | WhatsApp-style chat               |
| `duo:heartbeat`        | Client → Server | Partner alive check (5s interval) |
| `duo:end-session`      | Client → Server | End the session for both          |

---

## 🛠 Tech Stack

### Frontend

| Technology               | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| **React 18.3**           | UI framework with hooks & functional components |
| **Vite 6.4**             | Lightning-fast dev server & build tool          |
| **Tailwind CSS 3.4**     | Utility-first styling with custom design tokens |
| **Zustand 5**            | Lightweight state management (Duo store)        |
| **Framer Motion 12**     | Smooth animations & transitions                 |
| **Socket.io Client 4.8** | Real-time WebSocket communication               |
| **Lucide React**         | Beautiful, consistent icon set                  |

### Backend

| Technology              | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| **Node.js + Express 4** | REST API server                            |
| **Socket.io 4.8**       | WebSocket server for real-time sync        |
| **Helmet**              | Security headers                           |
| **CORS**                | Dynamic origin support (Vercel subdomains) |
| **nanoid**              | Unique room code generation                |
| **In-memory store**     | Room state (Redis-compatible interface)    |

### API

| Service          | Purpose                                               |
| ---------------- | ----------------------------------------------------- |
| **JioSaavn API** | Song search, details, streaming URLs, recommendations |

---

## 📁 Project Structure

```
SoulSync/
├── index.html                  # Entry HTML with PWA meta tags
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind CSS config with custom theme
├── postcss.config.js           # PostCSS plugins
├── eslint.config.js            # ESLint configuration
├── package.json                # Frontend dependencies & scripts
├── .env                        # Environment variables (VITE_DUO_BACKEND)
├── .gitignore                  # Git ignore rules
│
├── public/
│   └── vite.svg                # Favicon
│
├── src/
│   ├── main.jsx                # React entry point
│   ├── index.css               # Global styles + Tailwind directives
│   ├── App.jsx                 # 🏗️  Main app (~2900 lines)
│   │                           #     ├── Constants (API, genres, curated sections)
│   │                           #     ├── Helpers (bestUrl, bestImg, color extraction)
│   │                           #     ├── Custom Hooks (useRecentlyPlayed, useLocalStorage)
│   │                           #     ├── Sub-components:
│   │                           #     │   ├── EqBars (animated equalizer)
│   │                           #     │   ├── DuoMobileBar (live sync bar)
│   │                           #     │   ├── MobileNav (bottom navigation)
│   │                           #     │   ├── HSection (horizontal scroll section)
│   │                           #     │   ├── SongCard (album art + play button)
│   │                           #     │   ├── SongRow (list-style song item)
│   │                           #     │   ├── ArtistBubble (circular artist card)
│   │                           #     │   ├── BrowsePage (genre grid + search)
│   │                           #     │   ├── HomePage (curated dashboard)
│   │                           #     │   ├── LikedPage (saved songs view)
│   │                           #     │   ├── AlbumPage (album detail view)
│   │                           #     │   └── QueuePanel (queue sidebar)
│   │                           #     └── App (main layout + player + state)
│   │
│   ├── assets/
│   │   └── react.svg
│   │
│   ├── components/
│   │   └── index.md
│   │
│   └── duo/                    # 🎧 Duo Live Sync module
│       ├── index.js            # Barrel export
│       ├── socket.js           # Socket.io client (connect/disconnect/getSocket)
│       ├── duoStore.js         # Zustand store + sessionStorage persistence
│       ├── useDuo.js           # Main hook — socket events, sync actions, auto-rejoin
│       ├── DuoButton.jsx       # Duo toggle button (sidebar/mobile-nav/auto variants)
│       ├── DuoModal.jsx        # Create/Join session modal
│       ├── DuoPanel.jsx        # Side panel — chat, song history, session info
│       ├── DuoEndCard.jsx      # End-of-session recap card
│       ├── DuoHeartbeat.jsx    # Partner connection heartbeat
│       └── DuoReactions.jsx    # (Reserved for future use)
│
└── backend/                    # 🖥️  Real-time sync server
    ├── package.json            # Backend dependencies & scripts
    ├── .env                    # PORT, FRONTEND_URL, Redis config
    │
    └── src/
        ├── index.js            # Express + Socket.io server setup, CORS
        │
        ├── routes/
        │   └── session.js      # REST: POST /create, POST /join, GET /:code, DELETE /:code
        │
        ├── socket/
        │   ├── index.js        # Socket.io event registration
        │   ├── roomHandlers.js # Core: join, sync-play/pause/seek/song-change, heartbeat, end, disconnect
        │   └── reactionHandlers.js # Chat message handler (duo:message)
        │
        ├── services/
        │   ├── roomService.js  # Room CRUD — create, get, update, join, disconnect (in-memory)
        │   └── redis.js        # Redis adapter with in-memory fallback
        │
        └── middleware/
            └── rateLimiter.js  # API rate limiting
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/SoulSync.git
cd SoulSync
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Configure Environment Variables

**Root `.env`** (frontend):

```env
VITE_DUO_BACKEND=http://localhost:4000
```

**`backend/.env`** (backend):

```env
PORT=4000
FRONTEND_URL=http://localhost:5173
```

### 5. Start the Backend

```bash
cd backend
npm run dev
```

### 6. Start the Frontend (new terminal)

```bash
npm run dev
```

### 7. Open the App

Visit **http://localhost:5173** — you're live! 🎶

---

## 🌐 Deployment

### Frontend → Vercel

1. Push your repo to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Set environment variable:
   ```
   VITE_DUO_BACKEND=https://your-backend.onrender.com
   ```
4. Deploy — Vite builds automatically

### Backend → Render

1. Create a **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Set environment variables:
   ```
   PORT=4000
   FRONTEND_URL=https://your-app.vercel.app
   ```
5. Deploy — CORS is pre-configured for `.vercel.app` subdomains

---

## 🎨 Design System

| Token             | Value                                                              | Usage                                         |
| ----------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `sp-green`        | `#1DB954`                                                          | Primary accent, active states, Duo indicators |
| `sp-bg`           | `#0a0a0a`                                                          | App background                                |
| `sp-card`         | `#161616`                                                          | Card surfaces                                 |
| `sp-sub`          | `#a1a1a1`                                                          | Subtitle / secondary text                     |
| Glass morphism    | `blur(20px) + rgba overlays`                                       | Panels, nav, player                           |
| Border radius     | `rounded-2xl` / `rounded-xl`                                       | Cards, buttons                                |
| Z-index hierarchy | Toasts `60` > Nav `50` > DuoPanel `45` > DuoBar `41` > Player `40` | Layering                                      |

---

## ⚡ Performance Optimizations

- **Individual song search** — each curated song searched separately for accurate results
- **Batched API calls** — 3 concurrent requests per batch with 400ms spacing
- **Exponential backoff** — auto-retry on 429 rate limits (1s → 2s → 4s)
- **sessionStorage caching** — 15-minute TTL prevents redundant API calls
- **Lazy recommendations** — queue auto-fills only when thin (≤1 song)
- **Ref-based callbacks** — avoids stale closures in audio event handlers
- **Debounced search** — 400ms delay prevents excessive API calls while typing
- **Image error fallback** — graceful SVG placeholder on broken artwork

---

## 🔒 Security

- **Helmet** — secure HTTP headers on the backend
- **CORS** — dynamic origin validation (regex for `.vercel.app` subdomains)
- **Rate limiting** — middleware to prevent API abuse
- **No credentials stored** — all session data in sessionStorage (ephemeral)
- **Input validation** — server-side checks on all REST endpoints

---

## 📝 API Reference

### REST Endpoints (Backend)

| Method   | Endpoint              | Body                  | Response           |
| -------- | --------------------- | --------------------- | ------------------ |
| `POST`   | `/api/session/create` | `{ hostName }`        | `{ code, room }`   |
| `POST`   | `/api/session/join`   | `{ code, guestName }` | `{ room }`         |
| `GET`    | `/api/session/:code`  | —                     | `{ room }`         |
| `DELETE` | `/api/session/:code`  | —                     | `{ ok: true }`     |
| `GET`    | `/health`             | —                     | `{ status: "ok" }` |

### JioSaavn API (External)

| Endpoint                       | Purpose                               |
| ------------------------------ | ------------------------------------- |
| `/search/songs?q=...&n=...`    | Search songs by query                 |
| `/song?id=...`                 | Get full song details + download URLs |
| `/song/recommend?id=...&n=...` | Get song recommendations              |
| `/search/artists?q=...`        | Search for artists                    |
| `/artist?id=...`               | Get artist details + songs            |
| `/album?id=...`                | Get album details + track list        |

---

## 🗺️ Roadmap

- [ ] PWA support with offline caching
- [ ] Lyrics display (synced)
- [ ] Duo reactions & emoji bursts
- [ ] Playlist creation & management
- [ ] Audio visualizer
- [ ] Social sharing
- [ ] Multi-language UI

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ by <strong>Loki</strong><br/>
  <em>Listen together. Feel together.</em>
</p>
