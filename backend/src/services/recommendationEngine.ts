// ════════════════════════════════════════════════════════════════
// SOULSYNC RECOMMENDATION ENGINE
// Taste-aware, explicit-language filtered, cooldown-excluded recs.
// Reuses searchRanker's cover/popularity logic, adds behavioral signals.
// ════════════════════════════════════════════════════════════════

import mongoose from "mongoose";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { UserTasteProfile, IUserTasteProfile, IArtistAffinity } from "../models/UserTasteProfile.js";
import { SongCooccurrence } from "../models/SongCooccurrence.js";
import { User } from "../models/User.js";
import { Playlist } from "../models/Playlist.js";
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
  resolveLanguageFilter,
  filterByLanguages,
  getRecentlyRecommendedSongIds,
  recordRecentlyRecommended,
} from "./scoringUtils.js";

import { generateCandidatePool } from "./candidateGenerator.js";
import { rankCandidates as rankWithWeightedEngine } from "./rankingEngine.js";
import { applyDiversityAndDiscovery } from "./diversityEngine.js";
import { attachRecommendationExplanation } from "./explanationEngine.js";
import { getActiveSessionContext } from "./sessionEngine.js";
import { predictNextTracks } from "./upNextEngine.js";
import { computeUserTasteProfile, getUserTasteProfile } from "./tasteEngine.js";
import { computeAdaptiveWeights } from "./adaptiveWeights.js";
import { getAdaptiveBucketRatios } from "./bucketEngagementService.js";

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
  MAX_PER_ARTIST: 2,         // Max songs from same artist in one recommendation set
  // Taste profile computation
  RECENCY_HALF_LIFE_DAYS: 14,// Half-life for exponential decay
  RECOMPUTE_AFTER_N_PLAYS: 5,// Rebuild profile after this many new plays
  PROFILE_CACHE_TTL: 600,    // Redis cache TTL for taste profile (seconds)
  RESULT_CACHE_TTL: 300,     // Redis cache TTL for recommendation results (seconds)
} as const;

// Cover/junk keywords
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

async function resolveUserPrefs(
  userId?: string,
  userPrefs?: { languages?: string[] } | null,
): Promise<{ languages?: string[] } | null> {
  if (userPrefs && userPrefs.languages) return userPrefs;
  if (!userId || userId === "guest") return null;
  try {
    const user = await User.findById(userId).select("preferences").lean();
    return user?.preferences || null;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// 1. BUILD TASTE PROFILE
// ════════════════════════════════════════════════════════════════
export async function buildTasteProfile(
  userId: string,
): Promise<IUserTasteProfile> {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const now = Date.now();

  const history = await ListeningHistory.find({ userId: userObjId })
    .sort({ playedAt: -1 })
    .limit(500)
    .lean();

  if (history.length === 0) {
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

  const artistMap = new Map<string, { name: string; score: number; count: number }>();

  for (const h of history) {
    const rawArtist = h.artist || "Unknown";
    const ageMs = now - new Date(h.playedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayWeight = Math.pow(0.5, ageDays / W.RECENCY_HALF_LIFE_DAYS);

    const artistNames = rawArtist
      .split(/[,/&]+/)
      .map((a) => a.trim())
      .filter(Boolean);

    for (const name of artistNames) {
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

  const artists: IArtistAffinity[] = Array.from(artistMap.entries())
    .map(([id, { name, score, count }]) => ({
      artistId: id,
      artistName: name,
      score: Math.round(score * 100) / 100,
      playCount: count,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

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

  const recentSongIds = [...new Set(history.slice(0, 100).map((h) => h.songId))];

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

  await redisSet(
    `taste:${userId}`,
    JSON.stringify(profile),
    W.PROFILE_CACHE_TTL,
  ).catch(() => {});

  await redisDel(`dashboard:${userId}`).catch(() => {});

  return profile;
}

export async function getTasteProfile(
  userId: string,
): Promise<IUserTasteProfile | null> {
  try {
    const cached = await redisGet(`taste:${userId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  const existing = await UserTasteProfile.findOne({
    userId: new mongoose.Types.ObjectId(userId),
  }).lean() as IUserTasteProfile | null;

  if (existing) {
    ListeningHistory.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    }).then((currentCount) => {
      const delta = currentCount - (existing.lastPlayCountAtCompute || 0);
      if (delta >= W.RECOMPUTE_AFTER_N_PLAYS) {
        buildTasteProfile(userId).catch(() => {});
      }
    }).catch(() => {});

    await redisSet(
      `taste:${userId}`,
      JSON.stringify(existing),
      W.PROFILE_CACHE_TTL,
    ).catch(() => {});
    return existing;
  }

  return buildTasteProfile(userId);
}

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
    const prev = await ListeningHistory.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      songId: { $ne: currentEntry.songId },
    })
      .sort({ playedAt: -1 })
      .lean();

    if (!prev) return;

    const [songA, songB] =
      prev.songId < currentEntry.songId
        ? [prev.songId, currentEntry.songId]
        : [currentEntry.songId, prev.songId];

    await SongCooccurrence.findOneAndUpdate(
      { songIdA: songA, songIdB: songB },
      {
        $inc: { cooccurCount: 1, rawScore: 1, decayedScore: 1 },
        $set: { lastPlayedAt: new Date() },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error("[RecEngine] recordCooccurrence error:", err);
  }
}

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
    userPrefs?: { languages?: string[] } | null;
    userId?: string;
  },
): Promise<RecommendedSong[]> {
  const { currentSongId, profile, limit = 30, userPrefs, userId } = params;
  const candidates: RecommendedSong[] = [];
  const seenIds = new Set<string>(profile?.recentSongIds?.slice(0, 30) || []);

  const prefs = await resolveUserPrefs(userId, userPrefs);
  const { languages: allowedLangs } = resolveLanguageFilter(prefs, profile);

  const addCandidate = (song: Song, reason: string) => {
    if (seenIds.has(song.id)) return;
    seenIds.add(song.id);
    candidates.push({ ...song, reason });
  };

  if (mode === "next" && currentSongId) {
    try {
      const cooccurrences = await SongCooccurrence.find({ songIdA: currentSongId })
        .sort({ decayedScore: -1 })
        .limit(20)
        .lean();

      for (const co of cooccurrences) {
        if (seenIds.has(co.songIdB)) continue;
        try {
          const song = await fetchSongById(co.songIdB);
          if (song) addCandidate(song, "Frequently played together");
        } catch {}
      }
    } catch {}

    try {
      const raw = await getSuggestions(currentSongId, 30);
      const normalized = normalizeSongsToCanonical(raw);
      for (const s of normalized) {
        addCandidate(s, "Similar vibe");
      }
    } catch {}
  }

  if (profile && profile.artists.length > 0) {
    // Sort by score descending — highest-affinity artists first. No Math.random().
    const topArtists = [...profile.artists]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const artistResults = await Promise.allSettled(
      topArtists.map((a) => {
        if (a.artistId && /^\d+$/.test(a.artistId)) {
          return fetchArtistSongs(a.artistId, 0, 1);
        }
        return searchSongs(`${a.artistName}`, 15);
      }),
    );

    for (let i = 0; i < artistResults.length; i++) {
      const res = artistResults[i];
      if (res.status !== "fulfilled") continue;
      const songs = Array.isArray(res.value) ? normalizeSongsToCanonical(res.value) : (res.value as Song[]);
      const artistName = topArtists[i].artistName;
      for (const s of songs.slice(0, 8)) {
        addCandidate(s, `Because you like ${artistName}`);
      }
    }
  }

  // NOTE: Generic trending search injection removed.
  // It added language chart noise with no personalization signal.
  // Made For You uses getTasteProfileBatch() which has proper sourcing.
  // Home mode additional candidates come from liked songs and ecosystem peers.

  const langFiltered = filterByLanguages(candidates, allowedLangs);
  return langFiltered.slice(0, limit * 2);
}

export function rankCandidates(
  candidates: RecommendedSong[],
  profile: IUserTasteProfile | null,
  limit: number = 20,
): RecommendedSong[] {
  if (!candidates.length) return [];

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

  const scored = candidates.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    const artist = (song.primaryArtists || "").toLowerCase();
    const lang = (song.language || "").toLowerCase();
    const label = ((song as any).label || "").toLowerCase();

    score += popularityScore(song.playCount);
    score += coverPenalty(title);

    if (label && BLACKLISTED_LABELS.some((bl) => label.includes(bl))) {
      score += W.BLACKLISTED_LABEL;
    }

    for (const marker of ORIGINAL_MARKERS) {
      if (title.includes(marker)) {
        score += W.ORIGINAL_BONUS;
        break;
      }
    }

    const songArtists = artist.split(",").map((a) => a.trim().toLowerCase());
    for (const sa of songArtists) {
      if (artistNameSet.has(sa)) {
        score += W.TASTE_ARTIST_MATCH;
        break;
      }
      for (const profileArtist of artistNameSet) {
        if (sa.includes(profileArtist) || profileArtist.includes(sa)) {
          score += W.TASTE_ARTIST_MATCH * 0.6;
          break;
        }
      }
    }

    if (lang && langWeightMap.has(lang)) {
      const langWeight = langWeightMap.get(lang)!;
      score += Math.round(W.TASTE_LANG_MATCH * langWeight);
    }

    if (!song.streamUrl) score -= 30;

    // Age penalty removed: release year does not determine whether a user
    // will enjoy a song. Behavior (replay, completion, likes) does.
    // A user who replays A.R. Rahman's 2004 track daily should get more of it,
    // not less, because of its age.

    return { ...song, _recScore: score };
  });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  const artistCount = new Map<string, number>();
  const seenSongNames = new Set<string>();
  const diversified: RecommendedSong[] = [];

  for (const song of scored) {
    const cleanName = cleanSongNameForDeduplication(song.name);
    if (cleanName && seenSongNames.has(cleanName)) continue;

    const firstArtist = (song.primaryArtists || "")
      .split(",")[0]
      .trim()
      .toLowerCase();

    const count = artistCount.get(firstArtist) || 0;
    if (count >= W.MAX_PER_ARTIST) continue;

    artistCount.set(firstArtist, count + 1);
    if (cleanName) seenSongNames.add(cleanName);
    diversified.push(song);

    if (diversified.length >= limit) break;
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
  return W.LOW_PLAYCOUNT_PENALTY;
}

function coverPenalty(title: string): number {
  for (const kw of HARD_COVER_KW) {
    if (title.includes(kw)) return W.COVER_PENALTY_HARD;
  }
  for (const kw of SOFT_COVER_KW) {
    if (title.includes(kw)) return W.COVER_PENALTY_SOFT;
  }
  return 0;
}

export function attachReason(
  candidates: RecommendedSong[],
  profile: IUserTasteProfile | null,
): RecommendedSong[] {
  if (!profile) {
    return candidates.map((s) => ({
      ...s,
      reason: s.reason || "Popular right now",
    }));
  }

  const artistNames = profile.artists.map((a) => a.artistName.toLowerCase());

  return candidates.map((song) => {
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
// PUBLIC RECOMMENDATION SURFACES
// ════════════════════════════════════════════════════════════════

export async function getHomeRecommendations(
  userId: string,
  userPrefs?: { languages?: string[] } | null,
): Promise<RecommendedSong[]> {
  const cacheKey = `rec:home:${userId}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const profile = await getTasteProfile(userId);
  const prefs = await resolveUserPrefs(userId, userPrefs);
  const { languages: allowedLangs } = resolveLanguageFilter(prefs, profile);

  const candidates = await getCandidates("home", { profile, limit: 25, userPrefs: prefs, userId });
  const langFiltered = filterByLanguages(candidates, allowedLangs);
  const ranked = rankCandidates(langFiltered, profile, 20);
  const withReasons = attachReason(ranked, profile);

  const result = withReasons.map(({ _recScore, ...rest }) => rest);

  await redisSet(cacheKey, JSON.stringify(result), W.RESULT_CACHE_TTL).catch(() => {});
  return result;
}

export async function getNextRecommendations(
  currentSongId: string,
  userId?: string,
  excludeIds: string[] = [],
  userPrefs?: { languages?: string[] } | null,
): Promise<RecommendedSong[]> {
  if (!currentSongId) return [];

  const prefs = await resolveUserPrefs(userId, userPrefs);
  const profile = userId ? await getUserTasteProfile(userId) : null;

  const recommendedSongs = await predictNextTracks({
    currentSongId,
    userId,
    queueSongIds: excludeIds,
    limit: 20,
    userPrefs: prefs,
    tasteProfile: profile,
  });

  return recommendedSongs as RecommendedSong[];
}

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
      buildTasteProfile(userId).catch(() => {});
    }
  } catch (err) {
    console.error("[RecEngine] maybeRecomputeTaste error:", err);
  }
}

// ════════════════════════════════════════════════════════════════
// 6 SURFACE GENERATORS (HARD LANGUAGE FILTER + 7D COOLDOWN EXCLUSIONS)
// ════════════════════════════════════════════════════════════════

export async function generateSeedAnchoredBatch(
  seed: Song,
  tasteProfile: IUserTasteProfile | null,
  excludeIds: string[],
  batchSize: number = 8,
  userPrefs?: { languages?: string[] } | null,
  userId?: string,
): Promise<Song[]> {
  const prefs = await resolveUserPrefs(userId, userPrefs);
  const { languages: allowedLangs } = resolveLanguageFilter(prefs, tasteProfile);

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

  try {
    const cooccurrences = await SongCooccurrence.find({ songIdA: seedId })
      .sort({ decayedScore: -1 })
      .limit(20)
      .lean();
    for (const co of cooccurrences) {
      try {
        const song = await fetchSongById(co.songIdB);
        if (song) addCandidate(song);
      } catch {}
    }
  } catch {}

  try {
    const raw = await getSuggestions(seedId, 30);
    const normalized = normalizeSongsToCanonical(raw);
    for (const s of normalized) {
      addCandidate(s);
    }
  } catch {}

  if (seedArtist) {
    try {
      const artistSongs = await searchSongs(`${seedArtist} hits`, 15);
      const normalized = normalizeSongsToCanonical(artistSongs);
      for (const s of normalized) {
        addCandidate(s);
      }
    } catch {}
  }

  // User Taste Profile top artists blending (YouTube-style personalized radio)
  if (tasteProfile && tasteProfile.artists && tasteProfile.artists.length > 0) {
    const userTopArtists = tasteProfile.artists.slice(0, 5);
    const userArtistResults = await Promise.allSettled(
      userTopArtists.map((a) => searchSongs(`${a.artistName} hits`, 10))
    );
    for (const res of userArtistResults) {
      if (res.status === "fulfilled") {
        const normalized = normalizeSongsToCanonical(res.value);
        for (const s of normalized) {
          addCandidate(s);
        }
      }
    }
  }

  // Hard filter candidates by allowedLangs
  const langFiltered = filterByLanguages(candidates, allowedLangs);

  // REMOVED: getColdStartBatch fallback here.
  // Previously: when pool < 10, this pulled random songs from TOP_ARTISTS_BY_LANGUAGE —
  // the root cause of "random old Tamil songs in Up Next".
  // Now: if the pool is thin, the caller (upNextEngine) handles it via the
  // ecosystem tier instead. Cold-start is only valid for the Home surface.

  if (langFiltered.length === 0) return [];

  const scored = langFiltered.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    const artist = (song.primaryArtists || "").toLowerCase();
    const lang = (song.language || "").toLowerCase();
    const label = ((song as any).label || "").toLowerCase();

    score += popularityScore(song.playCount);
    score += coverPenalty(title);

    if (label && BLACKLISTED_LABELS.some((bl) => label.includes(bl))) {
      score += W.BLACKLISTED_LABEL;
    }

    for (const marker of ORIGINAL_MARKERS) {
      if (title.includes(marker)) {
        score += W.ORIGINAL_BONUS;
        break;
      }
    }

    const songArtists = artist.split(",").map((a) => a.trim().toLowerCase());
    const isSameArtist = songArtists.some(
      (sa) =>
        sa.includes(seedArtist.toLowerCase()) ||
        seedArtist.toLowerCase().includes(sa),
    );
    if (isSameArtist) score += 60;
    if (lang === seedLang) score += 40;

    if (!song.streamUrl) score -= 30;

    return { ...song, _recScore: score };
  });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  const artistCount = new Map<string, number>();
  const diversified: Song[] = [];

  for (const song of scored) {
    const firstArtist = (song.primaryArtists || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const count = artistCount.get(firstArtist) || 0;
    if (count >= 2) continue;
    artistCount.set(firstArtist, count + 1);

    const cleanSong = { ...song };
    delete (cleanSong as any)._recScore;
    (cleanSong as any).reason = `Similar to ${seed.name}`;
    diversified.push(cleanSong);

    if (diversified.length >= batchSize) break;
  }

  return diversified;
}

const TOP_ARTISTS_BY_LANGUAGE: Record<string, string[]> = {
  english: [
    "Ed Sheeran", "Taylor Swift", "The Weeknd", "Drake", "Billie Eilish",
    "Ariana Grande", "Dua Lipa", "Bruno Mars", "Coldplay", "Justin Bieber",
    "Post Malone", "Eminem", "Rihanna", "Beyonce", "Harry Styles", "Olivia Rodrigo",
    "Sabrina Carpenter", "Charlie Puth", "Selena Gomez", "Imagine Dragons"
  ],
  spanish: [
    "Bad Bunny", "Rosalía", "J Balvin", "Karol G", "Rauw Alejandro",
    "Daddy Yankee", "Maluma", "Ozuna", "Luis Fonsi", "Enrique Iglesias",
    "Peso Pluma", "Shakira", "Camilo", "Sebastian Yatra"
  ],
  korean: [
    "BTS", "BLACKPINK", "Stray Kids", "TWICE", "NewJeans", "SEVENTEEN",
    "EXO", "IU", "TXT", "ENHYPEN", "Red Velvet", "LE SSERAFIM", "aespa",
    "ITZY", "Jungkook"
  ],
  japanese: [
    "YOASOBI", "Kenshi Yonezu", "Fujii Kaze", "ONE OK ROCK", "Ado",
    "LiSA", "Official HIGE DANdism", "Hikaru Utada", "RADWIMPS", "Vaundy"
  ],
  french: [
    "Stromae", "Indila", "Gims", "Aya Nakamura", "JUL", "Ninho",
    "Soolking", "Angèle", "ZAZ", "David Guetta", "Daft Punk"
  ],
  german: [
    "Rammstein", "Apache 207", "Bonez MC", "Peter Fox", "CRO",
    "Robin Schulz", "Zedd", "Scorpions", "Tokio Hotel"
  ],
  portuguese: [
    "Anitta", "Alok", "Marília Mendonça", "Gusttavo Lima", "Ludmilla",
    "Roberto Carlos", "Jão", "Luísa Sonza"
  ],
  arabic: [
    "Amr Diab", "Nancy Ajram", "Elissa", "Sherine", "Saad Lamjarred",
    "Mohamed Hamaki", "Tamer Hosny", "Fairouz", "Assala"
  ],
  italian: [
    "Måneskin", "Andrea Bocelli", "Laura Pausini", "Mahmood", "Blanco", "Sfera Ebbasta"
  ],
  russian: [
    "Miyagi & Andy Panda", "Zivert", "Scriptonite", "Jony", "HammAli & Navai"
  ],
  turkish: [
    "Tarkan", "Zeynep Bastık", "Ezhel", "Edis", "Duman", "Sefo"
  ],
  tamil: [
    "Anirudh Ravichander", "A.R. Rahman", "Sid Sriram", "Yuvan Shankar Raja",
    "Harris Jayaraj", "G.V. Prakash", "Hiphop Tamizha", "Santhosh Narayanan",
    "Ilaiyaraaja", "Vijay Antony", "D. Imman", "Sai Abhyankkar"
  ],
  hindi: [
    "Arijit Singh", "Pritam", "Shreya Ghoshal", "A.R. Rahman", "Jubin Nautiyal",
    "Vishal-Shekhar", "Amit Trivedi", "Sachin-Jigar", "Badshah", "Atif Aslam",
    "Sonu Nigam", "Sunidhi Chauhan", "KK", "Mohit Chauhan"
  ],
  telugu: [
    "Devi Sri Prasad", "S. Thaman", "M.M. Keeravani", "Sid Sriram", "Anirudh Ravichander",
    "A.R. Rahman", "Hesham Abdul Wahab", "Gopi Sundar"
  ],
  punjabi: [
    "Diljit Dosanjh", "Karan Aujla", "Sidhu Moose Wala", "AP Dhillon", "B Praak",
    "Guru Randhawa", "Ammy Virk", "Harrdy Sandhu", "Honey Singh", "Jass Manak"
  ],
  malayalam: [
    "Sushin Shyam", "Jakes Bejoy", "Gopi Sundar", "Hesham Abdul Wahab", "Vineeth Sreenivasan"
  ],
  kannada: [
    "Arjun Janya", "V. Harikrishna", "B. Ajaneesh Loknath", "Ravi Basrur", "Vijay Prakash"
  ],
  marathi: [
    "Ajay-Atul", "Avadhoot Gupte", "Swapnil Bandodkar", "Adarsh Shinde"
  ],
  bengali: [
    "Anupam Roy", "Jeet Gannguli", "Indraadip Dasgupta", "Shreya Ghoshal", "Arijit Singh"
  ]
};

export async function getColdStartBatch(
  excludeIds: string[],
  limit: number = 36,
  allowedLangs?: string[],
): Promise<Song[]> {
  const excludeSet = new Set(excludeIds);
  const targetLangs = allowedLangs && allowedLangs.length > 0
    ? allowedLangs
    : ["english", "hindi", "tamil", "punjabi", "telugu"];

  const searchQueries: string[] = [];
  for (const lang of targetLangs) {
    const topArts = TOP_ARTISTS_BY_LANGUAGE[lang.toLowerCase()] || [];
    const shuffledArts = [...topArts].sort(() => Math.random() - 0.5).slice(0, 4);
    for (const art of shuffledArts) {
      searchQueries.push(`${art} hits`);
    }
    searchQueries.push(`best ${lang} songs`);
    searchQueries.push(`trending ${lang} hits`);
  }

  const searchResults = await Promise.allSettled(
    searchQueries.map((q) => searchSongs(q, 15)),
  );

  const candidates: Song[] = [];
  const seenIds = new Set<string>();

  for (const res of searchResults) {
    if (res.status !== "fulfilled") continue;
    const normalized = normalizeSongsToCanonical(res.value);
    const filtered = filterByLanguages(normalized, targetLangs);
    for (const s of filtered) {
      if (!excludeSet.has(s.id) && !seenIds.has(s.id)) {
        seenIds.add(s.id);
        candidates.push(s);
        excludeSet.add(s.id);
      }
    }
  }

  const scored = candidates.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    score += popularityScore(song.playCount);
    score += coverPenalty(title);
    if (!song.streamUrl) score -= 30;
    return { ...song, _recScore: score };
  });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  const artistCount = new Map<string, number>();
  const diversified: Song[] = [];

  for (const song of scored) {
    const firstArtist = (song.primaryArtists || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const count = artistCount.get(firstArtist) || 0;
    if (count >= 2) continue;
    artistCount.set(firstArtist, count + 1);

    const clean = { ...song };
    delete (clean as any)._recScore;
    (clean as any).reason = `Top ${song.language || "Hits"} Track`;
    diversified.push(clean);

    if (diversified.length >= limit) break;
  }

  return diversified;
}

/**
 * Made For You — The addictive blend.
 *
 * Split into three intentional buckets:
 *   70% DISCOVERY   — Songs from your taste profile you have never heard.
 *                     Feeds curiosity. Expands your world.
 *   20% FORGOTTEN   — Liked songs you haven't played in 30+ days.
 *                     Feels like rediscovery. "I forgot how good this is."
 *   10% PLAYLIST    — Songs from your playlists you haven't heard recently.
 *                     Rewards curation. Makes playlists feel alive.
 *
 * The blend is what makes it addictive:
 *   Pure discovery = cold and unfamiliar.
 *   Pure familiarity = boring, no excitement.
 *   This ratio = feels personally crafted.
 */
export async function getTasteProfileBatch(
  tasteProfile: IUserTasteProfile | null,
  excludeIds: string[],
  limit: number = 36,
  userPrefs?: { languages?: string[] } | null,
  userId?: string,
): Promise<Song[]> {
  const prefs = await resolveUserPrefs(userId, userPrefs);
  const { languages: allowedLangs } = resolveLanguageFilter(prefs, tasteProfile);

  const sessionState = await getActiveSessionContext(undefined, userId);
  const recentlySurfaced1d = userId ? await getRecentlyRecommendedSongIds(userId, 1) : [];

  // Build the recent-played set for "forgotten favorites" logic
  const recentlyPlayedIds = new Set<string>(recentlySurfaced1d);
  let likedSongs: { songId: string; title: string; artist: string; albumArt: string; duration: number; downloadUrl: { quality: string; url: string }[] }[] = [];
  let playlistSongs: { songId: string; title: string; artist: string; albumArt: string; duration: number; downloadUrl: { quality: string; url: string }[] }[] = [];

  // ── Collect data needed for all three buckets in parallel ──────
  const excludeSetForDiscovery = new Set<string>([...excludeIds, ...recentlySurfaced1d]);

  if (userId && userId !== "guest") {
    const userObjId = new mongoose.Types.ObjectId(userId);

    // Liked songs + recent history + playlist songs — all in parallel
    const [userDoc, historyEntries, playlistDocs, recentHistory30d] = await Promise.allSettled([
      User.findById(userId).select("likedSongs").lean(),
      ListeningHistory.find({ userId: userObjId })
        .sort({ playedAt: -1 })
        .limit(100)
        .select("songId")
        .lean(),
      Playlist.find({ userId: userObjId })
        .select("songs")
        .lean(),
      // Last 30 days of play for "forgotten favorites" check
      ListeningHistory.find({
        userId: userObjId,
        playedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      })
        .select("songId")
        .lean(),
    ]);

    if (userDoc.status === "fulfilled" && userDoc.value?.likedSongs) {
      likedSongs = userDoc.value.likedSongs as typeof likedSongs;
    }

    // Build recent-30d set for forgotten favorites
    if (recentHistory30d.status === "fulfilled") {
      for (const h of recentHistory30d.value) {
        if (h.songId) recentlyPlayedIds.add(h.songId);
      }
    }

    // Collect playlist songs
    if (playlistDocs.status === "fulfilled") {
      for (const pl of playlistDocs.value) {
        for (const s of (pl.songs || [])) {
          playlistSongs.push(s as typeof playlistSongs[0]);
        }
      }
    }
  }

  const adaptive = computeAdaptiveWeights(tasteProfile);
  const bucketRatios = await getAdaptiveBucketRatios(userId);

  const discoveryLimit = Math.max(1, Math.round(limit * bucketRatios.discoveryRatio));

  const { candidates, candidateSourcesMap } = await generateCandidatePool(
    tasteProfile,
    sessionState,
    allowedLangs,
    excludeSetForDiscovery,
    userId,
    200,
  );

  const scoredCandidates = rankWithWeightedEngine(
    candidates,
    candidateSourcesMap,
    tasteProfile,
    sessionState,
    adaptive.weights,
  );

  const discoverySongs = applyDiversityAndDiscovery(
    scoredCandidates,
    tasteProfile,
    sessionState,
    { targetCount: discoveryLimit, maxPerArtist: 2, maxPerAlbum: 1, discoveryRatio: adaptive.discoveryRatio }
  ).map((song) => {
    const sources = candidateSourcesMap.get(song.id) || [];
    const reason = attachRecommendationExplanation(song, sources, tasteProfile, sessionState);
    return { ...song, reason };
  });

  const usedIds = new Set<string>(discoverySongs.map((s) => s.id));

  // ════════════════════════════════════════════════════════════════
  // BUCKET 2 — FORGOTTEN FAVORITES (20% of limit)
  // Liked songs not played in the last 30 days.
  // ════════════════════════════════════════════════════════════════
  const forgottenLimit = Math.max(1, Math.round(limit * bucketRatios.forgottenRatio));
  const forgottenFavorites: Song[] = [];

  if (likedSongs.length > 0) {
    const forgotten = likedSongs
      .filter((l) => l.songId && !recentlyPlayedIds.has(l.songId) && !usedIds.has(l.songId))
      .sort((a, b) => a.songId.localeCompare(b.songId))
      .slice(0, forgottenLimit * 3);

    const fetched = await Promise.allSettled(
      forgotten.slice(0, forgottenLimit * 2).map((l) => fetchSongById(l.songId))
    );

    for (const res of fetched) {
      if (res.status === "fulfilled" && res.value && !usedIds.has(res.value.id)) {
        if (allowedLangs.length === 0 || filterByLanguages([res.value], allowedLangs).length > 0) {
          forgottenFavorites.push({ ...res.value, reason: "Liked · A while back" } as Song);
          usedIds.add(res.value.id);
          if (forgottenFavorites.length >= forgottenLimit) break;
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // BUCKET 3 — PLAYLIST DEEP CUTS (10% of limit)
  // Songs from user's own playlists not heard recently.
  // ════════════════════════════════════════════════════════════════
  const playlistLimit = Math.max(1, limit - discoveryLimit - forgottenLimit);
  const playlistDeepCuts: Song[] = [];

  if (playlistSongs.length > 0) {
    const freshPlaylistSongs = playlistSongs
      .filter((s) => s.songId && !recentlyPlayedIds.has(s.songId) && !usedIds.has(s.songId))
      .sort((a, b) => a.songId.localeCompare(b.songId))
      .slice(0, playlistLimit * 3);

    const fetched = await Promise.allSettled(
      freshPlaylistSongs.slice(0, playlistLimit * 2).map((s) => fetchSongById(s.songId))
    );

    for (const res of fetched) {
      if (res.status === "fulfilled" && res.value && !usedIds.has(res.value.id)) {
        if (allowedLangs.length === 0 || filterByLanguages([res.value], allowedLangs).length > 0) {
          playlistDeepCuts.push({ ...res.value, reason: "From your playlist" } as Song);
          usedIds.add(res.value.id);
          if (playlistDeepCuts.length >= playlistLimit) break;
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // BLEND & STRICT DIVERSITY (Max 1 per album across the entire output)
  // ════════════════════════════════════════════════════════════════
  const rawBlended: Song[] = [];
  let di = 0, fi = 0, pi = 0, position = 0;

  while (rawBlended.length < limit * 2) {
    const slot = position % 5;
    if (slot === 3 && fi < forgottenFavorites.length) {
      rawBlended.push(forgottenFavorites[fi++]);
    } else if (slot === 4 && pi < playlistDeepCuts.length) {
      rawBlended.push(playlistDeepCuts[pi++]);
    } else if (di < discoverySongs.length) {
      rawBlended.push(discoverySongs[di++]);
    } else if (fi < forgottenFavorites.length) {
      rawBlended.push(forgottenFavorites[fi++]);
    } else if (pi < playlistDeepCuts.length) {
      rawBlended.push(playlistDeepCuts[pi++]);
    } else {
      break;
    }
    position++;
  }

  // Final Pass: Enforce max 1 song per album and max 2 per artist on blended output
  const finalOutput: Song[] = [];
  const finalAlbumCount = new Map<string, number>();
  const finalArtistCount = new Map<string, number>();
  const finalSeenNames = new Set<string>();

  for (const song of rawBlended) {
    if (finalOutput.length >= limit) break;

    const album = (song.album || "").trim().toLowerCase();
    const artist = (song.primaryArtists || "").split(/[,/&]+/)[0].trim().toLowerCase();
    const cleanName = (song.name || "")
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

    if (cleanName && finalSeenNames.has(cleanName)) continue;
    if (album && (finalAlbumCount.get(album) || 0) >= 1) continue; // STRICT max 1 per album!
    if (artist && (finalArtistCount.get(artist) || 0) >= 2) continue; // MAX 2 per artist!

    if (cleanName) finalSeenNames.add(cleanName);
    if (album) finalAlbumCount.set(album, (finalAlbumCount.get(album) || 0) + 1);
    if (artist) finalArtistCount.set(artist, (finalArtistCount.get(artist) || 0) + 1);

    finalOutput.push(song);
  }

  const langFiltered = filterByLanguages(finalOutput, allowedLangs);

  // Dynamic Taste Rotation: Rotate candidates on every request so refreshes are always fresh
  if (langFiltered.length > limit) {
    const topTier = langFiltered.slice(0, Math.min(6, Math.floor(limit / 3)));
    const restPool = langFiltered.slice(topTier.length);
    const rotatedRest = [...restPool].sort(() => Math.random() - 0.5);
    return [...topTier, ...rotatedRest].slice(0, limit);
  }

  return langFiltered.slice(0, limit);
}

export async function getLanguageAwareNewReleases(
  tasteProfile: IUserTasteProfile | null,
  limit: number = 20,
  userPrefs?: { languages?: string[] } | null,
  userId?: string,
): Promise<Song[]> {
  const prefs = await resolveUserPrefs(userId, userPrefs);
  const { languages: allowedLangs } = resolveLanguageFilter(prefs, tasteProfile);

  const newReleases = await getIndustryNewReleases(allowedLangs, limit * 2);
  const langFiltered = filterByLanguages(newReleases, allowedLangs);
  return langFiltered.slice(0, limit);
}

const LANGUAGE_PLAYLIST_MAP: Record<string, string[]> = {
  hindi: ["latest hindi", "taaza tunes", "new releases hindi", "trending hindi hits", "top bollywood releases"],
  tamil: ["latest kollywood", "latest tamil", "new releases tamil", "trending tamil hits", "top kollywood releases"],
  telugu: ["latest tollywood", "latest telugu", "new releases telugu", "trending telugu hits"],
  punjabi: ["latest punjabi", "new releases punjabi", "trending punjabi hits"],
  english: ["latest english", "new releases english", "trending english hits", "top english releases", "fresh hollywood hits"],
  kannada: ["latest kannada", "latest sandalwood", "new releases kannada", "trending kannada hits"],
  malayalam: ["latest malayalam", "new releases malayalam", "trending malayalam hits"],
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
    `trending ${lang} hits`,
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

  try {
    const playlistsResults = await Promise.allSettled(
      searchTerms.map((term) => searchPlaylists(term, 2))
    );

    const playlistIds: string[] = [];
    for (const res of playlistsResults) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        for (const playlist of res.value) {
          if (playlist?.id) playlistIds.push(playlist.id);
        }
      }
    }

    if (playlistIds.length > 0) {
      const songsResults = await Promise.allSettled(
        playlistIds.map((id) => getPlaylistSongs(id))
      );
      for (const res of songsResults) {
        if (res.status === "fulfilled" && Array.isArray(res.value) && res.value.length > 0) {
          addSongs(normalizeSongsToCanonical(res.value));
        }
      }
    }
  } catch {}

  const searchQueries = [
    `new ${lang} songs ${currentYear}`,
    `latest ${lang} hits ${currentYear}`,
    `trending ${lang} releases ${currentYear}`,
  ];

  try {
    const searchResults = await Promise.allSettled(
      searchQueries.map((query) => searchSongs(query, 35))
    );
    for (const res of searchResults) {
      if (res.status === "fulfilled" && Array.isArray(res.value) && res.value.length > 0) {
        addSongs(normalizeSongsToCanonical(res.value));
      }
    }
  } catch {}

  return candidates;
}

function isCompilationReRelease(song: Song): boolean {
  const albumLower = (song.album || "").toLowerCase();
  const nameLower = (song.name || "").toLowerCase();

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
    if (albumLower.includes(kw) || nameLower.includes(kw)) {
      return true;
    }
  }

  const fromMatch = nameLower.match(/\(from\s+["'“&quot;](.+?)["'”&quot;]\)/) || 
                    nameLower.match(/from\s+["'“&quot;](.+?)["'”&quot;]/);
  if (fromMatch && fromMatch[1]) {
    const movieName = fromMatch[1].trim();
    if (movieName && !albumLower.includes(movieName)) {
      return true;
    }
  }

  if (song.releaseDate) {
    const rDate = new Date(song.releaseDate);
    const today = new Date();
    const diffTime = today.getTime() - rDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= 45 && song.playCount > 40000000) {
      return true;
    }
  }

  return false;
}

function isOfficialRelease(song: Song): boolean {
  const name = (song.name || "").toLowerCase();
  const album = (song.album || "").toLowerCase();
  const combined = `${name} ${album}`;

  const nonOfficialKeywords = [
    "cover", "remix", "recreate", "recreated", "re-created", "remake", "lofi", 
    "lo-fi", "slowed", "reverb", "tribute", "instrumental", "acoustic", "unplugged", 
    "reprised", "female version", "male version", "dance mix", "dj mix", "rework", 
    "fan made", "fanmix", "bootleg", "piano cover", "guitar cover", "karaoke"
  ];

  for (const kw of nonOfficialKeywords) {
    if (combined.includes(kw)) return false;
  }
  return true;
}

export async function getIndustryNewReleases(
  langs: string[] = [],
  limit: number = 30,
): Promise<Song[]> {
  const targetLangs = langs.length > 0 ? langs : ["hindi"];

  const fetchResults = await Promise.allSettled(
    targetLangs.map((l) => fetchCuratedNewReleases(l))
  );

  const songLists: Song[][] = fetchResults
    .filter((res): res is PromiseFulfilledResult<Song[]> => res.status === "fulfilled")
    .map((res) => res.value);

  const candidates: Song[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(...songLists.map((l) => l.length), 0);

  for (let i = 0; i < maxLen; i++) {
    for (const list of songLists) {
      if (i < list.length) {
        const s = list[i];
        if (s && s.id && !seen.has(s.id)) {
          seen.add(s.id);
          candidates.push(s);
        }
      }
    }
  }

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
  } catch {
    enrichedSongs = candidates;
  }

  const nonCompilationSongs = enrichedSongs.filter((song) => !isCompilationReRelease(song));
  const officialSongs = nonCompilationSongs.filter((song) => isOfficialRelease(song));
  const targetPool = officialSongs.length >= 10 ? officialSongs : nonCompilationSongs;
  const today = new Date();

  const scored = targetPool.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    score += popularityScore(song.playCount);

    const artistStr = (song.primaryArtists || "").toLowerCase();
    let hasTopArtist = false;
    for (const topArt of POPULAR_ARTISTS) {
      if (artistStr.includes(topArt)) {
        hasTopArtist = true;
        break;
      }
    }

    if (hasTopArtist) {
      score += 120;
    } else {
      if (song.playCount < 1_500_000) {
        score -= 150;
      } else if (song.playCount < 5_000_000) {
        score -= 60;
      }
    }
    
    score += coverPenalty(title) * 0.5;
    if (!song.streamUrl) score -= 30;

    let isWithin30Days = false;
    let isWithin90Days = false;

    if (song.releaseDate) {
      const rDate = new Date(song.releaseDate);
      if (!isNaN(rDate.getTime())) {
        const diffTime = today.getTime() - rDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        
        if (diffDays >= -1 && diffDays <= 30) {
          isWithin30Days = true;
          score += 150;
        } else if (diffDays >= -1 && diffDays <= 90) {
          isWithin90Days = true;
          score += 60;
        }
      }
    }

    const currentYear = today.getFullYear();
    if (song.year === String(currentYear)) {
      score += 20;
    } else if (song.year === String(currentYear - 1)) {
      score += 5;
    } else {
      score -= 80;
    }

    return { 
      ...song, 
      _recScore: score, 
      _isWithin30Days: isWithin30Days, 
      _isWithin90Days: isWithin90Days 
    };
  });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  // Diversity Filter: Max 2 songs per album/soundtrack to prevent a single movie/album from dominating
  const diverseScored: typeof scored = [];
  const albumMap = new Map<string, number>();

  for (const item of scored) {
    const albKey = (item.album || item.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const count = albumMap.get(albKey) || 0;
    if (count < 2) {
      albumMap.set(albKey, count + 1);
      diverseScored.push(item);
    }
  }

  let finalSongs = diverseScored.filter((s) => s._isWithin30Days);

  if (finalSongs.length < limit) {
    const extra90 = diverseScored.filter((s) => s._isWithin90Days && !finalSongs.some((f) => f.id === s.id));
    finalSongs = [...finalSongs, ...extra90];
  }

  if (finalSongs.length < limit) {
    const currentYearStr = String(today.getFullYear());
    const extraCurrentYear = scored.filter((s) => s.year === currentYearStr && !finalSongs.some((f) => f.id === s.id));
    finalSongs = [...finalSongs, ...extraCurrentYear];
  }

  if (finalSongs.length < limit) {
    const remaining = scored.filter((s) => !finalSongs.some((f) => f.id === s.id));
    finalSongs = [...finalSongs, ...remaining];
  }

  const selected = finalSongs.slice(0, limit);

  return selected.map((s) => {
    const clean = { ...s };
    delete (clean as any)._recScore;
    delete (clean as any)._isWithin30Days;
    delete (clean as any)._isWithin90Days;
    return clean;
  });
}

export async function generateNewMusicMix(
  tasteProfile: IUserTasteProfile | null,
  excludeIds: string[],
  limit: number = 25,
  userPrefs?: { languages?: string[] } | null,
  userId?: string,
): Promise<Song[]> {
  const prefs = await resolveUserPrefs(userId, userPrefs);
  const { languages: allowedLangs } = resolveLanguageFilter(prefs, tasteProfile);

  const recent1d = userId ? await getRecentlyRecommendedSongIds(userId, 1) : [];
  const excludeSet = new Set([...excludeIds, ...recent1d]);

  const newReleases = await getIndustryNewReleases(allowedLangs, 100);
  const langFiltered = filterByLanguages(newReleases, allowedLangs);

  const artistNameSet = new Set(
    tasteProfile?.artists?.map((a) => a.artistName.toLowerCase()) || [],
  );

  const scored = langFiltered
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
  userPrefs?: { languages?: string[] } | null,
  userId?: string,
): Promise<Song[]> {
  const prefs = await resolveUserPrefs(userId, userPrefs);
  const { languages: allowedLangs } = resolveLanguageFilter(prefs, tasteProfile);

  const recent1d = userId ? await getRecentlyRecommendedSongIds(userId, 1) : [];
  const excludeSet = new Set([...excludeIds, ...recent1d]);
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

  const langFiltered = filterByLanguages(candidates, allowedLangs);
  const artistScoreMap = new Map(tasteProfile.artists.map((a) => [a.artistName.toLowerCase(), a.score]));

  const scored = langFiltered.map((song) => {
    let score = 0;
    const songArtists = (song.primaryArtists || "").split(",").map((a) => a.trim().toLowerCase());
    
    for (const sa of songArtists) {
      if (artistScoreMap.has(sa)) {
        score += Math.min(100, artistScoreMap.get(sa)! * 10);
        break;
      }
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
  userPrefs?: { languages?: string[] } | null,
  userId?: string,
): Promise<Song[]> {
  const prefs = await resolveUserPrefs(userId, userPrefs);
  const { languages: allowedLangs } = resolveLanguageFilter(prefs, tasteProfile);

  const recent1d = userId ? await getRecentlyRecommendedSongIds(userId, 1) : [];
  const excludeSet = new Set([...excludeIds, ...recent1d]);

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

  const langFiltered = filterByLanguages(candidates, allowedLangs);

  if (langFiltered.length < limit * 1.5) {
    const langResults = await Promise.allSettled(
      allowedLangs.map((l) => searchSongs(`trending ${l} songs`, 20))
    );
    for (const res of langResults) {
      if (res.status === "fulfilled") {
        const normalized = normalizeSongsToCanonical(res.value);
        const filtered = filterByLanguages(normalized, allowedLangs);
        for (const s of filtered) {
          if (!excludeSet.has(s.id)) {
            excludeSet.add(s.id);
            langFiltered.push(s);
          }
        }
      }
    }
  }

  const secondaryArtistSet = new Set(secondaryArtists.map((a) => a.artistName.toLowerCase()));

  const scored = langFiltered.map((song) => {
    let score = 0;
    const songArtists = (song.primaryArtists || "").split(",").map((a) => a.trim().toLowerCase());
    
    for (const sa of songArtists) {
      if (secondaryArtistSet.has(sa)) {
        score += 40;
        break;
      }
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
