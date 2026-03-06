/**
 * Search cache warmup — runs once at server startup.
 *
 * Pre-fetches the 20 most popular query intents through the full
 * enhancedSearch pipeline so the first real user hit is always a
 * Redis cache hit (< 5 ms) instead of a cold JioSaavn round-trip.
 *
 * Queries are fired sequentially with a 2-second gap to be gentle
 * on the JioSaavn API (uses the throttled queue via enhancedSearch).
 */

import {
  enhancedSearch,
  normalizeSearchKey,
} from "../services/searchEnhancer.js";
import { redisGet } from "../services/redis.js";
import { hasActiveUserQueries } from "../services/jiosaavn.js";

const POPULAR_QUERIES = [
  // Top Bollywood artists
  "arijit singh",
  "shreya ghoshal",
  "jubin nautiyal",
  // Punjabi
  "diljit dosanjh",
  "ap dhillon",
  "karan aujla",
  // Tamil / South
  "anirudh ravichander",
  "ar rahman",
  // International
  "taylor swift",
  "the weeknd",
  // Mood / genre
  "romantic hindi songs",
  "lofi chill music",
  "party songs",
  "sad songs hindi",
  // Trending
  `bollywood hits ${new Date().getFullYear()}`,
  "trending hindi songs",
  "latest tamil songs",
  "workout motivation",
  "rain songs",
  "devotional songs",
];

// 5 s between items: each enhancedSearch fires ~3 throttled queries (3.3 s)
// plus 1.7 s buffer so user queries can slip through the throttle queue.
const WARMUP_GAP_MS = 5000;

async function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function warmupSearchCache() {
  console.log(
    `[Warmup] Pre-warming search cache with ${POPULAR_QUERIES.length} popular queries…`,
  );
  let cached = 0;
  let skipped = 0;
  let failed = 0;

  for (const q of POPULAR_QUERIES) {
    try {
      // Skip if already in Redis (avoids redundant JioSaavn calls on restart)
      const ck = `search:v3:${normalizeSearchKey(q)}:all`;
      const existing = await redisGet(ck);
      if (existing) {
        skipped++;
        console.log(`[Warmup] ↩ ${q} (already cached)`);
        continue;
      }

      // Yield to active user searches before consuming the throttle queue
      if (hasActiveUserQueries()) {
        console.log(`[Warmup] ⏸ ${q} — waiting for user query to finish…`);
        await delay(3000);
      }

      await enhancedSearch(q, "all", 20);
      cached++;
      console.log(`[Warmup] ✓ ${q}`);
    } catch (err) {
      failed++;
      console.warn(`[Warmup] ✗ ${q}:`, (err as Error).message);
    }
    await delay(WARMUP_GAP_MS);
  }

  console.log(
    `[Warmup] Done — ${cached} fetched, ${skipped} skipped (cached), ${failed} failed`,
  );
}
