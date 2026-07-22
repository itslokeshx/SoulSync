<div align="center">

<h1>🎧 SoulSync</h1>

<p><em>Listen together. Feel together.</em></p>

<p>
  <a href="https://github.com/itslokeshx/SoulSync/stargazers"><img src="https://img.shields.io/github/stars/itslokeshx/SoulSync?style=for-the-badge&color=1DB954" alt="Stars"></a>
  <a href="https://github.com/itslokeshx/SoulSync/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License"></a>
  <a href="https://soul-sync-beta.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-Click%20Here-blue?style=for-the-badge" alt="Live Demo"></a>
</p>

<p><strong>Free, open-source music streaming — GPT OSS 120B AI playlists, real-time listening sessions, native apps.</strong><br>
No ads. No subscription. Ever.</p>

</div>

---

## ✨ What is SoulSync?

SoulSync is a **free, open-source music streaming platform** built for people who love music without the paywalls. It combines intelligent **GPT OSS 120B** AI-powered playlist generation, real-time shared listening sessions (**SoulLink**), offline downloads, live listening analytics (**SoulSync Wrapped**), and a polished cross-platform experience — all at zero cost.

> 🚀 **Already used by 180+ users** with 8,000+ songs streamed. This is a battle-tested product people actually use every day.

---

## 📥 Downloads & Live Web App

| Platform       | Link                                                           | Requirement     |
| -------------- | -------------------------------------------------------------- | --------------- |
| 🌐 **Web**     | [soul-sync-beta.vercel.app](https://soul-sync-beta.vercel.app) | No install      |
| 💻 **Windows** | `SoulSync_3.0.0.exe`                                           | Windows 10+     |
| 🐧 **Linux**   | `soulsync_3.0.0.deb`                                           | Debian / Ubuntu |
| 📱 **Android** | `SoulSync_v5.apk` / `SoulSync_5.0.apk`                         | Android 7.0+    |

---

## 🆚 Why SoulSync?

| Feature                | SoulSync       | Spotify Free | Spotify Premium |
| ---------------------- | -------------- | ------------ | --------------- |
| Ad-free                | ✅             | ❌           | ✅              |
| GPT OSS 120B AI        | ✅             | ❌           | ❌              |
| Listen Together + Chat | ✅ (SoulLink)  | ❌           | ❌              |
| Offline Downloads      | ✅             | ❌           | ✅              |
| Live Analytics Story   | ✅ (Wrapped)   | ❌ (Annual)  | ❌ (Annual)     |
| Open Source            | ✅ MIT         | ❌           | ❌              |
| **Price**              | **₹0 forever** | ₹0 w/ ads    | ₹119/month      |

---

## 🎯 Core Features

### 🤖 AI Playlist Generator — Powered by GPT OSS 120B
- **Natural Language Vibe Generator**: Describe any mood, scenario, or aesthetic (e.g. *"late night drive under rain"*), and **GPT OSS 120B** curates 15 matching tracks with a creative title and description.
- **Smart Song Matching**: Paste song titles from any source, and AI automatically resolves JioSaavn metadata and IDs.
- **Multi-Key Failover Rotation**: Up to 5 Groq API keys with automatic round-robin, rate-limit fallback, and 30-min Redis caching.
- **Universal Importer**: Import playlists seamlessly from Spotify, YouTube Music, Apple Music, or plain text files.

### 🔍 Intelligent 7-Factor Ranked Search
- **Originals First**: Covers, karaokes, instrumentals, and tribute tracks are automatically demoted in search rankings.
- **7-Factor Ranking Engine**: Multi-signal scoring prioritizing play count, exact title/artist matching, user language preference, and popularity.
- **50 Results Per Query**: Extended search results grouped into songs, top artists, and full albums.
- **Redis Cache Layer**: Upstash Redis caching with 10-minute TTL delivering repeat search results in under 50ms.

### 🎧 SoulLink — Real-Time Shared Listening
- **Instant Synchronization**: Host controls (play/pause, seek, song transitions, queue updates) sync instantly across all joined guests.
- **6-Character Room Codes**: Join listening rooms in seconds without requiring an account.
- **In-Room Live Chat**: Integrated message chat for connected listeners.
- **Resilient Connection Handling**: Heartbeat monitoring and auto-cleanup for disconnected rooms.

### 📱 Native Android APK & Cross-Platform UI
- **Offline Direct Access**: Launches directly into downloaded songs without needing an active internet connection or login.
- **Lockscreen Media Controls**: Native Android media notification controls with play/pause/skip and track artwork via Capacitor.
- **Background Audio Engine**: Keeps audio playing uninterrupted when the app is minimized.
- **Gesture-Driven MiniPlayer**: Smooth swipe-down drawer transitions between full-screen view (`NowPlayingView`) and mini bar player.
- **Dynamic Release Resolution**: Download links dynamically resolve release binaries from GitHub API endpoints.

### 📊 SoulSync Wrapped — Live Analytics Story
- **Responsive Viewport Deck**: A full-screen visual modal deck scaled across mobile, tablet, and desktop screens.
- **Real-Time Listener Metrics**: Live computation of account milestones, total minutes listened, total play count, and favorite tracks directly from MongoDB.
- **Interactive Top Tracks & Rotating Vinyl**: Visual showcase of top 5 tracks featuring an animated spinning vinyl record for top artists.
- **Concert Pass Infographic**: Generates a shareable ticket pass infographic with perforated edges and barcode accents.

### 🌙 Smart Sleep Timer
- **Preset Durations**: 5 min, 10 min, 15 min, 30 min, 45 min, and 1 hour.
- **End of Track Mode**: Automatically stops playback at the exact end of the current playing song.
- **Custom Minute Input**: Set exact custom minutes (1–240 minutes).
- **Touch-Friendly Sheet**: Mobile bottom-sheet layout with touch scrolling support.

### 💬 Feedback & Audit Tracking
- **In-App Feedback History**: Modal displaying submitted user feedback and staff responses.
- **Unread Reply Tracking**: Profile indicators for unread support replies with read status tracking.

---

## ⚡ Performance Metrics

| Metric                   | Previous | Current | Improvement |
| ------------------------ | -------- | ------- | ----------- |
| Search latency (cached)  | 1.2s     | 45ms    | **−96%**    |
| Dashboard load (cached)  | 2.1s     | 95ms    | **−95%**    |
| Results per query        | 20       | 50      | **+150%**   |
| Original song at rank #1 | Never    | Always  | ✅          |
| Cache hit rate           | 0%       | 78%     | —           |

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
│  │  │  NowPlayingView  ·  QueuePanel           │  │  │     │  │  │  NowPlayingView  ·  QueuePanel        │   │  │
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
                    │  │  /api/feedback             → Feedback & support       │      │
                    │  │                                                       │      │
                    │  └───────────────────────────────────────────────────────┘      │
                    │                                                                 │
                    │  ┌─────────────────────── SERVICES ─────────────────────┐      │
                    │  │                                                       │      │
                    │  │  jiosaavn.ts        → Music API wrapper              │      │
                    │  │  searchRanker.ts    → 7-factor ranking engine        │      │
                    │  │  searchEnhancer.ts  → Result enhancement             │      │
                    │  │  groq.ts            → GPT OSS 120B AI Integration    │      │
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
     │  Users           │              │  Search cache   │              │  GPT OSS 120B   │
     │  Playlists       │              │  Dashboard cache│              │  Multi-key rot. │
     │  ListeningHist.  │              │  AI cache       │              │  30-min cache   │
     │  DuoSessions     │              │  10-30 min TTL  │              │                 │
     │  Feedback        │              │                 │              │                 │
     └─────────────────┘              └─────────────────┘              └─────────────────┘
```

---

## 🛠️ Tech Stack

| Layer        | Technologies                                                                             |
| ------------ | ---------------------------------------------------------------------------------------- |
| **Frontend** | React 18.3 · TypeScript 5.7 · Vite 6.1 · Tailwind CSS 3.4 · Zustand 5 · Lucide Icons     |
| **Mobile**   | Capacitor 8.1 · Android API 24+ · Haptics · Lockscreen Media Controls                    |
| **Backend**  | Node.js 18+ · Express 4.21 · Socket.io 4.8 · TypeScript 5.7                              |
| **Database** | MongoDB 8.9 (Mongoose) · Upstash Redis Caching                                          |
| **AI Model** | **GPT OSS 120B** (via Groq Cloud SDK with 5-key Failover & Auto-Rotation)                |
| **Auth**     | Google OAuth 2.0 · JWT RS256 · httpOnly Secure Cookies                                   |
| **Hosting**  | Vercel (Frontend) · Render (Backend) · MongoDB Atlas (Database)                           |

---

## 📁 Project Structure

```
SoulSync/
│
├── package.json                          # Workspace root scripts
├── package-lock.json
├── render.yaml                           # Render backend config
├── vercel.json                           # Vercel deployment config
├── version.json                          # App version tracking
├── README.md                             # Project documentation
│
├── backend/
│   ├── package.json                      # Backend node packages
│   ├── tsconfig.json                     # Backend TypeScript config
│   ├── .env.example                      # Backend env template
│   │
│   └── src/
│       ├── index.ts                      # Express app entry point
│       │
│       ├── middleware/
│       │   ├── auth.ts                   # JWT verification
│       │   ├── rateLimiter.ts            # REST rate limiter
│       │   └── softAuth.ts               # Optional auth middleware
│       │
│       ├── models/
│       │   ├── DuoSession.ts             # Listening session schema
│       │   ├── Feedback.ts               # User feedback & admin replies
│       │   ├── ListeningHistory.ts       # 90-day user play history
│       │   ├── Playlist.ts               # Custom & AI playlist schema
│       │   ├── User.ts                   # User account schema
│       │   └── UserTasteProfile.ts       # Preference taste profile
│       │
│       ├── routes/
│       │   ├── ai.ts                     # GPT OSS 120B playlist & match routes
│       │   ├── auth.ts                   # Google OAuth authentication
│       │   ├── dashboard.ts              # Dashboard section aggregator
│       │   ├── feedback.ts               # User feedback API endpoints
│       │   ├── import.ts                 # External playlist importer
│       │   ├── playlist.ts               # Playlist CRUD API
│       │   ├── search.ts                 # 7-factor ranked search route
│       │   ├── session.ts                # SoulLink room management
│       │   └── user.ts                   # Profile, stats & Wrapped data
│       │
│       ├── services/
│       │   ├── dashboardEngine.ts        # Dynamic section engine
│       │   ├── groq.ts                   # Groq GPT OSS 120B key manager
│       │   ├── importDetector.ts         # Playlist URL detector
│       │   ├── intentParser.ts           # Natural language prompt parser
│       │   ├── jiosaavn.ts               # JioSaavn API provider
│       │   ├── mongodb.ts                # MongoDB connection
│       │   ├── redis.ts                  # Upstash Redis wrapper
│       │   ├── searchEnhancer.ts         # Search result enhancer
│       │   └── searchRanker.ts           # 7-factor ranking algorithm
│       │
│       └── socket/
│           ├── index.ts                  # Socket.io initialization
│           └── roomHandlers.ts           # Real-time room event handlers
│
└── frontend/
    ├── package.json                      # Frontend node packages
    ├── vite.config.ts                    # Vite build configuration
    ├── capacitor.config.ts               # Capacitor Android config
    ├── tailwind.config.ts                # Tailwind styling tokens
    │
    └── src/
        ├── main.tsx                      # React root mount
        ├── App.tsx                       # Router & layout entry
        │
        ├── api/
        │   ├── backend.ts                # REST client for backend
        │   └── jiosaavn.ts               # Direct JioSaavn API client
        │
        ├── capacitor/
        │   ├── filesystem.ts             # Native offline file storage
        │   ├── musicControls.ts          # Android lockscreen media controls
        │   └── notifications.ts          # Local notifications
        │
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.tsx         # Responsive application shell
        │   │   ├── MobileNav.tsx         # Bottom mobile navigation
        │   │   └── Sidebar.tsx           # Desktop navigation sidebar
        │   │
        │   ├── player/
        │   │   ├── NowPlayingView.tsx    # Full-screen player & sleep timer
        │   │   ├── PlayerBar.tsx         # Bottom persistent player bar
        │   │   └── QueuePanel.tsx        # Queue management side drawer
        │   │
        │   ├── profile/
        │   │   ├── FeedbackHistoryModal.tsx # User feedback history modal
        │   │   └── SoulSyncWrapped.tsx   # Live listening story deck
        │   │
        │   └── ui/
        │       ├── AIPlaylistModal.tsx   # AI playlist prompt modal
        │       └── SearchOverlay.tsx     # Full-screen search overlay
        │
        ├── hooks/
        │   ├── useApkDownloadUrl.ts      # Live release asset loader
        │   ├── useAuthGate.ts            # Auth protection hook
        │   └── useSearch.ts              # Debounced search hook
        │
        ├── store/
        │   ├── playerStore.ts            # Audio playback & sleep timer state
        │   ├── queueStore.ts             # Active playback queue state
        │   ├── searchStore.ts            # Search state & cached results
        │   └── uiStore.ts                # UI modals & navigation state
        │
        └── pages/
            ├── HomePage.tsx              # Personalized dashboard page
            ├── PlaylistPage.tsx          # Playlist view page
            ├── ProfilePage.tsx           # Profile, stats & feedback page
            ├── SearchPage.tsx            # Main search page
            └── SoulLinkPage.tsx          # Real-time duo room page
```

---

## ⚡ Quick Start & Development

### Prerequisites

| Requirement    | Version             | Notes            |
| -------------- | ------------------- | ---------------- |
| Node.js        | ≥ 18                | Required         |
| npm            | ≥ 9                 | Required         |
| MongoDB Atlas  | Free M0 Instance    | Required         |
| Google Cloud   | OAuth 2.0 Client ID | Required         |
| Groq API       | Free Key            | For AI Features  |

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

# 2. Install workspace dependencies
npm run install:all

# 3. Create environment files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# 4. Launch backend and frontend development servers
npm run dev:backend   # Terminal 1 (Runs Express on port 4000)
npm run dev:frontend  # Terminal 2 (Runs Vite on http://localhost:5173)
```

---

## 🤝 Contributing to SoulSync

We welcome contributions from developers of all skill levels! Whether you want to fix a bug, suggest a new feature, improve documentation, or polish the mobile UI, your contributions help make free music streaming better for everyone.

### 💖 How You Can Contribute

- 🐛 **Report Bugs**: Found something broken? Open a detailed issue with steps to reproduce.
- 💡 **Suggest Features**: Have an idea for a new feature? Share your thoughts in an issue.
- 🎨 **UI/UX Polish**: Improve mobile responsiveness, animations, or styling.
- 💻 **Code Contributions**: Submit Pull Requests for open issues or improvements.
- 📝 **Documentation**: Improve guides, setup instructions, or code comments.

### 🚀 Pull Request Workflow

1. **Fork the Repository**: Click the **Fork** button at the top right of this repository.
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/SoulSync.git
   cd SoulSync
   ```
3. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/my-awesome-feature
   ```
4. **Install Dependencies & Set Up `.env`**:
   ```bash
   npm run install:all
   ```
5. **Make your changes & test**:
   ```bash
   # Check backend TypeScript
   cd backend && npx tsc --noEmit

   # Check frontend TypeScript
   cd frontend && npx tsc --noEmit
   ```
6. **Commit with Conventional Commits**:
   ```bash
   git commit -m "feat: add awesome new feature"
   ```
7. **Push to your fork and submit a PR**:
   ```bash
   git push origin feat/my-awesome-feature
   ```

### 📋 Commit Message Style Guide

We follow standard conventional commits:

| Prefix     | Meaning                                        |
| ---------- | ---------------------------------------------- |
| `feat:`    | A new feature or capability                    |
| `fix:`     | A bug fix                                      |
| `docs:`    | Documentation changes                          |
| `style:`   | Code formatting, whitespace, no logic change   |
| `refactor:`| Code restructuring without changing behavior   |
| `perf:`    | Performance optimization                       |
| `chore:`   | Build scripts, dependency updates              |

---

## 🙏 Acknowledgments & Dependencies

| Project / Service                                                     | Description                       |
| --------------------------------------------------------------------- | --------------------------------- |
| [sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) | Music streaming API wrapper       |
| [Groq Cloud](https://groq.com)                                        | **GPT OSS 120B** LLM inference    |
| [Ionic Capacitor](https://capacitorjs.com)                            | Native Android bridge & plugins   |
| [Socket.io](https://socket.io)                                        | Real-time Duo listening rooms     |
| [Zustand](https://github.com/pmndrs/zustand)                          | Fast, lightweight state management|
| [Framer Motion](https://www.framer.com/motion/)                       | Modern UI animations              |

---

## 📄 License

SoulSync is distributed under the [MIT License](https://github.com/itslokeshx/SoulSync/blob/main/LICENSE).

---

<div align="center">

**Built with ❤️ by Loki**

*No ads. No paywalls. No limits. Simply pure music.*

*If SoulSync saved you ₹119/month — consider giving us a ⭐ star on GitHub!*

</div>
