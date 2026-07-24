// ════════════════════════════════════════════════════════════════
// TELEMETRY STORE & SEARCH RANKING ADAPTIVE SIGNAL PIPELINE
// Records SearchClickEvent and PlaybackEvent and converts telemetry
// into ranking feedback (CTR, completion rate, likes, skips).
// ════════════════════════════════════════════════════════════════

import { redisGet, redisSet } from "./redis.js";
import { recordRecommendationEvent } from "./eventPipeline.js";
import { normalizeSearchKey } from "./searchEnhancer.js";

interface TelemetryMemoryCache {
  clicks: Map<string, number>;
  completions: Map<string, number>;
  skips: Map<string, number>;
}

const memCache: TelemetryMemoryCache = {
  clicks: new Map(),
  completions: new Map(),
  skips: new Map(),
};

/**
 * Record a user search click event (SearchClickEvent)
 */
export async function recordSearchClick(
  query: string,
  songId: string,
  position: number = 0,
  userId?: string,
): Promise<void> {
  if (!query || !songId) return;

  const normQuery = normalizeSearchKey(query);
  const clickKey = `telemetry:click:${normQuery}:${songId}`;
  const songClickKey = `telemetry:song_clicks:${songId}`;

  try {
    // In-memory counter for fast access
    memCache.clicks.set(clickKey, (memCache.clicks.get(clickKey) || 0) + 1);
    memCache.clicks.set(songClickKey, (memCache.clicks.get(songClickKey) || 0) + 1);

    // Redis increment
    const currentStr = await redisGet(clickKey).catch(() => "0");
    const current = parseInt(currentStr || "0", 10);
    await redisSet(clickKey, String(current + 1), 86400 * 30).catch(() => {});

    const globalSongStr = await redisGet(songClickKey).catch(() => "0");
    const globalSongClicks = parseInt(globalSongStr || "0", 10);
    await redisSet(songClickKey, String(globalSongClicks + 1), 86400 * 30).catch(() => {});

    // Log to central event pipeline if user is present
    if (userId) {
      recordRecommendationEvent({
        userId,
        eventType: "search",
        songId,
        searchQuery: query,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[TelemetryStore] Error recording search click:", err);
  }
}

/**
 * Record playback event (PlaybackEvent: completion, skip, like, replay)
 */
export async function recordPlaybackTelemetry(params: {
  songId: string;
  searchQuery?: string;
  eventType: "started" | "finished" | "skip" | "like" | "replay";
  completionPercent?: number;
  durationSeconds?: number;
  userId?: string;
}): Promise<void> {
  const { songId, searchQuery, eventType, completionPercent = 0, durationSeconds = 0, userId } = params;
  if (!songId) return;

  try {
    const statsKey = `telemetry:playback_stats:${songId}`;
    const raw = await redisGet(statsKey).catch(() => null);
    const stats = raw
      ? JSON.parse(raw)
      : { plays: 0, completions: 0, skips: 0, likes: 0, replays: 0 };

    if (eventType === "started") {
      stats.plays += 1;
    } else if (eventType === "finished" || completionPercent >= 80) {
      stats.completions += 1;
      memCache.completions.set(songId, (memCache.completions.get(songId) || 0) + 1);
    } else if (eventType === "skip" || (durationSeconds < 15 && completionPercent < 20)) {
      stats.skips += 1;
      memCache.skips.set(songId, (memCache.skips.get(songId) || 0) + 1);
    } else if (eventType === "like") {
      stats.likes += 1;
    } else if (eventType === "replay") {
      stats.replays += 1;
    }

    await redisSet(statsKey, JSON.stringify(stats), 86400 * 30).catch(() => {});

    // If query is present, update query-song completion bonus key
    if (searchQuery && (eventType === "finished" || completionPercent >= 80)) {
      const normQuery = normalizeSearchKey(searchQuery);
      const qComplKey = `telemetry:query_completion:${normQuery}:${songId}`;
      const cStr = await redisGet(qComplKey).catch(() => "0");
      await redisSet(qComplKey, String(parseInt(cStr || "0", 10) + 1), 86400 * 30).catch(() => {});
    }

    if (userId) {
      recordRecommendationEvent({
        userId,
        eventType: eventType === "finished" ? "song_finished" : eventType === "started" ? "song_started" : (eventType as any),
        songId,
        searchQuery: searchQuery || "",
        completionPercent,
        listeningDurationSeconds: durationSeconds,
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[TelemetryStore] Error recording playback telemetry:", err);
  }
}

/**
 * Calculate dynamic score adjustment for (query, songId) based on historical telemetry
 * Synchronous / fast read using in-memory or cached signals.
 */
export function getTelemetryScoreBoost(query: string, songId: string): number {
  if (!query || !songId) return 0;

  const normQuery = normalizeSearchKey(query);
  const clickKey = `telemetry:click:${normQuery}:${songId}`;

  let boost = 0;

  // Query-specific click count boost
  const queryClicks = memCache.clicks.get(clickKey) || 0;
  if (queryClicks >= 10) boost += 40;
  else if (queryClicks >= 5) boost += 25;
  else if (queryClicks >= 2) boost += 10;

  // Global completions boost & skip penalty
  const completions = memCache.completions.get(songId) || 0;
  const skips = memCache.skips.get(songId) || 0;

  if (completions > 5) boost += Math.min(completions * 2, 30);
  if (skips > 5 && skips > completions * 2) boost -= Math.min(skips * 3, 40);

  return boost;
}
