## Root cause (confirmed)

`PlayerProvider.tsx` uses a **hidden** YouTube IFrame-API player (`#youtube-audio-player`, `ytPlayerRef`, opacity 0.001) as the audible source for YouTube songs, with a pre-warmed `<audio>` element swapped in (unmuted) only on backgrounding. The swap (`syncEnginePlayback`) + intentional-pause suppression + drift-correction ticker is the fragile machinery.

**Critically, the premise holds:** the `<audio>` element already has a working, CORS-clean stream source. For every YouTube song, `song.streamUrl === ".../api/search/stream?id=<id>"` — a TS-backend proxy that pipes range-supported audio bytes from the Render origin (`backend/src/routes/search.ts:622-676`), set during normalization (`backend/src/services/youtubeMusicService.ts:163/282`). So making `<audio>` the sole source requires no backend or stream-URL changes.

### Architecture nuance the plan accounts for
There are **two** YouTube iframes, not one:
1. `PlayerProvider`'s **hidden** `ytPlayerRef` (`YT.Player`) — exists *only* as the audio engine (no display). **Fully removed.**
2. `NowPlayingView`'s **visible** `iframeRef` — separate `<iframe>`, rendered only in video mode, currently produces the sound in video mode. **Kept for display but forced always-muted**; audio in video mode comes from `<audio>` instead.

## Phase 1 — `<audio>` becomes the sole audio source (`PlayerProvider.tsx`)

**Remove entirely:**
- `loadYoutubeApi()`, the `onYouTubeIframeAPIReady`/`window.YT` globals, `apiLoadingPromise`, and the `<script>` injection.
- The YT.Player init effect (lines ~672-803): `onReady`/`onStateChange`/`onError`, the hidden `<div id="youtube-audio-player">` host, and the import-free `YT` usage.
- Refs: `ytPlayerRef`, `ytPlayerReadyRef`, `loadedYtVideoIdRef`, `pendingYtActionRef`, `handleEndedRef`, `isIntentionalIframePauseRef`, `isSwitchingEngineRef`.
- `syncEnginePlayback` (the entire background/foreground mute-unmute-swap) + its `visibilitychange` effect + all `[DIAG]` console.logs.
- The "Position Syncing Ticker" (drift corrector, ~277-294) — nothing to drift against.
- The "YouTube Background Player Command Sender" effect (~807-846) and the "Polling ticker for background YouTube playback" (~849-876) — both drove the dead hidden player.
- The "Local playback time ticker for Video Mode" (~615-628) — `<audio>.onTimeUpdate` now drives `currentTime` in all modes.
- `SILENT_MP3` constant (defined at line 32, never referenced — already dead).
- The "Foreground Resume Listener" that calls `ytPlayerRef.playVideo()` (~148-185) — replaced by a minimal no-op-safe guard (audio keeps playing across tab switches; no resume needed).

**Re-wire so `<audio>` owns YouTube playback (the key mechanism):**
- `handleTimeUpdate`, `handleLoadedMetadata`, `handlePlay`, `handlePause`, `handleError`, `handleEnded` currently all `if (isYouTube) return;` — **remove those early-returns** so the audio element's events flow into the store for YouTube songs too.
- Port the valuable `onError` logic (fallback search via `smartSearch` + auto-skip, currently inside the YT handler) into `handleError` so unplayable YouTube videos still recover.
- `handleEnded` repeat-one branch: drop the `ytPlayerRef` path; for YouTube songs use `audioRef.currentTime = 0; audioRef.play()`.
- `handleSeek` + `handleSeekRemoteRef`: remove `ytPlayerRef.seekTo`; seek only `audioRef` + store (+ `duo.syncSeek`). (Video-iframe seek on user drag is handled locally in `NowPlayingView`.)
- Volume effect (~571-580): remove the `ytPlayerRef.setVolume` branch; audio element only.
- Consolidated source-control effect (~411-518): collapse the `isVisibleVideo` muted/unmuted branch — `<audio>` is **always unmuted at full line volume** (`audioRef.volume = isMuted ? 0 : volume` handled by the volume effect), foreground and background identical, no visibility branch.

## Phase 1b — NowPlayingView video iframe becomes a muted visual follower (`NowPlayingView.tsx`)
- Add `mute=1` to the embed URL (`src=...&autoplay=1&mute=1&...`) so it can **never** produce sound. Remove the volume/mute `postMessage` effect (~337-349).
- Keep: `playVideo`/`pauseVideo` postMessage on `isPlaying` (~327-335) and `seekTo` postMessage in local `handleSeek` (~439-444) — iframe follows the store, which is now driven by `<audio>`.
- Remove the `infoDelivery`/`initialDelivery` message listener (~274-324) that writes `currentTime`/`duration`/`isPlaying`/ended back to the store — that was the iframe driving the store (the reverse direction the prompt calls out). `<audio>` owns all of that now; the iframe only follows.

## Phase 2 — Media Session (verify, no change expected)
`registerMediaControls` callbacks (`onPlay`/`onPause`/`onSeek`/...) act on the **store** and (via `handleSeek`) on `audioRef` — never on the iframe. `updateMediaMetadata` sets `navigator.mediaSession.metadata` from `currentSong` and reads position/duration from `document.querySelector("audio")`. Already fully decoupled from the iframe. Confirm only.

## Phase 3 — Native Android (verify, no change expected)
`MediaPlaybackService.java` / `MusicControlsPlugin.java` render notification metadata pushed via `updateNotification` and forward button presses as JS events; they are independent of the web iframe/swap. `initBackgroundAudio` (`lifecycle.ts`) only refreshes the native notification on `appStateChange` — keeps its purpose, stays. Confirm only; report any unexpected coupling before touching native code.

## Phase 4 — Verification
What I **can** run here: `npm run build` (or `tsc --noEmit`) in `frontend/` to prove the refactor compiles with no dangling references to removed symbols, and grep to confirm zero remaining `ytPlayerRef`/`YT.Player`/`syncEnginePlayback`/`SILENT_MP3` references.

What I **cannot** run here (will be reported honestly as "not executed by me" with a precise checklist for you): desktop tab-switch (30s+), mobile-web lock-screen + Media Session controls, native APK background, and video-mode-while-backgrounding. I won't claim these passed.

## Phase 5 — Cleanup
- `SILENT_MP3`: removed (Phase 1) — was already unused.
- `initBackgroundAudio`: kept — still serves the native notification refresh; not coupled to the swap.

## Style
Match existing section-banner comment style; add no verbose new comments. Strip all `[DIAG]` debug logging added during the swap experiments.

## Net effect
- **What's removed:** hidden YT IFrame-API player + API loader + all swap/drift/intentional-pause machinery + dead `SILENT_MP3` + DIAG logs (~400+ lines deleted from `PlayerProvider.tsx`).
- **What plays audio in every mode:** the single `<audio>` element (`audioRef`), fed by `song.streamUrl` (`/api/search/stream` proxy) for YouTube and blob/downloadUrl for offline — identical path foreground, background, and video mode; native APK unchanged (WebView `<audio>` + existing foreground service).

Files touched: `frontend/src/providers/PlayerProvider.tsx`, `frontend/src/components/player/NowPlayingView.tsx`. No backend, store, or native changes.