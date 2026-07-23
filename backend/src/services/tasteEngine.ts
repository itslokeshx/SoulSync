// ════════════════════════════════════════════════════════════════
// TASTE ENGINE SERVICE — Step 3
// Computes comprehensive UserTasteProfile from history & event weights
// ════════════════════════════════════════════════════════════════

import mongoose from "mongoose";
import { UserTasteProfile, IUserTasteProfile, IArtistAffinity, ILanguageDistribution, IGenreAffinity, IMoodAffinity, IEraAffinity } from "../models/UserTasteProfile.js";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { RecommendationEvent } from "../models/RecommendationEvent.js";
import { redisSet, redisGet, redisDel } from "./redis.js";

const HALF_LIFE_DAYS = 14;

export async function computeUserTasteProfile(userId: string): Promise<IUserTasteProfile> {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const now = Date.now();

  const [history, events] = await Promise.all([
    ListeningHistory.find({ userId: userObjId }).sort({ playedAt: -1 }).limit(500).lean(),
    RecommendationEvent.find({ userId: userObjId }).sort({ timestamp: -1 }).limit(1000).lean(),
  ]);

  if (history.length === 0 && events.length === 0) {
    const emptyProfile = await UserTasteProfile.findOneAndUpdate(
      { userId: userObjId },
      {
        $set: {
          artists: [],
          languages: [],
          genres: [],
          moods: [],
          eras: [],
          topArtist: "",
          topGenre: "",
          topLanguage: "",
          topMood: "",
          popularityPreference: 70,
          discoveryScore: 30,
          repeatTolerance: 50,
          recentSongIds: [],
          totalPlays: 0,
          lastComputedAt: new Date(),
          lastPlayCountAtCompute: 0,
        },
      },
      { upsert: true, new: true },
    );
    return emptyProfile;
  }

  // 1. Process Artist Affinities with Recency Decay & Multi-Artist Splitting
  const artistMap = new Map<string, { name: string; score: number; count: number }>();

  for (const h of history) {
    const rawArtist = h.artist || "Unknown";
    const ageMs = now - new Date(h.playedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayWeight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);

    const names = rawArtist.split(/[,/&]+/).map((a) => a.trim()).filter(Boolean);
    for (const name of names) {
      const key = name.toLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        existing.score += decayWeight;
        existing.count += 1;
      } else {
        artistMap.set(key, { name, score: decayWeight, count: 1 });
      }
    }
  }

  // Factor in explicit events (likes, skips, replays)
  for (const ev of events) {
    if (!ev.artistName) continue;
    const ageMs = now - new Date(ev.timestamp).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayWeight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const weightedScore = ev.weight * decayWeight;

    const names = ev.artistName.split(/[,/&]+/).map((a) => a.trim()).filter(Boolean);
    for (const name of names) {
      const key = name.toLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        existing.score += weightedScore;
      } else if (weightedScore > 0) {
        artistMap.set(key, { name, score: weightedScore, count: 1 });
      }
    }
  }

  const artists: IArtistAffinity[] = Array.from(artistMap.entries())
    .map(([id, { name, score, count }]) => ({
      artistId: id,
      artistName: name,
      score: Math.max(0, Math.round(score * 100) / 100),
      playCount: count,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  // 2. Process Languages
  const langMap = new Map<string, number>();
  let totalLangCount = 0;
  for (const h of history) {
    const lang = (h.language || "").toLowerCase().trim();
    if (!lang) continue;
    langMap.set(lang, (langMap.get(lang) || 0) + 1);
    totalLangCount++;
  }

  const languages: ILanguageDistribution[] = Array.from(langMap.entries())
    .map(([language, count]) => ({
      language,
      weight: totalLangCount > 0 ? Math.round((count / totalLangCount) * 100) / 100 : 0,
      playCount: count,
    }))
    .sort((a, b) => b.weight - a.weight);

  // 3. Process Behavioral Statistics (Completion, Skip, Replay, Discovery)
  let totalCompleted = 0;
  let totalSkipped = 0;
  let totalReplayed = 0;
  let totalCompletionPercentSum = 0;

  for (const ev of events) {
    if (ev.eventType === "song_finished") totalCompleted++;
    if (ev.eventType === "skip") totalSkipped++;
    if (ev.eventType === "replay") totalReplayed++;
    totalCompletionPercentSum += ev.completionPercent || 0;
  }

  const eventCount = Math.max(1, events.length);
  const averageCompletionRate = Math.min(100, Math.max(0, Math.round(totalCompletionPercentSum / eventCount)));
  const averageSkipRate = Math.min(100, Math.max(0, Math.round((totalSkipped / eventCount) * 100)));
  const averageReplayRate = Math.min(100, Math.max(0, Math.round((totalReplayed / eventCount) * 100)));

  // Discovery Score: Higher if user listens to many unique artists
  const uniqueArtistCount = artistMap.size;
  const discoveryScore = Math.min(100, Math.max(10, Math.round((uniqueArtistCount / Math.max(1, history.length)) * 100)));

  // Top Summaries
  const topArtist = artists[0]?.artistName || "";
  const topLanguage = languages[0]?.language || "english";

  const recentSongIds = Array.from(new Set(history.slice(0, 100).map((h) => h.songId)));

  const profile = await UserTasteProfile.findOneAndUpdate(
    { userId: userObjId },
    {
      $set: {
        artists,
        languages,
        topArtist,
        topLanguage,
        discoveryScore,
        averageCompletionRate,
        averageSkipRate,
        averageReplayRate,
        recentSongIds,
        totalPlays: history.length,
        lastComputedAt: new Date(),
        lastPlayCountAtCompute: history.length,
      },
    },
    { upsert: true, new: true },
  );

  await redisSet(`taste:${userId}`, JSON.stringify(profile), 600).catch(() => {});
  await redisDel(`dashboard:${userId}`).catch(() => {});

  return profile;
}

export async function getUserTasteProfile(userId: string): Promise<IUserTasteProfile | null> {
  if (!userId || userId === "guest") return null;

  try {
    const cached = await redisGet(`taste:${userId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  const existing = (await UserTasteProfile.findOne({
    userId: new mongoose.Types.ObjectId(userId),
  }).lean()) as IUserTasteProfile | null;

  if (existing) {
    await redisSet(`taste:${userId}`, JSON.stringify(existing), 600).catch(() => {});
    return existing;
  }

  return computeUserTasteProfile(userId);
}
