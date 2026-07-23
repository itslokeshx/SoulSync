// ════════════════════════════════════════════════════════════════
// UP NEXT ENGINE — 100% Current-Playing-Song Anchored Predictor
// Strictly eliminates all unrelated generic/cold-start candidate pollution
// ════════════════════════════════════════════════════════════════

import { Song, fetchSongById, getSuggestions, searchSongs, normalizeSongsToCanonical } from "./jiosaavn.js";
import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { getActiveSessionContext, updateSessionWithSong, SessionState } from "./sessionEngine.js";
import { getRelatedArtists } from "./artistGraphService.js";
import { filterByLanguages, detectSongLanguage, coverPenalty, popularityScore, getRecentlyRecommendedSongIds } from "./scoringUtils.js";
import { getOrCreateSongFeature } from "./songFeatureService.js";
import { getEcosystemArtists } from "./tasteClusters.js";

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
  signals: Record<string, number>;
}

export async function predictNextTracks(params: UpNextParams): Promise<QueuedTrack[]> {
  const { currentSongId, userId, queueSongIds = [], recentHistorySongIds = [], sessionId, limit = 25, userPrefs, tasteProfile } = params;

  if (!currentSongId) return [];

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
    return [];
  }

  // Active Session Context Update
  const session: SessionState = sessionId
    ? await updateSessionWithSong(sessionId, seedSong, userId)
    : await getActiveSessionContext(undefined, userId, currentSongId);

  const seedFeatures = await getOrCreateSongFeature(seedSong);
  const rec7d = userId ? await getRecentlyRecommendedSongIds(userId, 7) : [];
  const excludeSet = new Set<string>([currentSongId, ...queueSongIds, ...recentHistorySongIds, ...rec7d]);

  const candidateMap = new Map<string, Song>();
  const addCandidate = (song: Song) => {
    if (!song || !song.id || excludeSet.has(song.id)) return;
    if (!candidateMap.has(song.id)) {
      candidateMap.set(song.id, song);
    }
  };

  const seedLang = detectSongLanguage(seedSong) || (seedSong.language || "").toLowerCase().trim();
  const allowedLangs = seedLang ? [seedLang] : ["tamil", "hindi", "english"];

  const seedArtists = (seedSong.primaryArtists || "").split(/[,/&]+/).map((a) => a.trim()).filter(Boolean);
  const primarySeedArtist = seedArtists[0] || "";
  const seedAlbum = (seedSong.album || "").trim();

  // ════════════════════════════════════════════════════════════════
  // STRICT CURRENT PLAYING SONG ANCHORED HARVESTER (NO GENERIC POLLUTION)
  // ════════════════════════════════════════════════════════════════

  // Stream 1: Exact Current Album / Movie Soundtrack Tracks (40 candidates)
  if (seedAlbum) {
    try {
      const albumHits = await searchSongs(`${seedAlbum} album songs`, 30);
      normalizeSongsToCanonical(albumHits).forEach(addCandidate);
    } catch {}
  }

  // Stream 2: Primary & Featured Seed Artist Songs (40 candidates)
  for (const artist of seedArtists.slice(0, 3)) {
    try {
      const artistHits = await searchSongs(`${artist} songs`, 25);
      normalizeSongsToCanonical(artistHits).forEach(addCandidate);
    } catch {}
  }

  // Stream 3: Direct JioSaavn Track Vector Suggestions (40 candidates)
  try {
    const rawSuggestions = await getSuggestions(currentSongId, 40);
    normalizeSongsToCanonical(rawSuggestions).forEach(addCandidate);
  } catch {}

  // Stream 4: Direct Peer Ecosystem Artists (50 candidates)
  if (primarySeedArtist) {
    try {
      const ecoArtists = Array.from(getEcosystemArtists(primarySeedArtist));
      const ecoResults = await Promise.allSettled(
        ecoArtists.slice(0, 5).map((a) => searchSongs(`${a} hits`, 10))
      );
      for (const res of ecoResults) {
        if (res.status === "fulfilled") {
          normalizeSongsToCanonical(res.value).forEach(addCandidate);
        }
      }
    } catch {}
  }

  const rawCandidates = Array.from(candidateMap.values());

  // HARD GATEKEEPER: Filter strictly by seed song language
  const langFiltered = filterByLanguages(rawCandidates, allowedLangs);

  // Strictly Anchored Fallback: If candidates < limit, fetch deep cuts of primary artist
  if (langFiltered.length < limit && primarySeedArtist) {
    try {
      const deepCuts = await searchSongs(`best of ${primarySeedArtist}`, 30);
      normalizeSongsToCanonical(deepCuts).forEach((s) => {
        if (!excludeSet.has(s.id) && !candidateMap.has(s.id)) {
          langFiltered.push(s);
        }
      });
    } catch {}
  }

  // ════════════════════════════════════════════════════════════════
  // RELEVANCE & FLOW SCORING ENGINE
  // ════════════════════════════════════════════════════════════════
  const seedArtistSet = new Set(seedArtists.map((a) => a.toLowerCase()));
  const targetEnergy = seedFeatures.energy || session.dominantEnergy || 0.5;
  const targetBpm = seedFeatures.tempo || session.dominantTempo || 110;

  const scored = await Promise.all(
    langFiltered.map(async (song) => {
      let djScore = 0;
      const signals: Record<string, number> = {};

      const title = (song.name || "").toLowerCase();
      const songArtists = (song.primaryArtists || "").toLowerCase().split(/[,/&]+/).map((a) => a.trim());
      const songLang = detectSongLanguage(song) || (song.language || "").toLowerCase().trim();
      const songAlbum = (song.album || "").trim().toLowerCase();

      // Signal 1: Same Album Continuity (+160 pts)
      if (seedAlbum && songAlbum && seedAlbum.toLowerCase() === songAlbum) {
        djScore += 160;
        signals.albumContinuity = 160;
      }

      // Signal 2: Same Artist Flow (+120 pts)
      for (const sa of songArtists) {
        if (seedArtistSet.has(sa)) {
          djScore += 120;
          signals.sameArtist = 120;
          break;
        }
      }

      // Signal 3: Exact Seed Language Match (+100 pts)
      if (seedLang && songLang === seedLang) {
        djScore += 100;
        signals.languageMatch = 100;
      }

      // Signal 4: Emotional Energy Curve Alignment (+40 pts)
      const features = await getOrCreateSongFeature(song);
      const songEnergy = features.energy || 0.5;
      const energyDelta = Math.abs(songEnergy - targetEnergy);
      const energyScore = Math.max(0, Math.round((1 - energyDelta) * 40));
      djScore += energyScore;
      signals.energyCurve = energyScore;

      // Signal 5: Tempo Window Alignment (+30 pts)
      const songBpm = features.tempo || 110;
      const bpmDelta = Math.abs(songBpm - targetBpm);
      const bpmScore = Math.max(0, Math.round((1 - Math.min(1, bpmDelta / 60)) * 30));
      djScore += bpmScore;
      signals.tempoAlignment = bpmScore;

      // Popularity
      const popPts = Math.round(popularityScore(song.playCount) * 0.3);
      djScore += popPts;
      signals.popularity = popPts;

      // Cover Penalty
      const pen = coverPenalty(title);
      djScore += pen;

      if (!song.streamUrl) djScore -= 50;

      // Rationale tag
      let reasonTag = `Up Next • Recommended after ${seedSong.name}`;
      if (signals.albumContinuity) {
        reasonTag = `From same album • ${seedSong.album}`;
      } else if (signals.sameArtist) {
        reasonTag = `More from • ${primarySeedArtist}`;
      } else if (signals.languageMatch) {
        reasonTag = `Similar vibe to • ${seedSong.name}`;
      }

      const confidenceScore = Math.min(0.99, Math.max(0.65, Math.round((djScore / 380) * 100) / 100));

      return {
        ...song,
        _djScore: djScore,
        reason: reasonTag,
        confidenceScore,
        signals,
      };
    })
  );

  scored.sort((a, b) => b._djScore - a._djScore);

  // Human DJ Rotation: Max 2 songs per artist in Up Next queue
  const artistCount = new Map<string, number>();
  const seenNames = new Set<string>();
  const finalQueue: QueuedTrack[] = [];

  for (const song of scored) {
    const cleanTitle = (song.name || "").toLowerCase().replace(/\(.*\)/g, "").trim();
    if (cleanTitle && seenNames.has(cleanTitle)) continue;

    const firstArtist = (song.primaryArtists || "").split(/[,/&]+/)[0].trim().toLowerCase();
    const count = artistCount.get(firstArtist) || 0;
    
    if (count >= 2) continue;
    artistCount.set(firstArtist, count + 1);
    if (cleanTitle) seenNames.add(cleanTitle);

    const clean = { ...song };
    delete (clean as any)._djScore;
    finalQueue.push(clean as QueuedTrack);

    if (finalQueue.length >= limit) break;
  }

  return finalQueue;
}
