<div align="center">
<br/>

# 🎧 SoulSync

### Listen together. Feel together.

**AI-powered music streaming** · **Real-time SoulLink** · **Personalized dashboards** · **Offline downloads** · **Android APK**

<br/>

[![Live Demo](https://img.shields.io/badge/🔴_LIVE_DEMO-soul--sync--beta.vercel.app-1DB954?style=for-the-badge)](https://soul-sync-beta.vercel.app/)
&nbsp;&nbsp;
[![Download APK](https://img.shields.io/badge/📱_Download_APK-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

<br/>

<img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Vite-6.1-646CFF?style=flat-square&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
<img src="https://img.shields.io/badge/Capacitor-8.1-119EFF?style=flat-square&logo=capacitor&logoColor=white" />
<img src="https://img.shields.io/badge/MongoDB-8.9-47A248?style=flat-square&logo=mongodb&logoColor=white" />
<img src="https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white" />
<img src="https://img.shields.io/badge/Socket.io-4.8-010101?style=flat-square&logo=socketdotio&logoColor=white" />
<img src="https://img.shields.io/badge/Groq_AI-LLaMA_3.3_70B-FF6600?style=flat-square&logo=meta&logoColor=white" />
<img src="https://img.shields.io/badge/Android-API_24+-3DDC84?style=flat-square&logo=android&logoColor=white" />

<br/><br/>

[Features](#-features) · [Android App](#-android-app) · [vs Spotify](#-soulsync-vs-spotify) · [AI Engine](#-ai-engine) · [SoulLink](#-soullink--listen-together) · [Tech Stack](#-tech-stack) · [Architecture](#-architecture) · [Setup](#-getting-started) · [Deploy](#-deployment) · [API Docs](#-api-reference)

</div>

<br/>

---

<br/>

<div align="center">
<table>
<tr>
<td align="center" width="20%">
<img width="50" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f916.png" alt="AI" /><br/>
<strong>AI Playlists</strong><br/>
<sub>Describe a mood → get a<br/>curated playlist via LLaMA 3.3</sub>
</td>
<td align="center" width="20%">
<img width="50" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f3a7.png" alt="SoulLink" /><br/>
<strong>SoulLink</strong><br/>
<sub>Listen together in real-time<br/>with synced playback & chat</sub>
</td>
<td align="center" width="20%">
<img width="50" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/2728.png" alt="Smart" /><br/>
<strong>Smart Dashboard</strong><br/>
<sub>Personalized home built from<br/>your history & preferences</sub>
</td>
<td align="center" width="20%">
<img width="50" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f4e5.png" alt="Offline" /><br/>
<strong>Offline Mode</strong><br/>
<sub>Download songs & import<br/>local files for offline play</sub>
</td>
<td align="center" width="20%">
<img width="50" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/1f4f1.png" alt="Android" /><br/>
<strong>Android App</strong><br/>
<sub>Native APK with lock screen<br/>controls & background audio</sub>
</td>
</tr>
</table>
</div>

<br/>

---

## 📱 Android App

> **SoulSync runs as a native Android app** — not a PWA wrapper. Built with [Capacitor 8](https://capacitorjs.com/) for true native capabilities.

<div align="center">

[![Download APK](https://img.shields.io/badge/⬇️_Download_SoulSync.apk-8.2_MB-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

_Requires Android 7.0+ (API 24) · No Play Store needed — sideload directly_

</div>

<br/>

### 📋 Native Features

| Feature                        | Description                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **🔔 Lock Screen Controls**    | Play/pause/next/prev buttons on the lock screen and notification shade via Android `MediaSession` and a foreground `MediaPlaybackService` |
| **🎵 Background Audio**        | Music keeps playing when the app is minimized or screen is locked — foreground service prevents system kill                               |
| **📲 Notification Permission** | Prompts for `POST_NOTIFICATIONS` on first launch (Android 13+), like Spotify & YT Music                                                   |
| **🔐 Google OAuth (Native)**   | Opens Google consent in system browser → callback via `soulsync://` deep link → token stored in Capacitor Preferences                     |
| **📴 Offline Mode**            | Skip login entirely → plays downloaded/imported local songs without internet                                                              |
| **🔙 Smart Back Button**       | Back button navigates history; minimizes app (not kills) when at root                                                                     |
| **🎨 Status Bar**              | Dark-themed status bar matching the app's `#060606` background                                                                            |
| **💫 Splash Screen**           | 2-second branded splash screen on launch                                                                                                  |
| **🔊 Notification Seek Bar**   | Seekable progress bar in the media notification                                                                                           |
| **📂 Local File Import**       | Import MP3/WAV/AAC/OGG/FLAC from device storage with auto-metadata detection                                                              |

<details>
<summary><strong>🔧 Capacitor Plugins Used (9 plugins)</strong></summary>

<br/>

| Plugin                           | Version | Purpose                                               |
| -------------------------------- | ------- | ----------------------------------------------------- |
| `@capacitor/app`                 | 8.0.1   | App lifecycle, back button, deep links (`appUrlOpen`) |
| `@capacitor/browser`             | 8.0.1   | System browser for native Google OAuth                |
| `@capacitor/filesystem`          | 8.1.2   | Read/write local audio files                          |
| `@capacitor/haptics`             | 8.0.1   | Tactile feedback on button presses                    |
| `@capacitor/local-notifications` | 8.0.1   | Permission management + fallback notifications        |
| `@capacitor/network`             | 8.0.1   | Online/offline detection for network-aware UI         |
| `@capacitor/preferences`         | 8.0.1   | Secure key-value storage for JWT tokens               |
| `@capacitor/splash-screen`       | 8.0.1   | Branded launch splash                                 |
| `@capacitor/status-bar`          | 8.0.1   | Dark themed status bar                                |

</details>

<details>
<summary><strong>🏗️ Build the APK Yourself</strong></summary>

<br/>

```bash
# Prerequisites: Node.js ≥ 18, Java 17, Android SDK (API 36)

cd frontend

# One-command build (build → sync → assemble)
npm run apk

# Or step-by-step:
npm run build                          # Vite production build
npx cap sync android                   # Copy web assets → Android project
cd android && ./gradlew assembleDebug  # Gradle → APK

# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

> **Important:** The production build uses `.env.production` which points to the deployed backend. For local development, use `.env` with `localhost:4000`.

</details>

<br/>

---

## 🏆 SoulSync vs Spotify

> _Everything Spotify charges ₹119/month for — SoulSync gives you free. Plus features Spotify doesn't offer at any price._

<div align="center">

| Feature                    |       🟢 SoulSync       |  🔴 Spotify Free   |    🟡 Spotify Premium    |
| -------------------------- | :---------------------: | :----------------: | :----------------------: |
| **Ad-free listening**      |        ✅ Always        | ❌ Ads every song  |         ✅ Paid          |
| **AI Playlist Builder**    |   ✅ Free, unlimited    |  ❌ Not available  |     ❌ Not available     |
| **Listen Together (Duo)**  | ✅ Free + built-in chat |  ❌ Not available  |     ✅ Paid, no chat     |
| **Song Downloads**         | ✅ Free, stored locally |  ❌ Not available  |       ✅ Paid only       |
| **NLP Smart Search**       |     ✅ Intent-aware     |  ❌ Keyword only   |     ❌ Keyword only      |
| **Personalized Dashboard** |      ✅ From day 1      |     ❌ Generic     | ✅ Algorithmic black box |
| **In-session Chat**        |       ✅ Built-in       |  ❌ Not available  |     ❌ Not available     |
| **Offline Playback**       |         ✅ Free         |  ❌ Not available  |         ✅ Paid          |
| **Import Local Files**     | ✅ MP3/WAV/FLAC/AAC/OGG |       ❌ No        |          ❌ No           |
| **Lock Screen Controls**   | ✅ Native MediaSession  |      ❌ Basic      |          ✅ Yes          |
| **Android APK**            |   ✅ Direct download    | ❌ Play Store only |    ❌ Play Store only    |
| **Open Source**            |     ✅ MIT License      |  ❌ Closed source  |     ❌ Closed source     |
| **Monthly Price**          |     **₹0 forever**      |    ₹0 with ads     |      **₹119/month**      |

</div>

> 💬 **Bottom line** — SoulSync is what Spotify would look like if they actually cared about users more than revenue.

<br/>

---

## ✨ Features

<details open>
<summary><strong>🔐 Authentication & Onboarding</strong></summary>

<br/>

| Feature               | Description                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google OAuth 2.0**  | One-tap sign-in via `@react-oauth/google` (web) or system browser redirect flow (native APK) — verified server-side with `google-auth-library` |
| **JWT Sessions**      | httpOnly secure cookies (web) + Capacitor Preferences token storage (native) with 7-day expiry                                                 |
| **Deep Link Auth**    | Native APK uses `soulsync://auth-callback?token=...` scheme registered in `AndroidManifest.xml` for seamless OAuth redirect                    |
| **Guided Onboarding** | 4-step animated wizard — languages → eras → moods → profile name with animated transitions                                                     |
| **Protected Routes**  | `ProtectedRoute` wrapper redirects unauthenticated users to login                                                                              |
| **Offline Skip**      | Native APK users can skip login entirely and go straight to offline playback                                                                   |
| **Editable Profile**  | Google avatar, editable display name, inline language/mood preference editing with live save                                                   |

</details>

<details open>
<summary><strong>🎵 Core Music Experience</strong></summary>

<br/>

| Feature                  | Description                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **50M+ Songs**           | Full catalog streaming powered by JioSaavn API across Hindi, English, Punjabi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Urdu, Bhojpuri, Rajasthani, Haryanvi, Assamese, and Odia |
| **NLP Smart Search**     | Understands artists, moods, languages, eras, movies, and compound queries (e.g., _"sad anirudh songs 2024"_, _"chill lofi hindi"_)                                                                     |
| **Search Enhancer**      | 500+ artist dictionary covering Hindi, Tamil, Telugu, Malayalam, Kannada, English, and Korean + 50+ mood tokens + language detection + intent classification + multi-query expansion                   |
| **HQ Playback**          | Auto-selects 320kbps → 160kbps → 96kbps based on availability                                                                                                                                          |
| **Queue Management**     | View, reorder (drag & drop), add next/add last, shuffle, and auto-fill with smart recommendations when queue runs out                                                                                  |
| **Shuffle & Repeat**     | Shuffle mode, repeat-one (loops current), repeat-all (loops queue), repeat-off                                                                                                                         |
| **Now Playing View**     | Full-screen immersive view with dynamic gradient backgrounds extracted from album art, vinyl spin animation, lyrics placeholder, and song progress                                                     |
| **Context Menu**         | Right-click / long-press: Play, Play Next, Add to Queue, Add to Playlist, Like, Download, Go to Artist, Go to Album                                                                                    |
| **Keyboard Shortcuts**   | `Space` (play/pause), `←` `→` (prev/next), `↑` `↓` (volume), `M` (mute), `Q` (queue panel)                                                                                                             |
| **Dynamic Backgrounds**  | Album art color extraction via canvas sampling for immersive gradient overlays throughout the UI                                                                                                       |
| **Auto-Recommendations** | When the queue has ≤1 song remaining, automatically fetches 10 similar tracks and appends them                                                                                                         |

</details>

<details>
<summary><strong>🤖 AI-Powered Playlists</strong></summary>

<br/>

| Feature                   | Description                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mood-Based Generation** | Describe a vibe in natural language → Groq AI (LLaMA 3.3 70B) generates 15 optimized search queries with a creative playlist name                       |
| **Song List Mode**        | Paste a list of song names → AI optimizes each query for best JioSaavn matches                                                                          |
| **Smart Matching**        | Multi-pass confidence scoring: _high_ (artist + title match), _partial_ (title or artist match), _none_ (no match found) — with relevance-based ranking |
| **Multi-Key Rotation**    | Up to 5 Groq API keys with round-robin selection, per-key rate-limit tracking (30 req/min), and automatic fallback to next available key                |
| **Result Caching**        | AI responses cached in Upstash Redis for 30 minutes to save API calls; falls back to in-memory cache if Redis is unavailable                            |
| **One-Click Save**        | Review AI matches → deselect unwanted songs → save directly to your library as a named playlist with auto-generated tags                                |

</details>

<details>
<summary><strong>🏠 Personalized Dashboard</strong></summary>

<br/>

Built dynamically from your **listening history**, **language preferences**, and **time of day**. Cached server-side for 30 minutes with sessionStorage on the client.

| Section                     | Description                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 🎵 **Quick Grid**           | 6 recently played songs for instant one-tap replay                                                            |
| 🔄 **Continue Listening**   | Last 10 unique songs as a horizontal scrollable row                                                           |
| 🎤 **Artist Spotlight**     | Your most-played artist with their top songs                                                                  |
| 🌍 **Language Sections**    | Personalized trending/top sections in each of your preferred languages (up to 16 languages)                   |
| ⏰ **Time-Based Mood**      | Context-aware: "Morning Fresh Hits", "Afternoon Vibes", "Evening Wind Down", "Late Night Chill"               |
| 💡 **Because You Listened** | Recommendations seeded from your 3 most recent tracks                                                         |
| 📈 **Trending Now**         | Trending songs filtered by your language preferences                                                          |
| 😊 **Mood Grid**            | 6 clickable mood cards — Happy, Heartbreak, Party, Chill, Workout, Rainy Day — each triggers a curated search |
| 🆕 **New Releases**         | Latest releases in your preferred languages                                                                   |

</details>

<details>
<summary><strong>📚 Library & Playlists</strong></summary>

<br/>

| Feature               | Description                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Cloud Playlists**   | Create, edit, rename, delete, reorder songs — stored in MongoDB, synced across all devices                            |
| **AI Playlists**      | Save directly from the AI playlist builder modal with auto-generated names and tags                                   |
| **Liked Songs**       | Cloud-synced hearts (MongoDB) with localStorage fallback for offline resilience                                       |
| **Recently Played**   | Persistent 20-song history with deduplication, stored in localStorage                                                 |
| **Listening History** | Full play log with 90-day TTL auto-cleanup via MongoDB TTL index — powers dashboard recommendations and profile stats |
| **Playlist Page**     | Song list view with total duration display, drag-to-reorder, song removal, and one-click play all                     |

</details>

<details>
<summary><strong>📥 Offline Downloads & Local Files</strong></summary>

<br/>

| Feature                  | Description                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| **IndexedDB Storage**    | Songs saved locally with separate blob + metadata stores (`offlineDB.ts`)                          |
| **One-Click Download**   | Download any song from context menu or player — shows progress toast                               |
| **Import Local Files**   | File picker for MP3/WAV/AAC/OGG/FLAC with auto-duration detection via `<audio>` element            |
| **Offline Playback**     | Play downloaded songs without internet via blob URLs — full queue support with next/prev           |
| **Storage Dashboard**    | View total storage used, remove individual songs, playlist-style reorder                           |
| **Lock Screen Controls** | Offline/local songs show in the notification with play/pause/next/prev — just like streaming songs |
| **Playlist Order**       | Custom ordering for your download library saved in localStorage                                    |

</details>

<details>
<summary><strong>👤 Profile & Stats</strong></summary>

<br/>

| Feature                   | Description                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Profile Page**          | Google avatar with fallback gradient, editable display name, email display                             |
| **Listening Stats**       | Total songs played, total listening time (formatted as Xh Xm), liked songs count                       |
| **Top Artists**           | Top 5 artists aggregated from history with play counts, album art, and ranking                         |
| **Language Breakdown**    | Listening distribution by language with count badges                                                   |
| **Inline Edit Mode**      | Toggle edit mode → modify name, languages (16 options), moods (12 options) → save with one tap         |
| **Dashboard Cache Clear** | Saving preferences automatically clears dashboard cache so the home page rebuilds with new preferences |

</details>

<details>
<summary><strong>🎧 SoulLink (Listen Together)</strong></summary>

<br/>

| Feature                          | Description                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| **Create Room**                  | One-click room creation → generates a 6-character alphanumeric code                        |
| **Join Room**                    | Enter code → instantly connected with real-time state sync                                 |
| **Synced Playback**              | Play, pause, seek, skip — everything mirrors instantly via Socket.IO WebSockets            |
| **Real-time Chat**               | Send messages within the listening session — displayed in the DuoPanel                     |
| **Heartbeat System**             | 5-second keepalive pings detect disconnections and show partner status                     |
| **Auto-Reconnect**               | Socket reconnects with exponential backoff (1s → 5s max) + automatic room rejoin           |
| **Session Persistence**          | Room state survives page reloads via sessionStorage                                        |
| **End Card**                     | Beautiful recap card when session ends — shows songs listened, time spent, partner name    |
| **Callback Bridge Architecture** | Module-level event forwarding pattern that survives HMR, StrictMode, and socket recreation |

</details>

<details>
<summary><strong>📱 Responsive & Premium UI</strong></summary>

<br/>

| Feature              | Description                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Desktop Layout**   | Collapsible sidebar + scrollable main content + player bar + slide-in queue panel + DuoPanel                     |
| **Mobile Layout**    | Bottom navigation, full-screen panels, safe area insets (`env(safe-area-inset-*)`)                               |
| **Glassmorphism**    | Frosted glass panels with `backdrop-blur`, gradient overlays, semi-transparent borders                           |
| **60fps Animations** | Framer Motion for fade/slide/scale transitions, vinyl spin, equalizer bars, shimmer skeletons, breathing effects |
| **Skeleton Loaders** | Shimmer-animated loading states precisely matching the final UI structure for every page                         |
| **Adaptive Player**  | Compact bottom bar → expandable full-screen Now Playing view with gesture support                                |
| **Context Menu**     | Position-aware right-click menu with sub-options for playlists                                                   |
| **Toast System**     | `react-hot-toast` with custom durations, types (success/error/info), and emoji icons                             |

</details>

<br/>

---

## 🤖 AI Engine

<div align="center">

```
   ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
   │   User Input     │          │   Groq Cloud     │          │   JioSaavn API   │
   │                  │          │                  │          │                  │
   │  "chill tamil    │──REST──▶│  LLaMA 3.3 70B   │          │  Song Search     │
   │   late night"    │          │  Multi-Key Mgr   │          │  Match & Score   │
   └──────────────────┘          └────────┬─────────┘          └────────▲─────────┘
                                          │                             │
                                          ▼                             │
                                 ┌──────────────────┐                   │
                                 │  Search Enhancer  │───────────────────┘
                                 │                  │
                                 │  ▸ 500+ Artists  │
                                 │  ▸ Mood Tokens   │
                                 │  ▸ Language NLP  │
                                 │  ▸ Intent Class. │
                                 │  ▸ Query Expand  │
                                 └──────────────────┘
```

</div>

The AI pipeline processes user input through multiple stages:

1. **Groq LLM** — generates optimized search queries from natural language descriptions or song lists using LLaMA 3.3 70B with structured JSON output
2. **Search Enhancer** — NLP pipeline with a 500+ artist dictionary (Hindi, Tamil, Telugu, Malayalam, Kannada, English, Korean), 50+ mood tokens, language detection, era recognition, and multi-query expansion
3. **Relevance Scorer** — multi-factor ranking by artist match, title match, language alignment, year proximity, and format confidence scoring
4. **Multi-Key Manager** — round-robin across up to 5 Groq API keys with per-key rate-limit tracking (30 req/min) and automatic failover
5. **Caching** — Redis-backed 30-minute TTL prevents duplicate AI/API calls; falls back to in-memory `Map` if Redis is unavailable

<br/>

---

## 🎧 SoulLink — Listen Together

<div align="center">

```
  Partner A (Host)                    Server                     Partner B (Guest)
       │                                │                              │
       ├── POST /session/create ───────▶│                              │
       │◀────── { code: "X7K9P2" } ────│                              │
       │                                │                              │
       │── duo:join (host) ────────────▶│                              │
       │                                │◀── POST /session/join ───────┤
       │                                │──── { room state } ─────────▶│
       │                                │◀── duo:join (guest) ─────────┤
       │                                │                              │
       │◀── duo:partner-joined ────────│── duo:partner-joined ────────▶│
       │                                │                              │
       ├── duo:sync-song-change ───────▶│──── song-change ────────────▶│
       │                                │                              │
       ├── duo:sync-play ──────────────▶│──── play + timestamp ───────▶│
       │                                │                              │
       │◀───── duo:message ────────────│◀── duo:message ──────────────┤
       │                                │                              │
       ├── duo:heartbeat ──────────────▶│    5s keepalive              │
       │                                │◀── duo:heartbeat ───────────┤
       │                                │                              │
       ├── duo:end-session ────────────▶│──── end-card + history ─────▶│
       ▼                                ▼                              ▼
```

</div>

> Create a room → share the 6-character code → play, pause, seek, skip — everything syncs instantly. Chat in real-time. Get a beautiful recap card when the session ends.

### Socket Architecture

SoulLink uses a **callback bridge pattern** to solve React 18 StrictMode + HMR socket lifecycle issues:

```
socket.ts (module-level)              useDuo.ts (React hook)
┌─────────────────────┐              ┌──────────────────────┐
│ _duoCallback (fn)   │◀─── set ────│ registerDuoCallback  │
│                     │              │                      │
│ getSocket() {       │              │ useEffect(() => {    │
│   socket.on(ev) ──▶ │── forward ──▶│   handleEvent(ev)    │
│   _duoCallback(ev)  │              │   switch(event)...   │
│ }                   │              │ })                   │
└─────────────────────┘              └──────────────────────┘
```

Event listeners are attached inside `getSocket()` at creation time and forward through a module-level callback — surviving socket recreation, HMR, and StrictMode double-mounts.

<details>
<summary><strong>Socket Events Reference</strong></summary>

<br/>

| Event                      | Direction       | Purpose                                      |
| -------------------------- | --------------- | -------------------------------------------- |
| `duo:join`                 | Client → Server | Join room with code, name, role (host/guest) |
| `duo:session-state`        | Server → Client | Full room snapshot on join / request         |
| `duo:partner-joined`       | Server → Client | Notify host that partner connected           |
| `duo:partner-disconnected` | Server → Client | Partner went offline                         |
| `duo:partner-reconnected`  | Server → Client | Partner came back online                     |
| `duo:partner-active`       | Server → Client | Heartbeat acknowledgment                     |
| `duo:request-state`        | Client → Server | Poll for current room state (safety net)     |
| `duo:sync-song-change`     | Client ↔ Server | Sync current song + queue + index            |
| `duo:sync-play`            | Client ↔ Server | Sync play action + currentTime + songId      |
| `duo:sync-pause`           | Client ↔ Server | Sync pause action + currentTime              |
| `duo:sync-seek`            | Client ↔ Server | Sync seek position                           |
| `duo:message`              | Client ↔ Server | Chat messages with sender info               |
| `duo:heartbeat`            | Client → Server | Alive check (5s interval)                    |
| `duo:end-session`          | Client → Server | End session for both partners                |
| `duo:session-ended`        | Server → Client | Session terminated with song history         |
| `duo:error`                | Server → Client | Error messages                               |

</details>

<br/>

---

## 🛠 Tech Stack

<div align="center">

<table>
<tr><th colspan="2">Frontend</th><th colspan="2">Backend</th><th colspan="2">Mobile</th></tr>
<tr>
<td>

|     | Technology           |
| --- | -------------------- |
| ⚡  | TypeScript 5.7       |
| ⚛️  | React 18.3           |
| 🔥  | Vite 6.1             |
| 🎨  | Tailwind CSS 3.4     |
| 🗃️  | Zustand 5            |
| 🎬  | Framer Motion 12     |
| 🧭  | React Router 6       |
| 🔄  | TanStack Query 5     |
| 🔌  | Socket.io Client 4.8 |
| 🔐  | Google OAuth         |
| 🎯  | Lucide React         |
| 🍞  | react-hot-toast      |

</td>
<td></td>
<td></td>
<td>

|     | Technology             |
| --- | ---------------------- |
| ⚡  | TypeScript 5.7         |
| 🚀  | Express 4.21           |
| 🍃  | MongoDB + Mongoose 8.9 |
| 🔌  | Socket.io 4.8          |
| 🧠  | Groq SDK (LLaMA 3.3)   |
| 🔐  | google-auth-library    |
| 🎫  | jsonwebtoken           |
| 📝  | Winston Logger         |
| ✅  | Zod Validation         |
| 🛡️  | Helmet + CORS          |
| 📦  | Upstash Redis          |
| 🆔  | nanoid                 |

</td>
<td></td>
<td>

|     | Technology              |
| --- | ----------------------- |
| 📱  | Capacitor 8.1           |
| 🤖  | Android SDK (API 24–36) |
| 🎵  | MediaSession API        |
| 🔔  | Foreground Service      |
| 🔗  | Deep Link (soulsync://) |
| 💾  | IndexedDB + Preferences |
| 📂  | Filesystem API          |
| 📶  | Network Plugin          |
| 📳  | Haptics Plugin          |
| 🖼️  | Splash Screen           |
| 🔒  | Status Bar              |
| 🌐  | Browser Plugin          |

</td>
</tr>
</table>

</div>

<br/>

---

## 🏗 Architecture

```
┌────────────────────────────────── CLIENT (Web + Android) ────────────────────────────┐
│                                                                                      │
│   Capacitor Shell (native) ──▶ Auth Context ──▶ Zustand Stores ──▶ React Router     │
│   Deep Links + Preferences     Google OAuth     5 stores             12 pages        │
│                                                                                      │
│   ┌───────────────────────── AppLayout ─────────────────────────────────────────┐    │
│   │                                                                             │    │
│   │   Sidebar     Pages (Outlet)    PlayerBar       QueuePanel    DuoPanel      │    │
│   │   + MobileNav                   + NowPlaying                  + Chat        │    │
│   │                                 + MediaSession                              │    │
│   │                                 + Lock Screen                               │    │
│   └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│   Socket.io Client ←→ Callback Bridge ←→ useDuo Hook                                │
│   IndexedDB (offline songs) · localStorage (prefs) · sessionStorage (dashboard)      │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                              REST API + WebSocket
                                       │
┌─────────────────────────────────── SERVER ──────────────────────────────────────────┐
│                                                                                     │
│   Express 4.21 + Socket.io 4.8                                                      │
│                                                                                     │
│   ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐  ┌───────────┐ │
│   │  Auth   │  │ Search  │  │ Playlist │  │  User   │  │   AI   │  │ Dashboard │ │
│   │ Routes  │  │ Routes  │  │  Routes  │  │ Routes  │  │ Routes │  │  Routes   │ │
│   └────┬────┘  └────┬────┘  └────┬─────┘  └────┬────┘  └───┬────┘  └─────┬─────┘ │
│        │            │            │              │            │             │        │
│        ▼            ▼            ▼              ▼            ▼             ▼        │
│   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌─────────┐ │
│   │ Google  │  │  Search  │  │ MongoDB  │  │ History  │  │  Groq  │  │Dashboard│ │
│   │ OAuth   │  │ Enhancer │  │ Mongoose │  │ + Stats  │  │ KeyMgr │  │ Engine  │ │
│   └─────────┘  └──────────┘  └──────────┘  └──────────┘  └────────┘  └─────────┘ │
│                                                                                     │
│   ┌────────────────┐    ┌────────────────┐    ┌──────────────────┐                  │
│   │  Session +     │    │  Redis Cache   │    │  JioSaavn API    │                  │
│   │  Socket.io     │    │  (+ fallback)  │    │  (External)      │                  │
│   │  roomHandlers  │    │  Upstash       │    │  50M+ songs      │                  │
│   └────────────────┘    └────────────────┘    └──────────────────┘                  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

<details>
<summary><strong>Data Models</strong></summary>

<br/>

| Model                | Key Fields                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **User**             | googleId, email, name, photo, preferences (languages/eras/moods), likedSongs[], totalListeningTime                          |
| **Playlist**         | userId, name, description, songs[], isPublic, isAIGenerated, tags[], auto-calculated songCount & totalDuration              |
| **ListeningHistory** | userId, songId, title, artist, albumArt, duration, source (search/recommendation/playlist/duo/player), language, 90-day TTL |
| **DuoSession**       | host{name,socketId,connected}, guest{name,socketId,connected}, roomCode, currentSong, playState, messages[], songHistory[]  |

</details>

<details>
<summary><strong>Zustand Stores</strong></summary>

<br/>

| Store           | Manages                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| `playerStore`   | Current song, play/pause, time, volume, shuffle, repeat                                |
| `queueStore`    | Song queue, history, add/remove/reorder, auto-fill                                     |
| `searchStore`   | Search query, results, filters, parsed intent                                          |
| `uiStore`       | UI toggles — queue panel, now playing, context menu, sidebar collapse                  |
| `duoStore`      | SoulLink session state, partner info, messages, end card — persisted to sessionStorage |
| `downloadStore` | Active download progress tracking                                                      |
| `offlineStore`  | Offline song index for the downloads page                                              |

</details>

<br/>

---

## 📁 Project Structure

<details>
<summary><strong>Click to expand full project tree</strong></summary>

<br/>

```
SoulSync/
├── package.json                    # Monorepo root — workspace scripts
├── vercel.json                     # Vercel deployment config
├── render.yaml                     # Render deployment config
│
├── frontend/                       # 🎨 React + TypeScript SPA + Android App
│   ├── package.json                #    Dependencies + build/cap/apk scripts
│   ├── vite.config.ts              #    Dev server, API proxy, path aliases
│   ├── tailwind.config.ts          #    Custom colors, animations, fonts
│   ├── capacitor.config.ts         #    Capacitor: appId, plugins, android options
│   ├── .env                        #    Dev environment (localhost:4000)
│   ├── .env.production             #    Prod environment (render.com backend)
│   ├── tsconfig.json
│   │
│   ├── android/                    # 🤖 Native Android project (Capacitor-managed)
│   │   ├── app/
│   │   │   ├── src/main/
│   │   │   │   ├── AndroidManifest.xml    # Permissions, deep links, services
│   │   │   │   ├── java/.../MainActivity  # Capacitor activity
│   │   │   │   └── java/.../MediaPlaybackService  # Foreground audio service
│   │   │   └── build.gradle
│   │   ├── variables.gradle        #    SDK versions (API 24–36)
│   │   └── gradlew                 #    Gradle wrapper
│   │
│   └── src/
│       ├── main.tsx                # Providers + deep link listener + Capacitor init
│       ├── App.tsx                 # Route definitions (13 routes)
│       ├── index.css               # Globals + Tailwind directives + custom animations
│       │
│       ├── auth/                   # 🔐 Auth context + route guard
│       │   ├── AuthContext.tsx      #    Google OAuth provider, login/logout, user state
│       │   └── ProtectedRoute.tsx   #    Redirect unauthenticated users
│       │
│       ├── pages/                  # 📄 13 page components
│       │   ├── LoginPage.tsx       #    Google OAuth (web) / system browser (native) + offline skip
│       │   ├── OnboardingPage.tsx  #    4-step preference wizard
│       │   ├── HomePage.tsx        #    Personalized dashboard (9 section types)
│       │   ├── SearchPage.tsx      #    NLP-enhanced search with tabs
│       │   ├── BrowsePage.tsx      #    Genre/language/mood grid
│       │   ├── LibraryPage.tsx     #    Playlists, liked, history tabs
│       │   ├── PlaylistPage.tsx    #    Playlist detail + drag-reorder + management
│       │   ├── DownloadsPage.tsx   #    Offline songs + local file import + reorder
│       │   ├── LikedPage.tsx       #    Liked songs grid
│       │   ├── ArtistPage.tsx      #    Artist detail + discography
│       │   ├── AlbumPage.tsx       #    Album detail + tracklist
│       │   ├── ProfilePage.tsx     #    Profile + stats + inline edit preferences
│       │   └── OfflinePage.tsx     #    Native-only offline landing
│       │
│       ├── components/
│       │   ├── cards/              #    SongCard, SongRow, AlbumCard, ArtistCard, HSection
│       │   ├── layout/             #    AppLayout (804 lines), Sidebar, MobileNav, DuoMobileBar
│       │   ├── player/             #    PlayerBar, NowPlayingView, QueuePanel
│       │   └── ui/                 #    AIPlaylistModal, ContextMenu, Skeleton, EqBars
│       │
│       ├── duo/                    # 🎧 SoulLink module
│       │   ├── socket.ts           #    Socket.IO singleton + callback bridge + reconnection
│       │   ├── duoStore.ts         #    Zustand store + sessionStorage persistence
│       │   ├── useDuo.ts           #    Main hook (600 lines) — create/join/sync/end
│       │   ├── DuoButton.tsx       #    Floating SoulLink button
│       │   ├── DuoModal.tsx        #    Create/join room modal
│       │   ├── DuoPanel.tsx        #    Side panel with chat + partner status
│       │   ├── DuoEndCard.tsx      #    Session recap overlay
│       │   └── DuoHeartbeat.tsx    #    Partner heartbeat indicator
│       │
│       ├── capacitor/              # 📱 Native platform modules
│       │   ├── index.ts            #    Init: splash, status bar, back button, notification permission
│       │   ├── musicControls.ts    #    MediaSession + native notification (239 lines)
│       │   ├── lifecycle.ts        #    Background audio, app state change handling
│       │   ├── filesystem.ts       #    Native file read/write
│       │   ├── haptics.ts          #    Vibration feedback
│       │   ├── network.ts          #    Online/offline detection
│       │   └── notifications.ts    #    Local notification helpers
│       │
│       ├── store/                  #    playerStore, queueStore, searchStore, uiStore, downloadStore, offlineStore
│       ├── api/                    #    backend.ts (REST + token mgmt), jiosaavn.ts (external API)
│       ├── hooks/                  #    useToasts, useLikedSongs, useRecentlyPlayed, useNetwork
│       ├── types/                  #    song, user, playlist, duo type definitions
│       ├── utils/                  #    colorExtractor, downloadSong, offlineDB, platform, queryParser
│       ├── lib/                    #    constants, helpers (bestImg, getArtists, fmt, etc.)
│       └── context/                #    AppContext (shared player/queue/like state)
│
└── backend/                        # 🖥️ Express + TypeScript Server
    ├── package.json                #    Dependencies + dev/build/start scripts
    ├── tsconfig.json
    │
    └── src/
        ├── index.ts                # Server init (Express + Socket.io + MongoDB + keep-alive)
        ├── routes/
        │   ├── auth.ts             #    Google OAuth (web POST + native redirect flow)
        │   ├── search.ts           #    NLP-enhanced search (songs, albums, artists)
        │   ├── playlist.ts         #    Full CRUD + song management + reorder
        │   ├── user.ts             #    Profile, history, liked songs, stats
        │   ├── ai.ts               #    AI playlist builder (mood + song list modes)
        │   ├── session.ts          #    SoulLink create/join/get/delete
        │   └── dashboard.ts        #    Personalized dashboard engine
        ├── services/
        │   ├── dashboardEngine.ts  #    9-section dynamic dashboard builder
        │   ├── searchEnhancer.ts   #    500+ artist NLP pipeline
        │   ├── groq.ts             #    Multi-key Groq AI manager
        │   ├── jiosaavn.ts         #    JioSaavn API wrapper with retry
        │   ├── mongodb.ts          #    MongoDB connection + index setup
        │   └── redis.ts            #    Upstash Redis + in-memory fallback
        ├── models/
        │   ├── User.ts             #    User schema (preferences, liked, stats)
        │   ├── Playlist.ts         #    Playlist schema (songs, tags, AI flag)
        │   ├── ListeningHistory.ts #    Play log with 90-day TTL
        │   └── DuoSession.ts       #    Room state (host, guest, messages, songs)
        ├── middleware/
        │   ├── auth.ts             #    JWT verification (cookie + Bearer token)
        │   └── rateLimiter.ts      #    100 req/min global, 15 req/min AI
        └── socket/
            ├── index.ts            #    Socket.io server init + auth middleware
            └── roomHandlers.ts     #    All duo room event handlers + state management
```

</details>

<br/>

---

## 🚀 Getting Started

### Prerequisites

| Requirement   | Version             | Notes                          |
| ------------- | ------------------- | ------------------------------ |
| Node.js       | ≥ 18                | Required                       |
| npm           | ≥ 9                 | Required                       |
| MongoDB Atlas | Free M0 cluster     | Required                       |
| Google Cloud  | OAuth 2.0 Client ID | Required                       |
| Groq API      | Free key            | Optional — for AI playlists    |
| Java          | 17                  | Optional — only for APK builds |
| Android SDK   | API 36              | Optional — only for APK builds |

### Quick Start

```bash
# 1. Clone
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

# 2. Install everything
npm run install:all

# 3. Configure environment
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Edit both .env files with your credentials

# 4. Start backend
npm run dev:backend

# 5. Start frontend (new terminal)
npm run dev:frontend

# 6. Open http://localhost:5173 🎶
```

<details>
<summary><strong>Environment Variables Reference</strong></summary>

<br/>

**`frontend/.env`** (development)

```env
VITE_BACKEND_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_JIOSAAVN_API=https://jiosaavn.rajputhemant.dev
VITE_DUO_BACKEND=http://localhost:4000
```

**`frontend/.env.production`** (APK + Vercel builds)

```env
VITE_BACKEND_URL=https://your-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_JIOSAAVN_API=https://jiosaavn.rajputhemant.dev
VITE_DUO_BACKEND=https://your-backend.onrender.com
```

**`backend/.env`**

```env
# Server
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/soulsync

# Auth
JWT_SECRET=your-64-char-hex-secret
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret           # For native OAuth redirect flow
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback

# Groq AI — up to 5 keys for rotation (optional)
GROQ_KEY_1=gsk_xxxxx
GROQ_KEY_2=gsk_xxxxx
GROQ_KEY_3=gsk_xxxxx

# Upstash Redis — optional, falls back to in-memory
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxx
```

> 📘 See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) for the complete guide with step-by-step setup instructions.

</details>

<br/>

---

## 🌐 Deployment

<table>
<tr>
<td width="33%">

### Frontend → Vercel

1. Push repo to GitHub
2. Import on [vercel.com](https://vercel.com)
3. Set **Root Directory:** `frontend`
4. Set env vars:
   - `VITE_BACKEND_URL`
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_JIOSAAVN_API`
   - `VITE_DUO_BACKEND`
5. Deploy — auto-builds via `vercel.json`
6. Add Vercel URL to Google OAuth origins

</td>
<td width="33%">

### Backend → Render

1. Create Web Service on [render.com](https://render.com)
2. Connect GitHub repo
3. Configure:
   - **Root Dir:** `backend`
   - **Build:** `npm install --include=dev && npm run build`
   - **Start:** `npm start`
4. Set all env vars from `.env.example`
5. Deploy — includes 13-min keep-alive self-ping

</td>
<td width="33%">

### Android → APK

1. Set `.env.production` with production URLs
2. Run `cd frontend && npm run apk`
3. APK output at `android/app/build/outputs/apk/debug/`
4. Or download the pre-built APK from the [**GitHub Releases page**](https://github.com/itslokeshx/SoulSync/releases/latest) — no build needed
5. Sideload to any Android 7.0+ device

</td>
</tr>
</table>

> 📦 Pre-configured `render.yaml` included for one-click Render deployments.

<br/>

---

## 🎨 Design System

<details>
<summary><strong>Color Palette</strong></summary>

<br/>

| Token            | Hex                      | Usage                                                      |
| ---------------- | ------------------------ | ---------------------------------------------------------- |
| `sp-black`       | `#000000`                | True black backgrounds                                     |
| `sp-dark`        | `#060606`                | App background, splash screen, status bar                  |
| `sp-card`        | `#141414`                | Card surfaces                                              |
| `sp-hover`       | `#1c1c1c`                | Hover states                                               |
| `sp-green`       | `#1db954`                | Primary accent, active states, SoulLink, notification icon |
| `sp-green-light` | `#1ed760`                | Hover accent                                               |
| `sp-sub`         | `#a0a0a0`                | Secondary / subtitle text                                  |
| `sp-glass`       | `rgba(255,255,255,0.04)` | Glassmorphism overlays                                     |
| `sp-accent`      | `#6366f1`                | AI features, secondary accent                              |
| `sp-rose`        | `#f43f5e`                | Heart/like, destructive actions                            |
| `sp-amber`       | `#f59e0b`                | Warnings, highlights                                       |

</details>

<details>
<summary><strong>Animations</strong></summary>

<br/>

| Animation           | Duration | Purpose                                   |
| ------------------- | -------- | ----------------------------------------- |
| `eq1–eq5`           | 0.75s    | Staggered equalizer bars (5 bars, 60fps)  |
| `shimmer`           | 1.6s     | Skeleton loading with gradient sweep      |
| `fadeIn` / `fadeUp` | 0.3–0.4s | Element entrance with opacity + translate |
| `slideInRight`      | 0.3s     | Panel slide-in (queue, duo)               |
| `scaleIn`           | 0.25s    | Modal appearance with spring              |
| `vinylSpin`         | 3s       | Now playing vinyl rotation (continuous)   |
| `gradientShift`     | 8s       | Background gradient animation             |
| `breathe`           | 4s       | Soft breathing scale (SoulLink heartbeat) |

</details>

<details>
<summary><strong>Z-Index Hierarchy</strong></summary>

<br/>

| Z-Index | Layer                  |
| ------- | ---------------------- |
| 70      | DuoEndCard overlay     |
| 60      | Toast notifications    |
| 50      | Navigation / sidebar   |
| 45      | SoulLink panel         |
| 44      | Context menu           |
| 41      | SoulLink mobile bar    |
| 40      | Player bar             |
| 30      | Now Playing fullscreen |

</details>

<br/>

---

## ⚡ Performance

| Optimization               | Impact                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| **NLP Search Enhancer**    | 500+ artist dict + mood tokens + multi-query expansion = precise results without multiple searches |
| **Redis Caching**          | Dashboard (30m), AI (30m) — with in-memory `Map` fallback if Redis unavailable                     |
| **Batched API Calls**      | AI searches execute 5 concurrent JioSaavn requests per batch                                       |
| **Debounced Search**       | 400ms delay prevents API spam while typing                                                         |
| **Lazy Recommendations**   | Queue auto-fills only when ≤1 song remains — no preloading wasted data                             |
| **Skeleton Loaders**       | Shimmer-animated placeholders matching exact UI structure for perceived instant load               |
| **90-Day TTL**             | Listening history auto-expires via MongoDB TTL index — database stays lean                         |
| **Keep-Alive Ping**        | 13-min self-ping prevents Render free-tier cold starts                                             |
| **Ref-Based Callbacks**    | `callbackRefs` pattern avoids stale closures in audio event handlers and socket listeners          |
| **Vite Code Splitting**    | Capacitor plugins lazy-imported only on native — web bundle stays lean                             |
| **Socket Callback Bridge** | Module-level event forwarding eliminates listener reattachment on HMR/reconnect                    |

<br/>

---

## 🔒 Security

| Layer                 | Implementation                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| **Authentication**    | Google OAuth 2.0 — no passwords stored, server-verified ID tokens                                         |
| **Sessions (Web)**    | httpOnly, Secure, SameSite cookies — not accessible via JavaScript                                        |
| **Sessions (Native)** | JWT stored in Capacitor Preferences (encrypted key-value store)                                           |
| **Headers**           | Helmet middleware: CORP, COOP, X-Content-Type, Referrer-Policy                                            |
| **CORS**              | Exact origin validation with credentials — no wildcards                                                   |
| **Rate Limiting**     | 100 req/min global, 15 req/min for AI endpoints via `express-rate-limit`                                  |
| **JWT**               | Middleware validates signature + expiry on every protected route                                          |
| **Validation**        | Zod schemas on all request bodies + server-side input sanitization                                        |
| **Secrets**           | All sensitive ops (OAuth, AI, DB, JWT signing) are server-side only                                       |
| **Deep Links**        | `soulsync://` scheme registered in AndroidManifest — tokens passed via secure redirect, not exposed in UI |

<br/>

---

## 📝 API Reference

<details>
<summary><strong><code>/api/auth</code> — Authentication</strong></summary>

<br/>

| Method | Endpoint           | Auth | Body          | Response                                        |
| ------ | ------------------ | ---- | ------------- | ----------------------------------------------- |
| `POST` | `/google`          | ✗    | `{ idToken }` | `{ user, isNewUser, token }`                    |
| `GET`  | `/google/native`   | ✗    | —             | Redirect → Google consent screen                |
| `GET`  | `/google/callback` | ✗    | `?code=...`   | Redirect → `soulsync://auth-callback?token=...` |
| `POST` | `/logout`          | ✗    | —             | `{ success }` (clears cookie)                   |
| `GET`  | `/me`              | ✓    | —             | `{ user }`                                      |

</details>

<details>
<summary><strong><code>/api/search</code> — NLP-Enhanced Search</strong></summary>

<br/>

| Method | Endpoint   | Auth | Params             | Response              |
| ------ | ---------- | ---- | ------------------ | --------------------- |
| `GET`  | `/songs`   | ✗    | `?q=...&limit=...` | `{ results, parsed }` |
| `GET`  | `/albums`  | ✗    | `?q=...&limit=...` | `{ results }`         |
| `GET`  | `/artists` | ✗    | `?q=...&limit=...` | `{ results }`         |

</details>

<details>
<summary><strong><code>/api/playlists</code> — Playlist CRUD</strong></summary>

<br/>

| Method   | Endpoint             | Body                                 | Response        |
| -------- | -------------------- | ------------------------------------ | --------------- |
| `GET`    | `/`                  | —                                    | `{ playlists }` |
| `POST`   | `/`                  | `{ name, description, songs, tags }` | `{ playlist }`  |
| `GET`    | `/:id`               | —                                    | `{ playlist }`  |
| `PATCH`  | `/:id`               | `{ name, description, isPublic }`    | `{ playlist }`  |
| `DELETE` | `/:id`               | —                                    | `{ success }`   |
| `POST`   | `/:id/songs`         | `{ song }`                           | `{ playlist }`  |
| `DELETE` | `/:id/songs/:songId` | —                                    | `{ playlist }`  |
| `PATCH`  | `/:id/reorder`       | `{ songIds }`                        | `{ playlist }`  |

_All routes require authentication._

</details>

<details>
<summary><strong><code>/api/user</code> — User Profile & Data</strong></summary>

<br/>

| Method   | Endpoint         | Body / Params                                                     | Response                                                                                   |
| -------- | ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `GET`    | `/me`            | —                                                                 | `{ user }`                                                                                 |
| `PATCH`  | `/preferences`   | `{ name, languages, eras, moods }`                                | `{ user }`                                                                                 |
| `POST`   | `/history`       | `{ songId, title, artist, albumArt, duration, source, language }` | `{ success }`                                                                              |
| `GET`    | `/history`       | `?limit=20&page=1`                                                | `{ history, total, page }`                                                                 |
| `POST`   | `/liked`         | `{ song }`                                                        | `{ success, likedCount }`                                                                  |
| `DELETE` | `/liked/:songId` | —                                                                 | `{ success }`                                                                              |
| `GET`    | `/liked`         | —                                                                 | `{ likedSongs }`                                                                           |
| `GET`    | `/stats`         | —                                                                 | `{ totalSongsPlayed, totalListeningTime, likedSongsCount, topArtists, languageBreakdown }` |

_All routes require authentication._

</details>

<details>
<summary><strong><code>/api/ai</code> — AI Playlist Generation</strong></summary>

<br/>

| Method | Endpoint          | Rate Limit | Body                      | Response                                               |
| ------ | ----------------- | ---------- | ------------------------- | ------------------------------------------------------ |
| `POST` | `/build-playlist` | 15/min     | `{ songs }` or `{ mood }` | `{ playlistName, matched, partial, unmatched, stats }` |

_Requires authentication._

</details>

<details>
<summary><strong><code>/api/dashboard</code> — Personalized Dashboard</strong></summary>

<br/>

| Method | Endpoint | Auth | Response                                          |
| ------ | -------- | ---- | ------------------------------------------------- |
| `GET`  | `/`      | ✓    | `{ greeting, subtitle, sections[], generatedAt }` |
| `GET`  | `/guest` | ✗    | `{ greeting, subtitle, sections[], generatedAt }` |

</details>

<details>
<summary><strong><code>/api/session</code> — SoulLink Sessions</strong></summary>

<br/>

| Method   | Endpoint  | Body                  | Response            |
| -------- | --------- | --------------------- | ------------------- |
| `POST`   | `/create` | `{ hostName }`        | `{ code, room }`    |
| `POST`   | `/join`   | `{ code, guestName }` | `{ room, session }` |
| `GET`    | `/:code`  | —                     | `{ room }`          |
| `DELETE` | `/:code`  | —                     | `{ ok }`            |

</details>

<details>
<summary><strong>Health Check</strong></summary>

<br/>

| Method | Endpoint  | Response                      |
| ------ | --------- | ----------------------------- |
| `GET`  | `/health` | `{ status: "ok", timestamp }` |

</details>

<details>
<summary><strong>JioSaavn API (External)</strong></summary>

<br/>

| Endpoint                       | Purpose                                        |
| ------------------------------ | ---------------------------------------------- |
| `/search/songs?q=...&n=...`    | Search songs by query                          |
| `/song?id=...`                 | Song details + download URLs (320/160/96 kbps) |
| `/song/recommend?id=...&n=...` | Similar song recommendations                   |
| `/search/artists?q=...`        | Search artists                                 |
| `/artist?id=...`               | Artist details + top songs + albums            |
| `/album?id=...`                | Album details + full tracklist                 |

</details>

<br/>

---

## 🗺️ Roadmap

| Status | Feature                                           |
| ------ | ------------------------------------------------- |
| ✅     | AI-powered playlist generation (mood + song list) |
| ✅     | Real-time SoulLink duo listening with chat        |
| ✅     | Offline downloads + local file import             |
| ✅     | Native Android APK with lock screen controls      |
| ✅     | Editable profile with listening stats             |
| ✅     | Personalized dashboard (9 section types)          |
| 🟡     | PWA support with service worker                   |
| 🟡     | Synced lyrics display                             |
| 🟡     | SoulLink emoji reactions                          |
| 🟡     | Audio visualizer / waveform                       |
| 🟡     | Social sharing & public profiles                  |
| 🟡     | Multi-language UI (i18n)                          |
| 🟡     | iOS app (Capacitor already supports it)           |
| 🟡     | Cross-device session continuity                   |

<br/>

---

## 🤝 Contributing

```bash
# Fork → Clone → Branch → Code → Push → PR
git checkout -b feature/amazing-feature
git commit -m 'Add amazing feature'
git push origin feature/amazing-feature
```

<br/>

---

## 📄 License

This project is open source under the **[MIT License](LICENSE)**.

<br/>

---

<div align="center">

<br/>

**Built with ❤️ by [Loki](https://github.com/itslokeshx)**

_No ads. No paywalls. No limits. Just music._

_Listen together. Feel together._

<br/>

[![GitHub](https://img.shields.io/badge/GitHub-itslokeshx-181717?style=for-the-badge&logo=github)](https://github.com/itslokeshx)
&nbsp;&nbsp;
[![Download APK](https://img.shields.io/badge/📱_APK-Download-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

</div>
