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

import { enhancedSearch } from "../services/searchEnhancer.js";

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

const WARMUP_GAP_MS = 2000; // 2 s between queries — stays within throttle budget

async function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function warmupSearchCache() {
  console.log(
    `[Warmup] Pre-warming search cache with ${POPULAR_QUERIES.length} popular queries…`,
  );
  let cached = 0;
  let failed = 0;

  for (const q of POPULAR_QUERIES) {
    try {
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
    `[Warmup] Done — ${cached} cached, ${failed} failed (${POPULAR_QUERIES.length} total)`,
  );
}
