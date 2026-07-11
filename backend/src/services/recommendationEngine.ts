// ════════════════════════════════════════════════════════════════
// SOULSYNC RECOMMENDATION ENGINE
// Taste-aware, cover-filtered, diversity-capped recommendations.
// Reuses searchRanker's cover/popularity logic, adds behavioral signals.
// ════════════════════════════════════════════════════════════════

import mongoose from "mongoose";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { UserTasteProfile, IUserTasteProfile, IArtistAffinity } from "../models/UserTasteProfile.js";
import { SongCooccurrence } from "../models/SongCooccurrence.js";
import {
  getSuggestions,
  fetchArtistSongs,
  fetchSongById,
  searchSongs,
  normalizeSongsToCanonical,
  type Song,
} from "./jiosaavn.js";
import { redisGet, redisSet } from "./redis.js";

// ════════════════════════════════════════════════════════════════
// TUNABLE WEIGHTS — adjust these to shape recommendation quality
// ════════════════════════════════════════════════════════════════
const W = {
  // Candidate scoring weights
  POPULARITY_MAX: 60,        // Max points from JioSaavn play count
  TASTE_ARTIST_MATCH: 50,    // Points when candidate's artist is in taste profile
  TASTE_LANG_MATCH: 20,      // Points when candidate's language matches distribution
  COOCCURRENCE_BONUS: 40,    // Points from co-occurrence signal
  COVER_PENALTY_HARD: -100,  // Penalty for definite covers (always applied in recs)
  COVER_PENALTY_SOFT: -40,   // Penalty for suspicious titles (slowed, reverb, etc.)
  ORIGINAL_BONUS: 15,        // Bonus for "official" / "original" markers
  LOW_PLAYCOUNT_PENALTY: -20,// Penalty for songs with < 1K plays
  BLACKLISTED_LABEL: -120,   // Instant burial for known cover labels
  // Diversity caps
  MAX_PER_ARTIST: 3,         // Max songs from same artist in one recommendation set
  // Taste profile computation
  RECENCY_HALF_LIFE_DAYS: 14,// Half-life for exponential decay
  RECOMPUTE_AFTER_N_PLAYS: 5,// Rebuild profile after this many new plays
  PROFILE_CACHE_TTL: 600,    // Redis cache TTL for taste profile (seconds)
  RESULT_CACHE_TTL: 300,     // Redis cache TTL for recommendation results (seconds)
} as const;

// ── Cover/junk detection keywords (from searchRanker.ts / searchEnhancer.ts) ─
const HARD_COVER_KW = [
  "cover", "recreation", "recreated", "remake", "tribute", "karaoke",
  "fan made", "fan-made", "unofficial", "piano cover", "guitar cover",
  "lofi cover", "acoustic cover", "unplugged cover", "instrumental cover",
  "cover version", "recreated version", "unofficial cover", "reprise cover",
  "piano version", "instrumental version",
];
const SOFT_COVER_KW = [
  "lofi", "slowed", "reverb", "8d audio", "nightcore", "sped up",
  "bass boosted", "remix", "mashup", "medley",
];
const ORIGINAL_MARKERS = [
  "official music video", "official video", "official audio",
  "official", "original", "lyric video", "full song",
];
const BLACKLISTED_LABELS = [
  "magic records", "soave records", "vibe network", "vibes network",
  "luxebeats", "17diamonds", "cover kingdom", "acoustic hits",
  "tribute kingdom", "fanmade", "fan-made", "unofficial",
  "karaoke hits", "piano dreams", "relaxing covers",
];

// ════════════════════════════════════════════════════════════════
// 1. BUILD TASTE PROFILE
// Reads ListeningHistory, computes weighted distributions,
// writes to UserTasteProfile + Redis cache.
// ════════════════════════════════════════════════════════════════
export async function buildTasteProfile(
  userId: string,
): Promise<IUserTasteProfile> {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const now = Date.now();

  // Fetch last 500 history entries (covers ~2-3 weeks of active use)
  const history = await ListeningHistory.find({ userId: userObjId })
    .sort({ playedAt: -1 })
    .limit(500)
    .lean();

  if (history.length === 0) {
    // No history — return empty profile
    const empty = await UserTasteProfile.findOneAndUpdate(
      { userId: userObjId },
      {
        $set: {
          artists: [],
          languages: [],
          recentSongIds: [],
          totalPlays: 0,
          lastComputedAt: new Date(),
          lastPlayCountAtCompute: 0,
        },
      },
      { upsert: true, new: true },
    );
    return empty;
  }

  // ── Artist affinity (recency-weighted) ────────────────────────
  const artistMap = new Map<string, { name: string; score: number; count: number }>();

  for (const h of history) {
    // Prefer artistId; fall back to artist name as key
    const key = h.artistId || h.artist || "Unknown";
    const name = h.artist || "Unknown";
    const ageMs = now - new Date(h.playedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayWeight = Math.pow(0.5, ageDays / W.RECENCY_HALF_LIFE_DAYS);

    const existing = artistMap.get(key);
    if (existing) {
      existing.score += decayWeight;
      existing.count += 1;
    } else {
      artistMap.set(key, { name, score: decayWeight, count: 1 });
    }
  }

  const artists: IArtistAffinity[] = Array.from(artistMap.entries())
    .map(([id, { name, score, count }]) => ({
      artistId: id,
      artistName: name,
      score: Math.round(score * 100) / 100,
      playCount: count,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50); // Keep top 50

  // ── Language distribution ─────────────────────────────────────
  const langMap = new Map<string, number>();
  let langTotal = 0;
  for (const h of history) {
    const lang = (h.language || "").toLowerCase().trim();
    if (!lang) continue;
    langMap.set(lang, (langMap.get(lang) || 0) + 1);
    langTotal++;
  }

  const languages = Array.from(langMap.entries())
    .map(([language, count]) => ({
      language,
      weight: langTotal > 0 ? Math.round((count / langTotal) * 100) / 100 : 0,
      playCount: count,
    }))
    .sort((a, b) => b.weight - a.weight);

  // ── Recent song IDs (for dedup) ───────────────────────────────
  const recentSongIds = [...new Set(history.slice(0, 100).map((h) => h.songId))];

  // ── Persist ───────────────────────────────────────────────────
  const profile = await UserTasteProfile.findOneAndUpdate(
    { userId: userObjId },
    {
      $set: {
        artists,
        languages,
        recentSongIds,
        totalPlays: history.length,
        lastComputedAt: new Date(),
        lastPlayCountAtCompute: history.length,
      },
    },
    { upsert: true, new: true },
  );

  // Cache in Redis
  await redisSet(
    `taste:${userId}`,
    JSON.stringify(profile),
    W.PROFILE_CACHE_TTL,
  ).catch(() => {});

  return profile;
}

// ── Get or compute taste profile ────────────────────────────────
export async function getTasteProfile(
  userId: string,
): Promise<IUserTasteProfile | null> {
  // Try Redis first
  try {
    const cached = await redisGet(`taste:${userId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  // Try MongoDB
  const existing = await UserTasteProfile.findOne({
    userId: new mongoose.Types.ObjectId(userId),
  }).lean() as IUserTasteProfile | null;

  if (existing) {
    // Check if recomputation is needed
    const currentCount = await ListeningHistory.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    });
    const delta = currentCount - (existing.lastPlayCountAtCompute || 0);
    if (delta >= W.RECOMPUTE_AFTER_N_PLAYS) {
      return buildTasteProfile(userId);
    }
    // Re-cache in Redis
    await redisSet(
      `taste:${userId}`,
      JSON.stringify(existing),
      W.PROFILE_CACHE_TTL,
    ).catch(() => {});
    return existing;
  }

  // No profile exists — build from scratch
  return buildTasteProfile(userId);
}

// ════════════════════════════════════════════════════════════════
// 2. CO-OCCURRENCE TRACKING
// Called after each history write to record sequential plays.
// ════════════════════════════════════════════════════════════════
export async function recordCooccurrence(
  userId: string,
  currentEntry: {
    songId: string;
    title: string;
    artist: string;
    artistId: string;
    albumArt: string;
    language: string;
  },
): Promise<void> {
  try {
    // Find the previous song this user played
    const prev = await ListeningHistory.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      songId: { $ne: currentEntry.songId },
    })
      .sort({ playedAt: -1 })
      .lean();

    if (!prev) return;

    // Record A→B co-occurrence (bidirectional)
    const pairs = [
      { a: prev.songId, b: currentEntry },
      {
        a: currentEntry.songId,
        b: {
          songId: prev.songId,
          title: prev.title,
          artist: prev.artist,
          artistId: prev.artistId || "",
          albumArt: prev.albumArt,
          language: prev.language || "",
        },
      },
    ];

    for (const { a, b } of pairs) {
      await SongCooccurrence.findOneAndUpdate(
        { songIdA: a, songIdB: b.songId },
        {
          $inc: { count: 1, decayedScore: 1 },
          $set: {
            songBName: b.title,
            songBArtist: b.artist,
            songBArtistId: b.artistId,
            songBImage: b.albumArt,
            songBLanguage: b.language,
            lastSeenAt: new Date(),
          },
        },
        { upsert: true },
      );
    }
  } catch (err) {
    // Non-fatal — don't break history logging
    console.error("[RecEngine] Co-occurrence tracking error:", err);
  }
}

// ════════════════════════════════════════════════════════════════
// 3. GET CANDIDATES
// Multi-source candidate generation:
//   - Co-occurrence (strongest signal)
//   - JioSaavn suggestions endpoint
//   - Artist-ID-based fetching (songs by user's fav artists)
// ════════════════════════════════════════════════════════════════
interface RecommendedSong extends Song {
  _recScore?: number;
  reason?: string;
}

export async function getCandidates(
  mode: "home" | "next",
  params: {
    currentSongId?: string;
    profile: IUserTasteProfile | null;
    limit?: number;
  },
): Promise<RecommendedSong[]> {
  const { currentSongId, profile, limit = 30 } = params;
  const candidates: RecommendedSong[] = [];
  const seenIds = new Set<string>(profile?.recentSongIds?.slice(0, 30) || []);

  const addCandidate = (song: Song, reason: string) => {
    if (seenIds.has(song.id)) return;
    seenIds.add(song.id);
    candidates.push({ ...song, reason });
  };

  if (mode === "next" && currentSongId) {
    // ── Source 1: Co-occurrence (most personalized) ──────────────
    const cooccurrences = await SongCooccurrence.find({ songIdA: currentSongId })
      .sort({ decayedScore: -1 })
      .limit(20)
      .lean();

    for (const co of cooccurrences) {
      if (seenIds.has(co.songIdB)) continue;
      // Fetch full song details for co-occurred songs
      try {
        const song = await fetchSongById(co.songIdB);
        if (song) addCandidate(song, "Frequently played together");
      } catch {}
    }

    // ── Source 2: JioSaavn suggestions (their built-in recs) ────
    try {
      const raw = await getSuggestions(currentSongId, 30);
      const normalized = normalizeSongsToCanonical(raw);
      for (const s of normalized) {
        addCandidate(s, "Similar vibe");
      }
    } catch {}
  }

  // ── Source 3: Songs by user's top artists ──────────────────────
  if (profile && profile.artists.length > 0) {
    const topArtists = profile.artists.slice(0, 5);
    // Pick 2-3 random artists from top 5 for variety
    const shuffled = topArtists.sort(() => Math.random() - 0.5).slice(0, 3);

    const artistResults = await Promise.allSettled(
      shuffled.map((a) => {
        // If we have a JioSaavn artist ID, fetch by ID; else search by name
        if (a.artistId && /^\d+$/.test(a.artistId)) {
          return fetchArtistSongs(a.artistId, 0, 1);
        }
        return searchSongs(`${a.artistName} hits`, 15);
      }),
    );

    for (let i = 0; i < artistResults.length; i++) {
      const res = artistResults[i];
      if (res.status !== "fulfilled") continue;
      const songs = Array.isArray(res.value) ? normalizeSongsToCanonical(res.value) : res.value as Song[];
      const artistName = shuffled[i].artistName;
      for (const s of songs.slice(0, 8)) {
        addCandidate(s, `Because you like ${artistName}`);
      }
    }
  }

  // ── Source 4 (home mode): Language-based discovery ─────────────
  if (mode === "home" && profile && profile.languages.length > 0) {
    const topLangs = profile.languages.slice(0, 2);
    const langResults = await Promise.allSettled(
      topLangs.map((l) =>
        searchSongs(`trending ${l.language} songs ${new Date().getFullYear()}`, 15),
      ),
    );
    for (const res of langResults) {
      if (res.status !== "fulfilled") continue;
      for (const s of normalizeSongsToCanonical(res.value).slice(0, 10)) {
        addCandidate(s, "Trending in your taste");
      }
    }
  }

  return candidates.slice(0, limit * 2); // Over-fetch for ranking headroom
}

// ════════════════════════════════════════════════════════════════
// 4. RANK CANDIDATES
// Adapted from searchRanker.ts — cover penalty, popularity,
// taste affinity, diversity caps.
// ════════════════════════════════════════════════════════════════
export function rankCandidates(
  candidates: RecommendedSong[],
  profile: IUserTasteProfile | null,
  limit: number = 20,
): RecommendedSong[] {
  if (!candidates.length) return [];

  // Build lookup sets from profile for fast scoring
  const artistScoreMap = new Map<string, number>();
  const artistNameSet = new Set<string>();
  const langWeightMap = new Map<string, number>();

  if (profile) {
    for (const a of profile.artists) {
      artistScoreMap.set(a.artistId, a.score);
      artistNameSet.add(a.artistName.toLowerCase());
    }
    for (const l of profile.languages) {
      langWeightMap.set(l.language, l.weight);
    }
  }

  // Score each candidate
  const scored = candidates.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    const artist = (song.primaryArtists || "").toLowerCase();
    const lang = (song.language || "").toLowerCase();
    const label = ((song as any).label || "").toLowerCase();

    // ── Popularity (0–60 pts) ───────────────────────────────────
    score += popularityScore(song.playCount);

    // ── Cover penalty (always applied — no query bypass in recs) ─
    score += coverPenalty(title);

    // ── Blacklisted label check ─────────────────────────────────
    if (label && BLACKLISTED_LABELS.some((bl) => label.includes(bl))) {
      score += W.BLACKLISTED_LABEL;
    }

    // ── Original indicator bonus ────────────────────────────────
    for (const marker of ORIGINAL_MARKERS) {
      if (title.includes(marker)) {
        score += W.ORIGINAL_BONUS;
        break;
      }
    }

    // ── Taste: artist match ─────────────────────────────────────
    // Check by artist name since we may not have IDs on all songs
    const songArtists = artist.split(",").map((a) => a.trim().toLowerCase());
    for (const sa of songArtists) {
      if (artistNameSet.has(sa)) {
        score += W.TASTE_ARTIST_MATCH;
        break;
      }
      // Partial match: check if any profile artist name is contained
      for (const profileArtist of artistNameSet) {
        if (sa.includes(profileArtist) || profileArtist.includes(sa)) {
          score += W.TASTE_ARTIST_MATCH * 0.6;
          break;
        }
      }
    }

    // ── Taste: language match ───────────────────────────────────
    if (lang && langWeightMap.has(lang)) {
      const langWeight = langWeightMap.get(lang)!;
      score += Math.round(W.TASTE_LANG_MATCH * langWeight);
    }

    // ── Stream URL presence ─────────────────────────────────────
    if (!song.streamUrl) score -= 30;

    return { ...song, _recScore: score };
  });

  // Sort by score descending
  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  // ── Diversity cap: max N per artist ───────────────────────────
  const artistCount = new Map<string, number>();
  const diversified: RecommendedSong[] = [];

  for (const song of scored) {
    const firstArtist = (song.primaryArtists || "").split(",")[0].trim().toLowerCase();
    const count = artistCount.get(firstArtist) || 0;
    if (count >= W.MAX_PER_ARTIST) continue;
    artistCount.set(firstArtist, count + 1);
    diversified.push(song);
    if (diversified.length >= limit) break;
  }

  // ── Language diversity: ensure mix matches user's real distribution ─
  // If user listens 70% Tamil 30% English, don't return 100% Tamil
  if (profile && profile.languages.length > 1) {
    const topLang = profile.languages[0].language;
    const topLangCount = diversified.filter(
      (s) => (s.language || "").toLowerCase() === topLang,
    ).length;
    const topLangRatio = topLangCount / diversified.length;
    const targetRatio = Math.min(profile.languages[0].weight + 0.1, 0.8); // Cap at 80%

    if (topLangRatio > targetRatio) {
      // Too many of the top language — swap some out for other-language songs from scored
      const excess = Math.floor((topLangRatio - targetRatio) * diversified.length);
      const otherLangSongs = scored.filter(
        (s) =>
          (s.language || "").toLowerCase() !== topLang &&
          !diversified.some((d) => d.id === s.id),
      );
      // Replace last N top-lang songs with other-lang songs
      let swapped = 0;
      for (let i = diversified.length - 1; i >= 0 && swapped < excess; i--) {
        if ((diversified[i].language || "").toLowerCase() === topLang && otherLangSongs.length > 0) {
          diversified[i] = otherLangSongs.shift()!;
          swapped++;
        }
      }
    }
  }

  return diversified;
}

// ── Scoring helpers (adapted from searchRanker.ts) ──────────────

function popularityScore(playCount: number): number {
  if (!playCount || playCount <= 0) return W.LOW_PLAYCOUNT_PENALTY;
  const p = playCount;
  if (p >= 500_000_000) return W.POPULARITY_MAX;
  if (p >= 100_000_000) return 52;
  if (p >= 50_000_000) return 44;
  if (p >= 10_000_000) return 38;
  if (p >= 5_000_000) return 32;
  if (p >= 1_000_000) return 24;
  if (p >= 500_000) return 16;
  if (p >= 100_000) return 10;
  if (p >= 10_000) return 4;
  if (p >= 1_000) return 0;
  return W.LOW_PLAYCOUNT_PENALTY; // < 1K plays — almost certainly fake/cover
}

function coverPenalty(title: string): number {
  // In recommendation context: ALWAYS penalize covers (no "user asked for it" bypass)
  for (const kw of HARD_COVER_KW) {
    if (title.includes(kw)) return W.COVER_PENALTY_HARD;
  }
  for (const kw of SOFT_COVER_KW) {
    if (title.includes(kw)) return W.COVER_PENALTY_SOFT;
  }
  return 0;
}

// ════════════════════════════════════════════════════════════════
// 5. ATTACH REASON — explainable tag per song
// ════════════════════════════════════════════════════════════════
export function attachReason(
  songs: RecommendedSong[],
  profile: IUserTasteProfile | null,
): RecommendedSong[] {
  if (!profile) return songs.map((s) => ({ ...s, reason: s.reason || "Popular right now" }));

  const artistNames = new Set(profile.artists.slice(0, 15).map((a) => a.artistName.toLowerCase()));

  return songs.map((song) => {
    // Keep reason if already set (from candidate generation)
    if (song.reason) return song;

    const songArtists = (song.primaryArtists || "").split(",").map((a) => a.trim().toLowerCase());
    for (const sa of songArtists) {
      for (const pa of artistNames) {
        if (sa.includes(pa) || pa.includes(sa)) {
          const displayName = profile.artists.find(
            (a) => a.artistName.toLowerCase() === pa,
          )?.artistName || pa;
          return { ...song, reason: `Because you like ${displayName}` };
        }
      }
    }

    const lang = (song.language || "").toLowerCase();
    if (lang && profile.languages.some((l) => l.language === lang)) {
      const displayLang = lang.charAt(0).toUpperCase() + lang.slice(1);
      return { ...song, reason: `Trending in ${displayLang}` };
    }

    return { ...song, reason: "You might like this" };
  });
}

// ════════════════════════════════════════════════════════════════
// 6. PUBLIC API — High-level functions used by routes
// ════════════════════════════════════════════════════════════════

export async function getHomeRecommendations(
  userId: string,
): Promise<RecommendedSong[]> {
  // Check cache
  const cacheKey = `rec:home:${userId}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const profile = await getTasteProfile(userId);
  const candidates = await getCandidates("home", { profile, limit: 25 });
  const ranked = rankCandidates(candidates, profile, 20);
  const withReasons = attachReason(ranked, profile);

  // Strip internal scoring fields
  const result = withReasons.map(({ _recScore, ...rest }) => rest);

  await redisSet(cacheKey, JSON.stringify(result), W.RESULT_CACHE_TTL).catch(() => {});
  return result;
}

export async function getNextRecommendations(
  currentSongId: string,
  userId?: string,
): Promise<RecommendedSong[]> {
  const cacheKey = userId
    ? `rec:next:${userId}:${currentSongId}`
    : `rec:next:guest:${currentSongId}`;

  try {
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const profile = userId ? await getTasteProfile(userId) : null;
  const candidates = await getCandidates("next", {
    currentSongId,
    profile,
    limit: 30,
  });
  const ranked = rankCandidates(candidates, profile, 20);
  const withReasons = attachReason(ranked, profile);
  const result = withReasons.map(({ _recScore, ...rest }) => rest);

  await redisSet(cacheKey, JSON.stringify(result), W.RESULT_CACHE_TTL).catch(() => {});
  return result;
}

// ════════════════════════════════════════════════════════════════
// 7. TASTE PROFILE RECOMPUTE TRIGGER
// Called from the history-write route after each play event.
// Only rebuilds if N new plays have accumulated.
// ════════════════════════════════════════════════════════════════
export async function maybeRecomputeTaste(userId: string): Promise<void> {
  try {
    const existing = await UserTasteProfile.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .select("lastPlayCountAtCompute")
      .lean();

    const currentCount = await ListeningHistory.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    });

    const lastCount = (existing as any)?.lastPlayCountAtCompute || 0;
    if (currentCount - lastCount >= W.RECOMPUTE_AFTER_N_PLAYS) {
      // Fire and forget — don't block the history write response
      buildTasteProfile(userId).catch((err) =>
        console.error("[RecEngine] Taste recompute error:", err),
      );
    }
  } catch (err) {
    console.error("[RecEngine] maybeRecomputeTaste error:", err);
  }
}
