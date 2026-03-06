<div align="center">

<br/>

# 🎧 SoulSync

### _Listen together. Feel together._

**A free music app with AI-generated playlists, real-time listening with friends, and offline downloads — no ads, no subscription.**

<br/>

[![Open Web App](https://img.shields.io/badge/🌐%20Open%20Web%20App-soul--sync--beta.vercel.app-1DB954?style=for-the-badge)](https://soul-sync-beta.vercel.app/)
&nbsp;&nbsp;
[![Download APK](https://img.shields.io/badge/📱%20Download%20APK-Android%205.2%20MB-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

<sub>Android 7.0+ required &nbsp;·&nbsp; No Play Store needed &nbsp;·&nbsp; <a href="https://github.com/itslokeshx/SoulSync/releases">All Releases</a></sub>

<br/>

---

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

[Features](#-features) · [Android APK](#-android-apk) · [vs Spotify](#-soulsync-vs-spotify) · [AI Engine](#-ai-engine) · [SoulLink](#-soullink--listen-together) · [Tech Stack](#-tech-stack) · [Architecture](#-architecture) · [Setup](#-getting-started) · [Deploy](#-deployment) · [API Docs](#-api-reference)

</div>

<br/>

---

## 📱 Android APK

> _One codebase. One backend. Two platforms. Zero compromise._

SoulSync ships as a **native Android APK** built with Capacitor — the same React codebase that powers the web app, compiled into a real installable Android application. No React Native rewrite. No separate codebase. Same Render backend for both.

### Install the APK

```
1. Download SoulSync.apk from the Releases page
2. On your Android device:
   Settings → Security → Enable "Install from unknown sources"
3. Open the downloaded APK file
4. Tap Install
5. Open SoulSync and sign in with Google
```

> **Requires:** Android 7.0 (API 24) or higher

### APK-Exclusive Features

| Feature                      | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| **Offline without login**    | Play downloaded songs even with no account — APK only     |
| **Native file storage**      | Songs saved to device storage via `@capacitor/filesystem` |
| **Lock screen controls**     | Play, pause, skip from Android lock screen                |
| **Now Playing notification** | Persistent media notification with full controls          |
| **Background audio**         | Music keeps playing when app is minimized                 |
| **Haptic feedback**          | Every tap, like, skip feels native and satisfying         |
| **Native Google Sign-In**    | Bottom sheet sign-in, no popup, fully native              |
| **Native share sheet**       | Share songs via any installed app                         |
| **Back button handling**     | Back → minimize app (never accidentally exits)            |
| **Status bar theming**       | Matches app's dark `#060606` theme                        |
| **Custom splash screen**     | Branded dark splash on every launch                       |
| **Swipe-up player**          | Swipe up from mini player → full screen immersive view    |

### APK vs Web — Key Differences

| Behavior                  | 🤖 Android APK          | 🌐 Web App            |
| ------------------------- | ----------------------- | --------------------- |
| **Offline without login** | ✅ Can play downloads   | ❌ Redirects to login |
| **Audio storage**         | Native filesystem       | IndexedDB             |
| **Lock screen controls**  | ✅ Full native controls | ✅ Media Session API  |
| **Background playback**   | ✅ Foreground service   | ✅ Tab stays active   |
| **Google Sign-In**        | Native bottom sheet     | OAuth popup           |
| **Haptic feedback**       | ✅ Full haptics         | ❌ Not available      |
| **Install**               | APK / Play Store        | Browser bookmark      |
| **Updates**               | Manual / Store          | Instant on deploy     |

### Build the APK Yourself

```bash
# 1. Install Capacitor dependencies
npm install @capacitor/core @capacitor/android @capacitor/cli
npm install @capacitor/filesystem @capacitor/preferences
npm install @capacitor/network @capacitor/haptics
npm install @capacitor/status-bar @capacitor/splash-screen
npm install @capacitor/app @capacitor/local-notifications

# 2. Build the web bundle
cd frontend && npm run build

# 3. Sync to Android
npx cap sync android

# 4. Open in Android Studio
npx cap open android
# Then: Build → Generate Signed Bundle / APK → APK → Release

# OR build via command line
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### Android Permissions

```xml
<!-- Internet access -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Offline downloads -->
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
  android:maxSdkVersion="29" />

<!-- Background audio — keeps music playing when minimized -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Lock screen + notifications -->
<uses-permission android:name="android.permission.MEDIA_CONTENT_CONTROL" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Network detection -->
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

<br/>

---

## 🏆 SoulSync vs Spotify

> _Everything Spotify charges ₹119/month for — SoulSync gives you free. Plus features Spotify doesn't offer at any price._

<div align="center">

| Feature                       |        SoulSync         |   Spotify Free    |     Spotify Premium      |
| ----------------------------- | :---------------------: | :---------------: | :----------------------: |
| **Ad-free listening**         |        ✅ Always        | ❌ Ads every song |         ✅ Paid          |
| **AI Playlist Builder**       |   ✅ Free, unlimited    | ❌ Not available  |     ❌ Not available     |
| **Listen Together (Duo)**     | ✅ Free + built-in chat | ❌ Not available  |     ✅ Paid, no chat     |
| **Song Downloads**            | ✅ Free, stored locally | ❌ Not available  |       ✅ Paid only       |
| **NLP Smart Search**          |     ✅ Intent-aware     |  ❌ Keyword only  |     ❌ Keyword only      |
| **Personalized Dashboard**    |      ✅ From day 1      |    ❌ Generic     | ✅ Algorithmic black box |
| **In-session Chat**           |       ✅ Built-in       | ❌ Not available  |     ❌ Not available     |
| **Offline Playback**          |         ✅ Free         | ❌ Not available  |         ✅ Paid          |
| **Native Android APK**        |    ✅ Free download     | ✅ Free download  |     ✅ Paid features     |
| **Offline without login**     |    ✅ APK exclusive     |       ❌ No       |          ❌ No           |
| **Indian Language Support**   |    ✅ 10+ languages     | ❌ Poor regional  |     ❌ Poor regional     |
| **BGM / Instrumental Search** |    ✅ Auto-detected     |       ❌ No       |          ❌ No           |
| **Import Local Files**        |   ✅ MP3/WAV/FLAC/AAC   |       ❌ No       |          ❌ No           |
| **Lock Screen Controls**      |     ✅ Native + Web     |     ✅ Native     |        ✅ Native         |
| **Open Source**               |     ✅ MIT License      | ❌ Closed source  |     ❌ Closed source     |
| **Monthly Price**             |     **₹0 forever**      |    ₹0 with ads    |      **₹119/month**      |

</div>

<br/>

---

## ✨ Features

<details>
<summary><strong>🔐 Authentication & Onboarding</strong></summary>

<br/>

| Feature               | Web                                                      | APK                                                 |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| **Google OAuth 2.0**  | Popup via `@react-oauth/google`                          | Native bottom sheet via `capacitor-google-auth`     |
| **JWT Sessions**      | httpOnly secure cookies, 7-day expiry                    | Same — backend issues identical tokens              |
| **Guided Onboarding** | 4-step animated wizard — languages → eras → moods → name | Same UI                                             |
| **Protected Routes**  | Redirects to `/login` if unauthenticated                 | Redirects to `/offline` if no internet + no account |
| **User Profiles**     | Google photo, editable name, preference tags             | Same + cached locally for offline display           |

</details>

<details>
<summary><strong>🎵 Core Music Experience</strong></summary>

<br/>

| Feature                 | Description                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| **Millions of Songs**   | Full streaming powered by JioSaavn API across 10+ Indian languages & English                    |
| **NLP Smart Search**    | Understands artists, moods, languages, eras, movies, formats (e.g., _"sad anirudh songs 2024"_) |
| **Search Enhancer**     | 500+ artist dictionary, mood tokenization, language detection, intent classification            |
| **HQ Playback**         | Auto-selects 320kbps → 160kbps → 96kbps based on availability                                   |
| **Queue Management**    | View, reorder, add next/last, shuffle, auto-fill with recommendations                           |
| **Shuffle & Repeat**    | Shuffle mode, repeat-one, repeat-all, repeat-off — always visible on mobile                     |
| **Now Playing View**    | Full-screen immersive view — swipe up on mobile, dynamic art gradient, vinyl spin               |
| **Context Menu**        | Right-click / long-press: Play, Queue, Playlist, Like, Download, Artist, Album                  |
| **Keyboard Shortcuts**  | Space (play/pause), arrows (seek/volume), M (mute), S (shuffle), R (repeat)                     |
| **Dynamic Backgrounds** | Album art dominant color extraction for gradient overlays                                       |

</details>

<details>
<summary><strong>📱 Mobile Player — Redesigned</strong></summary>

<br/>

The mobile player is a completely separate, touch-native design shared between mobile web and the APK.

| Component                  | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| **Mini Player Bar**        | 64px bar above bottom nav — art + title + play/pause/next              |
| **Swipe Up → Full Screen** | Spring animation expands to immersive full-screen player               |
| **Full Screen Player**     | 300x300 breathing album art, progress bar, all controls, volume slider |
| **Seek +/- 10s**           | Double-tap left/right side of player seeks 10 seconds                  |
| **Bottom Sheet Queue**     | Slides up from bottom — drag handle, reorder, swipe-to-delete          |
| **Shuffle Always Visible** | Shuffle + repeat in full screen player, never hidden                   |
| **Queue Tab**              | Dedicated Queue tab in bottom nav with song count badge                |
| **Haptic Controls**        | Every tap, like, seek, skip — native haptic feedback (APK)             |

</details>

<details>
<summary><strong>✈️ Offline Mode</strong></summary>

<br/>

**Offline mode works differently on Web vs APK:**

| Scenario                    | Web                              | APK                                 |
| --------------------------- | -------------------------------- | ----------------------------------- |
| Online + logged in          | Full access                      | Full access                         |
| Online + not logged in      | → Login required                 | → Login required                    |
| Offline + logged in         | Offline library (downloads only) | Offline library (downloads only)    |
| **Offline + not logged in** | ❌ → Login page                  | ✅ → Offline player (APK exclusive) |

**Offline mode features:**

- Amber banner: "📶 No internet — playing downloaded songs"
- Only downloaded songs are playable (streamed songs disabled)
- Search shows downloaded songs only
- Liked songs served from local cache
- Auto-enters offline mode when network drops
- Toast: "Connection lost — switched to offline mode"
- On reconnect: "Back online 📶" + option to resume full mode
- Manual toggle in sidebar: `[✈️ Offline Mode]`

</details>

<details>
<summary><strong>🤖 AI-Powered Playlists</strong></summary>

<br/>

| Feature                   | Description                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------- |
| **Mood-Based Generation** | Describe a vibe → Groq AI generates 15 matching songs with a creative playlist name |
| **Song List Mode**        | Paste song names → AI optimizes search queries and matches from JioSaavn            |
| **Smart Matching**        | Confidence scoring (high / partial / none) with relevance-based ranking             |
| **Multi-Key Rotation**    | Up to 5 Groq API keys with round-robin, rate-limit detection, auto fallback         |
| **Result Caching**        | AI responses cached in Redis for 30 min to save API calls                           |
| **One-Click Save**        | Review matches, deselect unwanted songs, save directly to your library              |

</details>

<details>
<summary><strong>🏠 Personalized Dashboard</strong></summary>

<br/>

Built dynamically from your **listening history**, **language preferences**, and **time of day**.

| Section                  | Description                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| **Quick Grid**           | 6 recently played songs for instant replay                                       |
| **Continue Listening**   | Last 10 songs as a horizontal scroll row                                         |
| **Artist Spotlight**     | Most-played artist with their top songs                                          |
| **Language Sections**    | Trending/top sections in each of your preferred languages                        |
| **Time-Based Mood**      | "Morning Fresh Hits", "Afternoon Vibes", "Late Night Chill" based on time of day |
| **Because You Listened** | Recommendations seeded from your 3 most recent tracks                            |
| **Trending Now**         | Trending songs filtered by your language preferences                             |
| **Mood Grid**            | 6 mood cards — Happy, Heartbreak, Party, Chill, Workout, Rainy Day               |
| **New Releases**         | Latest releases in your preferred languages                                      |

</details>

<details>
<summary><strong>📚 Library & Playlists</strong></summary>

<br/>

| Feature               | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| **Cloud Playlists**   | Create, edit, delete, reorder — stored in MongoDB, synced everywhere |
| **AI Playlists**      | Save directly from AI modal with auto-generated names and tags       |
| **Liked Songs**       | Cloud-synced with local cache fallback for offline resilience        |
| **Recently Played**   | Persistent 20-song history with deduplication                        |
| **Listening History** | Full play log with 90-day TTL auto-cleanup in MongoDB                |
| **Playlist Page**     | Song list, total duration, drag-reorder, batch operations            |

</details>

<details>
<summary><strong>📥 Offline Downloads</strong></summary>

<br/>

| Feature                 | Web                         | APK                                              |
| ----------------------- | --------------------------- | ------------------------------------------------ |
| **Storage engine**      | IndexedDB (browser)         | Native filesystem via `@capacitor/filesystem`    |
| **One-click download**  | ✅ Context menu or player   | ✅ Same + haptic success feedback                |
| **Import local files**  | ✅ MP3/WAV/AAC/OGG/FLAC     | ✅ Same                                          |
| **Offline playback**    | ✅ Blob URLs                | ✅ Native file URIs (`Capacitor.convertFileSrc`) |
| **Storage dashboard**   | ✅ Total size, remove songs | ✅ Same                                          |
| **Download progress**   | Toast with %                | Toast with % + haptic pulse every 25%            |
| **Background download** | ✅                          | ✅ Continues while app is minimized              |

</details>

<details>
<summary><strong>👤 Profile & Stats</strong></summary>

<br/>

| Feature                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| **Profile Page**       | Google avatar, editable name, preference tags            |
| **Listening Stats**    | Total songs played, total hours listened, liked count    |
| **Top Artists**        | Aggregated from history with play counts and album art   |
| **Language Breakdown** | Listening distribution by language                       |
| **Edit Preferences**   | Modify languages/eras/moods — triggers dashboard rebuild |

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

1. **Groq LLM** — generates optimized search queries from natural language or pasted song lists
2. **Search Enhancer** — NLP pipeline: 500+ artist dictionary, 50+ mood tokens, language detection, multi-query expansion
3. **Relevance Scorer** — ranks by artist match, title match, language, year, and format confidence
4. **Caching** — Redis 30-minute TTL prevents duplicate AI/API calls

<br/>

---

## 🎧 SoulLink — Listen Together

<div align="center">

```
  Partner A (Host)                    Server                     Partner B (Guest)
       │                                │                              │
       ├── POST /session/create ───────▶│                              │
       │◀────── { code: "X7K9P2" } ────│                              │
       │                                │◀── POST /session/join ───────┤
       │                                │─────── { room state } ──────▶│
       ├── duo:sync-song-change ───────▶│──── song-change ────────────▶│
       ├── duo:sync-play ──────────────▶│──── play ───────────────────▶│
       │◀───── duo:message ────────────│◀── duo:message ──────────────┤
       ├── duo:heartbeat ──────────────▶│◀── duo:heartbeat ───────────┤
       ├── duo:end-session ────────────▶│──── end-card ───────────────▶│
```

</div>

> Create a room → share the 6-character code → play, pause, seek, skip — everything syncs instantly. Chat in real-time. Get a beautiful recap card when the session ends.

<details>
<summary><strong>Socket Events Reference</strong></summary>

<br/>

| Event                  | Direction       | Purpose                         |
| ---------------------- | --------------- | ------------------------------- |
| `duo:join`             | Client → Server | Join room with code, name, role |
| `duo:session-state`    | Server → Client | Full room state on join         |
| `duo:partner-joined`   | Server → Client | Notify partner connected        |
| `duo:sync-song-change` | Client ↔ Server | Sync current song + queue       |
| `duo:sync-play`        | Client ↔ Server | Sync play action + timestamp    |
| `duo:sync-pause`       | Client ↔ Server | Sync pause action               |
| `duo:sync-seek`        | Client ↔ Server | Sync seek position              |
| `duo:message`          | Client ↔ Server | Chat messages                   |
| `duo:heartbeat`        | Client → Server | Alive check (5s interval)       |
| `duo:end-session`      | Client → Server | End session for both            |

</details>

<br/>

---

## 🛠 Tech Stack

<div align="center">

<table>
<tr><th colspan="2">Frontend + Mobile</th><th colspan="2">Backend</th></tr>
<tr>
<td>

|     | Technology       |
| --- | ---------------- |
| ⚡  | TypeScript 5.7   |
| ⚛️  | React 18.3       |
| 🔥  | Vite 6.1         |
| 🎨  | Tailwind CSS 3.4 |
| 📱  | Capacitor 6      |
| 🗃️  | Zustand 5        |
| 🎬  | Framer Motion 12 |
| 🧭  | React Router 6   |
| 🔄  | TanStack Query 5 |
| 🔌  | Socket.io Client |
| 🔐  | Google OAuth     |
| 🎯  | Lucide React     |
| 🍞  | react-hot-toast  |

</td>
<td>

**Capacitor Plugins:**

|     | Plugin                           |
| --- | -------------------------------- |
| 📁  | `@capacitor/filesystem`          |
| 💾  | `@capacitor/preferences`         |
| 📶  | `@capacitor/network`             |
| 📳  | `@capacitor/haptics`             |
| 🔔  | `@capacitor/local-notifications` |
| 🎵  | `@capacitor/app`                 |
| 🖼  | `@capacitor/splash-screen`       |
| 📊  | `@capacitor/status-bar`          |

</td>
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
</tr>
</table>

</div>

> **One backend for everything** — the Render-hosted Express server powers both the web app and the Android APK. Same API endpoints, same JWT auth, same MongoDB, same Socket.io.

<br/>

---

## 🏗 Architecture

```
┌──────────────────── WEB BROWSER ───────────────────┐  ┌────────── ANDROID APK ──────────────┐
│                                                    │  │                                     │
│  Auth → Zustand → Router → IndexedDB → Socket.io  │  │  Auth → Zustand → Router →          │
│                                                    │  │  Capacitor Filesystem → Socket.io   │
│  ┌─── AppLayout ────────────────────────────────┐ │  │                                     │
│  │ Sidebar  Pages  PlayerBar  Queue  DuoPanel   │ │  │  ┌──── Mobile Layout ─────────────┐ │
│  └──────────────────────────────────────────────┘ │  │  │ BottomNav  Pages  MiniPlayer   │ │
│                                                    │  │  │ FullScreenPlayer  QueueSheet  │ │
└──────────────────────┬─────────────────────────────┘  │  └────────────────────────────────┘ │
                       │                                └──────────────┬──────────────────────┘
                       │          REST API + WebSocket                 │
                       └──────────────────┬────────────────────────────┘
                                          │
                         ┌────────────────▼────────────────┐
                         │         RENDER BACKEND          │
                         │       Express + Socket.io       │
                         │                                 │
                         │  /auth  /search  /playlist      │
                         │  /user  /ai  /session           │
                         │  /dashboard                     │
                         │                                 │
                         │  MongoDB Atlas  ·  Redis Cache  │
                         │  Groq AI  ·  JioSaavn API       │
                         └─────────────────────────────────┘
```

<details>
<summary><strong>Offline Auth Flow (APK)</strong></summary>

<br/>

```
App Starts
    │
    ├── isNative() ──────────────────── isWeb()
    │                                      │
  Online?                           Not logged in?
    │                                      │
  ┌─┴─┐                              → /login
  │   │
Online  Offline
  │       │
Logged?  Logged?
  │         │
  ├─Yes     ├─Yes → Offline library (downloads only)
  │         │
  ├─No      └─No  → /offline ✅ (APK exclusive guest mode)
  │
  └─No → /login
```

</details>

<details>
<summary><strong>Data Models</strong></summary>

<br/>

| Model                | Key Fields                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **User**             | googleId, email, name, photo, preferences (languages/eras/moods), likedSongs[], totalListeningTime             |
| **Playlist**         | userId, name, description, songs[], isPublic, isAIGenerated, tags[], auto-calculated songCount & totalDuration |
| **ListeningHistory** | userId, songId, title, artist, source (search/recommendation/playlist/duo), 90-day TTL                         |
| **DuoSession**       | host/guest, roomCode, currentSong, playState, messages[]                                                       |

</details>

<details>
<summary><strong>Zustand Stores</strong></summary>

<br/>

| Store          | Manages                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `playerStore`  | Current song, play/pause, time, volume, shuffle, repeat                                                              |
| `queueStore`   | Song queue, history, add/remove/reorder                                                                              |
| `searchStore`  | Search query, results, filters                                                                                       |
| `uiStore`      | UI toggles — queue panel, now playing, context menu                                                                  |
| `duoStore`     | SoulLink session state + sessionStorage persistence                                                                  |
| `offlineStore` | Downloaded songs, offline mode flag, cached user — persisted to `@capacitor/preferences` on APK, localStorage on web |

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
├── frontend/                       # 🎨 React + TypeScript SPA + APK
│   ├── capacitor.config.ts         # Capacitor: appId, plugins, splash, statusBar
│   ├── android/                    # Generated Android project (Capacitor)
│   │   └── app/src/main/
│   │       ├── AndroidManifest.xml # Permissions: internet, storage, foreground service
│   │       └── res/                # Icons (all densities) + splash screen
│   │
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── .env.example
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       │
│       ├── capacitor/              # 📱 Native plugin wrappers
│       │   ├── filesystem.ts       #    Save/read/delete audio files natively
│       │   ├── notifications.ts    #    Now Playing notification
│       │   ├── musicControls.ts    #    Lock screen controls
│       │   └── network.ts          #    Online/offline detection
│       │
│       ├── auth/
│       │   ├── AuthContext.tsx     # Login, logout, user state
│       │   └── ProtectedRoute.tsx  # Web: → /login | APK offline: → /offline
│       │
│       ├── pages/
│       │   ├── LoginPage.tsx       # Web: Google popup | APK: native sheet
│       │   ├── OnboardingPage.tsx
│       │   ├── HomePage.tsx
│       │   ├── SearchPage.tsx
│       │   ├── BrowsePage.tsx
│       │   ├── LibraryPage.tsx
│       │   ├── PlaylistPage.tsx
│       │   ├── DownloadsPage.tsx
│       │   ├── LikedPage.tsx
│       │   ├── ArtistPage.tsx
│       │   ├── AlbumPage.tsx
│       │   ├── ProfilePage.tsx
│       │   └── OfflinePage.tsx     # NEW: APK guest offline mode
│       │
│       ├── components/
│       │   ├── cards/
│       │   ├── layout/
│       │   │   ├── AppLayout.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── MobileNav.tsx   # Upgraded: Queue tab + offline indicator
│       │   │   └── DuoMobileBar.tsx
│       │   │
│       │   ├── player/
│       │   │   ├── PlayerBar.tsx
│       │   │   ├── NowPlayingView.tsx
│       │   │   └── QueuePanel.tsx
│       │   │
│       │   ├── mobile/             # NEW: Mobile-specific components
│       │   │   ├── MobilePlayerFull.tsx   # Full-screen swipe-up player
│       │   │   ├── MobileQueueSheet.tsx   # Bottom sheet queue
│       │   │   ├── MiniPlayerSheet.tsx    # 64px mini bar above nav
│       │   │   ├── OfflineBanner.tsx      # Amber offline status banner
│       │   │   └── OfflineToggle.tsx      # Manual offline mode toggle
│       │   │
│       │   └── ui/
│       │
│       ├── duo/
│       ├── store/
│       │   ├── playerStore.ts
│       │   ├── queueStore.ts
│       │   ├── searchStore.ts
│       │   ├── uiStore.ts
│       │   └── offlineStore.ts     # NEW: Offline songs + mode state
│       │
│       ├── hooks/
│       │   ├── useAudio.ts
│       │   ├── useDownload.ts      # Upgraded: native filesystem on APK
│       │   ├── useNetwork.ts       # NEW: Capacitor Network + browser fallback
│       │   ├── useOfflineMode.ts   # NEW: Offline mode logic
│       │   └── useNativeAudio.ts   # NEW: Background audio + lock screen
│       │
│       ├── utils/
│       │   ├── platform.ts         # NEW: isNative(), isAndroid(), isMobileView()
│       │   └── [existing utils]
│       │
│       └── types/
│
└── backend/                        # 🖥️ Express + TypeScript (shared: web + APK)
    └── src/
        ├── index.ts
        ├── routes/                 # auth, search, playlist, user, ai, session, dashboard
        ├── services/               # dashboardEngine, searchEnhancer, groq, jiosaavn, mongodb, redis
        ├── models/                 # User, Playlist, ListeningHistory, DuoSession
        ├── middleware/             # auth (JWT), rateLimiter
        └── socket/                 # Socket.io rooms + handlers
```

</details>

<br/>

---

## 🚀 Getting Started

### Prerequisites

| Requirement    | Version             | Notes                  |
| -------------- | ------------------- | ---------------------- |
| Node.js        | ≥ 18                | Required               |
| npm            | ≥ 9                 | Required               |
| MongoDB Atlas  | Free M0             | Required               |
| Google Cloud   | OAuth 2.0 Client ID | Required               |
| Android Studio | Latest              | For APK builds only    |
| Java JDK       | 17+                 | For APK builds only    |
| Groq API       | Free key            | Optional — AI features |

### Web App Quick Start

```bash
# 1. Clone
git clone https://github.com/itslokeshx/SoulSync.git
cd SoulSync

# 2. Install everything
npm run install:all

# 3. Configure environment
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Edit both files with your credentials

# 4. Start backend
npm run dev:backend

# 5. Start frontend
npm run dev:frontend

# 6. Open http://localhost:5173 🎶
```

### APK Build Quick Start

```bash
# After web app is working:

# 1. Install Capacitor
cd frontend
npm install @capacitor/core @capacitor/android @capacitor/cli
npm install @capacitor/filesystem @capacitor/preferences @capacitor/network
npm install @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen
npm install @capacitor/app @capacitor/local-notifications

# 2. Init + add Android (run once)
npx cap init SoulSync com.soulsync.app --web-dir dist
npx cap add android

# 3. Build + sync
npm run build
npx cap sync android

# 4. Open Android Studio
npx cap open android
# Build → Generate Signed APK → Release

# 5. Install on device
adb install android/app/build/outputs/apk/release/app-release.apk
```

<details>
<summary><strong>Environment Variables Reference</strong></summary>

<br/>

**`frontend/.env`** — used by both web and APK

```env
VITE_BACKEND_URL=https://your-soulsync-backend.onrender.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_JIOSAAVN_API=https://saavn.sumit.co/api
VITE_DUO_BACKEND=https://your-soulsync-backend.onrender.com
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

> 📘 See `backend/.env.example` and `frontend/.env.example` for full setup guides.

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
3. Set env vars
4. Deploy — `vercel.json` included
5. Add URL to Google OAuth origins

</td>
<td width="33%">

### Backend → Render

1. Create Web Service
2. Connect GitHub repo
3. Root: `backend`
4. Build: `npm install --include=dev && npm run build`
5. Start: `npm start`
6. Set env vars — includes 13-min keep-alive

</td>
<td width="33%">

### APK → GitHub Releases

1. Build signed APK in Android Studio
2. Go to GitHub → Releases → New Release
3. Upload `app-release.apk`
4. Tag: `v1.0.0`
5. Users download directly ✅

</td>
</tr>
</table>

> **APK uses the same Render backend as the web app** — no separate server needed. The `VITE_BACKEND_URL` in the APK build points directly to your Render URL.

<br/>

---

## 🎨 Design System

<details>
<summary><strong>Color Palette</strong></summary>

<br/>

| Token            | Hex                      | Usage                            |
| ---------------- | ------------------------ | -------------------------------- |
| `sp-black`       | `#000000`                | True black backgrounds           |
| `sp-dark`        | `#060606`                | App background + splash screen   |
| `sp-card`        | `#141414`                | Card surfaces + bottom sheets    |
| `sp-hover`       | `#1c1c1c`                | Hover / press states             |
| `sp-green`       | `#1db954`                | Primary accent, active, SoulLink |
| `sp-green-light` | `#1ed760`                | Hover accent                     |
| `sp-sub`         | `#a0a0a0`                | Secondary / subtitle text        |
| `sp-glass`       | `rgba(255,255,255,0.04)` | Glassmorphism                    |
| `sp-accent`      | `#6366f1`                | AI features                      |
| `sp-rose`        | `#f43f5e`                | Heart/like, destructive          |
| `sp-amber`       | `#f59e0b`                | Offline mode indicators          |

</details>

<details>
<summary><strong>Haptic Feedback Map (APK)</strong></summary>

<br/>

| Interaction            | Haptic Type                |
| ---------------------- | -------------------------- |
| Song card tap          | `ImpactStyle.Light`        |
| Play / Pause           | `ImpactStyle.Medium`       |
| Like button            | `NotificationType.Success` |
| Download complete      | `NotificationType.Success` |
| Download error         | `NotificationType.Error`   |
| Shuffle toggle         | `ImpactStyle.Light`        |
| Queue drag start       | `ImpactStyle.Light`        |
| Song delete            | `ImpactStyle.Heavy`        |
| Bottom sheet snap      | `ImpactStyle.Light`        |
| Tab bar press          | `SelectionChanged`         |
| Seek scrub (every 10s) | `ImpactStyle.Light`        |

</details>

<details>
<summary><strong>Animations</strong></summary>

<br/>

| Animation      | Duration     | Usage                          |
| -------------- | ------------ | ------------------------------ |
| `eq1–eq5`      | 0.75s        | Staggered equalizer bars       |
| `shimmer`      | 1.6s         | Skeleton loading               |
| `fadeUp`       | 0.4s         | Content entrance               |
| `slideInRight` | 0.3s         | Panel slide-in                 |
| `vinylSpin`    | 3s           | Now playing vinyl              |
| `breathe`      | 4s           | Album art pulse in full player |
| `playerExpand` | 400ms spring | Mini → full screen player      |
| `sheetSlide`   | 300ms spring | Queue bottom sheet             |
| `glowPulse`    | 3s           | SoulLink live indicator        |

</details>

<details>
<summary><strong>Z-Index Hierarchy</strong></summary>

<br/>

| Z-Index | Layer                             |
| ------- | --------------------------------- |
| 60      | Toast notifications               |
| 55      | Full screen mobile player         |
| 50      | Navigation (sidebar / bottom nav) |
| 48      | Queue bottom sheet                |
| 45      | SoulLink panel                    |
| 44      | Context menu                      |
| 41      | SoulLink mobile bar               |
| 40      | Mini player bar                   |

</details>

<br/>

---

## ⚡ Performance

| Optimization              | Impact                                                    |
| ------------------------- | --------------------------------------------------------- |
| **NLP Search Enhancer**   | 500+ artist dict + mood tokens + multi-query expansion    |
| **Redis Caching**         | Dashboard (30m), AI (30m), search — in-memory fallback    |
| **Batched AI Searches**   | 5 concurrent JioSaavn requests per batch                  |
| **Debounced Search**      | 400ms delay, AbortController cancels stale requests       |
| **Lazy Queue Fill**       | Recommendations fetched only when ≤1 song remains         |
| **Capacitor Preferences** | Faster than localStorage on Android for offline store     |
| **Native File URIs**      | `Capacitor.convertFileSrc()` for zero-copy audio playback |
| **Skeleton Loaders**      | Shimmer placeholders matching exact UI shape              |
| **90-Day TTL**            | History auto-expires via MongoDB TTL index                |
| **Keep-Alive Ping**       | 13-min self-ping prevents Render sleep                    |

<br/>

---

## 🔒 Security

| Layer                 | Implementation                                                         |
| --------------------- | ---------------------------------------------------------------------- |
| **Authentication**    | Google OAuth 2.0 — no passwords stored anywhere                        |
| **Sessions**          | httpOnly, Secure, SameSite cookies (web) · Capacitor Preferences (APK) |
| **Headers**           | Helmet: CORP, COOP, CSP on all responses                               |
| **CORS**              | Exact origin validation — Vercel URL + APK scheme whitelisted          |
| **Rate Limiting**     | 100 req/min global, 15 req/min AI endpoints                            |
| **JWT**               | RS256, verified on every protected route                               |
| **Validation**        | Zod schemas on all REST endpoints                                      |
| **APK Secrets**       | No secrets bundled in APK — all sensitive ops server-side              |
| **Android Cleartext** | `androidScheme: 'https'` — no HTTP allowed                             |

<br/>

---

## 📝 API Reference

> **Same API for web and APK** — the Render backend serves both platforms identically.

<details>
<summary><strong><code>/api/auth</code></strong></summary>
<br/>

| Method | Endpoint  | Auth | Body          | Response              |
| ------ | --------- | ---- | ------------- | --------------------- |
| `POST` | `/google` | ✗    | `{ idToken }` | `{ user, isNewUser }` |
| `POST` | `/logout` | ✗    | —             | `{ success }`         |
| `GET`  | `/me`     | ✓    | —             | `{ user }`            |

</details>

<details>
<summary><strong><code>/api/search</code></strong></summary>
<br/>

| Method | Endpoint   | Params             | Response              |
| ------ | ---------- | ------------------ | --------------------- |
| `GET`  | `/songs`   | `?q=...&limit=...` | `{ results, parsed }` |
| `GET`  | `/albums`  | `?q=...&limit=...` | `{ results }`         |
| `GET`  | `/artists` | `?q=...&limit=...` | `{ results }`         |

</details>

<details>
<summary><strong><code>/api/playlists</code></strong></summary>
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

_All routes require auth._

</details>

<details>
<summary><strong><code>/api/user</code></strong></summary>
<br/>

| Method   | Endpoint         | Body / Params                                 | Response                                                                  |
| -------- | ---------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `GET`    | `/me`            | —                                             | `{ user }`                                                                |
| `PATCH`  | `/preferences`   | `{ name, languages, eras, moods }`            | `{ user }`                                                                |
| `POST`   | `/history`       | `{ songId, title, artist, duration, source }` | `{ success }`                                                             |
| `GET`    | `/history`       | `?limit=20&page=1`                            | `{ history, total }`                                                      |
| `POST`   | `/liked`         | `{ song }`                                    | `{ success, likedCount }`                                                 |
| `DELETE` | `/liked/:songId` | —                                             | `{ success }`                                                             |
| `GET`    | `/stats`         | —                                             | `{ totalSongsPlayed, totalListeningTime, topArtists, languageBreakdown }` |

_All routes require auth._

</details>

<details>
<summary><strong><code>/api/ai</code></strong></summary>
<br/>

| Method | Endpoint          | Rate Limit | Body                      | Response                                               |
| ------ | ----------------- | ---------- | ------------------------- | ------------------------------------------------------ |
| `POST` | `/build-playlist` | 15/min     | `{ songs }` or `{ mood }` | `{ playlistName, matched, partial, unmatched, stats }` |

</details>

<details>
<summary><strong><code>/api/dashboard</code></strong></summary>
<br/>

| Method | Endpoint | Auth | Response                                |
| ------ | -------- | ---- | --------------------------------------- |
| `GET`  | `/`      | ✓    | `{ greeting, sections[], generatedAt }` |
| `GET`  | `/guest` | ✗    | `{ greeting, sections[], generatedAt }` |

</details>

<details>
<summary><strong><code>/api/session</code> — SoulLink</strong></summary>
<br/>

| Method   | Endpoint  | Body                  | Response         |
| -------- | --------- | --------------------- | ---------------- |
| `POST`   | `/create` | `{ hostName }`        | `{ code, room }` |
| `POST`   | `/join`   | `{ code, guestName }` | `{ room }`       |
| `GET`    | `/:code`  | —                     | `{ room }`       |
| `DELETE` | `/:code`  | —                     | `{ ok }`         |

</details>

<details>
<summary><strong>Health Check</strong></summary>
<br/>

| Method | Endpoint  | Response                      |
| ------ | --------- | ----------------------------- |
| `GET`  | `/health` | `{ status: "ok", timestamp }` |

</details>

<br/>

---

## 🗺️ Roadmap

| Status | Feature                          | Platform |
| ------ | -------------------------------- | -------- |
| 🟡     | Play Store submission            | Android  |
| 🟡     | PWA support + service worker     | Web      |
| 🟡     | Synced lyrics display            | Both     |
| 🟡     | SoulLink emoji reactions         | Both     |
| 🟡     | Audio visualizer                 | Both     |
| 🟡     | Social sharing & public profiles | Both     |
| 🟡     | iOS support (Capacitor)          | iOS      |
| 🟡     | Cross-device session continuity  | Both     |
| 🟡     | Multi-language UI (i18n)         | Both     |

<br/>

---

## 🤝 Contributing

```bash
git checkout -b feature/amazing-feature
git commit -m 'Add amazing feature'
git push origin feature/amazing-feature
# Open a Pull Request
```

<br/>

---

## 📄 License

Open source under the **[MIT License](LICENSE)**.

<br/>

---

## 📖 API Reference

SoulSync uses the following unofficial APIs for its core functionality:

| API              | Repository                                                            | Implementation                              |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| **JioSaavn API** | [sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) | Custom backend proxy with intent parsing    |
| **Groq AI**      | [Groq SDK](https://github.com/groq/groq-typescript)                   | LLaMA 3.3 70B for smart playlist generation |

<br/>

**Built with ❤️ by [Loki](https://github.com/itslokeshx)**

_No ads. No paywalls. No limits. Web app. Android APK. One codebase._

_Listen together. Feel together._

<br/>

[![GitHub](https://img.shields.io/badge/GitHub-itslokeshx-181717?style=for-the-badge&logo=github)](https://github.com/itslokeshx)
[![Download APK](https://img.shields.io/badge/Download-APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest)
[![Live Demo](https://img.shields.io/badge/Live-Demo-1DB954?style=for-the-badge&logo=vercel&logoColor=white)](https://soul-sync-beta.vercel.app/)

</div>
