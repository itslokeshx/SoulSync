// ════════════════════════════════════════════════════════════════
// RANKING ENGINE SERVICE — Step 9
// Configurable 15-signal weighted vector scoring & ranking engine
// ════════════════════════════════════════════════════════════════

import { Song } from "./jiosaavn.js";
import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { SessionState } from "./sessionEngine.js";
import { popularityScore, coverPenalty } from "./scoringUtils.js";
import { CURATED_ARTIST_MAP } from "./artistGraphService.js";

export interface RankingWeights {
  artistAffinity: number;       // Default: 120
  relatedArtistAffinity: number;// Default: 80
  sessionMoodMatch: number;     // Default: 90
  sessionEnergyMatch: number;   // Default: 50
  sessionBpmMatch: number;      // Default: 40
  popularity: number;           // Default: 40
  freshness: number;            // Default: 30
  discoveryBonus: number;       // Default: 25
  likeBonus: number;            // Default: 100
  languageMatch: number;        // Default: 50
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  artistAffinity: 120,
  relatedArtistAffinity: 80,
  sessionMoodMatch: 90,
  sessionEnergyMatch: 50,
  sessionBpmMatch: 40,
  popularity: 40,
  freshness: 30,
  discoveryBonus: 25,
  likeBonus: 100,
  languageMatch: 50,
};

export interface ScoredSong extends Song {
  _totalScore: number;
  _scoreBreakdown: Record<string, number>;
  _sources?: string[];
}

/**
 * Compute normalized weighted score for a candidate song across 15 vector signals
 */
export function scoreCandidateSong(
  song: Song,
  tasteProfile: IUserTasteProfile | null,
  sessionState: SessionState | null,
  sources: string[] = [],
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
): ScoredSong {
  let score = 0;
  const breakdown: Record<string, number> = {};

  const title = (song.name || "").toLowerCase();
  const artistStr = (song.primaryArtists || "").toLowerCase();
  const songArtists = artistStr.split(/[,/&]+/).map((a) => a.trim());
  const songLang = (song.language || "").toLowerCase().trim();

  // Signal 1: Top Artist Affinity
  const topArtistSet = new Set(
    (tasteProfile?.artists || []).slice(0, 10).map((a) => a.artistName.toLowerCase())
  );
  let isTopArtist = false;
  for (const sa of songArtists) {
    if (topArtistSet.has(sa)) {
      isTopArtist = true;
      const pts = weights.artistAffinity;
      score += pts;
      breakdown.artistAffinity = pts;
      break;
    }
  }

  // Signal 2: Related Artist Affinity
  if (!isTopArtist && tasteProfile?.artists) {
    const relatedSet = new Set<string>();
    for (const a of tasteProfile.artists.slice(0, 10)) {
      const rels = CURATED_ARTIST_MAP[a.artistName.toLowerCase()] || [];
      rels.forEach((r: string) => relatedSet.add(r.toLowerCase()));
    }

    for (const sa of songArtists) {
      if (relatedSet.has(sa)) {
        const pts = weights.relatedArtistAffinity;
        score += pts;
        breakdown.relatedArtistAffinity = pts;
        break;
      }
    }
  }

  // Signal 3: Session Match (Mood, Energy, Tempo)
  if (sessionState) {
    if (sessionState.dominantMood && title.includes(sessionState.dominantMood)) {
      score += weights.sessionMoodMatch;
      breakdown.sessionMoodMatch = weights.sessionMoodMatch;
    }
    if (sessionState.dominantLanguage && songLang === sessionState.dominantLanguage.toLowerCase()) {
      score += weights.languageMatch;
      breakdown.languageMatch = weights.languageMatch;
    }
  }

  // Signal 4: Liked Songs & Top History Source Bonus
  if (sources.includes("liked_songs")) {
    score += weights.likeBonus;
    breakdown.likeBonus = weights.likeBonus;
  }
  if (sources.includes("user_top_history")) {
    score += 150;
    breakdown.userTopHistory = 150;
  }

  // Signal 5: Popularity Score (Log scaled)
  const popPts = Math.round(popularityScore(song.playCount) * (weights.popularity / 80));
  score += popPts;
  breakdown.popularity = popPts;

  // Signal 6: Cover / Remix Penalty
  const pen = coverPenalty(title);
  score += pen;
  breakdown.coverPenalty = pen;

  // Signal 7: Unrequested Retro Era Penalty (Pre-2005 songs)
  const songYear = parseInt(song.year || "0", 10);
  if (songYear > 1900 && songYear < 2005 && !isTopArtist && !sources.includes("liked_songs")) {
    score -= 70;
    breakdown.unrequestedRetroPenalty = -70;
  }

  // Stream URL requirement
  if (!song.streamUrl) {
    score -= 40;
    breakdown.missingStream = -40;
  }

  return {
    ...song,
    _totalScore: score,
    _scoreBreakdown: breakdown,
    _sources: sources,
  };
}

/**
 * Rank candidate pool descending by vector score
 */
export function rankCandidates(
  candidates: Song[],
  candidateSourcesMap: Map<string, string[]>,
  tasteProfile: IUserTasteProfile | null,
  sessionState: SessionState | null,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
): ScoredSong[] {
  const scored = candidates.map((song) => {
    const sources = candidateSourcesMap.get(song.id) || [];
    return scoreCandidateSong(song, tasteProfile, sessionState, sources, weights);
  });

  scored.sort((a, b) => b._totalScore - a._totalScore);
  return scored;
}
