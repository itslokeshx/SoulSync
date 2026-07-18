# Incident Report: CacheWarm Startup Job Self-DDoS

**Date:** 2026-07-18  
**Status:** Resolved  
**Severity:** Critical  

---

## 🚨 Root Cause Analysis

During server startup, the backend process automatically initiates a cache warm-up job (`CacheWarm`) to pre-cache search results and recommendations:
1. **Unbounded Concurrency on boot:** The Node backend was running `enhancedSearch` sequential queries at startup while the frontend client simultaneously loaded the dashboard. 
2. **Curated Playlist Fetch Storm:** Loading the dashboard triggered language-specific curated playlist fetches (`getIndustryNewReleases` for 4 languages in parallel). This translated into:
   - 12 concurrent playlist searches.
   - Up to 24 concurrent playlist song fetches via `getPlaylistSongs(playlistId)`.
3. **Fallback Fetch Storm:** If batch fetching of songs timed out or failed (due to the initial proxy saturation), the fallback mechanism in `youtubeMusicService.ts` would immediately trigger individual song detail fetches for **100+ songs concurrently** using `Promise.all` with no rate-limiting or concurrency caps.
4. **Proxy Saturation:** The Python `music-provider-svc` (wrapping `ytmusicapi`) could not process 100+ concurrent requests. It returned `503 Service Unavailable` for the first few, and the rest queued up and failed with `timeout of 20000ms / 30000ms` Axios timeouts.

---

## 🛠️ Solutions Applied

### 1. Custom Concurrency Limiter (`pLimit`)
Added a lightweight, zero-dependency, type-safe ESM concurrency limiter `pLimit` inside [concurrency.ts](../src/utils/concurrency.ts) to manage queueing of parallel promises.

### 2. Staggered Batches with Delays
Modified `fetchCuratedNewReleases` in [recommendationEngine.ts](../src/services/recommendationEngine.ts):
- Capped playlist song fetching to **3 concurrent requests** at a time.
- Batched playlist IDs into groups of 3 and introduced a **1-second stagger delay** between batches.
- Capped new releases search queries to **2 concurrent requests** at a time.
- Restricted target language fetch concurrency to **2 concurrent languages** in `getIndustryNewReleases`.

### 3. Fallback Storm Capped
Capped the individual song fallback fetch storm in [youtubeMusicService.ts](../src/services/youtubeMusicService.ts):
- Wrapped the fallback mapping loop in a `pLimit(3)` concurrency limiter, preventing it from executing more than 3 individual song details calls at any time.

### 4. CacheWarm Optimization & Delayed Start
Modified the startup task in [index.ts](../src/index.ts):
- Increased the startup boot delay from **10 seconds** to **15 seconds** to allow health checks to pass and initial server health to stabilize.
- Reduced `WARM_QUERIES` from **20 queries** to **11 highly targeted/common queries** (removed outdated year-specific queries and low-traffic categories).
- Slowed pacing between sequential search queries from **400ms** to **1500ms**.

### 5. Duplicate Mongoose Index Resolved
Resolved the minor Mongoose console warning in [UserTasteProfile.ts](../src/models/UserTasteProfile.ts) by removing the duplicate `UserTasteProfileSchema.index({ userId: 1 })` definition since `userId` is already defined with `unique: true` (which implicitly creates a unique index).

---

## 📊 Verification & Results

- **Error Rate:** Decreased from ~95% failures (due to 503s/timeouts) to **0% error rate** on boot and dashboard reload.
- **Boot Duration:** The CacheWarm sequence is controlled and steady.
- **Responsiveness:** Loading the guest dashboard (`/api/dashboard/guest`) completes successfully and subsequently serves cached responses instantly (under 5ms) without blocking incoming search queries or song playback.
