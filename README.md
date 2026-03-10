<div align="center">

<br/>

# 🎧 SoulSync

### _Listen together. Feel together._

**A free music app with AI-generated playlists, real-time listening with friends, offline downloads, and world-class search — no ads, no subscription.**

<br/>

[![Open Web App](https://img.shields.io/badge/🌐%20Open%20Web%20App-soul--sync--beta.vercel.app-1DB954?style=for-the-badge)](https://soul-sync-beta.vercel.app/)
&nbsp;&nbsp;
[![Download APK](https://img.shields.io/badge/📱%20Download%20APK-Android%205.2%20MB-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/itslokeshx/SoulSync/releases/latest/download/SoulSync.apk)

<sub>Android 7.0+ required &nbsp;·&nbsp; No Play Store needed &nbsp;·&nbsp; <a href="https://github.com/itslokeshx/SoulSync/releases">All Releases</a></sub>

<br/>

> 🎉 **v2.0 is here** — World-class search that always shows originals first, a YT Music–style 3×3 dashboard, zero-friction offline for APK, song & playlist sharing (no account to play), universal playlist import, artist & album pages, and 10 critical bug fixes.

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

[What's New in v2.0](#-whats-new-in-v20) · [Features](#-features) · [Android APK](#-android-apk) · [vs Spotify](#-soulsync-vs-spotify) · [AI Engine](#-ai-engine) · [SoulLink](#-soullink--listen-together) · [Tech Stack](#-tech-stack) · [Architecture](#-architecture) · [Setup](#-getting-started) · [Deploy](#-deployment) · [API Docs](#-api-reference)

</div>

<br/>

---

## 🎉 What's New in v2.0

> _The biggest update since launch. Everything that was broken is fixed. Everything good is now great._

<details open>
<summary><strong>🔍 Intelligent Search — Originals Always #1</strong></summary>

<br/>

The old search showed "Killer Shape by Pavvy Sidhu" when you searched "shape of you". That's completely gone.

v2.0 ships a brand-new **7-factor intelligent ranking engine** that mirrors how Spotify and YouTube Music surface results:

| Signal                  | Weight                    | What it does                                              |
| ----------------------- | ------------------------- | --------------------------------------------------------- |
| **Play count**          | Dominant (0–80 pts)       | Ed Sheeran (2.1B plays) always beats any cover (5K plays) |
| **Cover penalty**       | Hard (−100 pts)           | "recreation", "cover", "karaoke", "tribute" = buried      |
| **Title match**         | Strong (0–50 pts)         | Exact phrase ranks above partial word overlap             |
| **Artist match**        | Medium (0–20 pts)         | Queried artist name boosts their own songs                |
| **Original markers**    | Bonus (+15 pts)           | "official audio", "official video" boosted                |
| **Language preference** | Soft (+10 pts)            | Your preferred language surfaces first                    |
| **Stream URL check**    | Required (−50 if missing) | Unplayable songs automatically buried                     |

**Other search improvements in v2.0:**

- Returns **50 songs** per search (up from 20) for much better recall
- **Artists section** — search "anirudh" → artist profile card appears above songs
- **Albums section** — search "varisu" → album card with full tracklist
- **Deduplication** — same song appearing from multiple API calls merged, keeping highest play-count version
- **Two-call parallel strategy** — `/search/songs` (depth) + `/search` (artists + albums) in parallel, merged together
- **API wrapper fixed** — now uses `saavn.sumit.co/api` exclusively with correct `.url` field (not `.link`)
- Backend env variable fixed (`JIOSAAVN_API` not `VITE_JIOSAAVN_API` which was always `undefined` on the server)
- **10-minute Redis cache** on all search results

</details>

<details open>
<summary><strong>📱 YT Music Dashboard — 3×3 Quick Play Grid</strong></summary>

<br/>

The home screen is completely rebuilt from scratch in YouTube Music style:

```
┌─────────────────────────────────────┐
│  Good evening, Lokesh          👤   │  ← Personalised greeting (morning/afternoon/evening/night)
├─────────────────────────────────────┤
│  😢 Sad  🎉 Party  😌 Chill  💪 ...│  ← Mood chips (8 moods, horizontal scroll)
├─────────────────────────────────────┤
│  Jump Back In │ Made For You │ Night │  ← 3 swipeable slide tabs
│  ┌────────┐  ┌────────┐  ┌────────┐ │
│  │ Song 1 │  │ Song 2 │  │ Song 3 │ │  ← 3×3 album art grid
│  ├────────┤  ├────────┤  ├────────┤ │
│  │ Song 4 │  │ Song 5 │  │ Song 6 │ │
│  ├────────┤  ├────────┤  ├────────┤ │
│  │ Song 7 │  │ Song 8 │  │ Song 9 │ │
│  └────────┘  └────────┘  └────────┘ │
│  ● ○ ○  (slide indicator dots)      │
├─────────────────────────────────────┤
│  Recently Played          See all → │
│  ══ ══ ══ ══ ══ (horizontal scroll) │
├─────────────────────────────────────┤
│  Trending Tamil           See all → │
└─────────────────────────────────────┘
```

- **3 slides**: Jump Back In / Made For You / Time-based (Morning Fresh, Afternoon Mix, Evening Chill, Night Mode)
- **Mood chips**: Sad, Party, Chill, Workout, Romance, Night, Morning, Melody — one tap to instant search
- **Fully personalised**: Built dynamically from listening history, language preferences, and time of day
- **Guest mode**: Trending + New Releases + Mood Grid shown with no login at all
- **Skeleton loading**: Shimmer placeholders matching the exact grid shape while data loads
- **Now playing bars**: Animated equalizer bars overlay the currently playing song's card
- `NetworkProvider` — the whole app now knows online/offline state from one source

</details>

<details open>
<summary><strong>📡 Instant Offline — Zero Friction (APK)</strong></summary>

<br/>

The old APK showed a login screen when you opened it without internet. v2.0 removes that completely.

**Before v2.0:** App opens → login screen appears → stuck, can't play anything offline without logging in first.

**v2.0 behaviour:**

```
APK opens with no internet
    ↓
App opens normally — NO login screen, NO blocking screen
Subtle yellow bar at top: "Offline — downloaded songs available"
Downloads tab highlighted automatically
User plays their downloaded songs as normal
    ↓
Internet comes back
    ↓
🟢 "Back online" green pill toast (3 seconds, bottom of screen)
App switches seamlessly — no reload, no interruption
```

- `NetworkProvider` wraps the entire app — no more scattered online/offline checks
- Works on APK (Capacitor Network plugin) and web (browser online/offline events)
- Downloads page fully redesigned: Shuffle All + Play All buttons, sort by Recent/A→Z/Artist/Size, search within downloads, swipe left to delete (with red trash reveal)

</details>

<details open>
<summary><strong>🔗 World-Class Song & Playlist Sharing</strong></summary>

<br/>

Share any song or playlist. Anyone who receives the link can open it and **play it instantly — no account needed**.

**Share link formats:**

- Song: `soul-sync-beta.vercel.app/s/:slug`
- Playlist: `soul-sync-beta.vercel.app/p/:slug`

**What the share page shows:**

- Full-screen beautiful preview — dominant colour from album art as animated background gradient
- Song plays automatically on page open (zero friction for the recipient)
- WhatsApp / X / native OS share sheet buttons
- Rich OG meta tags — beautiful preview cards in WhatsApp, iMessage, Telegram
- "Open in SoulSync" deep link button for users who have the app
- For playlists: full track list shown, every song playable by guests

**Where you can share from:**

- Full player — share icon in the header
- Song context menu (three-dot) — "Share Song" option
- Playlist page header — share icon
- Works on both web and APK (native share sheet on APK)

**How it works under the hood:** A short slug (nanoid) is created and stored in MongoDB with the song or playlist data. Share links never expire. Stream URLs are automatically refreshed when served if they've aged out.

</details>

<details open>
<summary><strong>📥 Universal Playlist Import — No API Keys</strong></summary>

<br/>

Import playlists from any platform without OAuth, API keys, or any login:

| Platform          | Method                       | Notes                 |
| ----------------- | ---------------------------- | --------------------- |
| **Spotify**       | HTML scrape + JSON-LD        | Public playlists only |
| **YouTube Music** | innertube API (free, no key) | Public playlists      |
| **Apple Music**   | schema.org JSON-LD scrape    | Public playlists      |
| **Gaana**         | Public apiv2 endpoint        | Public playlists      |
| **Text / CSV**    | Paste song names directly    | Any format            |

All imports feed into the **AI Playlist Builder** — Groq matches your imported songs on JioSaavn automatically.

</details>

<details open>
<summary><strong>🎨 Artist & Album Pages</strong></summary>

<br/>

- **Artist Page** (`/artist/:id`) — profile photo, bio, top songs sorted by popularity, discography
- **Album Page** (`/album/:id`) — album art, full tracklist with duration, year, label
- Both accessible from search results, song context menus, and the share page
- Artist songs fetched with `sortBy=popularity&sortOrder=desc` — always best songs first

</details>

<details open>
<summary><strong>🐛 10 Critical Bug Fixes</strong></summary>

<br/>

| #   | Bug                                       | Root Cause                                                         | Fix                                                                 |
| --- | ----------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | **Seek slider did nothing**               | `handleSeek` wasn't writing to `audioRef`                          | Now directly sets `audioRef.current.currentTime`                    |
| 2   | **Liked songs played silence**            | Raw API response passed to player without normalization            | All songs run through `normalizeSong()` before `loadAndPlay()`      |
| 3   | **Playlist songs played silence**         | Same normalization miss + expired stream URLs                      | `normalizeSong()` fix + backend batch-refreshes URLs before serving |
| 4   | **Downloads didn't play on APK**          | Browser blob URLs don't work on native filesystem                  | `Capacitor.convertFileSrc()` used for native file URIs              |
| 5   | **SoulLink host/guest desync**            | `isHost` in state caused stale closures in socket listeners        | Moved to `useRef` — listeners always read current value             |
| 6   | **Share page song wouldn't start**        | No explicit `play()` call after setting `src`                      | Added explicit `audio.play()` with URL fallback chain               |
| 7   | **Full player minimize broke navigation** | `navigate(-1)` popped the route stack                              | Replaced with `setPlayerExpanded(false)`                            |
| 8   | **Songs paused randomly mid-playback**    | Missing audio event guards                                         | `onPause`/`onPlay`/`onError` handlers added to audio element        |
| 9   | **APK share URLs were wrong**             | `window.location.origin` returns `capacitor://localhost` on native | `getBaseUrl()` now reads `VITE_FRONTEND_URL` env var on APK         |
| 10  | **Covers ranked above originals**         | Search sorted by text relevance only — no play count               | 7-factor ranker with `playCount` as dominant signal                 |

</details>

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
5. Open SoulSync
```

> **Requires:** Android 7.0 (API 24) or higher

### APK-Exclusive Features

| Feature                        | Description                                               |
| ------------------------------ | --------------------------------------------------------- |
| **Instant offline (v2.0)**     | Opens directly into app with no login screen when offline |
| **Offline without login**      | Play downloaded songs even with no account — APK only     |
| **Native file storage**        | Songs saved to device storage via `@capacitor/filesystem` |
| **Lock screen controls**       | Play, pause, skip from Android lock screen                |
| **Now Playing notification**   | Persistent media notification with full controls          |
| **Background audio**           | Music keeps playing when app is minimized                 |
| **Haptic feedback**            | Every tap, like, skip, seek feels native and satisfying   |
| **Native Google Sign-In**      | Bottom sheet sign-in, no popup, fully native              |
| **Native share sheet**         | Share songs via any installed app (v2.0)                  |
| **Back button handling**       | Back → minimize app (never accidentally exits)            |
| **Status bar theming**         | Matches app's dark `#060606` theme                        |
| **Custom splash screen**       | Branded dark splash on every launch                       |
| **Swipe-up player**            | Swipe up from mini player → full screen immersive view    |
| **Swipe-down minimize (v2.0)** | Drag down on full player → collapses to mini bar          |

### APK vs Web — Key Differences

| Behavior                 | 🤖 Android APK           | 🌐 Web App            |
| ------------------------ | ------------------------ | --------------------- |
| **Offline + no login**   | ✅ Opens directly (v2.0) | ❌ Redirects to login |
| **Audio storage**        | Native filesystem        | IndexedDB             |
| **Lock screen controls** | ✅ Full native controls  | ✅ Media Session API  |
| **Background playback**  | ✅ Foreground service    | ✅ Tab stays active   |
| **Google Sign-In**       | Native bottom sheet      | OAuth popup           |
| **Haptic feedback**      | ✅ Full haptics          | ❌ Not available      |
| **Share sheet**          | ✅ Native OS share       | ✅ Web Share API      |
| **Install**              | APK / Play Store         | Browser bookmark      |
| **Updates**              | Manual / Store           | Instant on deploy     |

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
# Build → Generate Signed Bundle / APK → APK → Release

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

<!-- Background audio -->
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

| Feature                       |            SoulSync             |   Spotify Free    |  Spotify Premium  |
| ----------------------------- | :-----------------------------: | :---------------: | :---------------: |
| **Ad-free listening**         |            ✅ Always            | ❌ Ads every song |      ✅ Paid      |
| **AI Playlist Builder**       |       ✅ Free, unlimited        | ❌ Not available  | ❌ Not available  |
| **Listen Together (Duo)**     |     ✅ Free + built-in chat     | ❌ Not available  | ✅ Paid, no chat  |
| **Song Downloads**            |     ✅ Free, stored locally     | ❌ Not available  |   ✅ Paid only    |
| **Intelligent Search (v2.0)** | ✅ Originals-first, 50 results  |  ❌ Keyword only  |  ❌ Keyword only  |
| **Artist + Album in Search**  |    ✅ Unified results (v2.0)    | ✅ Separate tabs  | ✅ Separate tabs  |
| **Song & Playlist Sharing**   |  ✅ No account to play (v2.0)   | ✅ Account needed | ✅ Account needed |
| **Playlist Import**           | ✅ From Spotify/YT/Apple (v2.0) | ❌ Not available  | ❌ Not available  |
| **YT Music Dashboard**        |       ✅ 3×3 grid (v2.0)        |    ❌ Generic     |  ✅ Algorithmic   |
| **In-session Chat**           |           ✅ Built-in           | ❌ Not available  | ❌ Not available  |
| **Offline Playback**          |             ✅ Free             | ❌ Not available  |      ✅ Paid      |
| **Offline without login**     |     ✅ APK exclusive (v2.0)     |       ❌ No       |       ❌ No       |
| **Indian Language Support**   |        ✅ 10+ languages         | ❌ Poor regional  | ❌ Poor regional  |
| **BGM / Instrumental Search** |        ✅ Auto-detected         |       ❌ No       |       ❌ No       |
| **Import Local Files**        |       ✅ MP3/WAV/FLAC/AAC       |       ❌ No       |       ❌ No       |
| **Lock Screen Controls**      |         ✅ Native + Web         |     ✅ Native     |     ✅ Native     |
| **Open Source**               |         ✅ MIT License          |     ❌ Closed     |     ❌ Closed     |
| **Monthly Price**             |         **₹0 forever**          |    ₹0 with ads    |  **₹119/month**   |

</div>

<br/>

---

## ✨ Features

<details>
<summary><strong>🔐 Authentication & Onboarding</strong></summary>

<br/>

| Feature               | Web                                                      | APK                                             |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| **Google OAuth 2.0**  | Popup via `@react-oauth/google`                          | Native bottom sheet via `capacitor-google-auth` |
| **JWT Sessions**      | httpOnly secure cookies, 7-day expiry                    | Same — backend issues identical tokens          |
| **Guided Onboarding** | 4-step animated wizard — languages → eras → moods → name | Same UI                                         |
| **Protected Routes**  | Redirects to `/login` if unauthenticated                 | Opens directly into app offline (v2.0)          |
| **User Profiles**     | Google photo, editable name, preference tags             | Same + cached locally for offline display       |

</details>

<details>
<summary><strong>🔍 Intelligent Search (v2.0 — Complete Rebuild)</strong></summary>

<br/>

| Feature                    | Description                                                                     |
| -------------------------- | ------------------------------------------------------------------------------- |
| **50 results per search**  | Up from 20 — deeper recall, fewer misses                                        |
| **Originals always first** | 7-factor ranker: Ed Sheeran above any cover, guaranteed                         |
| **Cover penalty (hard)**   | −100 pts for "recreation", "cover", "karaoke", "tribute", "unofficial" in title |
| **Soft quality penalty**   | −20 pts for "lofi", "slowed", "reverb", "8D audio", "sped up"                   |
| **Play-count ranking**     | 2.1B-play song always outranks a 5K-play cover — no exceptions                  |
| **Artists section**        | Artist card with profile image shown above songs in results                     |
| **Albums section**         | Album card with full tracklist in results                                       |
| **Deduplication**          | Same song from parallel queries merged, keeping highest play count              |
| **Two-call parallel**      | `/search/songs?limit=50` + `/search` called together, results merged            |
| **Stream URL required**    | Songs without working URLs scored −50 and buried                                |
| **Redis cache (10 min)**   | Repeat searches return in under 50ms                                            |

</details>

<details>
<summary><strong>🏠 Personalized Dashboard (v2.0 — YT Music Style)</strong></summary>

<br/>

| Section                  | Description                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **3×3 Quick Play Grid**  | YouTube Music-style swipeable grid — 3 slides × 9 songs each                        |
| **Jump Back In**         | Your 9 most recently played songs                                                   |
| **Made For You**         | AI-recommended from your listening history                                          |
| **Time-Based Mix**       | Morning Fresh / Afternoon Mix / Evening Chill / Night Mode                          |
| **Mood Chips**           | Sad, Party, Chill, Workout, Romance, Night, Morning, Melody — tap to instant search |
| **Recently Played**      | Horizontal scroll row, 20 songs                                                     |
| **Trending by Language** | Top songs in your preferred language                                                |
| **Artist Spotlight**     | Your most-played artist with their top tracks                                       |
| **Guest Dashboard**      | Trending + New Releases + Mood Grid (no login required)                             |
| **Skeleton Loading**     | Shimmer placeholders matching exact grid shape                                      |
| **NetworkProvider**      | Single source of truth for online/offline state across entire app                   |

</details>

<details>
<summary><strong>🔗 Song & Playlist Sharing (v2.0 — New)</strong></summary>

<br/>

| Feature                    | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| **Song share link**        | `soul-sync-beta.vercel.app/s/:slug` — plays without account   |
| **Playlist share link**    | `soul-sync-beta.vercel.app/p/:slug` — full playlist, no login |
| **Beautiful preview page** | Dominant colour gradient, album art, plays instantly          |
| **OG meta tags**           | Rich card previews in WhatsApp, iMessage, Telegram            |
| **WhatsApp / X / native**  | Share to any platform or OS share sheet                       |
| **"Open in SoulSync"**     | Deep link for users who have the app installed                |
| **Entry points**           | Full player header · song context menu · playlist page header |
| **Never expires**          | Stored permanently in MongoDB                                 |
| **Auto URL refresh**       | Expired stream URLs refreshed on-demand when share is opened  |

</details>

<details>
<summary><strong>📥 Universal Playlist Import (v2.0 — New)</strong></summary>

<br/>

Import from Spotify, YouTube Music, Apple Music, Gaana, or plain text — zero API keys, zero logins required. All imports feed into the AI Playlist Builder for matching.

| Platform          | Method                | Requirement           |
| ----------------- | --------------------- | --------------------- |
| **Spotify**       | HTML scrape + JSON-LD | Public playlists only |
| **YouTube Music** | innertube API         | Free, no key needed   |
| **Apple Music**   | schema.org JSON-LD    | Public playlists      |
| **Gaana**         | Public apiv2          | Public playlists      |
| **Text / CSV**    | Paste song names      | Any format            |

</details>

<details>
<summary><strong>🎨 Artist & Album Pages (v2.0 — New)</strong></summary>

<br/>

- **Artist Page** — profile, top songs sorted by popularity, discography scroll
- **Album Page** — art, tracklist with duration + year, play all button
- Accessible from search results, song context menus, share pages
- Artist songs: `sortBy=popularity&sortOrder=desc` — always best first

</details>

<details>
<summary><strong>✈️ Offline Mode (v2.0 — Upgraded)</strong></summary>

<br/>

| Scenario                    | Web                              | APK                              |
| --------------------------- | -------------------------------- | -------------------------------- |
| Online + logged in          | Full access                      | Full access                      |
| Online + not logged in      | → Login required                 | → Login required                 |
| Offline + logged in         | Offline library (downloads only) | Offline library (downloads only) |
| **Offline + not logged in** | ❌ → Login page                  | ✅ → App opens directly (v2.0)   |

**Offline experience:**

- Subtle yellow bar: "Offline — downloaded songs available"
- Downloads tab highlighted automatically
- Only downloaded songs are playable
- Liked songs served from local cache
- Auto-enters offline mode when network drops
- "Back online" green pill toast on reconnect (3 seconds, bottom)
- No reload required on reconnect

**Downloads page (v2.0 redesigned):**

- Shuffle All + Play All action buttons
- Sort by Recent / A→Z / Artist / Size
- Search within downloaded songs
- Swipe left to delete (red trash revealed)
- File size shown per song

</details>

<details>
<summary><strong>🎵 Core Music Experience</strong></summary>

<br/>

| Feature                 | Description                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| **Millions of Songs**   | Full streaming via JioSaavn across 10+ Indian languages & English                     |
| **NLP Smart Search**    | Understands artists, moods, languages, eras, movies (e.g. _"sad anirudh 2024"_)       |
| **Search Enhancer**     | 500+ artist dictionary, mood tokenization, language detection, intent classification  |
| **HQ Playback**         | Auto-selects 320kbps → 160kbps → 96kbps based on availability                         |
| **Queue Management**    | View, reorder, add next/last, shuffle, auto-fill recommendations                      |
| **Shuffle & Repeat**    | Shuffle, repeat-one, repeat-all, repeat-off                                           |
| **Now Playing View**    | Full-screen immersive — dynamic art gradient, vinyl spin animation                    |
| **Context Menu**        | Right-click / long-press: Play, Queue, Playlist, Like, Download, Share, Artist, Album |
| **Keyboard Shortcuts**  | Space (play/pause), arrows (seek/volume), M (mute), S (shuffle), R (repeat)           |
| **Dynamic Backgrounds** | Album art dominant colour extraction for gradient overlays                            |

</details>

<details>
<summary><strong>📱 Mobile Player</strong></summary>

<br/>

| Component                  | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| **Mini Player Bar**        | 64px bar above bottom nav — art + title + play/pause/next              |
| **Swipe Up → Full Screen** | Spring animation expands to immersive full-screen player               |
| **Swipe Down → Minimize**  | Drag down on full player → collapses to mini bar (v2.0 fixed)          |
| **Full Screen Player**     | 300×300 breathing album art, progress bar, all controls, volume slider |
| **Seek +/- 10s**           | Double-tap left/right side of player                                   |
| **Bottom Sheet Queue**     | Slides up from bottom — drag handle, reorder, swipe-to-delete          |
| **Share from Player**      | Share icon in full player header (v2.0)                                |
| **Haptic Controls**        | Every tap, like, seek, skip — native haptic feedback (APK)             |

</details>

<details>
<summary><strong>🤖 AI-Powered Playlists</strong></summary>

<br/>

| Feature                   | Description                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Mood-Based Generation** | Describe a vibe → Groq generates 15 matching songs with a creative playlist name |
| **Song List Mode**        | Paste song names → AI optimizes queries and matches from JioSaavn                |
| **Smart Matching**        | Confidence scoring (high / partial / none) with relevance-based ranking          |
| **Multi-Key Rotation**    | Up to 5 Groq API keys with round-robin, rate-limit detection, auto fallback      |
| **Result Caching**        | AI responses cached in Redis for 30 min                                          |
| **One-Click Save**        | Review matches, deselect unwanted, save to library                               |

</details>

<details>
<summary><strong>🎧 SoulLink — Listen Together</strong></summary>

<br/>

Create a room → share the 6-character code → play, pause, seek, skip — everything syncs in real time. Chat overlay built in. Beautiful session recap card on end. Powered by Socket.io rooms with heartbeat + disconnect cleanup.

</details>

<details>
<summary><strong>📚 Library & Playlists</strong></summary>

<br/>

Cloud playlists · AI playlists · Import from any platform (v2.0) · Liked songs with offline cache · Recently played (20 songs) · Listening history (90-day TTL) · Drag-reorder · Share button (v2.0)

</details>

<details>
<summary><strong>👤 Profile & Stats</strong></summary>

<br/>

| Feature                | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| **Profile Page**       | Google avatar, editable name, preference tags            |
| **Listening Stats**    | Total songs played, total hours, liked count             |
| **Top Artists**        | Aggregated from history with play counts + album art     |
| **Language Breakdown** | Listening distribution by language                       |
| **Edit Preferences**   | Change languages/eras/moods — triggers dashboard rebuild |

</details>

<br/>

---

## 🤖 AI Engine

<div align="center">

```
   ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
   │   User Input     │          │   Groq Cloud     │          │  saavn.sumit.co  │
   │                  │          │                  │          │  (v2.0 wrapper)  │
   │  "chill tamil    │──REST──▶│  LLaMA 3.3 70B   │          │  Search + Rank   │
   │   late night"    │          │  Multi-Key Mgr   │          │  7-Factor Engine │
   └──────────────────┘          └────────┬─────────┘          └────────▲─────────┘
                                          │                             │
                                          ▼                             │
                                 ┌──────────────────┐                   │
                                 │  Search Engine   │───────────────────┘
                                 │                  │
                                 │  ▸ 500+ Artists  │
                                 │  ▸ Mood Tokens   │
                                 │  ▸ Language NLP  │
                                 │  ▸ Intent Class. │
                                 │  ▸ Cover Filter  │
                                 │  ▸ Play Count    │
                                 │  ▸ Dedup Engine  │
                                 └──────────────────┘
```

</div>

1. **Groq LLM** — generates optimized search queries from natural language or pasted song lists
2. **Search Engine** — NLP pipeline: 500+ artist dictionary, 50+ mood tokens, language detection, multi-query expansion
3. **7-Factor Ranker** — play count (dominant) + cover penalty + title match + artist match + original markers + language + stream URL check
4. **Deduplication** — same song from parallel calls merged, keeping highest play-count version
5. **Caching** — Redis: search 10 min, AI 30 min, dashboard 30 min

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
| 📱  | Capacitor 8.1    |
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

> **One backend for everything** — the Render-hosted Express server powers both the web app and Android APK. Same API endpoints, same JWT auth, same MongoDB, same Socket.io.

<br/>

---

## 🏗 Architecture

```
┌──────────────────── WEB BROWSER ───────────────────┐  ┌────────── ANDROID APK ──────────────┐
│                                                    │  │                                     │
│  Auth → Zustand → Router → IndexedDB → Socket.io  │  │  Auth → Zustand → Router →          │
│  NetworkProvider (v2.0)                            │  │  Capacitor Filesystem → Socket.io   │
│                                                    │  │  NetworkProvider (v2.0)             │
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
                         │  /dashboard  /share  /import    │  ← v2.0 new routes
                         │                                 │
                         │  MongoDB Atlas  ·  Redis Cache  │
                         │  Groq AI  ·  saavn.sumit.co     │  ← v2.0: wrapper API
                         └─────────────────────────────────┘
```

<details>
<summary><strong>Data Models (v2.0 additions)</strong></summary>

<br/>

| Model                | Key Fields                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **User**             | googleId, email, name, photo, preferences (languages/eras/moods), likedSongs[], totalListeningTime |
| **Playlist**         | userId, name, description, songs[], isPublic, isAIGenerated, tags[], songCount, totalDuration      |
| **ListeningHistory** | userId, songId, title, artist, source, 90-day TTL                                                  |
| **DuoSession**       | host/guest, roomCode, currentSong, playState, messages[]                                           |
| **Share** _(v2.0)_   | slug (nanoid), type (song/playlist), data, createdAt, viewCount                                    |
| **Import** _(v2.0)_  | userId, sourceUrl, platform, songs[], status, createdAt                                            |

</details>

<details>
<summary><strong>Zustand Stores</strong></summary>

<br/>

| Store          | Manages                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `playerStore`  | Current song, play/pause, time, volume, shuffle, repeat, isExpanded                                 |
| `queueStore`   | Song queue, history, add/remove/reorder                                                             |
| `searchStore`  | Search query, results (songs + artists + albums), filters                                           |
| `uiStore`      | UI toggles — queue panel, now playing, context menu                                                 |
| `duoStore`     | SoulLink session state + sessionStorage persistence                                                 |
| `offlineStore` | Downloaded songs, offline mode flag, cached user — Capacitor Preferences (APK) / localStorage (web) |

</details>

<br/>

---

## 📁 Project Structure

<details>
<summary><strong>Click to expand full project tree</strong></summary>

<br/>

```
SoulSync/
├── package.json
├── vercel.json
├── render.yaml
│
├── frontend/
│   ├── capacitor.config.ts
│   ├── android/
│   └── src/
│       ├── providers/
│       │   └── NetworkProvider.tsx        ← NEW v2.0 — app-wide online/offline state
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx              ← REBUILT v2.0 — YT Music 3×3 grid
│       │   ├── SearchPage.tsx             ← REBUILT v2.0 — 50 songs + artists + albums
│       │   ├── ArtistPage.tsx             ← NEW v2.0
│       │   ├── AlbumPage.tsx              ← NEW v2.0
│       │   ├── SharePage.tsx              ← NEW v2.0 — share link web player
│       │   ├── Downloads.tsx              ← REBUILT v2.0 — sort/search/swipe-delete
│       │   └── [others unchanged]
│       │
│       ├── components/
│       │   ├── dashboard/
│       │   │   ├── QuickPlaySlider.tsx    ← NEW v2.0 — 3×3 grid + slide tabs + dots
│       │   │   ├── HorizontalSection.tsx  ← NEW v2.0
│       │   │   ├── DashboardHeader.tsx    ← NEW v2.0 — greeting + mood chips
│       │   │   └── MoodChips.tsx          ← NEW v2.0
│       │   │
│       │   ├── share/
│       │   │   └── ShareButtons.tsx       ← NEW v2.0
│       │   │
│       │   └── player/
│       │       ├── MobilePlayerFull.tsx   ← FIXED v2.0 — swipe-down, minimize
│       │       └── AudioEngine.tsx        ← FIXED v2.0 — URL decode, event guards
│       │
│       └── utils/
│           ├── normalizeSong.ts           ← REBUILT v2.0 — handles all API shapes
│           └── platform.ts               ← getBaseUrl() for APK/web
│
└── backend/
    └── src/
        ├── routes/
        │   ├── search.ts                  ← REBUILT v2.0 — parallel fetch + ranker
        │   ├── dashboard.ts               ← REBUILT v2.0 — 3-slide grid sections
        │   ├── share.ts                   ← NEW v2.0
        │   └── import.ts                  ← NEW v2.0
        │
        └── services/
            ├── jiosaavn.ts                ← REBUILT v2.0 — saavn.sumit.co wrapper
            ├── searchRanker.ts            ← NEW v2.0 — 7-factor ranking engine
            └── queryBuilder.ts            ← NEW v2.0 — intelligent query expansion
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
| Android Studio | Latest              | APK builds only        |
| Java JDK       | 17+                 | APK builds only        |
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

# Open http://localhost:5173 🎶
```

<details>
<summary><strong>Environment Variables Reference</strong></summary>

<br/>

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

> ⚠️ **v2.0 critical**: `JIOSAAVN_API` (no `VITE_` prefix) must be set in backend `.env` separately. The `VITE_` prefix only works in the frontend bundle and is always `undefined` on the server.

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
3. Set env vars (add `VITE_FRONTEND_URL`)
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
6. Set `JIOSAAVN_API` env var

</td>
<td width="33%">

### APK → GitHub Releases

1. Build signed APK in Android Studio
2. GitHub → Releases → New Release
3. Upload `app-release.apk`
4. Tag: `v2.0.0`
5. Users download directly ✅

</td>
</tr>
</table>

<br/>

---

## 🎨 Design System

<details>
<summary><strong>Color Palette</strong></summary>

<br/>

| Token            | Hex                      | Usage                          |
| ---------------- | ------------------------ | ------------------------------ |
| `sp-black`       | `#000000`                | True black backgrounds         |
| `sp-dark`        | `#060606`                | App background + splash screen |
| `sp-card`        | `#141414`                | Card surfaces + bottom sheets  |
| `sp-hover`       | `#1c1c1c`                | Hover / press states           |
| `sp-green`       | `#1db954`                | Primary accent, active states  |
| `sp-green-light` | `#1ed760`                | Hover accent                   |
| `sp-sub`         | `#a0a0a0`                | Secondary / subtitle text      |
| `sp-glass`       | `rgba(255,255,255,0.04)` | Glassmorphism                  |
| `sp-accent`      | `#6366f1`                | AI features                    |
| `sp-rose`        | `#f43f5e`                | Heart/like, destructive        |
| `sp-amber`       | `#f59e0b`                | Offline mode indicators (v2.0) |

</details>

<details>
<summary><strong>Haptic Feedback Map (APK)</strong></summary>

<br/>

| Interaction       | Haptic Type                |
| ----------------- | -------------------------- |
| Song card tap     | `ImpactStyle.Light`        |
| Play / Pause      | `ImpactStyle.Medium`       |
| Like button       | `NotificationType.Success` |
| Download complete | `NotificationType.Success` |
| Download error    | `NotificationType.Error`   |
| Shuffle toggle    | `ImpactStyle.Light`        |
| Queue drag start  | `ImpactStyle.Light`        |
| Song delete       | `ImpactStyle.Heavy`        |
| Bottom sheet snap | `ImpactStyle.Light`        |
| Tab bar press     | `SelectionChanged`         |
| Seek scrub (10s)  | `ImpactStyle.Light`        |

</details>

<details>
<summary><strong>Animations (v2.0 additions)</strong></summary>

<br/>

| Animation      | Duration     | Usage                               |
| -------------- | ------------ | ----------------------------------- |
| `eq1–eq5`      | 0.75s        | Staggered equalizer bars            |
| `musicBar`     | 0.8s         | Now playing bars in 3×3 grid (v2.0) |
| `shimmer`      | 1.6s         | Skeleton loading (grid-matched)     |
| `fadeUp`       | 0.4s         | Content entrance                    |
| `slideInRight` | 0.3s         | Panel slide-in                      |
| `vinylSpin`    | 3s           | Now playing vinyl                   |
| `breathe`      | 4s           | Album art pulse in full player      |
| `playerExpand` | 400ms spring | Mini → full screen player           |
| `sheetSlide`   | 300ms spring | Queue bottom sheet                  |
| `glowPulse`    | 3s           | SoulLink live indicator             |

</details>

<br/>

---

## ⚡ Performance

| Optimization                     | Impact                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| **7-Factor Search Ranker**       | Originals always #1 — zero manual curation needed             |
| **Parallel API calls**           | `/search/songs` + `/search` same latency, 2× data coverage    |
| **Redis Search Cache**           | 10-minute TTL — repeat searches under 50ms                    |
| **Redis Dashboard Cache**        | 30-minute TTL — dashboard under 100ms on repeat visits        |
| **Redis AI Cache**               | 30-minute TTL — no duplicate Groq calls                       |
| **Deduplication engine**         | Same song from parallel queries → one entry, best play count  |
| **Debounced Search**             | 200ms delay, AbortController cancels stale requests instantly |
| **Batched AI Searches**          | 5 concurrent JioSaavn requests per batch                      |
| **Lazy Queue Fill**              | Recommendations fetched only when ≤1 song remains             |
| **Capacitor Preferences**        | Faster than localStorage on Android for offline store         |
| **`Capacitor.convertFileSrc()`** | Zero-copy audio playback from native filesystem               |
| **Skeleton Loaders**             | Grid-matched shimmer — no layout shift                        |
| **90-Day MongoDB TTL**           | History auto-expires via TTL index                            |
| **13-min keep-alive**            | Self-ping prevents Render cold starts                         |

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
| **Share Links**       | Read-only — slugs cannot modify any user data                          |

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
<summary><strong><code>/api/search</code> (v2.0)</strong></summary>

<br/>

| Method | Endpoint      | Params                     | Response                                    |
| ------ | ------------- | -------------------------- | ------------------------------------------- |
| `GET`  | `/`           | `?q=...&lang=...&limit=50` | `{ songs[50], artists[], albums[], query }` |
| `GET`  | `/artist/:id` | `?page=0`                  | `{ songs[], artistId }`                     |
| `GET`  | `/album/:id`  | —                          | `{ songs[], albumId }`                      |
| `GET`  | `/trending`   | `?language=tamil`          | `{ songs[], language }`                     |

</details>

<details>
<summary><strong><code>/api/share</code> (v2.0 — New)</strong></summary>

<br/>

| Method | Endpoint    | Auth | Body / Params    | Response                      |
| ------ | ----------- | ---- | ---------------- | ----------------------------- |
| `POST` | `/song`     | ✓    | `{ song }`       | `{ slug, url }`               |
| `POST` | `/playlist` | ✓    | `{ playlistId }` | `{ slug, url }`               |
| `GET`  | `/s/:slug`  | ✗    | —                | `{ type, song }`              |
| `GET`  | `/p/:slug`  | ✗    | —                | `{ type, playlist, songs[] }` |

</details>

<details>
<summary><strong><code>/api/import</code> (v2.0 — New)</strong></summary>

<br/>

| Method | Endpoint  | Auth | Body       | Response                |
| ------ | --------- | ---- | ---------- | ----------------------- |
| `POST` | `/detect` | ✓    | `{ url }`  | `{ platform, songs[] }` |
| `POST` | `/text`   | ✓    | `{ text }` | `{ songs[] }`           |

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

</details>

<details>
<summary><strong><code>/api/dashboard</code> (v2.0)</strong></summary>

<br/>

| Method | Endpoint | Auth | Response                                                                           |
| ------ | -------- | ---- | ---------------------------------------------------------------------------------- |
| `GET`  | `/`      | ✓    | `{ greeting, quickPlay[3][9], recentlyPlayed, madeForYou, timeSection, trending }` |
| `GET`  | `/guest` | ✗    | `{ quickPlay[3][9], trending, newReleases }`                                       |

</details>

<details>
<summary><strong><code>/api/user</code> · <code>/api/ai</code> · <code>/api/session</code></strong></summary>

<br/>

Unchanged from v1.0 — see the Render backend for full reference.

</details>

<br/>

---

## 🗺️ Roadmap

| Status | Feature                                                  | Platform |
| ------ | -------------------------------------------------------- | -------- |
| ✅     | Intelligent search — originals first, 50 results         | Both     |
| ✅     | YT Music 3×3 swipeable dashboard                         | Both     |
| ✅     | Instant offline — no login friction                      | APK      |
| ✅     | Song & playlist sharing — no account to play             | Both     |
| ✅     | Universal playlist import (Spotify/YT/Apple/Gaana)       | Both     |
| ✅     | Artist & album pages                                     | Both     |
| ✅     | 10 critical bug fixes (seek, playback, SoulLink, player) | Both     |
| 🟡     | Synced lyrics display                                    | Both     |
| 🟡     | Play Store submission                                    | Android  |
| 🟡     | PWA support + service worker                             | Web      |
| 🟡     | SoulLink emoji reactions                                 | Both     |
| 🟡     | Audio visualizer                                         | Both     |
| 🟡     | iOS support (Capacitor)                                  | iOS      |
| 🟡     | Cross-device session continuity                          | Both     |
| 🟡     | Multi-language UI (i18n)                                 | Both     |

<br/>

---

## 🤝 Contributing

```bash
git checkout -b feature/amazing-feature
git commit -m 'feat: add amazing feature'
git push origin feature/amazing-feature
# Open a Pull Request
```

<br/>

---

## 📄 License

Open source under the **[MIT License](LICENSE)**.

<br/>

---

## 📖 Credits

| API              | Repository                                                            | Implementation                              |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| **JioSaavn API** | [sumitkolhe/jiosaavn-api](https://github.com/sumitkolhe/jiosaavn-api) | Custom proxy + 7-factor intelligent ranker  |
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
