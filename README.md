<div align="center">

<br />

# SoulSync

**Full-stack music streaming platform with AI playlist generation, real-time collaborative listening, offline support, and a native Android app.**

<br />

[![Live Demo](https://img.shields.io/badge/Live_Demo-soul--sync--beta.vercel.app-1DB954?style=flat-square)](https://soul-sync-beta.vercel.app/)
&nbsp;
[![Latest Release](https://img.shields.io/github/v/release/itslokeshx/SoulSync?style=flat-square&label=Release&color=1DB954)](https://github.com/itslokeshx/SoulSync/releases/latest)
&nbsp;
[![Download APK](https://img.shields.io/badge/Android_APK-Download-3DDC84?style=flat-square&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

<br />

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8.1-119EFF?style=flat-square&logo=capacitor&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-8.9-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Groq AI](https://img.shields.io/badge/Groq_AI-LLaMA_3.3_70B-FF6600?style=flat-square&logo=meta&logoColor=white)
![Android](https://img.shields.io/badge/Android-API_24+-3DDC84?style=flat-square&logo=android&logoColor=white)

<br />

[Features](#features) · [Android App](#android-app) · [AI Engine](#ai-engine) · [SoulLink](#soullink) · [Tech Stack](#tech-stack) · [Architecture](#architecture) · [Getting Started](#getting-started) · [Deployment](#deployment) · [API Reference](#api-reference)

<br />

</div>

---

## Overview

SoulSync is a full-stack music streaming application built with React, Express, MongoDB, and Socket.IO. It streams 50M+ songs from the JioSaavn catalog and extends beyond standard music apps with an AI playlist builder powered by Groq's LLaMA 3.3 70B, a real-time collaborative listening system called SoulLink, and a native Android app built with Capacitor 8.

Key characteristics:

- **No subscription required.** All features including offline downloads, AI playlists, and collaborative sessions are free.
- **Native Android.** Not a PWA — a proper Capacitor-wrapped app with foreground audio service, lock screen controls, and deep link authentication.
- **NLP-powered search.** A custom search enhancer with 500+ artist entries, mood tokenization, language detection, and multi-query expansion delivers precise results without relying on exact keyword matches.
- **Personalized by default.** The home dashboard is generated from your listening history, language preferences, and time of day — no cold start.

---

## Features

### Authentication & Onboarding

| Feature           | Description                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Google OAuth 2.0  | One-tap sign-in via `@react-oauth/google` on web; system browser redirect flow on native with `google-auth-library` server-side verification     |
| JWT Sessions      | `httpOnly` Secure cookies on web; Capacitor Preferences (encrypted key-value store) on native; 7-day expiry                                      |
| Deep Link Auth    | Native APK registers `soulsync://auth-callback?token=...` in `AndroidManifest.xml` — OAuth tokens returned via redirect, never exposed in the UI |
| Guided Onboarding | 4-step animated wizard collecting language preferences, era preferences, mood preferences, and a display name                                    |
| Protected Routes  | `ProtectedRoute` wrapper; unauthenticated users are redirected to login                                                                          |
| Offline Skip      | APK users can bypass login entirely and access the downloads page directly                                                                       |

### Music Playback

| Feature              | Description                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 50M+ Songs           | Full JioSaavn catalog: Hindi, English, Punjabi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Urdu, Bhojpuri, Rajasthani, Haryanvi, Assamese, Odia |
| HQ Audio             | Auto-selects 320 kbps → 160 kbps → 96 kbps based on availability                                                                                                    |
| Queue Management     | View, drag-to-reorder, add-next, add-last, shuffle; auto-fills from recommendations when ≤1 song remains                                                            |
| Playback Modes       | Shuffle, repeat-one, repeat-all, repeat-off                                                                                                                         |
| Now Playing          | Full-screen immersive view with dynamic gradients extracted from album art via canvas sampling, vinyl animation, and progress scrubbing                             |
| Context Menu         | Right-click / long-press: Play, Play Next, Add to Queue, Add to Playlist, Like, Download, Go to Artist, Go to Album                                                 |
| Keyboard Shortcuts   | `Space` play/pause · `←` `→` skip · `↑` `↓` volume · `M` mute · `Q` queue panel                                                                                     |
| Auto-Recommendations | Fetches 10 similar tracks and appends to queue when running low                                                                                                     |

### AI Playlist Builder

| Feature               | Description                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Mood-Based Generation | Natural language vibe description → LLaMA 3.3 70B generates 15 optimized search queries and a playlist name                    |
| Song List Mode        | Paste a list of song names → AI optimizes each query for best JioSaavn match accuracy                                          |
| Confidence Scoring    | Multi-pass relevance ranking: `high` (artist + title match), `partial` (title or artist), `none` — unmatched songs are flagged |
| Multi-Key Rotation    | Up to 5 Groq API keys with round-robin selection and per-key rate-limit tracking (30 req/min) with automatic failover          |
| Result Caching        | AI responses cached in Upstash Redis for 30 minutes; falls back to in-memory `Map` when Redis is unavailable                   |
| One-Click Save        | Review matches, deselect unwanted songs, save directly to your library as a named playlist with auto-generated tags            |

### Personalized Dashboard

Built dynamically from listening history, language preferences, and time of day. Server-side cache (30 min) with client-side `sessionStorage`.

| Section              | Description                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Quick Grid           | 6 recently played songs for instant replay                                                          |
| Continue Listening   | Last 10 unique songs as a horizontal scroll row                                                     |
| Artist Spotlight     | Most-played artist with their top songs                                                             |
| Language Sections    | Trending/top sections per preferred language — up to 16 languages                                   |
| Time-Based Context   | "Morning Fresh Hits" · "Afternoon Vibes" · "Evening Wind Down" · "Late Night Chill"                 |
| Because You Listened | Recommendations seeded from 3 most recent tracks                                                    |
| Trending Now         | Filtered by language preferences                                                                    |
| Mood Grid            | 6 mood cards (Happy, Heartbreak, Party, Chill, Workout, Rainy Day) — each triggers a curated search |
| New Releases         | Latest releases in preferred languages                                                              |

### Library & Playlists

| Feature           | Description                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Cloud Playlists   | Full CRUD — create, rename, edit, reorder, delete — stored in MongoDB, synced across devices         |
| AI Playlists      | Save from the AI builder modal with auto-generated names and tags                                    |
| Liked Songs       | Cloud-synced with localStorage fallback for offline resilience                                       |
| Listening History | Full play log with 90-day TTL auto-cleanup via MongoDB TTL index; powers dashboard and profile stats |
| Playlist Page     | Total duration display, drag-to-reorder, per-song removal, play-all                                  |

### Offline Downloads & Local Files

| Feature              | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| IndexedDB Storage    | Songs stored with separate blob + metadata stores via `offlineDB.ts`        |
| One-Click Download   | Download from context menu or player — progress displayed as a toast        |
| Local File Import    | File picker for MP3 / WAV / AAC / OGG / FLAC with duration auto-detection   |
| Offline Playback     | Plays from blob URLs — full queue with next/prev navigation                 |
| Lock Screen Controls | Offline songs appear in the system notification exactly like streamed songs |
| Storage Dashboard    | Total storage used, remove individual songs, custom playlist ordering       |

### Profile & Statistics

| Feature            | Description                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Stats Overview     | Total songs played, total listening time (formatted Xh Xm), liked songs count                                                    |
| Top Artists        | Top 5 artists from history with play counts, album art, and ranking                                                              |
| Language Breakdown | Distribution of listening by language with count badges                                                                          |
| Inline Editing     | Toggle edit mode → modify name, languages (16 options), moods (12 options) → save; automatically invalidates the dashboard cache |

### UI & Experience

| Feature          | Description                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Desktop Layout   | Collapsible sidebar + main content + player bar + slide-in queue panel + SoulLink panel                                    |
| Mobile Layout    | Bottom navigation, full-screen panels, `env(safe-area-inset-*)` support                                                    |
| Glassmorphism    | `backdrop-blur` panels, gradient overlays, semi-transparent borders                                                        |
| Animations       | Framer Motion: fade/slide/scale transitions, vinyl spin, equalizer bars, shimmer skeletons, breathing effects — all 60 fps |
| Skeleton Loaders | Shimmer placeholders matching exact UI structure for every page                                                            |
| Context Menu     | Position-aware, with playlist sub-options                                                                                  |
| Toast System     | `react-hot-toast` with per-type durations                                                                                  |

---

## Android App

SoulSync ships as a native Android APK, not a progressive web app. The React frontend runs inside an Android WebView managed by Capacitor, with nine native plugins bridging the JS layer to Android system APIs.

<div align="center">

[![Download APK](https://img.shields.io/badge/Download_SoulSync.apk-8.14_MB-3DDC84?style=flat-square&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

`Android 7.0+ (API 24)` · No Play Store required · Sideload directly

</div>

### Native Capabilities

| Capability              | Implementation                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lock Screen Controls    | `MediaSession` API + foreground `MediaPlaybackService` — play/pause/next/prev on the lock screen and notification shade with seekable progress bar |
| Background Audio        | Foreground service keeps music playing when the app is minimized or the screen locks                                                               |
| Notification Permission | `POST_NOTIFICATIONS` (Android 13+ API 33) requested on first launch before any music plays                                                         |
| Google OAuth            | System browser opens the consent screen → returns via `soulsync://auth-callback` deep link → token stored in Capacitor Preferences                 |
| Offline Mode            | Skip login and access downloaded songs directly without network                                                                                    |
| Back Button             | Navigates history; at root, minimizes the app rather than terminating it                                                                           |
| Status Bar              | Dark overlay matching the `#060606` background                                                                                                     |
| Splash Screen           | 2-second branded splash on launch                                                                                                                  |
| Local File Import       | Android file picker for audio files with auto-detected metadata                                                                                    |

### Capacitor Plugins

| Plugin                           | Version | Purpose                                                 |
| -------------------------------- | ------- | ------------------------------------------------------- |
| `@capacitor/app`                 | 8.0.1   | App lifecycle, back button, deep links via `appUrlOpen` |
| `@capacitor/browser`             | 8.0.1   | System browser for native Google OAuth                  |
| `@capacitor/filesystem`          | 8.1.2   | Read/write local audio files                            |
| `@capacitor/haptics`             | 8.0.1   | Tactile feedback                                        |
| `@capacitor/local-notifications` | 8.0.1   | Permission management                                   |
| `@capacitor/network`             | 8.0.1   | Online/offline detection                                |
| `@capacitor/preferences`         | 8.0.1   | Encrypted JWT storage                                   |
| `@capacitor/splash-screen`       | 8.0.1   | Branded launch screen                                   |
| `@capacitor/status-bar`          | 8.0.1   | Dark status bar theming                                 |

### Building from Source

```bash
# Prerequisites: Node.js ≥ 18, Java 17, Android SDK (API 36)

cd frontend

# One command — build → sync → assemble
npm run apk

# Equivalent steps:
npm run build                          # Vite production build (uses .env.production)
npx cap sync android                   # Copy dist/ into Android project, update plugins
cd android && ./gradlew assembleDebug  # Gradle compile → APK

# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

> `.env.production` must point to your deployed backend. The build bakes the URL at compile time — using the wrong env file is why OAuth would redirect to `localhost`.

---

## Comparison

| Feature                 |        SoulSync        | Spotify Free  | Spotify Premium |
| ----------------------- | :--------------------: | :-----------: | :-------------: |
| Ad-free listening       |           ✓            |       ✗       |        ✓        |
| AI Playlist Builder     |           ✓            |       ✗       |        ✗        |
| Collaborative Listening |     ✓ Free + chat      |       ✗       |    ✓ No chat    |
| Song Downloads          |         ✓ Free         |       ✗       |        ✓        |
| NLP Smart Search        |     ✓ Intent-aware     |       ✗       |        ✗        |
| Personalized Dashboard  |           ✓            |    Partial    |        ✓        |
| In-session Chat         |           ✓            |       ✗       |        ✗        |
| Offline Playback        |         ✓ Free         |       ✗       |        ✓        |
| Import Local Files      | ✓ MP3/WAV/FLAC/AAC/OGG |       ✗       |        ✗        |
| Lock Screen Controls    |        ✓ Native        |     Basic     |        ✓        |
| Android APK (direct)    |           ✓            |       ✗       |        ✗        |
| Open Source             |         ✓ MIT          |       ✗       |        ✗        |
| **Price**               |        **Free**        | Free with ads |   ₹119/month    |

---

## AI Engine

```
User Input                    Groq Cloud                     JioSaavn API
"chill tamil late night"  →   LLaMA 3.3 70B              →   Song Search
                              Multi-Key Manager              Match & Score
                                     ↓
                            Search Enhancer
                            ├── 500+ Artist Dictionary
                            ├── 50+ Mood Tokens
                            ├── Language Detection
                            ├── Intent Classification
                            └── Multi-Query Expansion
```

**Pipeline stages:**

1. **Groq LLM** — LLaMA 3.3 70B with structured JSON output generates search queries from natural language or a song list
2. **Search Enhancer** — NLP pipeline: 500+ artist dictionary (Hindi, Tamil, Telugu, Malayalam, Kannada, English, Korean), 50+ mood tokens, language detection, era recognition, multi-query expansion
3. **Relevance Scorer** — ranks by artist match, title match, language alignment, year proximity, and format confidence
4. **Multi-Key Manager** — round-robin across up to 5 Groq keys with per-key rate-limit tracking (30 req/min) and automatic failover
5. **Cache** — Redis-backed 30-minute TTL; graceful fallback to in-memory `Map`

---

## SoulLink

Real-time collaborative listening. Create a room, share the 6-character code, and everything — play, pause, seek, skip — mirrors instantly for both partners. Includes an in-session chat and an end-of-session recap card.

```
  Host                          Server                        Guest
   │                              │                              │
   ├── POST /session/create ──→   │                              │
   │ ←── { code: "X7K9P2" } ──   │                              │
   │                              │                              │
   ├── duo:join ──────────────→   │                              │
   │                              │  ←── POST /session/join ─── │
   │                              │  ──── room state ─────────→  │
   │                              │  ←── duo:join (guest) ────   │
   │                              │                              │
   │ ←── duo:partner-joined ───   │  ── duo:partner-joined ──→   │
   │                              │                              │
   ├── duo:sync-song-change ──→   │  ── song-change ──────────→  │
   ├── duo:sync-play ──────────→  │  ── play + timestamp ─────→  │
   │                              │                              │
   │ ←───── duo:message ──────    │  ←── duo:message ─────────   │
   │                              │                              │
   ├── duo:heartbeat ──────────→  │  (5s keepalive)              │
   ├── duo:end-session ────────→  │  ── end-card + history ──→   │
```

### Socket Architecture

SoulLink uses a **callback bridge pattern** that solves React 18 StrictMode and HMR socket lifecycle problems: listeners attach once inside `getSocket()` at socket creation time and forward all events through a module-level callback, surviving socket recreation and double-mounts.

```
socket.ts (module-level)                useDuo.ts (React hook)
┌──────────────────────┐               ┌─────────────────────────┐
│  _duoCallback (fn)   │ ←── register  │  registerDuoCallback()  │
│                      │               │                         │
│  getSocket() {       │               │  useEffect(() => {      │
│    socket.on(event)  │──── forward → │    handleEvent(event)   │
│    _duoCallback(ev)  │               │    switch(type) { ... } │
│  }                   │               │  })                     │
└──────────────────────┘               └─────────────────────────┘
```

### Socket Events

| Event                      | Direction       | Purpose                              |
| -------------------------- | --------------- | ------------------------------------ |
| `duo:join`                 | Client → Server | Join room with code, name, role      |
| `duo:session-state`        | Server → Client | Full room snapshot on join           |
| `duo:partner-joined`       | Server → Client | Notify host of partner connection    |
| `duo:partner-disconnected` | Server → Client | Partner went offline                 |
| `duo:partner-reconnected`  | Server → Client | Partner came back online             |
| `duo:request-state`        | Client → Server | Poll for current state (safety net)  |
| `duo:sync-song-change`     | Client ↔ Server | Sync current song, queue, index      |
| `duo:sync-play`            | Client ↔ Server | Sync play action + currentTime       |
| `duo:sync-pause`           | Client ↔ Server | Sync pause + currentTime             |
| `duo:sync-seek`            | Client ↔ Server | Sync seek position                   |
| `duo:message`              | Client ↔ Server | Chat messages                        |
| `duo:heartbeat`            | Client → Server | Alive check (5s interval)            |
| `duo:end-session`          | Client → Server | End session for both partners        |
| `duo:session-ended`        | Server → Client | Session terminated with song history |

---

## Tech Stack

**Frontend**

| Package          | Version | Role                      |
| ---------------- | ------- | ------------------------- |
| React            | 18.3    | UI framework              |
| TypeScript       | 5.7     | Type safety               |
| Vite             | 6.1     | Build tool and dev server |
| Tailwind CSS     | 3.4     | Utility-first styling     |
| Zustand          | 5       | Client state management   |
| Framer Motion    | 12      | Animations                |
| React Router     | 6       | Client-side routing       |
| TanStack Query   | 5       | Server state and caching  |
| Socket.io Client | 4.8     | WebSocket transport       |
| Capacitor        | 8.1     | Native Android bridge     |

**Backend**

| Package             | Version | Role                         |
| ------------------- | ------- | ---------------------------- |
| Express             | 4.21    | HTTP server                  |
| TypeScript          | 5.7     | Type safety                  |
| Mongoose            | 8.9     | MongoDB ODM                  |
| Socket.io           | 4.8     | WebSocket server             |
| Groq SDK            | latest  | LLaMA 3.3 70B inference      |
| google-auth-library | latest  | OAuth token verification     |
| jsonwebtoken        | latest  | JWT signing and verification |
| Zod                 | latest  | Request schema validation    |
| Helmet              | latest  | Security headers             |
| Winston             | latest  | Structured logging           |
| Upstash Redis       | latest  | Response caching             |

---

## Architecture

```
┌──────────────────── CLIENT (Web + Android APK) ─────────────────────┐
│                                                                      │
│  Capacitor Shell → Auth Context → Zustand Stores → React Router     │
│  Deep Links         Google OAuth   7 stores          13 pages        │
│                                                                      │
│  ┌─────────────────────── AppLayout ───────────────────────────┐    │
│  │  Sidebar    Pages     PlayerBar    QueuePanel    DuoPanel   │    │
│  │  MobileNav  (Outlet)  NowPlaying                Chat        │    │
│  │                       MediaSession                          │    │
│  │                       Lock Screen                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Socket.io Client ↔ Callback Bridge ↔ useDuo Hook                   │
│  IndexedDB (songs) · localStorage (prefs) · sessionStorage (dash)    │
└──────────────────────────────────────────────────────────────────────┘
                              │
                    REST API + WebSocket
                              │
┌─────────────────── SERVER (Express + Socket.io) ────────────────────┐
│                                                                      │
│  Routes: auth · search · playlist · user · ai · session · dashboard │
│                                                                      │
│  Services                                                            │
│  ├── dashboardEngine.ts   9-section personalized builder             │
│  ├── searchEnhancer.ts    500+ artist NLP pipeline                   │
│  ├── groq.ts              Multi-key AI manager                       │
│  ├── jiosaavn.ts          JioSaavn API wrapper with retry            │
│  ├── mongodb.ts           Connection + index setup                   │
│  └── redis.ts             Upstash Redis + in-memory fallback         │
│                                                                      │
│  Socket: roomHandlers.ts  All SoulLink room event handlers           │
│                                                                      │
│  External: JioSaavn API (50M+ songs) · MongoDB Atlas · Upstash       │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Models

| Model              | Key Fields                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `User`             | `googleId`, `email`, `name`, `photo`, `preferences` (languages/eras/moods), `likedSongs[]`, `totalListeningTime`          |
| `Playlist`         | `userId`, `name`, `description`, `songs[]`, `isPublic`, `isAIGenerated`, `tags[]`, computed `songCount` + `totalDuration` |
| `ListeningHistory` | `userId`, `songId`, `title`, `artist`, `albumArt`, `duration`, `source`, `language` — 90-day TTL index                    |
| `DuoSession`       | `host` {name, socketId, connected}, `guest` {…}, `roomCode`, `currentSong`, `playState`, `messages[]`, `songHistory[]`    |

### Zustand Stores

| Store           | Manages                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| `playerStore`   | Current song, play/pause state, time, volume, shuffle, repeat                       |
| `queueStore`    | Song queue, history stack, add/remove/reorder, auto-fill                            |
| `searchStore`   | Query, results, filters, parsed NLP intent                                          |
| `uiStore`       | Panel visibility, context menu, sidebar collapse state                              |
| `duoStore`      | SoulLink session, partner info, messages, end card — persisted via `sessionStorage` |
| `downloadStore` | Active download progress                                                            |
| `offlineStore`  | Offline song index for the downloads page                                           |

---

## Project Structure

<details>
<summary>Expand full tree</summary>

```
SoulSync/
├── package.json                    # Monorepo root
├── vercel.json                     # Vercel config
├── render.yaml                     # Render one-click deploy config
│
├── frontend/
│   ├── capacitor.config.ts         # appId, plugins, Android options
│   ├── vite.config.ts              # Dev server, API proxy, path aliases
│   ├── tailwind.config.ts          # Design tokens, custom animations
│   ├── .env                        # Dev: localhost:4000
│   ├── .env.production             # Prod: render.com backend URL
│   │
│   ├── android/                    # Capacitor-managed Android project
│   │   ├── app/src/main/
│   │   │   ├── AndroidManifest.xml        # Permissions, deep links, services
│   │   │   ├── java/.../MainActivity.java # Capacitor entry point
│   │   │   └── java/.../MediaPlaybackService.java
│   │   └── gradlew
│   │
│   └── src/
│       ├── main.tsx                # App providers, deep link listener, Capacitor init
│       ├── App.tsx                 # 13 route definitions
│       │
│       ├── auth/
│       │   ├── AuthContext.tsx     # Google OAuth state, login/logout
│       │   └── ProtectedRoute.tsx  # Redirect guard
│       │
│       ├── pages/                  # 13 page components
│       │   ├── LoginPage.tsx
│       │   ├── OnboardingPage.tsx
│       │   ├── HomePage.tsx        # Dashboard (9 section types)
│       │   ├── SearchPage.tsx
│       │   ├── BrowsePage.tsx
│       │   ├── LibraryPage.tsx
│       │   ├── PlaylistPage.tsx
│       │   ├── DownloadsPage.tsx
│       │   ├── LikedPage.tsx
│       │   ├── ArtistPage.tsx
│       │   ├── AlbumPage.tsx
│       │   ├── ProfilePage.tsx
│       │   └── OfflinePage.tsx
│       │
│       ├── components/
│       │   ├── cards/              # SongCard, SongRow, AlbumCard, ArtistCard
│       │   ├── layout/             # AppLayout, Sidebar, MobileNav
│       │   ├── player/             # PlayerBar, NowPlayingView, QueuePanel
│       │   └── ui/                 # AIPlaylistModal, ContextMenu, Skeleton, EqBars
│       │
│       ├── duo/                    # SoulLink module
│       │   ├── socket.ts           # Socket.IO singleton + callback bridge
│       │   ├── duoStore.ts         # Zustand store + sessionStorage persistence
│       │   ├── useDuo.ts           # Main hook — create/join/sync/end
│       │   ├── DuoModal.tsx
│       │   ├── DuoPanel.tsx
│       │   ├── DuoEndCard.tsx
│       │   └── DuoHeartbeat.tsx
│       │
│       ├── capacitor/              # Native bridge modules
│       │   ├── index.ts            # Init: splash, status bar, back button, notifications
│       │   ├── musicControls.ts    # MediaSession + native notification
│       │   ├── lifecycle.ts        # Background audio, app state
│       │   ├── filesystem.ts       # File read/write
│       │   ├── haptics.ts
│       │   ├── network.ts
│       │   └── notifications.ts
│       │
│       ├── store/                  # playerStore, queueStore, searchStore, uiStore, downloadStore, offlineStore
│       ├── api/                    # backend.ts, jiosaavn.ts
│       ├── hooks/                  # useLikedSongs, useRecentlyPlayed, useNetwork
│       ├── types/                  # Song, User, Playlist, Duo type definitions
│       ├── utils/                  # colorExtractor, downloadSong, offlineDB, platform, queryParser
│       └── lib/                    # constants, helpers
│
└── backend/
    └── src/
        ├── index.ts                # Server init + keep-alive ping
        ├── routes/
        │   ├── auth.ts             # Google OAuth (web + native redirect)
        │   ├── search.ts           # NLP-enhanced search
        │   ├── playlist.ts         # Full CRUD + reorder
        │   ├── user.ts             # Profile, history, liked, stats
        │   ├── ai.ts               # AI playlist builder
        │   ├── session.ts          # SoulLink session management
        │   └── dashboard.ts        # Personalized dashboard
        ├── services/
        │   ├── dashboardEngine.ts
        │   ├── searchEnhancer.ts
        │   ├── groq.ts
        │   ├── jiosaavn.ts
        │   ├── mongodb.ts
        │   └── redis.ts
        ├── models/
        │   ├── User.ts
        │   ├── Playlist.ts
        │   ├── ListeningHistory.ts
        │   └── DuoSession.ts
        ├── middleware/
        │   ├── auth.ts             # JWT verification (cookie + Bearer)
        │   └── rateLimiter.ts      # 100 req/min global, 15 req/min AI
        └── socket/
            ├── index.ts
            └── roomHandlers.ts
```

</details>

---

## Getting Started

### Prerequisites

| Tool                   | Version   | Required            |
| ---------------------- | --------- | ------------------- |
| Node.js                | ≥ 18      | Yes                 |
| npm                    | ≥ 9       | Yes                 |
| MongoDB Atlas          | Free M0   | Yes                 |
| Google Cloud OAuth 2.0 | —         | Yes                 |
| Groq API key           | Free tier | For AI playlists    |
| Java                   | 17        | For APK builds only |
| Android SDK            | API 36    | For APK builds only |

### Local Development

```bash
# Clone the repository
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

# Install all dependencies
npm run install:all

# Configure environment
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Fill in your credentials in both files

# Start the backend (port 4000)
npm run dev:backend

# Start the frontend in a second terminal (port 5173)
npm run dev:frontend
```

### Environment Variables

<details>
<summary><code>frontend/.env</code> — Development</summary>

```env
VITE_BACKEND_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_JIOSAAVN_API=https://jiosaavn.rajputhemant.dev
VITE_DUO_BACKEND=http://localhost:4000
```

</details>

<details>
<summary><code>frontend/.env.production</code> — Production / APK builds</summary>

```env
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_JIOSAAVN_API=https://jiosaavn.rajputhemant.dev
VITE_DUO_BACKEND=https://your-backend.onrender.com
```

</details>

<details>
<summary><code>backend/.env</code></summary>

```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/soulsync

# Auth
JWT_SECRET=your-64-char-hex-secret
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

# Groq — up to 5 keys for round-robin rotation
GROQ_KEY_1=gsk_xxxxx
GROQ_KEY_2=gsk_xxxxx
GROQ_KEY_3=gsk_xxxxx

# Upstash Redis — optional, in-memory fallback used if absent
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxx
```

</details>

---

## Deployment

### Frontend — Vercel

1. Import the repository on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add environment variables: `VITE_BACKEND_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_JIOSAAVN_API`, `VITE_DUO_BACKEND`
4. Deploy — `vercel.json` handles routing
5. Add the Vercel domain to your Google OAuth authorized origins

### Backend — Render

1. Create a **Web Service** on [render.com](https://render.com) and connect the repository
2. Set **Root Directory** to `backend`
3. **Build command:** `npm install --include=dev && npm run build`
4. **Start command:** `npm start`
5. Add all variables from `backend/.env.example`
6. The server includes a 13-minute self-ping to prevent cold starts on the free tier

### Android APK — GitHub Releases

1. Set `.env.production` with production backend URL
2. Run `cd frontend && npm run apk`
3. Upload the output APK to a [GitHub Release](https://github.com/itslokeshx/SoulSync/releases/new)
4. APKs are excluded from git via `.gitignore` — they belong as release assets only

> `render.yaml` is included for one-click Render deployment.

---

## Design System

### Color Tokens

| Token            | Value                    | Usage                              |
| ---------------- | ------------------------ | ---------------------------------- |
| `sp-dark`        | `#060606`                | App background, status bar, splash |
| `sp-card`        | `#141414`                | Card surfaces                      |
| `sp-hover`       | `#1c1c1c`                | Hover state                        |
| `sp-green`       | `#1db954`                | Primary accent, active states      |
| `sp-green-light` | `#1ed760`                | Hover accent                       |
| `sp-sub`         | `#a0a0a0`                | Secondary text                     |
| `sp-glass`       | `rgba(255,255,255,0.04)` | Glassmorphism surfaces             |
| `sp-accent`      | `#6366f1`                | AI features                        |
| `sp-rose`        | `#f43f5e`                | Like / destructive                 |
| `sp-amber`       | `#f59e0b`                | Warnings                           |

### Animations

| Name                | Duration        | Purpose             |
| ------------------- | --------------- | ------------------- |
| `eq1`–`eq5`         | 0.75s staggered | Equalizer bars      |
| `shimmer`           | 1.6s            | Skeleton loading    |
| `fadeIn` / `fadeUp` | 0.3–0.4s        | Element entrance    |
| `slideInRight`      | 0.3s            | Panel entrance      |
| `scaleIn`           | 0.25s           | Modal entrance      |
| `vinylSpin`         | 3s              | Now playing vinyl   |
| `gradientShift`     | 8s              | Background gradient |
| `breathe`           | 4s              | SoulLink heartbeat  |

### Z-Index Layers

| Level | Layer                  |
| ----- | ---------------------- |
| 70    | Session end card       |
| 60    | Toast notifications    |
| 50    | Sidebar / navigation   |
| 45    | SoulLink panel         |
| 44    | Context menu           |
| 40    | Player bar             |
| 30    | Now Playing fullscreen |

---

## Performance

| Technique           | Effect                                                               |
| ------------------- | -------------------------------------------------------------------- |
| Search Enhancer     | 500+ artist dictionary + intent classification reduces query retries |
| Redis Caching       | Dashboard and AI responses cached for 30 minutes; in-memory fallback |
| Batched AI Requests | 5 concurrent JioSaavn requests per AI search batch                   |
| Debounced Search    | 400ms input debounce prevents excessive API calls                    |
| Lazy Queue Fill     | Recommendations fetched only when ≤1 song remains in queue           |
| MongoDB TTL Index   | Listening history expires after 90 days automatically                |
| Vite Code Splitting | Capacitor plugins tree-shaken on web builds                          |
| Callback Bridge     | Socket listeners attach once — no reattachment on HMR or reconnect   |
| Keep-Alive Ping     | 13-minute server self-ping prevents Render free-tier cold starts     |

---

## Security

| Layer              | Approach                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| Authentication     | Google OAuth 2.0 — no passwords stored; tokens verified server-side              |
| Web Sessions       | `httpOnly` + `Secure` + `SameSite` cookies — inaccessible to JavaScript          |
| Native Sessions    | JWT in Capacitor Preferences (platform-encrypted key-value storage)              |
| HTTP Headers       | Helmet: CORP, COOP, X-Content-Type-Options, Referrer-Policy                      |
| CORS               | Exact origin allowlist with credentials; no wildcards                            |
| Rate Limiting      | 100 req/min global, 15 req/min on AI endpoints via `express-rate-limit`          |
| JWT Middleware     | Signature and expiry validated on every protected route                          |
| Input Validation   | Zod schemas on all request bodies                                                |
| Deep Link Security | OAuth tokens travel via `soulsync://` redirect — never rendered in the web layer |

---

## API Reference

<details>
<summary><code>POST /api/auth/google</code> — Web sign-in</summary>

**Body:** `{ idToken: string }`  
**Response:** `{ user, isNewUser, token }`

</details>

<details>
<summary><code>GET /api/auth/google/native</code> — Native OAuth redirect</summary>

Redirects to Google consent. On return, redirects to `soulsync://auth-callback?token=…`

</details>

<details>
<summary><code>GET /api/search/songs</code> — NLP song search</summary>

**Query:** `?q=string&limit=number`  
**Response:** `{ results: Song[], parsed: ParsedIntent }`

</details>

<details>
<summary><code>GET /api/dashboard</code> — Personalized dashboard</summary>

**Auth required.** Returns up to 9 dynamic sections based on listening history and preferences.  
**Response:** `{ greeting, subtitle, sections[], generatedAt }`

</details>

<details>
<summary><code>POST /api/ai/build-playlist</code> — AI playlist builder</summary>

**Auth required.** Rate limited to 15 req/min.  
**Body:** `{ mood: string }` or `{ songs: string[] }`  
**Response:** `{ playlistName, matched[], partial[], unmatched[], stats }`

</details>

<details>
<summary>Playlist routes — <code>/api/playlists</code></summary>

| Method   | Path                 | Body                                    | Description        |
| -------- | -------------------- | --------------------------------------- | ------------------ |
| `GET`    | `/`                  | —                                       | All user playlists |
| `POST`   | `/`                  | `{ name, description?, songs?, tags? }` | Create playlist    |
| `GET`    | `/:id`               | —                                       | Single playlist    |
| `PATCH`  | `/:id`               | `{ name?, description?, isPublic? }`    | Update metadata    |
| `DELETE` | `/:id`               | —                                       | Delete playlist    |
| `POST`   | `/:id/songs`         | `{ song }`                              | Add song           |
| `DELETE` | `/:id/songs/:songId` | —                                       | Remove song        |
| `PATCH`  | `/:id/reorder`       | `{ songIds }`                           | Reorder songs      |

</details>

<details>
<summary>User routes — <code>/api/user</code></summary>

| Method   | Path             | Description                         |
| -------- | ---------------- | ----------------------------------- |
| `GET`    | `/me`            | Current user                        |
| `PATCH`  | `/preferences`   | Update name, languages, eras, moods |
| `POST`   | `/history`       | Log a play event                    |
| `GET`    | `/history`       | Paginated history                   |
| `POST`   | `/liked`         | Like a song                         |
| `DELETE` | `/liked/:songId` | Unlike a song                       |
| `GET`    | `/liked`         | All liked songs                     |
| `GET`    | `/stats`         | Aggregated listening stats          |

</details>

<details>
<summary>Session routes — <code>/api/session</code></summary>

| Method   | Path      | Description            |
| -------- | --------- | ---------------------- |
| `POST`   | `/create` | Create a SoulLink room |
| `POST`   | `/join`   | Join by room code      |
| `GET`    | `/:code`  | Get room state         |
| `DELETE` | `/:code`  | Delete room            |

</details>

---

## Roadmap

| Status | Item                                             |
| ------ | ------------------------------------------------ |
| ✅     | AI playlist generation (mood + song list modes)  |
| ✅     | SoulLink real-time collaborative listening       |
| ✅     | Offline downloads + local file import            |
| ✅     | Native Android APK with foreground audio service |
| ✅     | Personalized dashboard (9 section types)         |
| ✅     | Editable profile with listening statistics       |
| ⬜     | Synced lyrics display                            |
| ⬜     | PWA with service worker                          |
| ⬜     | SoulLink emoji reactions                         |
| ⬜     | Audio visualizer                                 |
| ⬜     | Public profiles and social sharing               |
| ⬜     | iOS build (Capacitor supports it)                |
| ⬜     | Cross-device session handoff                     |

---

## Contributing

```bash
git clone https://github.com/itslokeshx/SoulSync.git
git checkout -b feature/your-feature
git commit -m "feat: description"
git push origin feature/your-feature
# Open a pull request
```

---

## License

[MIT](LICENSE) — open source, free to use.

---

<div align="center">

Built by [Loki](https://github.com/itslokeshx)

[![GitHub](https://img.shields.io/badge/GitHub-itslokeshx-181717?style=flat-square&logo=github)](https://github.com/itslokeshx)
&nbsp;
[![Download APK](https://img.shields.io/badge/Android_APK-Download-3DDC84?style=flat-square&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

</div>
