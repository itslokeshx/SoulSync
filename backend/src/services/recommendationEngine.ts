// ════════════════════════════════════════════════════════════════
// SOULSYNC RECOMMENDATION ENGINE
// Taste-aware, cover-filtered, diversity-capped recommendations.
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
  searchPodcasts,
  searchAlbums,
  fetchAlbumSongs,
  getHomeFeed,
  type Song,
} from "./youtubeMusicService.js";
import { redisGet, redisSet, redisDel } from "./redis.js";
import { pLimit } from "../utils/concurrency.js";
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
  POPULARITY_MAX: 60,        // Max points from play count
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

  // Fetch history, liked songs + preferences, and playlists in parallel
  const [history, userDoc, playlists] = await Promise.all([
    ListeningHistory.find({ userId: userObjId }).sort({ playedAt: -1 }).limit(500).lean(),
    User.findById(userId).select("likedSongs preferences").lean(),
    Playlist.find({ userId: userObjId }).select("songs").lean(),
  ]);

  const likedSongs = userDoc?.likedSongs || [];
  const playlistSongs = (playlists || []).flatMap((p: any) => p.songs || []);
  const totalInteractions = history.length + likedSongs.length + playlistSongs.length;

  if (totalInteractions === 0) {
    const languages: any[] = [];
    try {
      const prefLangs = userDoc?.preferences?.languages || [];
      if (prefLangs.length > 0) {
        prefLangs.forEach((lang: string, idx: number) => {
          languages.push({
            language: lang.toLowerCase().trim(),
            weight: idx === 0 ? 0.7 : 0.3,
            playCount: 0,
          });
        });
      }
    } catch (e) {
      console.warn("[TasteProfile] Failed to fetch user preferences:", e);
    }

    const empty = await UserTasteProfile.findOneAndUpdate(
      { userId: userObjId },
      {
        $set: {
          artists: [],
          languages,
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

  // ── Compute Artist affinity & Language distribution ────────────────────────
  const artistMap = new Map<string, { name: string; score: number; count: number }>();
  const langMap = new Map<string, number>();
  let langTotalScore = 0;

  // 1. Process History (recency-decayed weight)
  for (const h of history) {
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

    const lang = (h.language || "").toLowerCase().trim();
    if (lang && lang !== "unknown") {
      langMap.set(lang, (langMap.get(lang) || 0) + decayWeight);
      langTotalScore += decayWeight;
    }
  }

  // 2. Process Liked Songs (permanent high weight = 2.0 per liked song)
  for (const song of likedSongs) {
    if (!song.artist) continue;
    const key = song.artist;
    const name = song.artist;

    const existing = artistMap.get(key);
    if (existing) {
      existing.score += 2.0;
      existing.count += 1;
    } else {
      artistMap.set(key, { name, score: 2.0, count: 1 });
    }

    const inferredLang = inferSongLanguage({ name: song.title, primaryArtists: song.artist });
    if (inferredLang) {
      langMap.set(inferredLang, (langMap.get(inferredLang) || 0) + 2.0);
      langTotalScore += 2.0;
    }
  }

  // 3. Process Playlists (permanent weight = 1.0 per playlist song)
  for (const song of playlistSongs) {
    if (!song.artist) continue;
    const key = song.artist;
    const name = song.artist;

    const existing = artistMap.get(key);
    if (existing) {
      existing.score += 1.0;
      existing.count += 1;
    } else {
      artistMap.set(key, { name, score: 1.0, count: 1 });
    }

    const inferredLang = inferSongLanguage({ name: song.title, primaryArtists: song.artist });
    if (inferredLang) {
      langMap.set(inferredLang, (langMap.get(inferredLang) || 0) + 1.0);
      langTotalScore += 1.0;
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

  const languages = Array.from(langMap.entries())
    .map(([language, score]) => ({
      language,
      weight: langTotalScore > 0 ? Math.round((score / langTotalScore) * 100) / 100 : 0,
      playCount: Math.round(score),
    }))
    .sort((a, b) => b.weight - a.weight);

  // If no languages were matched, fallback to user's onboarding preferences
  if (languages.length === 0) {
    try {
      const prefLangs = userDoc?.preferences?.languages || [];
      if (prefLangs.length > 0) {
        prefLangs.forEach((lang: string, idx: number) => {
          languages.push({
            language: lang.toLowerCase().trim(),
            weight: idx === 0 ? 0.7 : 0.3,
            playCount: 0,
          });
        });
      }
    } catch {}
  }

  // Recent song IDs (dedup against last 100 played/liked)
  const historyIds = history.map((h: any) => h.songId);
  const likedIds = likedSongs.map((s: any) => s.songId);
  const recentSongIds = [...new Set([...historyIds, ...likedIds])].slice(0, 100);

  // ── Persist ───────────────────────────────────────────────────
  const profile = await UserTasteProfile.findOneAndUpdate(
    { userId: userObjId },
    {
      $set: {
        artists,
        languages,
        recentSongIds,
        totalPlays: totalInteractions,
        lastComputedAt: new Date(),
        lastPlayCountAtCompute: totalInteractions,
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

  // Invalidate dashboard and candidates cache immediately
  await Promise.all([
    redisDel(`dashboard:${userId}`),
    redisDel(`taste_candidates:${userId}`),
  ]).catch(() => {});

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
    // Check if recomputation is needed asynchronously (fire-and-forget) to not block the request
    ListeningHistory.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    }).then((currentCount) => {
      const delta = currentCount - (existing.lastPlayCountAtCompute || 0);
      if (delta >= W.RECOMPUTE_AFTER_N_PLAYS) {
        buildTasteProfile(userId).catch((err) => {
          console.error("[TasteProfile] Async recomputation error:", err);
        });
      }
    }).catch((err) => {
      console.warn("[TasteProfile] Failed to count history documents for async taste check:", err);
    });

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
//   - Similar suggestions
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

    // ── Source 2: YT Music suggestions ────
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
        // If we have an artist ID, fetch by ID; else search by name
        if (a.artistId && a.artistId.length > 3) {
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

  // ── Source 4 (home mode): Personalized seeds from Liked / Playlists ───
  if (mode === "home" && profile) {
    try {
      const [userDoc, playlists] = await Promise.all([
        User.findById(profile.userId).select("likedSongs").lean(),
        Playlist.find({ userId: profile.userId }).select("songs").lean(),
      ]);
      const likedSongs = userDoc?.likedSongs || [];
      const playlistSongs = (playlists || []).flatMap((p: any) => p.songs || []);
      const combinedSeeds = [...likedSongs, ...playlistSongs];

      if (combinedSeeds.length > 0) {
        // Sample up to 3 random seeds
        const seeds = combinedSeeds.sort(() => Math.random() - 0.5).slice(0, 3);
        const suggestionResults = await Promise.allSettled(
          seeds.map((s) => getSuggestions(s.songId || s._id, 15))
        );
        for (const res of suggestionResults) {
          if (res.status === "fulfilled") {
            for (const s of res.value) {
              addCandidate(s, "Recommended for you");
            }
          }
        }
      } else if (profile.languages.length > 0) {
        // Fallback to trending search if no likes/playlists exist
        const topLangs = profile.languages.slice(0, 2);
        const langResults = await Promise.allSettled(
          topLangs.map((l) =>
            searchSongs(`trending ${l.language} songs ${new Date().getFullYear()}`, 15),
          ),
        );
        for (const res of langResults) {
          if (res.status === "fulfilled") {
            for (const s of normalizeSongsToCanonical(res.value).slice(0, 10)) {
              addCandidate(s, "Trending in your taste");
            }
          }
        }
      }
    } catch (err) {
      console.error("[getCandidates] Failed to query seeds/suggestions:", err);
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

function inferSongLanguage(song: any): string {
  const title = (song.name || "").toLowerCase();
  const artist = (song.primaryArtists || "").toLowerCase();
  const album = (song.album || song.album?.name || "").toLowerCase();
  const combined = `${title} ${artist} ${album}`;

  if (/[\u0B80-\u0BFF]/.test(combined)) return "tamil";
  if (/[\u0C00-\u0C7F]/.test(combined)) return "telugu";
  if (/[\u0900-\u097F]/.test(combined)) return "hindi";
  if (/[\u0D00-\u0D7F]/.test(combined)) return "malayalam";
  if (/[\u0C80-\u0CFF]/.test(combined)) return "kannada";

  const tamilKws = ["tamil", "kollywood", "anirudh", "spb", "rahman", "arr", "yuvan", "imman", "ilayaraja", "harris jayaraj", "santhosh narayanan", "pradeep kumar", "sid sriram", "srinivas", "vijay", "thalapathy", "ajith", "thala", "rajini", "kamal haasan"];
  if (tamilKws.some(kw => combined.includes(kw))) return "tamil";

  const teluguKws = ["telugu", "tollywood", "thaman", "devi sri prasad", "dsp", "ntr", "ram charan", "prabhas", "mahesh babu", "allu arjun"];
  if (teluguKws.some(kw => combined.includes(kw))) return "telugu";

  const hindiKws = ["hindi", "bollywood", "arijit", "pritam", "shreya", "atif aslam", "lofi hindi", "t-series", "tseries", "srk", "shah rukh", "salman", "aamir", "hrithik", "ranbir", "ranveer", "akshay"];
  if (hindiKws.some(kw => combined.includes(kw))) return "hindi";

  const punjabiKws = ["punjabi", "diljit", "dosanjh", "moose wala", "moosewala", "aujla", "dhillon"];
  if (punjabiKws.some(kw => combined.includes(kw))) return "punjabi";

  const malayalamKws = ["malayalam", "mollywood", "sushin", "vineeth", "dulquer", "mohanlal", "mammootty"];
  if (malayalamKws.some(kw => combined.includes(kw))) return "malayalam";

  const kannadaKws = ["kannada", "sandalwood", "arjun janya", "yash"];
  if (kannadaKws.some(kw => combined.includes(kw))) return "kannada";

  if (song.language && song.language !== "english") {
    return song.language.toLowerCase().trim();
  }

  return "english";
}

export async function generateSeedAnchoredBatch(
  seed: Song,
  tasteProfile: IUserTasteProfile | null,
  excludeIds: string[],
  batchSize: number = 8,
): Promise<Song[]> {
  const seedId = seed.id;
  const seedArtist = (seed.primaryArtists || "").split(",")[0].trim();
  const seedLang = inferSongLanguage(seed);

  const allowedLanguages = new Set<string>([seedLang]);

  const excludeSet = new Set<string>([...excludeIds, seedId]);
  const candidates: Song[] = [];

  const addCandidate = (song: Song) => {
    if (excludeSet.has(song.id)) return;
    const lang = inferSongLanguage(song);
    if (!allowedLanguages.has(lang)) return;
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
        if (song) {
          addCandidate(song);
        }
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

  if (candidates.length < 15) {
    if (tasteProfile && tasteProfile.userId) {
      try {
        const recentPlays = await ListeningHistory.find({
          userId: new mongoose.Types.ObjectId(tasteProfile.userId),
          language: seedLang,
          songId: { $ne: seedId },
        })
          .sort({ playedAt: -1 })
          .limit(3)
          .lean();
        const extraPromises = recentPlays.map((p) => getSuggestions(p.songId, 25));
        const extraResults = await Promise.allSettled(extraPromises);
        for (const res of extraResults) {
          if (res.status === "fulfilled") {
            const normalized = normalizeSongsToCanonical(res.value);
            for (const s of normalized) {
              addCandidate(s);
            }
          }
        }
      } catch {}
    }
  }

  if (candidates.length < 15) {
    try {
      const fallbacks = await searchSongs(`popular ${seedLang} songs`, 25);
      const normalized = normalizeSongsToCanonical(fallbacks);
      for (const s of normalized) {
        addCandidate(s);
      }
    } catch {}
  }

  if (candidates.length === 0) {
    return [];
  }

  const scored = candidates.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    const artist = (song.primaryArtists || "").toLowerCase();
    const lang = inferSongLanguage(song);
    const album = (song.album || "").toLowerCase();

    const songArtists = artist.split(",").map((a) => a.trim().toLowerCase());
    const isSameArtist = songArtists.some(
      (sa) =>
        sa.includes(seedArtist.toLowerCase()) ||
        seedArtist.toLowerCase().includes(sa),
    );
    if (isSameArtist) {
      score += 150;
    }

    const seedAlbum = (seed.album || "").toLowerCase();
    if (seedAlbum && album && (album.includes(seedAlbum) || seedAlbum.includes(album))) {
      score += 100;
    }

    if (lang === seedLang) {
      score += 50;
    }

    if (tasteProfile) {
      const artistNameSet = new Set(
        tasteProfile.artists.map((a) => a.artistName.toLowerCase()),
      );
      for (const sa of songArtists) {
        if (artistNameSet.has(sa)) {
          score += 30;
          break;
        }
      }
    }

    score += popularityScore(song.playCount) * 0.5;
    score += coverPenalty(title);

    return { ...song, _recScore: score, language: lang };
  });

  scored.sort((a, b) => (b._recScore ?? 0) - (a._recScore ?? 0));

  const diversified: Song[] = [];
  const artistCount = new Map<string, number>();
  let lastArtist1 = "";
  let lastArtist2 = "";

  for (const song of scored) {
    const firstArtist = (song.primaryArtists || "")
      .split(",")[0]
      .trim()
      .toLowerCase();

    if (firstArtist === lastArtist1 && firstArtist === lastArtist2) {
      continue;
    }

    const count = artistCount.get(firstArtist) || 0;
    if (count >= 4) continue;

    artistCount.set(firstArtist, count + 1);
    lastArtist2 = lastArtist1;
    lastArtist1 = firstArtist;

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
  preferredLangs?: string[],
): Promise<Song[]> {
  const langs = (preferredLangs && preferredLangs.length > 0)
    ? preferredLangs.map((l: any) => l.toLowerCase().trim())
    : ["english", "hindi", "tamil", "punjabi"];

  const cacheKey = `cold_start:v2:${[...langs].sort().join(",")}`;
  let candidates: Song[] = [];
  try {
    const cached = await redisGet(cacheKey);
    if (cached) {
      candidates = JSON.parse(cached);
    }
  } catch (err) {
    console.error("[recommendationEngine] getColdStartBatch cache read failed:", err);
  }

  if (candidates.length === 0) {
    const fallbacks = langs.map((l: string) => `best ${l} songs`);
    
    const searchResults = await Promise.allSettled(
      fallbacks.map((q) => searchSongs(q, 30)),
    );

    const seen = new Set<string>();
    for (const res of searchResults) {
      if (res.status !== "fulfilled") continue;
      const normalized = normalizeSongsToCanonical(res.value);
      for (const s of normalized) {
        if (!seen.has(s.id)) {
          candidates.push(s);
          seen.add(s.id);
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
    candidates = scored.map((s) => {
      const clean = { ...s };
      delete (clean as any)._recScore;
      (clean as any).reason = "Popular right now";
      return clean;
    });

    if (candidates.length > 0) {
      await redisSet(cacheKey, JSON.stringify(candidates), 86400).catch(() => {}); // 24 hours TTL
    }
  }

  const excludeSet = new Set(excludeIds);
  return candidates.filter((s) => !excludeSet.has(s.id)).slice(0, limit);
}

export async function getTasteProfileBatch(
  tasteProfile: IUserTasteProfile | null,
  excludeIds: string[],
  limit: number = 20,
): Promise<Song[]> {
  if (!tasteProfile || tasteProfile.artists.length === 0) {
    const prefLangs = tasteProfile?.languages.map(l => l.language) || [];
    return getColdStartBatch(excludeIds, limit, prefLangs);
  }

  // 1. Fetch user's actual liked songs and custom playlist tracks to get seeds
  let likedSongs: any[] = [];
  let playlistSongs: any[] = [];
  try {
    const [userDoc, playlists] = await Promise.all([
      User.findById(tasteProfile.userId).select("likedSongs").lean(),
      Playlist.find({ userId: tasteProfile.userId }).select("songs").lean(),
    ]);
    likedSongs = userDoc?.likedSongs || [];
    playlistSongs = (playlists || []).flatMap((p: any) => p.songs || []);
  } catch (err) {
    console.error("[getTasteProfileBatch] Failed to fetch seeds from db:", err);
  }

  const ARTIST_QUERY_VARIANTS = [
    "best of", "top songs", "popular", "hits", "essentials",
    "greatest", "playlist", "latest", "new", "trending",
  ];
  const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const topLangs = tasteProfile.languages.slice(0, 3);
  const currentYear = new Date().getFullYear();

  // Source 0: History watch suggestions
  const fetchSource0 = async (): Promise<Song[]> => {
    const recentPlays = await ListeningHistory.find({ userId: tasteProfile.userId })
      .sort({ playedAt: -1 })
      .limit(3)
      .lean();
    if (recentPlays.length === 0) return [];
    const watchPlaylists = await Promise.all(
      recentPlays.map((p) => getSuggestions(p.songId, 15).catch(() => []))
    );
    const interleaved: Song[] = [];
    const maxLen = Math.max(...watchPlaylists.map((list) => list.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const list of watchPlaylists) {
        if (i < list.length) interleaved.push(list[i]);
      }
    }
    return interleaved;
  };

  // Source Liked: Liked songs watch suggestions (Leverages YT recommendation AI on user favorites)
  const fetchSourceLiked = async (): Promise<Song[]> => {
    if (likedSongs.length === 0) return [];
    // Shuffle and pick 4 seeds for variety
    const seeds = [...likedSongs].sort(() => Math.random() - 0.5).slice(0, 4);
    const watchPlaylists = await Promise.all(
      seeds.map((s) => getSuggestions(s.songId || s._id, 15).catch(() => []))
    );
    return watchPlaylists.flat();
  };

  // Source Playlist: Custom playlists watch suggestions (Leverages YT recommendation AI on curated tracks)
  const fetchSourcePlaylist = async (): Promise<Song[]> => {
    if (playlistSongs.length === 0) return [];
    // Shuffle and pick 4 seeds
    const seeds = [...playlistSongs].sort(() => Math.random() - 0.5).slice(0, 4);
    const watchPlaylists = await Promise.all(
      seeds.map((s) => getSuggestions(s.songId || s._id, 15).catch(() => []))
    );
    return watchPlaylists.flat();
  };

  // Source 1: Top Artists catalog
  const fetchSource1 = async (): Promise<Song[]> => {
    const topArtists = tasteProfile.artists.slice(0, 10);
    const sampledArtists = [...topArtists].sort(() => Math.random() - 0.5).slice(0, 4);
    const artistResults = await Promise.allSettled(
      sampledArtists.map((a) => {
        if (a.artistId && a.artistId.length > 3) {
          const randomPage = Math.floor(Math.random() * 8);
          return fetchArtistSongs(a.artistId, randomPage, 2);
        }
        const variant = pickRandom(ARTIST_QUERY_VARIANTS);
        return searchSongs(`${variant} ${a.artistName}`, 20);
      }),
    );
    const songs: Song[] = [];
    for (const res of artistResults) {
      if (res.status !== "fulfilled") continue;
      const normalized = Array.isArray(res.value)
        ? normalizeSongsToCanonical(res.value)
        : (res.value as Song[]);
      for (const s of normalized) songs.push(s);
    }
    return songs;
  };

  // Source 2: Co-occurrences
  const fetchSource2 = async (): Promise<Song[]> => {
    const recentIds = tasteProfile.recentSongIds || [];
    if (recentIds.length === 0) return [];
    const shuffledRecent = [...recentIds].sort(() => Math.random() - 0.5);
    const cooccurrences = await SongCooccurrence.find({
      songIdA: { $in: shuffledRecent.slice(0, 10) },
    })
      .sort({ decayedScore: -1 })
      .limit(30)
      .lean();
    const cooccurIds = cooccurrences.map((co) => co.songIdB);
    if (cooccurIds.length === 0) return [];
    try {
      return await fetchSongsByIds(cooccurIds);
    } catch {
      return [];
    }
  };

  const cacheKey = `taste_candidates:${tasteProfile.userId}`;
  let rawCandidates: Song[] = [];

  try {
    const cached = await redisGet(cacheKey);
    if (cached) {
      rawCandidates = JSON.parse(cached);
    }
  } catch (err) {
    console.error("[getTasteProfileBatch] Cache read failed:", err);
  }

  if (rawCandidates.length === 0) {
    const [src0, srcLiked, srcPlaylist, src1, src2] = await Promise.allSettled([
      fetchSource0(),
      fetchSourceLiked(),
      fetchSourcePlaylist(),
      fetchSource1(),
      fetchSource2(),
    ]);

    const seenIds = new Set<string>();
    const sourceResults = [src0, srcLiked, srcPlaylist, src1, src2];
    for (const res of sourceResults) {
      if (res.status === "fulfilled") {
        for (const s of res.value) {
          if (s && s.id && !seenIds.has(s.id)) {
            seenIds.add(s.id);
            rawCandidates.push(s);
          }
        }
      }
    }

    // Fallback: If we have very few personalized candidates (e.g. new user), pull trending language songs
    if (rawCandidates.length < 30) {
      try {
        const langResults = await Promise.allSettled(
          topLangs.map((l) => searchSongs(`trending ${l.language} songs`, 20))
        );
        for (const res of langResults) {
          if (res.status === "fulfilled") {
            const normalized = normalizeSongsToCanonical(res.value);
            for (const s of normalized) {
              if (s && s.id && !seenIds.has(s.id)) {
                seenIds.add(s.id);
                rawCandidates.push(s);
              }
            }
          }
        }
      } catch {}
    }

    if (rawCandidates.length > 0) {
      await redisSet(cacheKey, JSON.stringify(rawCandidates), 3600).catch(() => {});
    }
  }

  const excludeSet = new Set(excludeIds);
  const candidates: Song[] = [];
  for (const s of rawCandidates) {
    if (s && s.id && !excludeSet.has(s.id)) {
      candidates.push(s);
    }
  }

  if (candidates.length === 0) {
    const prefLangs = tasteProfile?.languages.map(l => l.language) || [];
    return getColdStartBatch(excludeIds, limit, prefLangs);
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
    let fallbackLangs = ["hindi", "english", "tamil", "punjabi"];
    if (tasteProfile?.userId) {
      try {
        const userDoc = await User.findById(tasteProfile.userId).lean();
        const prefLangs = userDoc?.preferences?.languages || [];
        if (prefLangs.length > 0) {
          fallbackLangs = prefLangs.map((l: string) => l.toLowerCase().trim());
        }
      } catch {}
    }
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

async function fetchCuratedNewReleases(lang: string, homeAlbumIds: string[] = []): Promise<Song[]> {
  const cacheKey = `curated_new_releases:v3:${lang.toLowerCase().trim()}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("[fetchCuratedNewReleases] Cache read error:", err);
  }

  const currentYear = new Date().getFullYear();
  const candidates: Song[] = [];
  const seenIds = new Set<string>();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Try to fetch from the latest language-specific playlist for absolute recency
  try {
    const playlistQuery = `latest ${lang} songs playlist`;
    const searchPlaylistsResults = await searchPlaylists(playlistQuery, 2);
    if (searchPlaylistsResults && searchPlaylistsResults.length > 0) {
      const targetPlaylist = searchPlaylistsResults[0];
      if (targetPlaylist && targetPlaylist.id) {
        const playlistSongsRaw = await getPlaylistSongs(targetPlaylist.id);
        const normalizedSongs = normalizeSongsToCanonical(playlistSongsRaw);
        for (const s of normalizedSongs) {
          if (s && s.id && !seenIds.has(s.id)) {
            seenIds.add(s.id);
            s.language = lang.toLowerCase();
            s.year = String(currentYear);
            if (!s.releaseDate) s.releaseDate = todayStr;
            candidates.push(s);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[NewReleases] Failed to fetch playlist new releases for ${lang}`, err);
  }

  // 2. Search for language-specific new release albums as fallback/supplement
  if (candidates.length < 12) {
    let searchAlbumIds: string[] = [];
    try {
      const query = `new release ${lang} album`;
      const searchResults = await searchAlbums(query, 3);
      if (searchResults && Array.isArray(searchResults)) {
        searchAlbumIds = searchResults
          .filter((a: any) => String(a.year) === String(currentYear))
          .map((a: any) => a.browseId || a.id)
          .filter(Boolean);
      }
    } catch (err) {
      console.warn(`[NewReleases] Failed to search albums for ${lang}`, err);
    }

    // Combine album IDs. For language-specific curations (especially regional ones), only use searchAlbumIds to avoid contaminating with global/Hindi home feed releases.
    const isGlobalLang = ["hindi", "english"].includes(lang.toLowerCase());
    const baseAlbumIds = isGlobalLang ? homeAlbumIds : [];
    const allAlbumIds = Array.from(new Set([...baseAlbumIds.slice(0, 1), ...searchAlbumIds])).slice(0, 2);

    if (allAlbumIds.length > 0) {
      try {
        const albumLimit = pLimit(2);
        const tracksResults = await Promise.allSettled(
          allAlbumIds.map((id) => albumLimit(() => fetchAlbumSongs(id)))
        );

        for (const res of tracksResults) {
          if (res.status === "fulfilled" && Array.isArray(res.value)) {
            for (const s of res.value) {
              if (s && s.id && !seenIds.has(s.id)) {
                seenIds.add(s.id);
                // Explicitly tag the language, year, and releaseDate since they come from a 2026 album
                s.language = lang.toLowerCase();
                s.year = String(currentYear);
                if (!s.releaseDate) {
                  s.releaseDate = todayStr;
                }
                candidates.push(s);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[NewReleases] Failed to fetch album tracks for ${lang}`, err);
      }
    }
  }

  if (candidates.length > 0) {
    await redisSet(cacheKey, JSON.stringify(candidates), 43200).catch(() => {});
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

  // 3. Mathematical playcount ceiling for new releases (40M plays in < 45 days is impossible)
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
  const sortedLangs = [...targetLangs].sort();
  const cacheKey = `industry_new_releases:v2:${sortedLangs.join(",")}`;

  try {
    const cached = await redisGet(cacheKey);
    if (cached) {
      const cachedSongs = JSON.parse(cached);
      return cachedSongs.slice(0, limit);
    }
  } catch (err) {
    console.error("[recommendationEngine] getIndustryNewReleases cache read failed:", err);
  }

  // 1. Fetch from global home feed "New Releases" shelf if available (once for all languages)
  let homeAlbumIds: string[] = [];
  try {
    const homeFeed = await getHomeFeed(15);
    const sections = homeFeed.sections || [];
    const newReleasesSection = sections.find(
      (s: any) => s.title && s.title.toLowerCase() === "new releases"
    );
    if (newReleasesSection && Array.isArray(newReleasesSection.contents)) {
      homeAlbumIds = newReleasesSection.contents
        .map((c: any) => c.browseId)
        .filter(Boolean);
    }
  } catch (err) {
    console.warn("[NewReleases] Failed to fetch home feed new releases", err);
  }

  const langLimit = pLimit(2);
  const fetchResults = await Promise.allSettled(
    targetLangs.map((l) => langLimit(() => fetchCuratedNewReleases(l, homeAlbumIds)))
  );

  const candidates: Song[] = [];
  const seen = new Set<string>();

  const lists: Song[][] = fetchResults
    .filter((res): res is PromiseFulfilledResult<Song[]> => res.status === "fulfilled")
    .map((res) => res.value)
    .filter((list) => list.length > 0);

  const maxLen = Math.max(...lists.map((l) => l.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i < list.length) {
        const s = list[i];
        if (s && s.id && !seen.has(s.id)) {
          seen.add(s.id);
          candidates.push(s);
        }
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

  const cleanedSongs = finalSongs.map((s) => {
    const clean = { ...s };
    delete (clean as any)._recScore;
    delete (clean as any)._isWithin30Days;
    delete (clean as any)._isWithin90Days;
    return clean;
  });

  if (cleanedSongs.length > 0) {
    // Cache up to 100 scored candidates (longer than the requested limit) so other limits can use it
    await redisSet(cacheKey, JSON.stringify(cleanedSongs.slice(0, 100)), 7200).catch(() => {}); // 2 hours TTL
  }

  return cleanedSongs.slice(0, limit);
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
      if (a.artistId && a.artistId.length > 3) {
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
        if (a.artistId && a.artistId.length > 3) {
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

export async function getPodcastRecommendations(langs: string[] = ["english"], limit = 10): Promise<any[]> {
  const normalizedLangs = langs.map(l => l.toLowerCase().trim());
  const cacheKey = `podcast_recommendations:v3:${normalizedLangs.sort().join("_")}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error("[recommendationEngine] getPodcastRecommendations cache read failed:", err);
  }

  const queriesByLang: Record<string, string[]> = {
    tamil: ["Naallanaa Murugesan", "Schumy Vanna Kaviyangal", "RJ Balaji Podcast", "Dad's Life Tamil Podcast", "Tamil Podcast"],
    hindi: ["The Ranveer Show", "Dostcast", "RealHit Podcast", "Kahaani Podcast", "Bhaskar Bose"],
    telugu: ["Telugu Geeks Podcast", "The Telugu Podcast", "Mana Telugu Podcast", "Purana Stories"],
    english: ["Joe Rogan", "Lex Fridman", "Huberman Lab", "TED Talks Daily", "The Diary Of A CEO"],
  };

  const queries: string[] = [];
  for (const lang of normalizedLangs) {
    const qList = queriesByLang[lang] || [];
    queries.push(...qList);
  }

  if (queries.length === 0) {
    queries.push(...queriesByLang.english, ...queriesByLang.tamil);
  }

  const uniqueQueries = Array.from(new Set(queries));
  const sampledQueries = [...uniqueQueries].sort(() => Math.random() - 0.5).slice(0, 4);

  const searchResults = await Promise.allSettled(
    sampledQueries.map((q) => searchPodcasts(q, 3))
  );

  const candidates: any[] = [];
  const seen = new Set<string>();

  for (const res of searchResults) {
    if (res.status !== "fulfilled") continue;
    for (const item of res.value) {
      if (item?.id && !seen.has(item.id)) {
        seen.add(item.id);
        candidates.push(item);
      }
    }
  }

  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, limit);

  if (shuffled.length > 0) {
    await redisSet(cacheKey, JSON.stringify(shuffled), 86400).catch(() => {});
  }

  return shuffled;
}


