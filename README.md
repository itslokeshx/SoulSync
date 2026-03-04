<p align="center">
  <a href="https://soul-sync-beta.vercel.app/"><img src="https://img.shields.io/badge/🔴_LIVE-soul--sync--beta.vercel.app-1DB954?style=for-the-badge" alt="Live Demo" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SoulSync-Music-1DB954?style=for-the-badge&logo=spotify&logoColor=white" alt="SoulSync" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-6.1-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/MongoDB-8.9-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Groq_AI-LLaMA_3.3-FF6600?style=for-the-badge&logo=meta&logoColor=white" alt="Groq AI" />
</p>

<h1 align="center">🎧 SoulSync</h1>
<p align="center">
  <strong>Listen together. Feel together.</strong><br/>
  A premium, AI-powered music streaming app with real-time SoulLink (listen together), smart personalized dashboards, AI playlist generation, offline downloads, and cloud-synced libraries — built with React, TypeScript, Tailwind CSS, MongoDB, Socket.io & the JioSaavn API.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-ai-powered-features">AI</a> •
  <a href="#-soullink--listen-together">SoulLink</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-getting-started">Setup</a> •
  <a href="#-deployment">Deploy</a> •
  <a href="#-api-reference">API</a>
</p>

---

## ✨ Features

### 🔐 Authentication & Onboarding

- **Google OAuth 2.0** — one-tap sign-in via `@react-oauth/google`, verified server-side with `google-auth-library`
- **JWT sessions** — httpOnly secure cookies with 7-day expiry, automatic renewal
- **Guided onboarding** — 4-step wizard (languages → eras → moods → profile name) with animated card-based slides
- **Protected routes** — `ProtectedRoute` wrapper redirects unauthenticated users to login
- **User profiles** — Google profile picture, editable display name, language/mood/era preferences

### 🎵 Core Music Experience

- **Full music streaming** powered by the JioSaavn API — millions of songs across 10+ Indian languages & English
- **Smart search** with NLP-like query parsing — understands artists, moods, languages, eras, movies, and formats (e.g., "sad anirudh songs 2024", "romantic AR Rahman Tamil")
- **Search enhancer** — 500+ artist dictionary, mood tokenization, language detection, intent classification, multi-query expansion, and relevance scoring
- **High-quality playback** — auto-selects 320kbps → 160kbps → 96kbps based on availability
- **Queue management** — view, reorder, add next/last, shuffle, and auto-fill with recommendations
- **Shuffle & Repeat** — shuffle mode, repeat-one, repeat-all, repeat-off
- **Volume control** with mute toggle, slider, and keyboard shortcuts
- **Seekbar** — scrub through songs with real-time progress tracking
- **Now Playing view** — full-screen immersive view with dynamic album art background, vinyl spin animation, and lyrics-ready layout
- **Context menu** — right-click any song for: Play, Add to Queue, Add to Playlist, Like/Unlike, Download, Go to Artist, Go to Album
- **Keyboard shortcuts** — space (play/pause), arrow keys (seek/volume), M (mute), S (shuffle), R (repeat)
- **Dynamic backgrounds** — album art color extraction for immersive gradient overlays

### 🤖 AI-Powered Features

- **AI Playlist Generation** — describe a mood or paste song names → Groq AI (LLaMA 3.3 70B) generates a curated playlist with creative names
- **Smart song matching** — AI-optimized search queries with confidence scoring (high / partial / none)
- **Mood-based generation** — describe a vibe ("chill late night Tamil", "Bollywood workout pump") and get 15 matching songs
- **Multi-key rotation** — up to 5 Groq API keys with round-robin, rate-limit detection, and automatic fallback
- **Result caching** — AI responses cached in Redis for 30 minutes to save API calls

### 🏠 Personalized Dashboard

- **Dynamic, user-aware homepage** — built from listening history, language preferences, and time of day
- **Time-aware greetings** — morning/afternoon/evening/night greetings with matching mood queries
- **Section types:**
  - 🎵 **Quick Grid** — 6 recently played songs for instant replay
  - 🔄 **Continue Listening** — last 10 songs with album art, collapsible
  - 🎤 **Artist Spotlight** — top listened artist with their songs
  - 🌍 **Language sections** — personalized sections in your preferred languages (Tamil Hits, Hindi Vibes, etc.)
  - ⏰ **Time-based mood** — "Morning Fresh Hits", "Late Night Chill", etc.
  - 💡 **Because You Listened** — recommendations based on recent tracks
  - 📈 **Trending Now** — trending songs filtered by user's languages
  - 😊 **Mood Grid** — clickable mood cards (Happy, Heartbreak, Party, Chill, Workout, Rainy Day)
  - 🆕 **New Releases** — latest songs in preferred languages
- **Guest dashboard** — default curated content for users without listening history
- **30-minute cache** — Redis-backed caching with smart invalidation on preference changes

### 📚 Library & Playlists

- **Cloud-synced playlists** — create, edit, delete, reorder playlists stored in MongoDB
- **AI-generated playlists** — one-click save from AI Playlist Modal with auto-generated names and tags
- **Liked songs** — heart any song, cloud-synced with local localStorage fallback for offline resilience
- **Recently played** — persistent 20-song history with deduplication (localStorage)
- **Listening history** — full play log with MongoDB persistence, paginated API, 90-day TTL auto-cleanup
- **Playlist page** — dedicated view with song list, duration, reordering, and batch operations

### 📥 Offline Downloads

- **IndexedDB storage** — songs saved locally with separate blob + metadata stores
- **Download any song** — one-click download from context menu or player
- **Import local files** — drag & drop or file picker for MP3/WAV/AAC/OGG/FLAC files
- **Offline playback** — play downloaded songs without internet via blob URLs
- **Storage management** — view total storage used, remove individual songs
- **Auto-duration detection** — reads duration from audio file metadata on import

### 👤 Profile & Stats

- **User profile page** — Google avatar, editable name, preference tags (languages, moods)
- **Listening stats** — total songs played, total listening time, liked song count
- **Top artists** — aggregated from listening history with play counts and album art
- **Language breakdown** — pie-chart-ready data showing listening distribution by language
- **Edit preferences** — modify language, era, mood preferences; triggers dashboard rebuild

### 🎧 SoulLink — Listen Together

- **Real-time listening with a partner** — create a room, share the 6-character code, listen together
- **Forced song sync** — both partners are always on the same song
- **Play / Pause / Seek sync** — every action mirrors instantly via WebSocket
- **WhatsApp-style chat** — persistent messaging within the SoulLink session
- **Song history** — tracks every song played during the session
- **Session persistence** — survives page reloads via sessionStorage + auto-rejoin
- **Heartbeat system** — 5-second interval partner connection monitoring
- **End-of-session card** — beautiful recap with song history when session ends
- **SoulLink Mobile Bar** — floating bar showing current synced song + LIVE indicator on mobile

### 📱 Responsive Design

- **Desktop** — full sidebar + main content + now-playing panel + queue sidebar
- **Mobile** — bottom navigation, full-screen SoulLink panel, safe area support
- **Glass morphism UI** — frosted glass panels, gradient overlays, reactive blur effects
- **Premium animations** — Framer Motion powered fade/slide/scale transitions, vinyl spin, equalizer bars, shimmer skeletons, glow pulses
- **Adaptive player** — compact mobile player bar with expandable full-screen Now Playing view
- **Skeleton loaders** — shimmer-animated loading states matching UI structure

---

## 🤖 AI-Powered Features — How It Works

```
┌──────────────────┐                     ┌────────────────────┐                     ┌──────────────────┐
│   User Input     │────── REST API ─────│   Backend Server    │──── Groq Cloud ────│   LLaMA 3.3 70B  │
│  (mood / songs)  │                     │   Express + AI      │                     │   Versatile      │
└──────────────────┘                     └────────────────────┘                     └──────────────────┘
                                                  │
                                                  ▼
                                         ┌────────────────┐
                                         │ Search Enhancer │
                                         │ (NLP Pipeline)  │
                                         └────────────────┘
                                                  │
                                                  ▼
                                         ┌────────────────┐
                                         │  JioSaavn API  │
                                         │  (Song Search)  │
                                         └────────────────┘

Flow:
1. User enters mood ("chill late night") or pastes song names
2. Groq AI generates optimized search queries + creative playlist name
3. Search Enhancer parses each query through NLP pipeline:
   ├── Artist dictionary lookup (500+ entries across 8 languages)
   ├── Mood tokenization (50+ mood terms → normalized categories)
   ├── Language detection (Hindi, Tamil, Telugu, Malayalam, Kannada, etc.)
   ├── Intent classification (artist_search, mood_search, song_search, etc.)
   └── Multi-query expansion (generates multiple search permutations)
4. JioSaavn API searched with optimized queries, results scored by relevance
5. Matched songs returned with confidence levels (high / partial / none)
6. User reviews, deselects unwanted songs, saves as playlist to MongoDB
```

---

## 🎧 SoulLink — How It Works

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

| Technology                  | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| **TypeScript 5.7**          | Type-safe codebase with strict mode              |
| **React 18.3**              | UI framework with hooks & functional components  |
| **Vite 6.1**                | Lightning-fast dev server & build tool            |
| **Tailwind CSS 3.4**        | Utility-first styling with custom design tokens  |
| **Zustand 5**               | Lightweight state management (player, queue, UI, search, duo stores) |
| **Framer Motion 12**        | Smooth animations & transitions                  |
| **React Router 6**          | Client-side routing with protected routes        |
| **TanStack React Query 5**  | Server state management & caching                |
| **Socket.io Client 4.8**    | Real-time WebSocket communication                |
| **@react-oauth/google**     | Google One-Tap sign-in                           |
| **Axios**                   | HTTP client for API calls                        |
| **Lucide React**            | Beautiful, consistent icon set                   |
| **react-hot-toast**         | Toast notifications                              |
| **clsx + tailwind-merge**   | Conditional class merging                        |
| **date-fns**                | Date formatting utilities                        |
| **jwt-decode**              | Client-side JWT parsing                          |

### Backend

| Technology                   | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| **TypeScript 5.7**           | Type-safe server code                            |
| **Node.js + Express 4**      | REST API server                                  |
| **MongoDB + Mongoose 8.9**   | Document database for users, playlists, history  |
| **Socket.io 4.8**            | WebSocket server for real-time SoulLink sync     |
| **Groq SDK (LLaMA 3.3 70B)** | AI playlist generation & search optimization     |
| **google-auth-library**      | Server-side Google OAuth token verification      |
| **jsonwebtoken (JWT)**        | Session token signing & verification             |
| **Winston**                  | Structured JSON logging with colorized console   |
| **Zod**                      | Runtime schema validation                        |
| **Helmet**                   | Security headers                                 |
| **CORS**                     | Cross-origin request handling                    |
| **cookie-parser**            | Parse httpOnly auth cookies                      |
| **nanoid**                   | Unique room code generation                      |
| **Upstash Redis** (optional) | Caching layer with in-memory fallback            |
| **tsx**                      | TypeScript execution for development             |

### External APIs

| Service          | Purpose                                               |
| ---------------- | ----------------------------------------------------- |
| **JioSaavn API** | Song search, details, streaming URLs, recommendations |
| **Google OAuth** | User authentication                                   |
| **Groq Cloud**   | LLM inference for AI features                         |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  CLIENT                                        │
│                                                                                │
│  ┌──────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌───────────┐  │
│  │  Auth     │   │  Zustand  │   │  React    │   │  IndexDB  │   │  Socket   │  │
│  │  Context  │   │  Stores   │   │  Router   │   │  Offline  │   │  Client   │  │
│  └────┬─────┘   └────┬─────┘   └─────┬─────┘   └────┬─────┘   └─────┬─────┘  │
│       │              │               │               │               │         │
│       ▼              ▼               ▼               ▼               ▼         │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           AppLayout                                     │    │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐  │    │
│  │  │ Sidebar │  │   Pages   │  │  Player  │  │   Queue   │  │  Duo    │  │    │
│  │  │  + Nav  │  │  (Outlet) │  │  Bar +   │  │  Panel    │  │  Panel  │  │    │
│  │  │         │  │           │  │  NowPlay │  │           │  │         │  │    │
│  │  └─────────┘  └──────────┘  └──────────┘  └───────────┘  └─────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │
                          REST + WebSocket
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────────┐
│                                 SERVER                                          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        Express + Socket.io                              │    │
│  │                                                                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │    │
│  │  │  Auth    │  │  Search  │  │ Playlist │  │   User   │  │   AI    │  │    │
│  │  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes │  │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘  │    │
│  │       │              │             │              │              │       │    │
│  │       ▼              ▼             ▼              ▼              ▼       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │    │
│  │  │ Google   │  │ Search   │  │ MongoDB  │  │ History  │  │  Groq   │  │    │
│  │  │ OAuth    │  │ Enhancer │  │ Mongoose │  │  + Stats │  │  Multi  │  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │  Key    │  │    │
│  │                                                            │  Mgr    │  │    │
│  │  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐  └─────────┘  │    │
│  │  │  Dashboard   │    │   Session    │    │   Redis     │               │    │
│  │  │  Engine      │    │   + Socket   │    │   Cache     │               │    │
│  │  └──────────────┘    └──────────────┘    └─────────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data Models

| Model              | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| **User**            | Google ID, email, name, photo, preferences (languages/eras/moods), liked songs, total listening time |
| **Playlist**        | User's playlists with embedded songs, tags, AI-generated flag, auto-calculated song count & duration |
| **ListeningHistory** | Play log with song metadata, source tracking (search/recommendation/playlist/duo), 90-day TTL |
| **DuoSession**      | SoulLink room state — host/guest, current song, play state, messages   |

### State Management (Zustand Stores)

| Store           | Manages                                                 |
| --------------- | ------------------------------------------------------- |
| `playerStore`   | Current song, play/pause, time, volume, shuffle, repeat |
| `queueStore`    | Song queue, history, add/remove/reorder operations      |
| `searchStore`   | Search query, results, filters                          |
| `uiStore`       | UI toggles (queue panel, now playing view, context menu)|
| `duoStore`      | SoulLink session state with sessionStorage persistence  |

---

## 📁 Project Structure

```
SoulSync/
├── package.json                    # Monorepo root — workspace scripts
├── vercel.json                     # Vercel config (frontend deploy)
├── render.yaml                     # Render config (backend deploy)
│
├── frontend/                       # 🎨 React + TypeScript SPA
│   ├── package.json                # Frontend dependencies & scripts
│   ├── index.html                  # Entry HTML
│   ├── vite.config.ts              # Vite — dev server, proxy, aliases
│   ├── tailwind.config.ts          # Tailwind — custom colors, animations, fonts
│   ├── tsconfig.json               # TypeScript configuration
│   ├── .env.example                # Environment variable template
│   │
│   └── src/
│       ├── main.tsx                # React entry — providers (Google OAuth, Router, QueryClient)
│       ├── App.tsx                 # Route definitions (login, onboarding, app shell)
│       ├── index.css               # Global styles + Tailwind directives
│       │
│       ├── auth/                   # 🔐 Authentication
│       │   ├── AuthContext.tsx      # React context — login, logout, user state
│       │   └── ProtectedRoute.tsx  # Route guard — redirects to /login if unauthenticated
│       │
│       ├── pages/                  # 📄 Page components
│       │   ├── LoginPage.tsx       # Google OAuth sign-in with animated UI
│       │   ├── OnboardingPage.tsx  # 4-step wizard (languages, eras, moods, name)
│       │   ├── HomePage.tsx        # Personalized dashboard with dynamic sections
│       │   ├── SearchPage.tsx      # Full-page search with NLP-enhanced results
│       │   ├── BrowsePage.tsx      # Genre/category grid + search
│       │   ├── LibraryPage.tsx     # User's playlists, liked songs, history tabs
│       │   ├── LikedPage.tsx       # Dedicated liked songs view
│       │   ├── PlaylistPage.tsx    # Single playlist detail + song management
│       │   ├── DownloadsPage.tsx   # Offline songs + local file import
│       │   ├── ArtistPage.tsx      # Artist detail + discography
│       │   ├── AlbumPage.tsx       # Album detail + tracklist
│       │   └── ProfilePage.tsx     # User profile, stats, preference editor
│       │
│       ├── components/
│       │   ├── cards/              # 🃏 Song/Album/Artist cards
│       │   │   ├── SongCard.tsx    # Album art card with play overlay
│       │   │   ├── SongRow.tsx     # List-style song item with context menu
│       │   │   ├── AlbumCard.tsx   # Album card with link
│       │   │   ├── ArtistCard.tsx  # Circular artist card
│       │   │   └── HSection.tsx    # Horizontal scroll section wrapper
│       │   │
│       │   ├── layout/             # 🏗️ App shell
│       │   │   ├── AppLayout.tsx   # Main layout — sidebar, player, audio engine (~700 LOC)
│       │   │   ├── Sidebar.tsx     # Desktop sidebar navigation
│       │   │   ├── MobileNav.tsx   # Bottom navigation for mobile
│       │   │   └── DuoMobileBar.tsx # Floating SoulLink status bar (mobile)
│       │   │
│       │   ├── player/             # 🎵 Music player
│       │   │   ├── PlayerBar.tsx   # Bottom player bar with controls & seekbar
│       │   │   ├── NowPlayingView.tsx # Full-screen now-playing with vinyl animation
│       │   │   └── QueuePanel.tsx  # Slide-out queue sidebar
│       │   │
│       │   └── ui/                 # 🧩 Shared UI components
│       │       ├── AIPlaylistModal.tsx # AI playlist generation modal
│       │       ├── ContextMenu.tsx # Right-click context menu (play, queue, like, download, etc.)
│       │       ├── ConfirmModal.tsx # Generic confirmation dialog
│       │       ├── EqBars.tsx      # Animated equalizer bars
│       │       ├── GreenButton.tsx # Reusable accent button
│       │       ├── Skeleton.tsx    # Shimmer loading skeleton
│       │       └── Toasts.tsx      # Toast notification system
│       │
│       ├── duo/                    # 🎧 SoulLink — Listen Together module
│       │   ├── socket.ts          # Socket.io client (connect/disconnect/getSocket)
│       │   ├── duoStore.ts        # Zustand store + sessionStorage persistence
│       │   ├── useDuo.ts          # Main hook — socket events, sync actions, auto-rejoin
│       │   ├── DuoButton.tsx      # SoulLink toggle button (sidebar/mobile-nav/auto)
│       │   ├── DuoModal.tsx       # Create/Join session modal
│       │   ├── DuoPanel.tsx       # Side panel — chat, song history, session info
│       │   ├── DuoEndCard.tsx     # End-of-session recap card
│       │   └── DuoHeartbeat.tsx   # Partner connection heartbeat
│       │
│       ├── store/                  # 🗃️ Zustand state stores
│       │   ├── playerStore.ts     # Player state (song, play, time, volume, shuffle, repeat)
│       │   ├── queueStore.ts      # Queue management (add, remove, reorder, shuffle)
│       │   ├── searchStore.ts     # Search query & results state
│       │   └── uiStore.ts        # UI toggles (panels, modals, context menu)
│       │
│       ├── api/                    # 🌐 API clients
│       │   ├── backend.ts         # Backend REST API (auth, playlists, user, AI, dashboard)
│       │   └── jiosaavn.ts        # JioSaavn API (search, song details, recommendations)
│       │
│       ├── hooks/                  # 🪝 Custom React hooks
│       │   └── index.ts           # useToasts, useLikedSongs (cloud-synced), useRecentlyPlayed
│       │
│       ├── types/                  # 📋 TypeScript type definitions
│       │   ├── song.ts            # Song, DownloadURL, Image types
│       │   ├── user.ts            # User, Preferences types
│       │   ├── playlist.ts        # Playlist, PlaylistSong types
│       │   └── duo.ts             # DuoSession, DuoMessage types
│       │
│       ├── utils/                  # 🔧 Utility functions
│       │   ├── colorExtractor.ts  # Album art dominant color extraction
│       │   ├── downloadSong.ts    # Song download helper (fetch + IndexedDB save)
│       │   ├── formatTime.ts      # Duration formatting (mm:ss, hh:mm:ss)
│       │   ├── getBestAudioUrl.ts # Quality-ranked audio URL selector
│       │   ├── offlineDB.ts       # IndexedDB wrapper (save, get, remove, storage size)
│       │   └── queryParser.ts     # Client-side query parser for quick search
│       │
│       ├── lib/                    # 📚 Shared constants & helpers
│       │   ├── constants.ts       # API URLs, fallback images, browse categories, genre lists
│       │   └── helpers.ts         # bestImg, bestUrl, getArtists, image error handler
│       │
│       └── context/                # ⚙️ React context
│           └── AppContext.tsx      # App-wide context (play handlers, navigation)
│
└── backend/                        # 🖥️ Express + TypeScript Server
    ├── package.json                # Backend dependencies & scripts
    ├── tsconfig.json               # TypeScript configuration
    ├── .env.example                # Environment variable template (with full setup guide)
    │
    └── src/
        ├── index.ts                # Express server + Socket.io init + MongoDB connect + keep-alive
        │
        ├── routes/                 # 🛣️ API route handlers
        │   ├── auth.ts            # POST /google (login), POST /logout, GET /me
        │   ├── search.ts          # GET /songs, /albums, /artists (enhanced NLP search)
        │   ├── playlist.ts        # Full CRUD + song add/remove/reorder
        │   ├── user.ts            # Profile, preferences, history, liked songs, stats
        │   ├── ai.ts              # POST /build-playlist (Groq AI integration)
        │   ├── session.ts         # SoulLink REST API (create, join, get, delete)
        │   └── dashboard.ts       # GET /dashboard (personalized), GET /guest (default)
        │
        ├── services/               # ⚙️ Business logic
        │   ├── dashboardEngine.ts  # Personalized dashboard builder (~670 LOC)
        │   ├── searchEnhancer.ts   # NLP search pipeline (~935 LOC)
        │   ├── groq.ts            # Groq AI key manager with round-robin + fallback
        │   ├── jiosaavn.ts        # JioSaavn API wrapper (search, song, album, artist, recommendations)
        │   ├── mongodb.ts         # MongoDB connection with Mongoose
        │   └── redis.ts           # Upstash Redis client with in-memory fallback
        │
        ├── models/                 # 📊 MongoDB/Mongoose schemas
        │   ├── User.ts            # User schema with embedded liked songs
        │   ├── Playlist.ts        # Playlist schema with pre-save hooks (auto song count/duration)
        │   ├── ListeningHistory.ts # Play log with TTL index (90-day auto-cleanup)
        │   └── DuoSession.ts      # SoulLink session schema
        │
        ├── middleware/             # 🛡️ Express middleware
        │   ├── auth.ts            # JWT verification from httpOnly cookie
        │   └── rateLimiter.ts     # Sliding-window rate limiter
        │
        └── socket/                 # 🔌 WebSocket handlers
            ├── index.ts           # Socket.io server initialization & event registration
            └── roomHandlers.ts    # SoulLink room events (join, sync, heartbeat, end, disconnect)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **MongoDB Atlas** account (free M0 cluster)
- **Google Cloud** project with OAuth 2.0 Client ID
- **Groq** API key (free at [console.groq.com](https://console.groq.com)) — optional, for AI features

### 1. Clone the Repository

```bash
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync
```

### 2. Install All Dependencies

```bash
npm run install:all
```

> This installs both `frontend/` and `backend/` dependencies.

### 3. Configure Environment Variables

**Frontend** — `frontend/.env`:

```env
VITE_BACKEND_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_JIOSAAVN_API=https://jiosaavn.rajputhemant.dev
VITE_DUO_BACKEND=http://localhost:4000
```

**Backend** — `backend/.env`:

```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/soulsync?retryWrites=true&w=majority

# Auth
JWT_SECRET=your-64-char-hex-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Groq AI (optional — up to 5 keys for rotation)
GROQ_KEY_1=gsk_xxxxx
GROQ_KEY_2=gsk_xxxxx

# Redis (optional — falls back to in-memory)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxx
```

> See `backend/.env.example` and `frontend/.env.example` for the full setup guide with detailed instructions.

### 4. Start the Backend

```bash
npm run dev:backend
```

### 5. Start the Frontend (new terminal)

```bash
npm run dev:frontend
```

### 6. Open the App

Visit **http://localhost:5173** — sign in with Google and you're live! 🎶

---

## 🌐 Deployment

### Frontend → Vercel

1. Push your repo to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Set environment variables:
   ```
   VITE_BACKEND_URL=https://your-backend.onrender.com
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   VITE_JIOSAAVN_API=https://jiosaavn.rajputhemant.dev
   VITE_DUO_BACKEND=https://your-backend.onrender.com
   ```
4. Deploy — Vite builds automatically via `vercel.json` config
5. Add your Vercel URL to Google OAuth authorized origins and redirect URIs

### Backend → Render

1. Create a **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm start`
4. Set environment variables (see `backend/.env.example` for the full list)
5. Deploy — includes keep-alive self-ping (every 13 min) to prevent Render free-tier sleep

> Pre-configured `render.yaml` is included for one-click Render deployments.

---

## 🎨 Design System

### Colors

| Token             | Value              | Usage                                              |
| ----------------- | ------------------ | -------------------------------------------------- |
| `sp-black`        | `#000000`          | True black backgrounds                             |
| `sp-dark`         | `#060606`          | App background                                     |
| `sp-card`         | `#141414`          | Card surfaces                                      |
| `sp-hover`        | `#1c1c1c`          | Hover states                                       |
| `sp-green`        | `#1db954`          | Primary accent, active states, SoulLink indicators  |
| `sp-green-light`  | `#1ed760`          | Hover accent                                       |
| `sp-muted`        | `#4a4a4a`          | Muted borders                                      |
| `sp-sub`          | `#a0a0a0`          | Subtitle / secondary text                          |
| `sp-glass`        | `rgba(255,255,255,0.04)` | Glassmorphism overlays                      |
| `sp-accent`       | `#6366f1`          | AI features, secondary accent                      |
| `sp-rose`         | `#f43f5e`          | Heart/like, destructive actions                    |
| `sp-amber`        | `#f59e0b`          | Warnings, highlights                               |

### Typography

- **Font Family:** Inter (Google Fonts) → system-ui → sans-serif
- **Responsive scaling** across all breakpoints

### Animations (Tailwind Custom)

| Animation       | Duration | Purpose                              |
| --------------- | -------- | ------------------------------------ |
| `eq1–eq5`       | 0.75s    | Animated equalizer bars (staggered)  |
| `shimmer`       | 1.6s     | Skeleton loading effect              |
| `fadeIn`        | 0.3s     | Subtle element entrance              |
| `fadeUp`        | 0.4s     | Content entrance with upward motion  |
| `slideInRight`  | 0.3s     | Panel slide-in                       |
| `scaleIn`       | 0.25s    | Modal/popover appearance             |
| `float`         | 3s       | Gentle floating effect               |
| `gradientShift` | 8s       | Background gradient movement         |
| `glowPulse`     | 3s       | Soft glow pulsing                    |
| `vinylSpin`     | 3s       | Vinyl record rotation                |
| `breathe`       | 4s       | Breathing scale effect               |

### Z-Index Hierarchy

| Layer          | Z-Index | Components                    |
| -------------- | ------- | ----------------------------- |
| Toast          | 60      | Notifications                 |
| Navigation     | 50      | Sidebar, mobile nav           |
| SoulLink Panel | 45      | Duo panel overlay             |
| Context Menu   | 44      | Right-click menu              |
| SoulLink Bar   | 41      | Mobile floating bar           |
| Player         | 40      | Bottom player bar             |

---

## ⚡ Performance Optimizations

- **NLP search enhancer** — client queries parsed through 500+ artist dictionary, mood tokens, and language detection for precise results
- **Multi-query expansion** — single user query generates multiple optimized search permutations
- **Relevance scoring** — search results scored and ranked by artist match, title match, language, year, and format
- **Redis caching** — dashboards (30 min), AI results (30 min), search results cached with TTL
- **In-memory fallback** — Redis cache gracefully falls back to in-memory Map when Upstash unavailable
- **Batched API calls** — AI playlist searches executed in batches of 5 concurrent requests
- **Debounced search** — 400ms delay prevents excessive API calls while typing
- **Lazy recommendations** — queue auto-fills only when thin (≤1 song)
- **Ref-based callbacks** — avoids stale closures in audio event handlers
- **Skeleton loaders** — shimmer-animated loading states matching UI structure
- **Image error fallback** — graceful SVG placeholder on broken artwork
- **Session caching** — listening history debounced and batched server-side
- **90-day TTL** — listening history auto-expires via MongoDB TTL index
- **Keep-alive ping** — 13-minute self-ping prevents Render free-tier sleep

---

## 🔒 Security

- **Google OAuth 2.0** — no password storage, server-verified ID tokens
- **httpOnly cookies** — JWT stored in secure, httpOnly, SameSite cookies (not localStorage)
- **Helmet** — secure HTTP headers (CORS resource policy, opener policy)
- **CORS** — exact origin validation, credentials support
- **Rate limiting** — sliding-window rate limiter on all routes (100 req/min global, 15 req/min for AI)
- **JWT verification** — middleware validates token signature and expiry on every protected route
- **Input validation** — Zod schemas + server-side checks on all REST endpoints
- **No client-side secrets** — all sensitive operations (OAuth, AI, DB) happen server-side
- **Cookie security** — `secure: true`, `sameSite: "none"` in production

---

## 📝 API Reference

### Auth Routes (`/api/auth`)

| Method | Endpoint  | Auth | Body          | Response              |
| ------ | --------- | ---- | ------------- | --------------------- |
| `POST` | `/google` | No   | `{ idToken }` | `{ user, isNewUser }` |
| `POST` | `/logout` | No   | —             | `{ success: true }`   |
| `GET`  | `/me`     | Yes  | —             | `{ user }`            |

### Search Routes (`/api/search`)

| Method | Endpoint   | Auth | Query Params      | Response                   |
| ------ | ---------- | ---- | ----------------- | -------------------------- |
| `GET`  | `/songs`   | No   | `q, limit`        | `{ results, parsed }`     |
| `GET`  | `/albums`  | No   | `q, limit`        | `{ results }`             |
| `GET`  | `/artists` | No   | `q, limit`        | `{ results }`             |

### Playlist Routes (`/api/playlists`)

| Method   | Endpoint            | Auth | Body / Params                        | Response          |
| -------- | ------------------- | ---- | ------------------------------------ | ----------------- |
| `GET`    | `/`                 | Yes  | —                                    | `{ playlists }`   |
| `POST`   | `/`                 | Yes  | `{ name, description, songs, tags }` | `{ playlist }`    |
| `GET`    | `/:id`              | Yes  | —                                    | `{ playlist }`    |
| `PATCH`  | `/:id`              | Yes  | `{ name, description, isPublic }`    | `{ playlist }`    |
| `DELETE` | `/:id`              | Yes  | —                                    | `{ success }`     |
| `POST`   | `/:id/songs`        | Yes  | `{ song }`                           | `{ playlist }`    |
| `DELETE` | `/:id/songs/:songId`| Yes  | —                                    | `{ playlist }`    |
| `PATCH`  | `/:id/reorder`      | Yes  | `{ songIds }`                        | `{ playlist }`    |

### User Routes (`/api/user`)

| Method   | Endpoint         | Auth | Body / Params                                              | Response                                     |
| -------- | ---------------- | ---- | ---------------------------------------------------------- | -------------------------------------------- |
| `GET`    | `/me`            | Yes  | —                                                          | `{ user }`                                   |
| `PATCH`  | `/preferences`   | Yes  | `{ name, languages, eras, moods }`                         | `{ user }`                                   |
| `POST`   | `/history`       | Yes  | `{ songId, title, artist, albumArt, duration, source }`    | `{ success }`                                |
| `GET`    | `/history`       | Yes  | `?limit=20&page=1`                                        | `{ history, total, page, limit }`            |
| `POST`   | `/liked`         | Yes  | `{ song }`                                                 | `{ success, likedCount }`                    |
| `DELETE` | `/liked/:songId` | Yes  | —                                                          | `{ success }`                                |
| `GET`    | `/liked`         | Yes  | —                                                          | `{ likedSongs }`                             |
| `GET`    | `/stats`         | Yes  | —                                                          | `{ totalSongsPlayed, totalListeningTime, likedSongsCount, topArtists, languageBreakdown }` |

### AI Routes (`/api/ai`)

| Method | Endpoint          | Auth | Rate Limit | Body                    | Response                                      |
| ------ | ----------------- | ---- | ---------- | ----------------------- | --------------------------------------------- |
| `POST` | `/build-playlist` | Yes  | 15/min     | `{ songs }` or `{ mood }` | `{ playlistName, matched, partial, unmatched, stats }` |

### Dashboard Routes (`/api/dashboard`)

| Method | Endpoint   | Auth | Response                                       |
| ------ | ---------- | ---- | ---------------------------------------------- |
| `GET`  | `/`        | Yes  | `{ greeting, subtitle, sections, generatedAt }` |
| `GET`  | `/guest`   | No   | `{ greeting, subtitle, sections, generatedAt }` |

### Session Routes (`/api/session`)

| Method   | Endpoint  | Body                  | Response           |
| -------- | --------- | --------------------- | ------------------ |
| `POST`   | `/create` | `{ hostName }`        | `{ code, room }`   |
| `POST`   | `/join`   | `{ code, guestName }` | `{ room }`         |
| `GET`    | `/:code`  | —                     | `{ room }`         |
| `DELETE` | `/:code`  | —                     | `{ ok: true }`     |

### Health Check

| Method | Endpoint  | Response                        |
| ------ | --------- | ------------------------------- |
| `GET`  | `/health` | `{ status: "ok", timestamp }`  |

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

- [ ] PWA support with offline caching + service worker
- [ ] Synced lyrics display
- [ ] SoulLink reactions & emoji bursts
- [ ] Audio visualizer
- [ ] Social sharing
- [ ] Multi-language UI
- [ ] Cross-device session continuity

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
  Built with ❤️ by <a href="https://github.com/itslokeshx"><strong>Loki</strong></a><br/>
  <em>Listen together. Feel together.</em>
</p>
