// ════════════════════════════════════════════════════════════════
// NEGATIVE AFFINITY SERVICE — Step 3
// Builds negative affinity sets for skipped languages, artists, & genres
// ════════════════════════════════════════════════════════════════

import mongoose from "mongoose";
import { RecommendationEvent } from "../models/RecommendationEvent.js";
import { redisGet, redisSet } from "./redis.js";

export interface NegativeAffinityProfile {
  negativeLanguages: Set<string>;  // Strictly blocked languages
  negativeArtists: Set<string>;    // Strictly blocked artists
}

export async function getNegativeAffinityProfile(userId: string): Promise<NegativeAffinityProfile> {
  if (!userId || userId === "guest") {
    return { negativeLanguages: new Set(), negativeArtists: new Set() };
  }

  const cacheKey = `rec:negative_affinity:${userId}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        negativeLanguages: new Set(parsed.negativeLanguages),
        negativeArtists: new Set(parsed.negativeArtists),
      };
    }
  } catch {}

  const negativeLangs = new Set<string>();
  const negativeArts = new Set<string>();

  try {
    const userObjId = new mongoose.Types.ObjectId(userId);
    const skipEvents = await RecommendationEvent.find({
      userId: userObjId,
      eventType: "skip",
    })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    const langSkipCounts = new Map<string, number>();
    const artistSkipCounts = new Map<string, number>();

    for (const ev of skipEvents) {
      if (ev.contextLanguage) {
        const lang = ev.contextLanguage.toLowerCase().trim();
        langSkipCounts.set(lang, (langSkipCounts.get(lang) || 0) + 1);
      }
      if (ev.artistName) {
        const art = ev.artistName.toLowerCase().trim();
        artistSkipCounts.set(art, (artistSkipCounts.get(art) || 0) + 1);
      }
    }

    // Languages skipped >= 3 times without completion are hard blocked
    for (const [lang, count] of langSkipCounts.entries()) {
      if (count >= 3) negativeLangs.add(lang);
    }

    // Artists skipped >= 3 times without completion are hard blocked
    for (const [art, count] of artistSkipCounts.entries()) {
      if (count >= 3) negativeArts.add(art);
    }
  } catch (err) {
    console.error("[NegativeAffinity] Error fetching skip profile:", err);
  }

  const payload = {
    negativeLanguages: Array.from(negativeLangs),
    negativeArtists: Array.from(negativeArts),
  };

  await redisSet(cacheKey, JSON.stringify(payload), 3600).catch(() => {});

  return {
    negativeLanguages: negativeLangs,
    negativeArtists: negativeArts,
  };
}
