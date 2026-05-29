<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=1DB954&height=120&section=header&animation=fadeIn" width="100%"/>

# ✦ SoulSync

### Listen together. Feel together.

**Free, open-source music streaming — AI playlists, real-time listening sessions, native apps.**
No ads. No subscription. Ever.

[![Live App](https://img.shields.io/badge/Web_App-Live-1DB954?style=for-the-badge&logoColor=white)](https://soul-sync-beta.vercel.app/)
[![Release](https://img.shields.io/github/v/release/itslokeshx/SoulSync?style=for-the-badge&color=1DB954)](https://github.com/itslokeshx/SoulSync/releases)
[![License](https://img.shields.io/badge/License-MIT-1DB954?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/itslokeshx/SoulSync?style=for-the-badge&color=1DB954)](https://github.com/itslokeshx/SoulSync/stargazers)

<br>

### ✦ Currently Used By!

![Users](https://img.shields.io/badge/120%2B_Users-joined-1DB954?style=for-the-badge&logoColor=white)
![Songs](https://img.shields.io/badge/5,000%2B_Songs-streamed-1DB954?style=for-the-badge&logoColor=white)
![Playlists](https://img.shields.io/badge/100%2B_Playlists-created_by_users-1DB954?style=for-the-badge&logoColor=white)

_Not a tutorial project — a product people have actually been using!_

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

### System Overview

```
┌─────────────────────────────────────────────────────┐     ┌──────────────────────────────────────────────────┐
│                    WEB BROWSER                       │     │                  ANDROID APK                      │
│                                                      │     │                                                  │
│  ┌────────────────────────────────────────────────┐  │     │  ┌────────────────────────────────────────────┐  │
│  │              AUTHENTICATION LAYER               │  │     │  │              AUTHENTICATION LAYER           │  │
│  │  Google OAuth 2.0 → JWT RS256 → httpOnly Cookie │  │     │  │  Google OAuth → JWT → Capacitor Preferences │  │
│  └────────────────────────┬───────────────────────┘  │     │  └──────────────────────┬─────────────────────┘  │
│                           │                          │     │                         │                        │
│  ┌────────────────────────▼───────────────────────┐  │     │  ┌──────────────────────▼─────────────────────┐  │
│  │              STATE MANAGEMENT                   │  │     │  │              STATE MANAGEMENT               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │     │  │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │ player   │ │  queue   │ │    search      │  │  │     │  │  │ player   │ │  queue   │ │   search   │  │  │
│  │  │ Store    │ │  Store   │ │    Store       │  │  │     │  │  │ Store    │ │  Store   │ │   Store    │  │  │
│  │  └──────────┘ └──────────┘ └────────────────┘  │  │     │  │  └──────────┘ └──────────┘ └────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │     │  │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │  duo     │ │ offline  │ │      ui        │  │  │     │  │  │  duo     │ │ offline  │ │     ui     │  │  │
│  │  │ Store    │ │  Store   │ │    Store       │  │  │     │  │  │ Store    │ │  Store   │ │   Store    │  │  │
│  │  └──────────┘ └──────────┘ └────────────────┘  │  │     │  │  └──────────┘ └──────────┘ └────────────┘  │  │
│  └────────────────────────┬───────────────────────┘  │     │  └──────────────────────┬─────────────────────┘  │
│                           │                          │     │                         │                        │
│  ┌────────────────────────▼───────────────────────┐  │     │  ┌──────────────────────▼─────────────────────┐  │
│  │              ROUTING & PAGES                   │  │     │  │              ROUTING & PAGES                │  │
│  │  HomePage · SearchPage · ArtistPage · AlbumPage│  │     │  │  HomePage · SearchPage · ArtistPage       │  │
│  │  PlaylistPage · LibraryPage · LikedPage        │  │     │  │  AlbumPage · PlaylistPage · LibraryPage   │  │
│  │  DownloadsPage · ProfilePage · LoginPage       │  │     │  │  LikedPage · DownloadsPage · ProfilePage  │  │
│  │  ImportPage · OnboardingPage · OfflinePage     │  │     │  │  ImportPage · OnboardingPage · OfflinePage│  │
│  │  SongSharePage · SoulLinkPage                  │  │     │  │  SongSharePage · SoulLinkPage             │  │
│  └────────────────────────┬───────────────────────┘  │     │  └──────────────────────┬─────────────────────┘  │
│                           │                          │     │                         │                        │
│  ┌────────────────────────▼───────────────────────┐  │     │  ┌──────────────────────▼─────────────────────┐  │
│  │              LAYOUT COMPONENTS                 │  │     │  │              MOBILE LAYOUT                  │  │
│  │  ┌──────────────────────────────────────────┐  │  │     │  │  ┌────────────────────────────────────┐   │  │
│  │  │  Sidebar  ·  Pages  ·  PlayerBar  · Duo │  │  │     │  │  │  BottomNav  ·  MiniPlayer  · DuoBar│   │  │
│  │  └──────────────────────────────────────────┘  │  │     │  │  └────────────────────────────────────┘   │  │
│  │  ┌──────────────────────────────────────────┐  │  │     │  │  ┌────────────────────────────────────┐   │  │
│  │  │  NowPlayingView  ·  QueuePanel           │  │  │     │  │  │  FullScreenPlayer  ·  QueuePanel   │   │  │
│  │  └──────────────────────────────────────────┘  │  │     │  │  └────────────────────────────────────┘   │  │
│  └────────────────────────┬───────────────────────┘  │     │  └──────────────────────┬─────────────────────┘  │
│                           │                          │     │                         │                        │
│  ┌────────────────────────▼───────────────────────┐  │     │  ┌──────────────────────▼─────────────────────┐  │
│  │              PROVIDERS                         │  │     │  │              CAPACITOR BRIDGE               │  │
│  │  NetworkProvider · PlayerProvider              │  │     │  │  Filesystem · Haptics · Lifecycle          │  │
│  │  IndexedDB (offline cache)                     │  │     │  │  MusicControls · Network · Notifications   │  │
│  └────────────────────────┬───────────────────────┘  │     │  └──────────────────────┬─────────────────────┘  │
│                           │                          │     │                         │                        │
└───────────────────────────┼──────────────────────────┘     └─────────────────────────┼────────────────────────┘
                            │         REST API  +  WebSocket  (Socket.io)              │
                            └────────────────────────┬─────────────────────────────────┘
                                                     │
                    ┌────────────────────────────────▼────────────────────────────────┐
                    │                        RENDER BACKEND                          │
                    │                     Express 4.21 + Socket.io                    │
                    │                                                                 │
                    │  ┌─────────────────────────────────────────────────────────┐   │
                    │  │                    MIDDLEWARE LAYER                      │   │
                    │  │  auth.ts  ·  softAuth.ts  ·  rateLimiter.ts  ·  Helmet  │   │
                    │  └─────────────────────────────────────────────────────────┘   │
                    │                                                                 │
                    │  ┌─────────────────────── ROUTES ───────────────────────┐      │
                    │  │                                                       │      │
                    │  │  /api/auth/google          → Google OAuth 2.0         │      │
                    │  │  /api/search?q=...         → 7-factor ranked search   │      │
                    │  │  /api/search/artist/:id    → Artist top songs         │      │
                    │  │  /api/search/album/:id     → Album tracklist          │      │
                    │  │  /api/dashboard            → Personalized sections    │      │
                    │  │  /api/dashboard/guest      → Guest sections           │      │
                    │  │  /api/playlist/*           → CRUD operations          │      │
                    │  │  /api/ai/generate          → Mood-based playlist      │      │
                    │  │  /api/ai/match             → Song list matching       │      │
                    │  │  /api/import/detect        → Platform detection       │      │
                    │  │  /api/share/song           → Generate share slug      │      │
                    │  │  /api/share/playlist       → Generate share slug      │      │
                    │  │  /api/share/s/:slug        → Retrieve share (public)  │      │
                    │  │  /api/share/p/:slug        → Retrieve share (public)  │      │
                    │  │  /api/session/create       → Create duo room          │      │
                    │  │  /api/session/join         → Join duo room            │      │
                    │  │  /api/user/*               → User profile & prefs     │      │
                    │  │                                                       │      │
                    │  └───────────────────────────────────────────────────────┘      │
                    │                                                                 │
                    │  ┌─────────────────────── SERVICES ─────────────────────┐      │
                    │  │                                                       │      │
                    │  │  jiosaavn.ts        → Music API wrapper              │      │
                    │  │  searchRanker.ts    → 7-factor ranking engine        │      │
                    │  │  searchEnhancer.ts  → Result enhancement             │      │
                    │  │  groq.ts            → LLaMA 3.3 70B AI              │      │
                    │  │  intentParser.ts    → NLP intent extraction         │      │
                    │  │  redis.ts           → Caching layer (Upstash)        │      │
                    │  │  mongodb.ts         → Database connection            │      │
                    │  │  dashboardEngine.ts → Section generation             │      │
                    │  │  importDetector.ts  → Platform detection             │      │
                    │  │                                                       │      │
                    │  │  ┌───────────────── IMPORTERS ──────────────────┐   │      │
                    │  │  │  spotify · youtube · apple · gaana · text    │   │      │
                    │  │  └──────────────────────────────────────────────┘   │      │
                    │  └─────────────────────────────────────────────────────┘      │
                    │                                                                 │
                    │  ┌─────────────────────── SOCKET.IO ────────────────────┐      │
                    │  │                                                       │      │
                    │  │  duo:join         → Join room with code              │      │
                    │  │  duo:sync-song-change  → Sync current song + queue   │      │
                    │  │  duo:sync-play    → Sync play/pause + timestamp      │      │
                    │  │  duo:sync-seek    → Sync seek position               │      │
                    │  │  duo:message      → In-session chat                  │      │
                    │  │  duo:end-session  → End session                      │      │
                    │  │  heartbeat (5s)   → Connection monitoring            │      │
                    │  │                                                       │      │
                    │  └───────────────────────────────────────────────────────┘      │
                    │                                                                 │
                    └────────────────────────────┬────────────────────────────────────┘
                                                 │
              ┌──────────────────────────────────┼──────────────────────────────────┐
              │                                  │                                  │
              ▼                                  ▼                                  ▼
     ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
     │  MongoDB Atlas   │              │  Upstash Redis  │              │     Groq AI     │
     │                  │              │                 │              │                 │
     │  Users           │              │  Search cache   │              │  LLaMA 3.3 70B  │
     │  Playlists       │              │  Dashboard cache│              │  Multi-key rot. │
     │  ListeningHist.  │              │  AI cache       │              │  30-min cache   │
     │  DuoSessions     │              │  10-30 min TTL  │              │                 │
     │  Shares          │              │                 │              │                 │
     └─────────────────┘              └─────────────────┘              └─────────────────┘
```

### Data Flow

```
User Action → Zustand Store → API Call → Express Route → Service Layer → External API
                                              │
                                              ├── MongoDB (persist)
                                              ├── Redis (cache)
                                              └── Socket.io (real-time sync)
```

---

## 📁 Project Structure

```
SoulSync/
│
├── package.json                          # Root workspace scripts
├── package-lock.json
├── render.yaml                           # Render deployment config
├── vercel.json                           # Vercel deployment config
├── version.json                          # Version tracking
├── README.md                             # Project documentation
│
├── backend/
│   ├── package.json                      # Backend dependencies
│   ├── package-lock.json
│   ├── tsconfig.json                     # TypeScript config
│   ├── .env.example                      # Environment template
│   ├── .env                              # Environment variables (gitignored)
│   │
│   └── src/
│       ├── index.ts                      # Express server entry point
│       │
│       ├── middleware/
│       │   ├── auth.ts                   # JWT authentication middleware
│       │   ├── rateLimiter.ts            # Rate limiting middleware
│       │   └── softAuth.ts               # Optional auth for public routes
│       │
│       ├── models/
│       │   ├── DuoSession.ts             # Real-time listening session model
│       │   ├── ListeningHistory.ts       # User listening history (90-day TTL)
│       │   ├── Playlist.ts               # Playlist model (AI + manual)
│       │   └── User.ts                   # User model with preferences
│       │
│       ├── routes/
│       │   ├── ai.ts                     # AI playlist generation endpoints
│       │   ├── auth.ts                   # Google OAuth authentication
│       │   ├── dashboard.ts              # Personalized dashboard data
│       │   ├── import.ts                 # Playlist import from other platforms
│       │   ├── playlist.ts               # Playlist CRUD operations
│       │   ├── search.ts                 # 7-factor ranked search
│       │   ├── session.ts                # SoulLink session management
│       │   └── user.ts                   # User profile & preferences
│       │
│       ├── services/
│       │   ├── dashboardEngine.ts        # Dashboard section generation
│       │   ├── groq.ts                   # Groq LLaMA 3.3 70B integration
│       │   ├── importDetector.ts         # Platform detection for imports
│       │   ├── intentParser.ts           # Natural language intent parsing
│       │   ├── jiosaavn.ts               # JioSaavn API wrapper
│       │   ├── mongodb.ts                # MongoDB connection & utilities
│       │   ├── redis.ts                  # Redis caching layer
│       │   ├── searchEnhancer.ts         # Search result enhancement
│       │   ├── searchRanker.ts           # 7-factor ranking algorithm
│       │   │
│       │   └── importers/
│       │       ├── types.ts              # Importer interface & types
│       │       ├── spotifyImporter.ts    # Spotify playlist importer
│       │       ├── youtubeMusicImporter.ts # YouTube Music importer
│       │       ├── appleMusicImporter.ts # Apple Music importer
│       │       ├── gaanaImporter.ts      # Gaana importer
│       │       └── textImporter.ts       # Plain text song list importer
│       │
│       └── socket/
│           ├── index.ts                  # Socket.io server setup
│           └── roomHandlers.ts           # Duo session room event handlers
│
├── frontend/
│   ├── package.json                      # Frontend dependencies
│   ├── package-lock.json
│   ├── tsconfig.json                     # TypeScript config
│   ├── tsconfig.node.json                # Node TypeScript config
│   ├── vite.config.ts                    # Vite build configuration
│   ├── vite-env.d.ts                     # Vite environment types
│   ├── tailwind.config.ts                # Tailwind CSS configuration
│   ├── postcss.config.js                 # PostCSS configuration
│   ├── vercel.json                       # Vercel SPA routing
│   ├── index.html                        # HTML entry point
│   ├── capacitor.config.ts               # Capacitor mobile config
│   ├── preview-offline.ts                # Offline preview script
│   ├── .env.example                      # Environment template
│   ├── .env.production                   # Production environment
│   ├── .env.electron                     # Electron environment
│   ├── .env                              # Environment variables (gitignored)
│   │
│   ├── src/
│   │   ├── main.tsx                      # React entry point
│   │   ├── App.tsx                       # Root component with routing
│   │   ├── index.css                     # Global styles
│   │   │
│   │   ├── api/
│   │   │   ├── backend.ts                # Backend API client
│   │   │   └── jiosaavn.ts               # JioSaavn API client
│   │   │
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx           # Authentication context provider
│   │   │   └── ProtectedRoute.tsx        # Route guard for auth
│   │   │
│   │   ├── capacitor/
│   │   │   ├── index.ts                  # Capacitor exports
│   │   │   ├── filesystem.ts             # File system operations
│   │   │   ├── haptics.ts                # Haptic feedback
│   │   │   ├── lifecycle.ts              # App lifecycle events
│   │   │   ├── musicControls.ts          # Lock screen media controls
│   │   │   ├── network.ts                # Network status monitoring
│   │   │   └── notifications.ts          # Push notifications
│   │   │
│   │   ├── components/
│   │   │   ├── cards/
│   │   │   │   ├── index.ts              # Card component exports
│   │   │   │   ├── AlbumCard.tsx         # Album display card
│   │   │   │   ├── ArtistCard.tsx        # Artist display card
│   │   │   │   ├── HSection.tsx          # Horizontal scroll section
│   │   │   │   ├── SongCard.tsx          # Song display card
│   │   │   │   └── SongRow.tsx           # Horizontal song row
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── index.ts              # Layout component exports
│   │   │   │   ├── AppLayout.tsx         # Desktop app layout
│   │   │   │   ├── DuoMobileBar.tsx      # Mobile duo session bar
│   │   │   │   ├── MobileNav.tsx         # Mobile bottom navigation
│   │   │   │   └── Sidebar.tsx           # Desktop sidebar navigation
│   │   │   │
│   │   │   ├── mobile/
│   │   │   │   ├── OfflineBanner.tsx     # Offline status banner
│   │   │   │   └── OfflineToggle.tsx     # Offline mode toggle
│   │   │   │
│   │   │   ├── player/
│   │   │   │   ├── index.ts              # Player component exports
│   │   │   │   ├── NowPlayingView.tsx    # Full-screen now playing
│   │   │   │   ├── PlayerBar.tsx         # Bottom player bar
│   │   │   │   └── QueuePanel.tsx        # Song queue panel
│   │   │   │
│   │   │   ├── ui/
│   │   │   │   ├── index.ts              # UI component exports
│   │   │   │   ├── AIPlaylistModal.tsx   # AI playlist generation modal
│   │   │   │   ├── AuthGateModal.tsx     # Authentication gate modal
│   │   │   │   ├── ConfirmModal.tsx      # Confirmation dialog
│   │   │   │   ├── ContextMenu.tsx       # Right-click context menu
│   │   │   │   ├── EqBars.tsx            # Equalizer animation bars
│   │   │   │   ├── GreenButton.tsx       # Primary action button
│   │   │   │   ├── SearchOverlay.tsx     # Full-screen search overlay
│   │   │   │   ├── SearchTrigger.tsx     # Search input trigger
│   │   │   │   ├── Skeleton.tsx          # Loading skeleton loader
│   │   │   │   └── Toasts.tsx            # Toast notification system
│   │   │   │
│   │   │   └── UpdatePopup.tsx           # App update notification
│   │   │
│   │   ├── context/
│   │   │   └── AppContext.tsx            # Global app context
│   │   │
│   │   ├── duo/
│   │   │   ├── index.ts                  # Duo module exports
│   │   │   ├── DuoButton.tsx             # Duo session action button
│   │   │   ├── DuoEndCard.tsx            # Session end recap card
│   │   │   ├── DuoHeartbeat.tsx          # Connection heartbeat monitor
│   │   │   ├── DuoModal.tsx              # Duo session modal
│   │   │   ├── DuoPanel.tsx              # Duo session panel
│   │   │   ├── duoStore.ts               # Duo session Zustand store
│   │   │   ├── socket.ts                 # Socket.io client setup
│   │   │   └── useDuo.ts                 # Duo session hook
│   │   │
│   │   ├── hooks/
│   │   │   ├── index.ts                  # Hook exports
│   │   │   ├── useAuthGate.ts            # Authentication gate hook
│   │   │   ├── useDashboard.ts           # Dashboard data fetching hook
│   │   │   ├── useNetwork.ts             # Network status hook
│   │   │   ├── useQueueAutoFill.ts       # Queue auto-fill hook
│   │   │   └── useSearch.ts              # Search debouncing hook
│   │   │
│   │   ├── lib/
│   │   │   ├── constants.ts              # App-wide constants
│   │   │   └── helpers.ts                # Utility helper functions
│   │   │
│   │   ├── pages/
│   │   │   ├── index.ts                  # Page component exports
│   │   │   ├── AlbumPage.tsx             # Album detail page
│   │   │   ├── ArtistPage.tsx            # Artist detail page
│   │   │   ├── DownloadsPage.tsx         # Downloaded songs manager
│   │   │   ├── HomePage.tsx              # Home dashboard
│   │   │   ├── ImportPage.tsx            # Playlist import page
│   │   │   ├── LibraryPage.tsx           # User library page
│   │   │   ├── LikedPage.tsx             # Liked songs page
│   │   │   ├── LoginPage.tsx             # Login/authentication page
│   │   │   ├── OfflinePage.tsx           # Offline mode page
│   │   │   ├── OnboardingPage.tsx        # First-time user onboarding
│   │   │   ├── PlaylistPage.tsx          # Playlist detail page
│   │   │   ├── ProfilePage.tsx           # User profile page
│   │   │   ├── SearchPage.tsx            # Search results page
│   │   │   ├── SongSharePage.tsx         # Shared song player page
│   │   │   └── SoulLinkPage.tsx          # Duo listening session page
│   │   │
│   │   ├── providers/
│   │   │   ├── NetworkProvider.tsx       # Network state provider
│   │   │   └── PlayerProvider.tsx        # Audio player provider
│   │   │
│   │   ├── store/
│   │   │   ├── downloadStore.ts          # Download management store
│   │   │   ├── offlineStore.ts           # Offline mode state store
│   │   │   ├── playerStore.ts            # Audio player state store
│   │   │   ├── queueStore.ts             # Song queue state store
│   │   │   ├── searchStore.ts            # Search state store
│   │   │   └── uiStore.ts                # UI state store
│   │   │
│   │   ├── types/
│   │   │   ├── duo.ts                    # Duo session TypeScript types
│   │   │   ├── playlist.ts               # Playlist TypeScript types
│   │   │   ├── song.ts                   # Song TypeScript types
│   │   │   └── user.ts                   # User TypeScript types
│   │   │
│   │   └── utils/
│   │       ├── colorExtractor.ts         # Album art color extraction
│   │       ├── downloadSong.ts           # Song download utility
│   │       ├── formatTime.ts             # Time formatting utility
│   │       ├── getBestAudioUrl.ts        # Best audio URL selector
│   │       ├── normalizeSong.ts          # Song data normalizer
│   │       ├── offlineDB.ts              # IndexedDB offline storage
│   │       ├── platform.ts               # Platform detection utility
│   │       ├── queryParser.ts            # Search query parser
│   │       ├── share.ts                  # Share link generator
│   │       └── updateChecker.ts          # App update checker
│   │
│   └── android/                          # Capacitor Android project
│       └── app/src/main/
│           ├── assets/
│           │   ├── capacitor.config.json # Capacitor config for Android
│           │   ├── capacitor.plugins.json # Capacitor plugins manifest
│           │   └── public/               # Built web assets
│           └── AndroidManifest.xml       # Android app manifest
│
└── release/                              # Built desktop app releases
    ├── win-unpacked/                     # Windows desktop build
    └── linux-unpacked/                   # Linux desktop build
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

_No ads. No paywalls. No limits. Simply pure music._

[![GitHub](https://img.shields.io/badge/GitHub-itslokeshx-181717?style=flat-square&logo=github)](https://github.com/itslokeshx)
[![Twitter](https://img.shields.io/badge/Twitter-@itslokeshx-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://twitter.com/itslokeshx)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://linkedin.com/in/itslokeshx)

_If SoulSync saved you ₹119/month — drop a ⭐_

<img src="https://capsule-render.vercel.app/api?type=waving&color=1DB954&height=80&section=footer" width="100%"/>

</div>
