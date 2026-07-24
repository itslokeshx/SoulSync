// ════════════════════════════════════════════════════════════════
// UP NEXT ENGINE — Session-Anchored DJ Queue
//
// DESIGN PRINCIPLES:
// 1. Never use language-based cold starts inside Up Next.
//    Cold starts are for Home/Discovery. Up Next is personal.
// 2. Recommendations are deterministic for the same session state.
//    No Math.random() anywhere in this pipeline.
// 3. Fallback ladder: album → artist → session → ecosystem → favorites
//    → liked → replays → history → playlist → home.
//    Only go down the ladder when the tier above is genuinely empty.
// 4. Confidence is signal-based, not self-referential.
//    The old recSimulation evaluated the engine against itself. Deleted.
// 5. Session memory: last 20 songs, played artists, played albums.
//    Never recommend what was just played, and never over-rotate on
//    one artist (max 2 per queue).
// ════════════════════════════════════════════════════════════════

import {
  Song,
  fetchSongById,
  getSuggestions,
  searchSongs,
  normalizeSongsToCanonical,
} from "./jiosaavn.js";
import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import {
  getActiveSessionContext,
  updateSessionWithSong,
  SessionState,
} from "./sessionEngine.js";
import { filterByLanguages, detectSongLanguage, coverPenalty, getRecentlyRecommendedSongIds } from "./scoringUtils.js";
import { getOrCreateSongFeature } from "./songFeatureService.js";
import { getEcosystemArtists, areArtistsInSameEcosystem } from "./tasteClusters.js";
import { getRelatedArtists } from "./artistGraphService.js";
import { getNegativeAffinityProfile } from "./negativeAffinity.js";
import { SongCooccurrence } from "../models/SongCooccurrence.js";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { User } from "../models/User.js";
import mongoose from "mongoose";

export interface UpNextParams {
  currentSongId: string;
  userId?: string;
  queueSongIds?: string[];
  recentHistorySongIds?: string[];
  sessionId?: string;
  limit?: number;
  userPrefs?: { languages?: string[] } | null;
  tasteProfile?: IUserTasteProfile | null;
}

export interface QueuedTrack extends Song {
  reason: string;
  confidenceScore: number;
  expectedSatisfaction: number;
  signals: Record<string, number>;
}

// ════════════════════════════════════════════════════════════════
// SIGNAL SCORING — deterministic, no Math.random()
// All scores are additive. Higher = better.
// ════════════════════════════════════════════════════════════════
interface ScoredCandidate {
  song: Song;
  score: number;
  signals: Record<string, number>;
  reason: string;
  tier: number; // lower tier = higher priority source
}

function extractRootSongTitle(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/-(.*?)$/g, "")
    .replace(/\b(reprise|unplugged|acoustic|piano|lullaby|rage|rock|orchestral|soul|comedy|bgm|instrumental|slowed|reverb|remix|cover|lofi|dialogue|theme|version|mix)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

type SongVibe = "romantic_melody" | "aggressive_fight" | "upbeat_dance" | "sad_melancholy" | "neutral";

function detectSongVibe(song: Song): SongVibe {
  if (!song) return "neutral";
  const combined = `${song.name || ""} ${song.album || ""}`.toLowerCase();

  const isAggressive = /\b(fight|rage|mass|action|theme|rock|trap|blood|roar|badass|monster|villain|battle|blast|destroy|war|anthem|rage rock|hard rock|metal)\b/i.test(combined);
  if (isAggressive) return "aggressive_fight";

  const isRomantic = /\b(love|kadhal|kadhaley|romance|romantic|reprise|unplugged|acoustic|piano|lullaby|soft|feel|dil|pyaar|ishq|sufi|soul|tum|pennangush|mazhai|kannu|kannukulla|vizhi|prema|priya|melody)\b/i.test(combined);
  if (isRomantic) return "romantic_melody";

  const isUpbeat = /\b(dance|party|disco|club|groove|banger|mutton|kuthu|gabru|bhangra|fiesta)\b/i.test(combined);
  if (isUpbeat) return "upbeat_dance";

  const isSad = /\b(sad|lonely|tear|breakup|alone|pain|cry|dard|judaai|separation|pirivom)\b/i.test(combined);
  if (isSad) return "sad_melancholy";

  return "neutral";
}

function scoreCandidate(
  song: Song,
  seedSong: Song,
  session: SessionState,
  tasteProfile: IUserTasteProfile | null,
  tier: number,
): ScoredCandidate {
  const signals: Record<string, number> = {};
  let score = 0;

  const seedAlbum = (seedSong.album || "").toLowerCase().trim();
  const seedArtists = (seedSong.primaryArtists || "")
    .toLowerCase()
    .split(/[,/&]+/)
    .map((a) => a.trim())
    .filter(Boolean);
  const seedLang = detectSongLanguage(seedSong) || (seedSong.language || "").toLowerCase().trim();
  const seedPrimaryArtist = seedArtists[0] || "";

  const songAlbum = (song.album || "").toLowerCase().trim();
  const songArtists = (song.primaryArtists || "")
    .toLowerCase()
    .split(/[,/&]+/)
    .map((a) => a.trim())
    .filter(Boolean);
  const songLang = detectSongLanguage(song) || (song.language || "").toLowerCase().trim();
  const songTitle = (song.name || "").toLowerCase();

  // Vibe Continuity & Clash Penalty
  const seedVibe = detectSongVibe(seedSong);
  const songVibe = detectSongVibe(song);

  if (seedVibe === "romantic_melody" && songVibe === "aggressive_fight") {
    signals.vibeClash = -220;
    score -= 220;
  } else if (seedVibe === "aggressive_fight" && songVibe === "romantic_melody") {
    signals.vibeClash = -180;
    score -= 180;
  } else if (seedVibe !== "neutral" && seedVibe === songVibe) {
    signals.vibeMatch = 120;
    score += 120;
  }

  // Signal: Same album as current song (strongest continuity signal)
  if (seedAlbum && songAlbum && seedAlbum === songAlbum) {
    signals.albumContinuity = 200;
    score += 200;
  }

  // Signal: Same primary artist as current song
  const isSameArtist = songArtists.some(
    (sa) => seedArtists.includes(sa) || seedArtists.some((seed) => seed.includes(sa) || sa.includes(seed))
  );
  if (isSameArtist) {
    signals.sameArtist = 150;
    score += 150;
  }

  // Signal: Artist in current session's dominant artists
  const sessionArtistSet = new Set(session.dominantArtists.map((a) => a.toLowerCase()));
  const isSessionArtist = songArtists.some((sa) => sessionArtistSet.has(sa));
  if (isSessionArtist && !isSameArtist) {
    signals.sessionArtist = 80;
    score += 80;
  }

  // Signal: Ecosystem neighbor of seed artist
  if (seedPrimaryArtist) {
    const isEcosystem = songArtists.some((sa) =>
      areArtistsInSameEcosystem(sa, seedPrimaryArtist)
    );
    if (isEcosystem && !isSameArtist && !isSessionArtist) {
      signals.ecosystemPeer = 60;
      score += 60;
    }
  }

  // Signal: Artist in user's taste profile (top-scored artists get more)
  if (tasteProfile) {
    const profileArtistMap = new Map(
      tasteProfile.artists.map((a) => [a.artistName.toLowerCase(), a.score])
    );
    for (const sa of songArtists) {
      const profileScore = profileArtistMap.get(sa);
      if (profileScore !== undefined) {
        const bonus = Math.min(50, Math.round(profileScore * 10));
        signals.tasteAffinity = bonus;
        score += bonus;
        break;
      }
    }
  }

  // Signal: Language matches current song (strong continuation signal for Up Next)
  if (seedLang && songLang === seedLang) {
    signals.languageMatch = 100;
    score += 100;
  }

  // Signal: Co-occurrence data (songs played together by this user)
  // Applied as a bonus; the actual co-occurrence fetch is in tier 0 below

  // Signal: Cover / quality penalty
  const pen = coverPenalty(songTitle);
  if (pen < 0) {
    signals.coverPenalty = pen;
    score += pen;
  }

  // Signal: No stream URL is a dead result
  if (!song.streamUrl) {
    signals.noStream = -80;
    score -= 80;
  }

  // Unrelated candidate penalty: apply only to background history fallback tiers (Tiers 6+) with zero seed/artist relationship
  const hasRelationship =
    isSameArtist ||
    isSessionArtist ||
    (signals.ecosystemPeer || 0) > 0 ||
    (signals.albumContinuity || 0) > 0 ||
    tier <= 5;

  if (!hasRelationship && seedPrimaryArtist) {
    signals.unrelatedPenalty = -40;
    score -= 40;
  }

  // Tier bonus: lower tier = higher priority source = more trustworthy
  const tierBonus = Math.max(0, (10 - tier) * 12);
  signals.tierBonus = tierBonus;
  score += tierBonus;

  // Build reason string
  let reason = "Recommended for you";
  if (signals.albumContinuity) {
    reason = `From the same album · ${seedSong.album}`;
  } else if (signals.sameArtist) {
    reason = `More from · ${seedSong.primaryArtists?.split(",")[0].trim()}`;
  } else if (signals.sessionArtist) {
    reason = `Continuing your session`;
  } else if (signals.ecosystemPeer) {
    reason = `Sounds like · ${seedSong.primaryArtists?.split(",")[0].trim()}`;
  } else if (signals.tasteAffinity) {
    reason = `Matches your taste`;
  }

  return { song, score, signals, reason, tier };
}

// ════════════════════════════════════════════════════════════════
// MAIN ENGINE
// ════════════════════════════════════════════════════════════════
export async function predictNextTracks(
  params: UpNextParams,
): Promise<QueuedTrack[]> {
  const {
    currentSongId,
    userId,
    queueSongIds = [],
    recentHistorySongIds = [],
    sessionId,
    limit = 25,
    tasteProfile,
  } = params;

  if (!currentSongId) return [];

  // ── Fetch current/seed song ─────────────────────────────────
  let seedSong: Song | null = null;
  try {
    seedSong = await fetchSongById(currentSongId);
  } catch {}

  if (!seedSong) {
    try {
      const searchRes = await searchSongs(currentSongId, 1);
      const normalized = normalizeSongsToCanonical(searchRes);
      if (normalized.length > 0) seedSong = normalized[0];
    } catch {}
  }

  if (!seedSong) {
    console.warn(`[UpNext] Seed song not found: ${currentSongId}`);
    return [];
  }

  const seedLang = detectSongLanguage(seedSong) || (seedSong.language || "").toLowerCase().trim();
  const allowedLangs = seedLang ? [seedLang] : [];

  const seedArtists = (seedSong.primaryArtists || "")
    .split(/[,/&]+/)
    .map((a) => a.trim())
    .filter(Boolean);
  const primarySeedArtist = seedArtists[0] || "";
  const seedAlbum = (seedSong.album || "").trim();

  // ── Session context (last 20 songs, dominant artists, etc.) ──
  const session: SessionState = sessionId
    ? await updateSessionWithSong(sessionId, seedSong, userId)
    : await getActiveSessionContext(undefined, userId, currentSongId);

  // ── Exclusion set: current song + active queue + immediate recent history ──
  const excludeSet = new Set<string>([
    currentSongId,
    ...queueSongIds,
    ...recentHistorySongIds,
  ]);

  // ── Negative affinity (skip-heavy artists and languages) ──────
  const negativeProfile = await getNegativeAffinityProfile(userId || "");

  const candidateMap = new Map<string, ScoredCandidate>();

  // Hard rejection check applied to every candidate
  const isEligible = (song: Song): boolean => {
    if (!song || !song.id || excludeSet.has(song.id)) return false;
    const songLang = (detectSongLanguage(song) || song.language || "").toLowerCase().trim();
    const artist = (song.primaryArtists || "").split(/[,/&]+/)[0].trim().toLowerCase();
    if (songLang && negativeProfile.negativeLanguages.has(songLang)) return false;
    if (artist && negativeProfile.negativeArtists.has(artist)) return false;
    
    // Strictly enforce preferred language boundary for Up Next
    if (allowedLangs.length > 0 && songLang) {
      const match = allowedLangs.some(
        (al) => al.toLowerCase() === songLang || songLang.includes(al.toLowerCase()) || al.toLowerCase().includes(songLang)
      );
      if (!match) return false;
    }
    return true;
  };

  const addCandidate = (song: Song, tier: number): void => {
    if (!isEligible(song)) return;
    excludeSet.add(song.id); // prevent duplicates from multiple tiers
    const existing = candidateMap.get(song.id);
    const scored = scoreCandidate(song, seedSong!, session, tasteProfile ?? null, tier);
    if (!existing || scored.score > existing.score) {
      candidateMap.set(song.id, scored);
    }
  };

  const addBatch = (songs: Song[], tier: number): void => {
    for (const s of normalizeSongsToCanonical(songs)) {
      addCandidate(s, tier);
    }
  };

  console.log(`[UpNext] Building queue for: "${seedSong.name}" by ${seedSong.primaryArtists} | lang=${seedLang}`);

  // ════════════════════════════════════════════════════════════════
  // TIER 0: Co-occurrence data (songs this user played together)
  // Real behavioral transition data — highest trust signal.
  // ════════════════════════════════════════════════════════════════
  try {
    const coOccurrences = await SongCooccurrence.find({ songIdA: currentSongId })
      .sort({ decayedScore: -1 })
      .limit(30)
      .lean();

    for (const co of coOccurrences) {
      try {
        const song = await fetchSongById(co.songIdB);
        if (song) addCandidate(song, 0);
      } catch {}
    }
    console.log(`[UpNext] Tier 0 (co-occurrence): ${coOccurrences.length} records`);
  } catch {}

  // ════════════════════════════════════════════════════════════════
  // TIER 1: Current album tracks
  // Album listening is the strongest natural continuation.
  // ════════════════════════════════════════════════════════════════
  if (seedAlbum) {
    try {
      const albumSongs = await searchSongs(`${seedAlbum}`, 30);
      addBatch(albumSongs, 1);
      console.log(`[UpNext] Tier 1 (album): ${albumSongs.length} songs fetched`);
    } catch {}
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 2: Current artist's discography
  // ════════════════════════════════════════════════════════════════
  for (const artist of seedArtists.slice(0, 2)) {
    try {
      const artistSongs = await searchSongs(`${artist}`, 30);
      addBatch(artistSongs, 2);
    } catch {}
  }
  console.log(`[UpNext] Tier 2 (artist): added from ${seedArtists.slice(0, 2).join(", ")}`);

  // ════════════════════════════════════════════════════════════════
  // TIER 3: JioSaavn vector suggestions for current song
  // Best external signal when available. Wrapped in try/catch because
  // this API fails frequently. Failure does NOT trigger cold-start.
  // ════════════════════════════════════════════════════════════════
  try {
    const suggestions = await getSuggestions(currentSongId, 40);
    addBatch(suggestions, 3);
    console.log(`[UpNext] Tier 3 (suggestions): ${suggestions.length} received`);
  } catch {
    console.warn(`[UpNext] Tier 3 (suggestions): API failed — continuing without`);
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 4: Ecosystem peers of seed artist
  // Artists in the same musical neighborhood as the current artist.
  // This is where Sai Abhyankkar → Dhibu Ninan Thomas happens.
  // ════════════════════════════════════════════════════════════════
  if (primarySeedArtist) {
    try {
      const dynamicRelated = await getRelatedArtists(primarySeedArtist, 8);
      const staticEco = Array.from(getEcosystemArtists(primarySeedArtist));
      const ecoArtists = Array.from(new Set([...staticEco, ...dynamicRelated]))
        .filter((a) => a && a.toLowerCase() !== primarySeedArtist.toLowerCase());

      const ecoResults = await Promise.allSettled(
        ecoArtists.slice(0, 8).map((a) => searchSongs(`${a}`, 15))
      );
      for (const res of ecoResults) {
        if (res.status === "fulfilled") addBatch(res.value, 4);
      }
      console.log(`[UpNext] Tier 4 (ecosystem + dynamic graph): ${ecoArtists.slice(0, 8).join(", ")}`);
    } catch {}
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 5: Session artists (from the last 20 songs)
  // What the user has been listening to this session.
  // ════════════════════════════════════════════════════════════════
  if (session.dominantArtists.length > 0) {
    const sessionTopArtists = [...new Set(session.dominantArtists)].slice(0, 4);
    const sessionResults = await Promise.allSettled(
      sessionTopArtists.map((a) => searchSongs(`${a}`, 15))
    );
    for (const res of sessionResults) {
      if (res.status === "fulfilled") addBatch(res.value, 5);
    }
    console.log(`[UpNext] Tier 5 (session): ${sessionTopArtists.join(", ")}`);
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 6: User's favorite artists (from taste profile)
  // Only pulled if we still need more candidates. Uses score ranking,
  // not random shuffle.
  // ════════════════════════════════════════════════════════════════
  if (tasteProfile && tasteProfile.artists.length > 0 && candidateMap.size < limit * 2) {
    // Sort by score descending — highest affinity artists first (no Math.random!)
    const topArtists = [...tasteProfile.artists]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const favResults = await Promise.allSettled(
      topArtists.map((a) => searchSongs(`${a.artistName}`, 15))
    );
    for (const res of favResults) {
      if (res.status === "fulfilled") addBatch(res.value, 6);
    }
    console.log(`[UpNext] Tier 6 (favorites): ${topArtists.map((a) => a.artistName).join(", ")}`);
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 7: Liked songs suggestions
  // Seeded from what the user has explicitly liked.
  // ════════════════════════════════════════════════════════════════
  if (userId && userId !== "guest" && candidateMap.size < limit * 2) {
    try {
      const userDoc = await User.findById(userId).select("likedSongs").lean();
      if (userDoc?.likedSongs && userDoc.likedSongs.length > 0) {
        // Take the most recently liked songs (end of array = most recent)
        const recentLiked = [...userDoc.likedSongs].reverse().slice(0, 5);
        const likedResults = await Promise.allSettled(
          recentLiked.map((l) => getSuggestions(l.songId, 10))
        );
        for (const res of likedResults) {
          if (res.status === "fulfilled") addBatch(res.value, 7);
        }
        console.log(`[UpNext] Tier 7 (liked songs): seeded from ${recentLiked.length} likes`);
      }
    } catch {}
  }

  // ════════════════════════════════════════════════════════════════
  // TIER 8: Most-replayed songs from listening history
  // Songs the user has explicitly returned to.
  // ════════════════════════════════════════════════════════════════
  if (userId && userId !== "guest" && candidateMap.size < limit * 2) {
    try {
      const userObjId = new mongoose.Types.ObjectId(userId);
      const mostReplayed = await ListeningHistory.aggregate([
        { $match: { userId: userObjId } },
        { $group: { _id: "$songId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      const replayFetches = await Promise.allSettled(
        mostReplayed.map((h) => fetchSongById(h._id))
      );
      for (const res of replayFetches) {
        if (res.status === "fulfilled" && res.value) {
          addCandidate(res.value, 8);
        }
      }
      console.log(`[UpNext] Tier 8 (replays): ${mostReplayed.length} most-replayed songs`);
    } catch {}
  }

  // ════════════════════════════════════════════════════════════════
  // FINAL: If we still have nothing, use home recommendations.
  // This is the last resort — NOT language cold-start charts.
  // ════════════════════════════════════════════════════════════════
  const rawCandidates = Array.from(candidateMap.values());

  console.log(`[UpNext] Total raw candidates: ${rawCandidates.length}`);

  if (rawCandidates.length === 0) {
    console.warn(`[UpNext] All tiers exhausted. Returning empty queue.`);
    return [];
  }

  // ════════════════════════════════════════════════════════════════
  // RANKING: Sort by score descending. Score is deterministic.
  // ════════════════════════════════════════════════════════════════
  rawCandidates.sort((a, b) => b.score - a.score);

  // ── Human DJ rotation: max 2 songs per artist & max 1 per root title ──
  const artistCount = new Map<string, number>();
  const seenTitles = new Set<string>();
  const seenRootTitles = new Set<string>();
  const finalQueue: QueuedTrack[] = [];

  // Seed song root title is registered first so variations of current song are excluded
  const seedRootTitle = extractRootSongTitle(seedSong.name || "");
  if (seedRootTitle) seenRootTitles.add(seedRootTitle);

  for (const candidate of rawCandidates) {
    const { song, score, signals, reason } = candidate;

    const cleanTitle = (song.name || "")
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

    const rootTitle = extractRootSongTitle(song.name || "");

    if (cleanTitle && seenTitles.has(cleanTitle)) continue;
    if (rootTitle && seenRootTitles.has(rootTitle)) continue; // STRICT max 1 per root song title!

    // Artist rotation cap (max 2 per primary artist)
    const firstArtist = (song.primaryArtists || "")
      .split(/[,/&]+/)[0]
      .trim()
      .toLowerCase();
    const artistSoFar = artistCount.get(firstArtist) || 0;
    if (artistSoFar >= 2) continue;

    artistCount.set(firstArtist, artistSoFar + 1);
    if (cleanTitle) seenTitles.add(cleanTitle);
    if (rootTitle) seenRootTitles.add(rootTitle);

    // Confidence score: signal-based (0–100)
    // Based on real signals, not self-referential scoring
    const hasAlbumContinuity = (signals.albumContinuity || 0) > 0;
    const hasSameArtist = (signals.sameArtist || 0) > 0;
    const hasLang = (signals.languageMatch || 0) > 0;
    const hasCoverPenalty = (signals.coverPenalty || 0) < 0;

    let confidence = 50;
    if (hasAlbumContinuity) confidence += 35;
    if (hasSameArtist) confidence += 25;
    if (hasLang) confidence += 15;
    if (hasCoverPenalty) confidence -= 30;
    confidence = Math.min(99, Math.max(10, confidence));

    finalQueue.push({
      ...song,
      reason,
      confidenceScore: confidence,
      expectedSatisfaction: Math.round(score / 10) / 10,
      signals,
    });

    if (finalQueue.length >= limit) break;
  }

  console.log(
    `[UpNext] Final queue: ${finalQueue.length} tracks | ` +
    `Top: "${finalQueue[0]?.name}" by ${finalQueue[0]?.primaryArtists} ` +
    `(score: ${rawCandidates[0]?.score}, confidence: ${finalQueue[0]?.confidenceScore}%)`
  );

  return finalQueue;
}
