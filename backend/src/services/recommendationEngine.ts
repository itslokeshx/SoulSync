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
  fetchSongsByIds,
  searchSongs,
  searchPlaylists,
  getPlaylistSongs,
  normalizeSongsToCanonical,
  getSongsDetailsBatch,
  type Song,
} from "./jiosaavn.js";
import { redisGet, redisSet, redisDel } from "./redis.js";
import {
  BLACKLISTED_LABELS,
  ORIGINAL_MARKERS,
  POPULAR_ARTISTS,
} from "./scoringUtils.js";

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

// ── Cover/junk detection keywords ───────────────────────────────
// These are kept local (not imported from scoringUtils) because the
// rec engine's coverPenalty() uses STRICTER thresholds than search
// (no "user asked for it" bypass — covers are always penalized in recs).
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
// POPULAR_ARTISTS, BLACKLISTED_LABELS and ORIGINAL_MARKERS imported from scoringUtils.ts

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

  // Invalidate dashboard cache immediately
  await redisDel(`dashboard:${userId}`).catch(() => {});

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

    // ── Age / Release Year Penalty ──────────────────────────────
    const currentYear = new Date().getFullYear();
    const songYear = parseInt(song.year, 10);
    if (!isNaN(songYear)) {
      const age = currentYear - songYear;
      if (age > 4) {
        // Penalize older catalog items progressively
        score -= Math.min(100, age * 15);
      } else if (age === 0) {
        // Minor boost for current year releases
        score += 20;
      }
    }

    return { ...song, _recScore: score };
  });

  // Sort by score descending
  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  // ── Diversity cap: max N per artist & unique song titles ──────
  const artistCount = new Map<string, number>();
  const seenSongNames = new Set<string>();
  const diversified: RecommendedSong[] = [];

  for (const song of scored) {
    const cleanName = cleanSongNameForDeduplication(song.name);
    if (cleanName && seenSongNames.has(cleanName)) continue;

    const firstArtist = (song.primaryArtists || "").split(",")[0].trim().toLowerCase();
    const count = artistCount.get(firstArtist) || 0;
    if (count >= W.MAX_PER_ARTIST) continue;

    artistCount.set(firstArtist, count + 1);
    if (cleanName) seenSongNames.add(cleanName);
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

function cleanSongNameForDeduplication(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\(feat\..*?\)/g, "")
    .replace(/\[feat\..*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

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
  excludeIds: string[] = [],
): Promise<RecommendedSong[]> {
  const cacheKey = userId
    ? `rec:next:${userId}:${currentSongId}`
    : `rec:next:guest:${currentSongId}`;

  // Bypass Redis cache when dynamic exclusions are provided
  if (excludeIds.length === 0) {
    try {
      const cached = await redisGet(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  // Fetch seed song metadata first
  const seedSong = await fetchSongById(currentSongId);
  if (!seedSong) {
    return [];
  }

  const profile = userId ? await getTasteProfile(userId) : null;

  // Generate seed-anchored, taste-aware recommendations
  const recommendedSongs = await generateSeedAnchoredBatch(
    seedSong,
    profile,
    excludeIds,
    20,
  );

  // Map to RecommendedSong format with reasons
  const result: RecommendedSong[] = recommendedSongs.map((song) => ({
    ...song,
    reason: (song as any).reason || `Similar to ${seedSong.name}`,
  }));

  // Only cache when there are no dynamic exclusions
  if (excludeIds.length === 0) {
    await redisSet(cacheKey, JSON.stringify(result), W.RESULT_CACHE_TTL).catch(() => {});
  }

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

// ════════════════════════════════════════════════════════════════
// 8. TASTE REDESIGN HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════

export async function generateSeedAnchoredBatch(
  seed: Song,
  tasteProfile: IUserTasteProfile | null,
  excludeIds: string[],
  batchSize: number = 8,
): Promise<Song[]> {
  const seedId = seed.id;
  const seedArtist = (seed.primaryArtists || "").split(",")[0].trim();
  const seedLang = (seed.language || "").toLowerCase().trim();

  const excludeSet = new Set<string>([...excludeIds, seedId]);
  const candidates: Song[] = [];

  const addCandidate = (song: Song) => {
    if (excludeSet.has(song.id)) return;
    excludeSet.add(song.id);
    candidates.push(song);
  };

  // Source 1: Co-occurrence
  let cooccurCount = 0;
  const coOccurrenceCandidatesList: Song[] = [];
  try {
    const cooccurrences = await SongCooccurrence.find({ songIdA: seedId })
      .sort({ decayedScore: -1 })
      .limit(20)
      .lean();
    cooccurCount = cooccurrences.length;
    for (const co of cooccurrences) {
      try {
        const song = await fetchSongById(co.songIdB);
        if (song) {
          coOccurrenceCandidatesList.push(song);
          addCandidate(song);
        }
      } catch {}
    }
  } catch {}

  // Source 2: JioSaavn suggestions
  let suggestionsCount = 0;
  const jiosaavnCandidatesList: Song[] = [];
  try {
    const raw = await getSuggestions(seedId, 30);
    suggestionsCount = raw.length;
    const normalized = normalizeSongsToCanonical(raw);
    for (const s of normalized) {
      jiosaavnCandidatesList.push(s);
      addCandidate(s);
    }
  } catch {}

  // Source 3: Hits from primary artist of the seed
  let artistHitsCount = 0;
  if (seedArtist) {
    try {
      const artistSongs = await searchSongs(`${seedArtist} hits`, 15);
      artistHitsCount = artistSongs.length;
      const normalized = normalizeSongsToCanonical(artistSongs);
      for (const s of normalized) {
        addCandidate(s);
      }
    } catch {}
  }

  // Sanity check: if candidate pool is too small, supplement with cold start/popular songs
  let fallbackCount = 0;
  if (candidates.length < 10) {
    try {
      const fallbacks = await getColdStartBatch(Array.from(excludeSet), batchSize);
      fallbackCount = fallbacks.length;
      for (const s of fallbacks) {
        addCandidate(s);
      }
    } catch {}
  }
  if (candidates.length === 0) {
    return [];
  }

  // Score candidates with seed-weighted ranking (seed weight close to 1.0)
  const scored = candidates.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    const artist = (song.primaryArtists || "").toLowerCase();
    const lang = (song.language || "").toLowerCase();
    const label = ((song as any).label || "").toLowerCase();

    // Base popularity (0–60 pts)
    score += popularityScore(song.playCount);

    // Full cover penalty (applied unconditionally)
    score += coverPenalty(title);

    // Blacklisted label check
    if (label && BLACKLISTED_LABELS.some((bl) => label.includes(bl))) {
      score += W.BLACKLISTED_LABEL;
    }

    // Original indicator bonus
    for (const marker of ORIGINAL_MARKERS) {
      if (title.includes(marker)) {
        score += W.ORIGINAL_BONUS;
        break;
      }
    }

    // Seed-anchored similarity (heavy weights, close to 1.0)
    const songArtists = artist.split(",").map((a) => a.trim().toLowerCase());
    const isSameArtist = songArtists.some(
      (sa) =>
        sa.includes(seedArtist.toLowerCase()) ||
        seedArtist.toLowerCase().includes(sa),
    );
    if (isSameArtist) {
      score += 60; // Extra heavy seed artist similarity
    }

    if (lang === seedLang) {
      score += 40; // Heavy seed language similarity
    }

    // Overall taste profile score (if present)
    if (tasteProfile) {
      const artistNameSet = new Set(
        tasteProfile.artists.map((a) => a.artistName.toLowerCase()),
      );
      const langWeightMap = new Map(
        tasteProfile.languages.map((l) => [l.language, l.weight]),
      );

      for (const sa of songArtists) {
        if (artistNameSet.has(sa)) {
          score += 20;
          break;
        }
      }

      if (lang && langWeightMap.has(lang)) {
        score += Math.round(15 * langWeightMap.get(lang)!);
      }
    }

    if (!song.streamUrl) score -= 30;

    return { ...song, _recScore: score };
  });

  // Sort candidates
  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  // Diversity: max 2 songs per artist
  const artistCount = new Map<string, number>();
  const diversified: Song[] = [];

  for (const song of scored) {
    const firstArtist = (song.primaryArtists || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const count = artistCount.get(firstArtist) || 0;
    if (count >= 2) continue; // max 2 per artist
    artistCount.set(firstArtist, count + 1);

    // Attach reason
    const cleanSong = { ...song };
    delete (cleanSong as any)._recScore;
    (cleanSong as any).reason = `Similar to ${seed.name}`;
    diversified.push(cleanSong);

    if (diversified.length >= batchSize) break;
  }

  return diversified;
}

export async function getColdStartBatch(
  excludeIds: string[],
  limit: number = 20,
): Promise<Song[]> {
  const excludeSet = new Set(excludeIds);
  const fallbacks = [
    "best hindi songs",
    "best tamil songs",
    "best telugu songs",
    "best english songs",
  ];
  
  const searchResults = await Promise.allSettled(
    fallbacks.map((q) => searchSongs(q, 15)),
  );

  const candidates: Song[] = [];
  for (const res of searchResults) {
    if (res.status !== "fulfilled") continue;
    const normalized = normalizeSongsToCanonical(res.value);
    for (const s of normalized) {
      if (!excludeSet.has(s.id)) {
        candidates.push(s);
        excludeSet.add(s.id);
      }
    }
  }

  // Score only based on cover penalties and popularity
  const scored = candidates.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    score += popularityScore(song.playCount);
    score += coverPenalty(title);
    if (!song.streamUrl) score -= 30;
    return { ...song, _recScore: score };
  });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  return scored.slice(0, limit).map((s) => {
    const clean = { ...s };
    delete (clean as any)._recScore;
    (clean as any).reason = "Popular right now";
    return clean;
  });
}

export async function getTasteProfileBatch(
  tasteProfile: IUserTasteProfile | null,
  excludeIds: string[],
  limit: number = 20,
): Promise<Song[]> {
  if (!tasteProfile || tasteProfile.artists.length === 0) {
    return getColdStartBatch(excludeIds, limit);
  }

  const excludeSet = new Set(excludeIds);
  const candidates: Song[] = [];

  const addCandidate = (song: Song) => {
    if (excludeSet.has(song.id)) return;
    excludeSet.add(song.id);
    candidates.push(song);
  };

  // Rotating query modifiers for variety on every reload
  const ARTIST_QUERY_VARIANTS = [
    "best of", "top songs", "popular", "hits", "essentials",
    "greatest", "playlist", "latest", "new", "trending",
  ];
  const LANG_QUERY_VARIANTS = [
    "trending", "popular", "best", "top", "latest",
    "new releases", "hot", "viral", "chartbusters", "hits",
  ];

  const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Source 1: User's top artists (randomize page + search query variants)
  const topArtists = tasteProfile.artists.slice(0, 10);
  const artistResults = await Promise.allSettled(
    topArtists.map((a) => {
      if (a.artistId && /^\d+$/.test(a.artistId)) {
        const randomPage = Math.floor(Math.random() * 8); // pages 0-7 for wider variety
        return fetchArtistSongs(a.artistId, randomPage, 2);
      }
      const variant = pickRandom(ARTIST_QUERY_VARIANTS);
      return searchSongs(`${variant} ${a.artistName}`, 20);
    }),
  );

  for (let i = 0; i < artistResults.length; i++) {
    const res = artistResults[i];
    if (res.status !== "fulfilled") continue;
    const songs = Array.isArray(res.value)
      ? normalizeSongsToCanonical(res.value)
      : (res.value as Song[]);
    for (const s of songs) {
      addCandidate(s);
    }
  }

  // Source 2: Co-occurrences for the user's recent songs (randomize which recent songs to use)
  const recentIds = tasteProfile.recentSongIds || [];
  if (recentIds.length > 0) {
    // Shuffle recent IDs so we pick different co-occurrences each time
    const shuffledRecent = [...recentIds].sort(() => Math.random() - 0.5);
    const cooccurrences = await SongCooccurrence.find({
      songIdA: { $in: shuffledRecent.slice(0, 10) },
    })
      .sort({ decayedScore: -1 })
      .limit(30)
      .lean();
    for (const co of cooccurrences) {
      try {
        const song = await fetchSongById(co.songIdB);
        if (song) addCandidate(song);
      } catch {}
    }
  }

  // Source 3: Language discovery (randomized query variants)
  const topLangs = tasteProfile.languages.slice(0, 3);
  const currentYear = new Date().getFullYear();
  const langResults = await Promise.allSettled(
    topLangs.map((l) => {
      const variant = pickRandom(LANG_QUERY_VARIANTS);
      const yearVariant = Math.random() > 0.5 ? ` ${currentYear}` : "";
      return searchSongs(
        `${variant} ${l.language} songs${yearVariant}`,
        20,
      );
    }),
  );
  for (const res of langResults) {
    if (res.status !== "fulfilled") continue;
    const songs = normalizeSongsToCanonical(res.value);
    for (const s of songs) {
      addCandidate(s);
    }
  }

  // Source 4: Genre/mood discovery for extra variety
  const moodQueries = ["chill vibes", "upbeat energy", "romantic", "party", "soulful", "acoustic", "lo-fi"];
  const randomMood = pickRandom(moodQueries);
  const randomLang = topLangs.length > 0 ? pickRandom(topLangs).language : "hindi";
  try {
    const moodSongs = await searchSongs(`${randomMood} ${randomLang} songs`, 15);
    const normalized = normalizeSongsToCanonical(moodSongs);
    for (const s of normalized) {
      addCandidate(s);
    }
  } catch {}

  if (candidates.length === 0) {
    return getColdStartBatch(excludeIds, limit);
  }

  // Shuffle candidates to introduce randomness before ranking
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Rank using rankCandidates (which applies cover penalty + popularity)
  // Then add random noise to final scores so tied songs shuffle differently each time
  const ranked = rankCandidates(candidates, tasteProfile, limit * 3);
  for (const song of ranked) {
    (song as any)._recScore = ((song as any)._recScore || 0) + Math.floor(Math.random() * 30) - 15;
  }
  ranked.sort((a, b) => ((b as any)._recScore ?? 0) - ((a as any)._recScore ?? 0));
  const withReasons = attachReason(ranked, tasteProfile);

  // Apply diversity limit of max 2 songs per artist & unique song titles in the final returned batch
  const artistCount = new Map<string, number>();
  const seenNames = new Set<string>();
  const diversified: Song[] = [];

  for (const song of withReasons) {
    const cleanName = cleanSongNameForDeduplication(song.name);
    if (cleanName && seenNames.has(cleanName)) continue;

    const firstArtist = (song.primaryArtists || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const count = artistCount.get(firstArtist) || 0;
    if (count >= 2) continue; // max 2 per artist
    artistCount.set(firstArtist, count + 1);
    if (cleanName) seenNames.add(cleanName);

    const clean = { ...song };
    delete (clean as any)._recScore;
    diversified.push(clean);

    if (diversified.length >= limit) break;
  }

  return diversified;
}

export async function getLanguageAwareNewReleases(
  tasteProfile: IUserTasteProfile | null,
  limit: number = 20,
): Promise<Song[]> {
  const currentYear = new Date().getFullYear();

  // Cold start / Guest
  if (!tasteProfile || tasteProfile.languages.length === 0) {
    const fallbackLangs = ["hindi", "english", "tamil", "punjabi"];
    const results = await Promise.allSettled(
      fallbackLangs.map((l) => searchSongs(`new ${l} songs ${currentYear}`, 15)),
    );
    const candidates: Song[] = [];
    const seen = new Set<string>();

    for (const res of results) {
      if (res.status !== "fulfilled") continue;
      const normalized = normalizeSongsToCanonical(res.value);
      for (const s of normalized) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          candidates.push(s);
        }
      }
    }

    // Apply light cover penalty (0.5 weight) and popularity
    const scored = candidates.map((song) => {
      let score = 0;
      const title = (song.name || "").toLowerCase();
      score += popularityScore(song.playCount);
      score += coverPenalty(title) * 0.5; // light penalty
      if (!song.streamUrl) score -= 30;
      return { ...song, _recScore: score };
    });

    scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));
    return scored.slice(0, limit).map((s) => {
      const clean = { ...s };
      delete (clean as any)._recScore;
      return clean;
    });
  }

  // Filter languages present at >= 15% (weight >= 0.15)
  let eligibleLangs = tasteProfile.languages.filter((l) => l.weight >= 0.15);
  if (eligibleLangs.length === 0 && tasteProfile.languages.length > 0) {
    eligibleLangs = [tasteProfile.languages[0]];
  }

  // Fetch new releases for each language in parallel
  const fetchResults = await Promise.allSettled(
    eligibleLangs.map((el) =>
      searchSongs(`new ${el.language} songs ${currentYear}`, 25),
    ),
  );

  const candidatesByLang: Record<string, Song[]> = {};
  for (let i = 0; i < eligibleLangs.length; i++) {
    const el = eligibleLangs[i];
    const res = fetchResults[i];
    if (res.status !== "fulfilled") continue;

    const normalized = normalizeSongsToCanonical(res.value);
    // Apply light cover penalty + popularity to sort this language's candidates
    const scored = normalized.map((song) => {
      let score = 0;
      const title = (song.name || "").toLowerCase();
      score += popularityScore(song.playCount);
      score += coverPenalty(title) * 0.5; // light penalty
      if (!song.streamUrl) score -= 30;
      return { ...song, _recScore: score };
    });

    scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));
    candidatesByLang[el.language] = scored.map((s) => {
      const clean = { ...s };
      delete (clean as any)._recScore;
      return clean;
    });
  }

  // Determine allocations
  // Give each eligible language a minimum floor of 3 songs, and allocate the rest proportionally
  const totalEligibleWeight = eligibleLangs.reduce((sum, el) => sum + el.weight, 0);
  const allocations: Record<string, number> = {};
  let remainingSlots = limit;

  // First round: give 3 songs minimum floor
  const floor = Math.min(3, Math.floor(limit / eligibleLangs.length));
  for (const el of eligibleLangs) {
    allocations[el.language] = floor;
    remainingSlots -= floor;
  }

  // Second round: distribute remaining slots proportionally
  if (remainingSlots > 0 && totalEligibleWeight > 0) {
    for (const el of eligibleLangs) {
      const proportional = Math.round(
        (el.weight / totalEligibleWeight) * remainingSlots,
      );
      allocations[el.language] = (allocations[el.language] || 0) + proportional;
    }
  }

  // Collect and merge songs matching allocations
  const result: Song[] = [];
  const seen = new Set<string>();

  for (const el of eligibleLangs) {
    const count = allocations[el.language] || 0;
    const songs = candidatesByLang[el.language] || [];
    let added = 0;
    for (const song of songs) {
      if (added >= count) break;
      if (!seen.has(song.id)) {
        seen.add(song.id);
        result.push(song);
        added++;
      }
    }
  }

  // If we ended up with less than the limit, fill up from any of the lists
  if (result.length < limit) {
    for (const el of eligibleLangs) {
      const songs = candidatesByLang[el.language] || [];
      for (const song of songs) {
        if (result.length >= limit) break;
        if (!seen.has(song.id)) {
          seen.add(song.id);
          result.push(song);
        }
      }
    }
  }

  return result;
}

const LANGUAGE_PLAYLIST_MAP: Record<string, string[]> = {
  hindi: ["latest hindi", "taaza tunes", "new releases hindi"],
  tamil: ["latest kollywood", "latest tamil", "new releases tamil"],
  telugu: ["latest tollywood", "latest telugu", "new releases telugu"],
  punjabi: ["latest punjabi", "new releases punjabi"],
  english: ["latest english", "new releases english", "fresh latin hits"],
  kannada: ["latest kannada", "latest sandalwood", "new releases kannada"],
  malayalam: ["latest malayalam", "new releases malayalam"],
  marathi: ["latest marathi", "new releases marathi"],
  bengali: ["latest bengali", "new releases bengali"],
  gujarati: ["latest gujarati", "new releases gujarati"],
  bhojpuri: ["latest bhojpuri", "new releases bhojpuri"],
};

async function fetchCuratedNewReleases(lang: string): Promise<Song[]> {
  const currentYear = new Date().getFullYear();
  const searchTerms = LANGUAGE_PLAYLIST_MAP[lang.toLowerCase()] || [
    `latest ${lang}`,
    `new releases ${lang}`,
  ];

  const candidates: Song[] = [];
  const seen = new Set<string>();

  const addSongs = (songs: Song[]) => {
    for (const s of songs) {
      if (s?.id && !seen.has(s.id)) {
        seen.add(s.id);
        candidates.push(s);
      }
    }
  };

  // 1. Fetch from the top 2 curated playlists
  for (const term of searchTerms) {
    try {
      const playlists = await searchPlaylists(term, 2);
      for (const playlist of playlists) {
        const rawSongs = await getPlaylistSongs(playlist.id);
        if (rawSongs.length > 0) {
          addSongs(normalizeSongsToCanonical(rawSongs));
        }
      }
    } catch (err) {
      console.warn(`[NewReleases] Failed to fetch playlist for term: ${term}`, err);
    }
  }

  // 2. Fetch from active search results for new releases to capture the latest individual tracks
  const searchQueries = [
    `new ${lang} songs ${currentYear}`,
    `latest ${lang} songs ${currentYear}`,
  ];

  for (const query of searchQueries) {
    try {
      const rawSearch = await searchSongs(query, 35);
      if (rawSearch.length > 0) {
        addSongs(normalizeSongsToCanonical(rawSearch));
      }
    } catch (err) {
      console.error(`[NewReleases] Search query failed: ${query}`, err);
    }
  }

  return candidates;
}

function isCompilationReRelease(song: Song): boolean {
  const albumLower = (song.album || "").toLowerCase();
  const nameLower = (song.name || "").toLowerCase();

  // 1. Direct compilation keywords in album name
  const compilationKeywords = [
    "best of", "collection", "hits", "compilation", "romantic songs", 
    "bollywood hits", "top 10", "top 20", "top 30", "top 50", "top 100", 
    "most liked", "selection", "anthology", "mashup", "superhits", 
    "greatest", "memories", "party hits", "lofi mix", "chill mix",
    "sad songs", "love hits", "essential", "essentials", "playlist",
    "music day", "day 2026", "hits 2026", "celebration", "festival",
    "monsoon", "summer", "winter", "spring"
  ];
  for (const kw of compilationKeywords) {
    if (albumLower.includes(kw)) return true;
  }

  // 2. Movie/Album mismatch heuristic
  const fromMatch = nameLower.match(/\(from\s+["'“&quot;](.+?)["'”&quot;]\)/) || 
                    nameLower.match(/from\s+["'“&quot;](.+?)["'”&quot;]/);
  if (fromMatch && fromMatch[1]) {
    const movieName = fromMatch[1].trim();
    if (movieName && !albumLower.includes(movieName)) {
      return true;
    }
  }

  // 3. Mathematical playcount ceiling for new releases (40M plays in < 45 days is impossible on JioSaavn)
  if (song.releaseDate) {
    const rDate = new Date(song.releaseDate);
    const today = new Date();
    const diffTime = today.getTime() - rDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= 45 && song.playCount > 40000000) {
      return true; // compilation re-release
    }
  }

  return false;
}

export async function getIndustryNewReleases(
  langs: string[],
  limit: number = 20,
): Promise<Song[]> {
  const targetLangs = langs.length > 0 ? langs : ["hindi"];

  const fetchResults = await Promise.allSettled(
    targetLangs.map((l) => fetchCuratedNewReleases(l))
  );

  const candidates: Song[] = [];
  const seen = new Set<string>();

  for (const res of fetchResults) {
    if (res.status !== "fulfilled") continue;
    for (const s of res.value) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        candidates.push(s);
      }
    }
  }

  // Batch enrich all candidates with full details (carrying precise release dates)
  let enrichedSongs: Song[] = [];
  try {
    const candidateIds = candidates.map((s) => s.id);
    if (candidateIds.length > 0) {
      const rawEnriched = await getSongsDetailsBatch(candidateIds);
      const normalizedEnriched = normalizeSongsToCanonical(rawEnriched);
      const enrichedMap = new Map<string, Song>();
      for (const s of normalizedEnriched) {
        if (s?.id) enrichedMap.set(s.id, s);
      }
      enrichedSongs = candidates.map((c) => enrichedMap.get(c.id) || c);
    } else {
      enrichedSongs = candidates;
    }
  } catch (err) {
    console.error("[NewReleases] Failed to enrich candidates with precise release dates:", err);
    enrichedSongs = candidates;
  }

  // Filter out compilation re-releases of older catalog items
  const nonCompilationSongs = enrichedSongs.filter((song) => !isCompilationReRelease(song));

  const today = new Date();

  const scored = nonCompilationSongs.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    score += popularityScore(song.playCount);

    // Popular/Mainstream Artist Boost vs Indie Penalty
    const artistStr = (song.primaryArtists || "").toLowerCase();
    let hasTopArtist = false;
    for (const topArt of POPULAR_ARTISTS) {
      if (artistStr.includes(topArt)) {
        hasTopArtist = true;
        break;
      }
    }

    if (hasTopArtist) {
      score += 120; // Massive boost for top mainstream artists
    } else {
      // If it doesn't feature a mainstream artist:
      if (song.playCount < 1_500_000) {
        score -= 150; // Heavily penalize obscure indie/low-playcount releases
      } else if (song.playCount < 5_000_000) {
        score -= 60;  // Moderate penalty for lesser known mid-tier releases
      }
    }
    
    // Cover/karaoke penalty
    score += coverPenalty(title) * 0.5; // light penalty
    if (!song.streamUrl) score -= 30;

    // Precise 30-day filter boost/ranking
    let isWithin30Days = false;
    let isWithin90Days = false;

    if (song.releaseDate) {
      const rDate = new Date(song.releaseDate);
      if (!isNaN(rDate.getTime())) {
        const diffTime = today.getTime() - rDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        // We include a tiny negative limit (-1 day) to handle timezones / future releases
        if (diffDays >= -1 && diffDays <= 30) {
          isWithin30Days = true;
          score += 150; // HUGE boost to place them at the absolute top
        } else if (diffDays >= -1 && diffDays <= 90) {
          isWithin90Days = true;
          score += 60;  // Moderate boost for recent 3-month releases
        }
      }
    }

    // Year-based fallback (if releaseDate is missing/invalid)
    const currentYear = today.getFullYear();
    if (song.year === String(currentYear)) {
      score += 20;
    } else if (song.year === String(currentYear - 1)) {
      score += 5;
    } else {
      score -= 80; // heavily penalize older catalog items
    }

    return { 
      ...song, 
      _recScore: score, 
      _isWithin30Days: isWithin30Days, 
      _isWithin90Days: isWithin90Days 
    };
  });

  // Sort candidates by score
  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  // 1. Try to get candidates within the last 30 days
  let finalSongs = scored.filter((s) => s._isWithin30Days);

  // 2. If we don't have enough, expand to last 90 days
  if (finalSongs.length < limit) {
    const extra90 = scored.filter((s) => s._isWithin90Days && !finalSongs.some((f) => f.id === s.id));
    finalSongs = [...finalSongs, ...extra90];
  }

  // 3. If still not enough, expand to current year
  if (finalSongs.length < limit) {
    const currentYearStr = String(today.getFullYear());
    const extraCurrentYear = scored.filter((s) => s.year === currentYearStr && !finalSongs.some((f) => f.id === s.id));
    finalSongs = [...finalSongs, ...extraCurrentYear];
  }

  // 4. If still not enough, fall back to everything else
  if (finalSongs.length < limit) {
    const remaining = scored.filter((s) => !finalSongs.some((f) => f.id === s.id));
    finalSongs = [...finalSongs, ...remaining];
  }

  // Slice to limit
  const selected = finalSongs.slice(0, limit);

  // Return cleaned items
  return selected.map((s) => {
    const clean = { ...s };
    delete (clean as any)._recScore;
    delete (clean as any)._isWithin30Days;
    delete (clean as any)._isWithin90Days;
    return clean;
  });
}

// ─── APPLE MUSIC MIX GENERATORS ───────────────────────────────────

export async function generateNewMusicMix(
  tasteProfile: IUserTasteProfile | null,
  excludeIds: string[],
  limit: number = 25,
): Promise<Song[]> {
  if (!tasteProfile || tasteProfile.languages.length === 0) {
    return getIndustryNewReleases(["hindi", "english"], limit);
  }

  const langs = tasteProfile.languages.map((l) => l.language);
  const newReleases = await getIndustryNewReleases(langs, 100);

  const excludeSet = new Set(excludeIds);
  const artistNameSet = new Set(tasteProfile.artists.map((a) => a.artistName.toLowerCase()));

  const scored = newReleases
    .filter((song) => !excludeSet.has(song.id))
    .map((song) => {
      let score = 0;
      const songArtists = (song.primaryArtists || "").split(",").map((a) => a.trim().toLowerCase());
      
      for (const sa of songArtists) {
        if (artistNameSet.has(sa)) {
          score += 100;
          break;
        }
      }
      
      const langWeightMap = new Map(tasteProfile.languages.map((l) => [l.language, l.weight]));
      if (song.language && langWeightMap.has(song.language)) {
        score += Math.round(30 * langWeightMap.get(song.language)!);
      }
      
      score += popularityScore(song.playCount);
      score += coverPenalty(song.name || "");
      
      return { ...song, _recScore: score };
    });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));
  return scored.slice(0, limit).map((s) => {
    const clean = { ...s };
    delete (clean as any)._recScore;
    return clean;
  });
}

export async function generateFavoritesMix(
  tasteProfile: IUserTasteProfile,
  excludeIds: string[],
  limit: number = 25,
): Promise<Song[]> {
  const excludeSet = new Set(excludeIds);
  const candidates: Song[] = [];

  const addCandidate = (song: Song) => {
    if (excludeSet.has(song.id)) return;
    excludeSet.add(song.id);
    candidates.push(song);
  };

  const recentIds = tasteProfile.recentSongIds || [];
  if (recentIds.length > 0) {
    try {
      const recentSongs = await fetchSongsByIds(recentIds.slice(0, 20));
      for (const s of recentSongs) {
        addCandidate(s);
      }
    } catch {}
  }

  const topArtists = tasteProfile.artists.slice(0, 5);
  const fetchResults = await Promise.allSettled(
    topArtists.map((a) => {
      if (a.artistId && /^\d+$/.test(a.artistId)) {
        return fetchArtistSongs(a.artistId, 0, 10);
      }
      return searchSongs(`${a.artistName} hits`, 15);
    })
  );

  for (const res of fetchResults) {
    if (res.status === "fulfilled") {
      const normalized = normalizeSongsToCanonical(res.value);
      for (const s of normalized) {
        addCandidate(s);
      }
    }
  }

  const artistScoreMap = new Map(tasteProfile.artists.map((a) => [a.artistName.toLowerCase(), a.score]));
  const langWeightMap = new Map(tasteProfile.languages.map((l) => [l.language, l.weight]));

  const scored = candidates.map((song) => {
    let score = 0;
    const songArtists = (song.primaryArtists || "").split(",").map((a) => a.trim().toLowerCase());
    
    for (const sa of songArtists) {
      if (artistScoreMap.has(sa)) {
        score += Math.min(100, artistScoreMap.get(sa)! * 10);
        break;
      }
    }

    if (song.language && langWeightMap.has(song.language)) {
      score += Math.round(50 * langWeightMap.get(song.language)!);
    }

    score += popularityScore(song.playCount);
    score += coverPenalty(song.name || "");

    return { ...song, _recScore: score };
  });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));
  return scored.slice(0, limit).map((s) => {
    const clean = { ...s };
    delete (clean as any)._recScore;
    return clean;
  });
}

export async function generateDiscoveryMix(
  tasteProfile: IUserTasteProfile,
  excludeIds: string[],
  limit: number = 25,
): Promise<Song[]> {
  const excludeSet = new Set(excludeIds);
  const top5Artists = new Set(tasteProfile.artists.slice(0, 5).map((a) => a.artistName.toLowerCase()));
  const secondaryArtists = tasteProfile.artists.slice(5, 15);
  
  const candidates: Song[] = [];
  const addCandidate = (song: Song) => {
    if (excludeSet.has(song.id)) return;
    const songArtists = (song.primaryArtists || "").split(",").map((a) => a.trim().toLowerCase());
    if (songArtists.some((sa) => top5Artists.has(sa))) return;
    excludeSet.add(song.id);
    candidates.push(song);
  };

  if (secondaryArtists.length > 0) {
    const fetchResults = await Promise.allSettled(
      secondaryArtists.map((a) => {
        if (a.artistId && /^\d+$/.test(a.artistId)) {
          return fetchArtistSongs(a.artistId, 0, 8);
        }
        return searchSongs(`${a.artistName} hits`, 10);
      })
    );
    for (const res of fetchResults) {
      if (res.status === "fulfilled") {
        const normalized = normalizeSongsToCanonical(res.value);
        for (const s of normalized) {
          addCandidate(s);
        }
      }
    }
  }

  const recentIds = tasteProfile.recentSongIds || [];
  if (recentIds.length > 0) {
    const seeds = recentIds.slice(0, 3);
    const recResults = await Promise.allSettled(
      seeds.map((id) => getSuggestions(id, 20))
    );
    for (const res of recResults) {
      if (res.status === "fulfilled") {
        const normalized = normalizeSongsToCanonical(res.value);
        for (const s of normalized) {
          addCandidate(s);
        }
      }
    }
  }

  if (candidates.length < limit * 1.5) {
    const secondaryLangs = tasteProfile.languages.slice(1, 3);
    const langResults = await Promise.allSettled(
      secondaryLangs.map((l) => searchSongs(`trending ${l.language} songs`, 20))
    );
    for (const res of langResults) {
      if (res.status === "fulfilled") {
        const normalized = normalizeSongsToCanonical(res.value);
        for (const s of normalized) {
          addCandidate(s);
        }
      }
    }
  }

  const secondaryLangSet = new Set(tasteProfile.languages.slice(1, 3).map((l) => l.language));
  const secondaryArtistSet = new Set(secondaryArtists.map((a) => a.artistName.toLowerCase()));

  const scored = candidates.map((song) => {
    let score = 0;
    const songArtists = (song.primaryArtists || "").split(",").map((a) => a.trim().toLowerCase());
    
    for (const sa of songArtists) {
      if (secondaryArtistSet.has(sa)) {
        score += 40;
        break;
      }
    }

    if (song.language && secondaryLangSet.has(song.language)) {
      score += 30;
    }

    score += popularityScore(song.playCount);
    score += coverPenalty(song.name || "");

    return { ...song, _recScore: score };
  });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));
  return scored.slice(0, limit).map((s) => {
    const clean = { ...s };
    delete (clean as any)._recScore;
    return clean;
  });
}


