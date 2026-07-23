// ════════════════════════════════════════════════════════════════
// ADAPTIVE WEIGHTING ENGINE — Step 5
// Computes dynamic, user-specific ranking weights & discovery ratios
// ════════════════════════════════════════════════════════════════

import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { RankingWeights, DEFAULT_RANKING_WEIGHTS } from "./rankingEngine.js";

export interface AdaptiveProfile {
  weights: RankingWeights;
  discoveryRatio: number;      // 0.05 to 0.35
  maxPerArtist: number;        // 2 to 5 depending on artist concentration
}

export function computeAdaptiveWeights(
  tasteProfile: IUserTasteProfile | null,
): AdaptiveProfile {
  if (!tasteProfile || !tasteProfile.artists || tasteProfile.artists.length === 0) {
    return {
      weights: { ...DEFAULT_RANKING_WEIGHTS },
      discoveryRatio: 0.20,
      maxPerArtist: 2,
    };
  }

  const weights: RankingWeights = { ...DEFAULT_RANKING_WEIGHTS };
  let discoveryRatio = 0.20;
  let maxPerArtist = 2;

  const topArtistScore = tasteProfile.artists[0]?.score || 0;
  const totalArtistScoreSum = tasteProfile.artists.reduce((sum, a) => sum + (a.score || 0), 0);
  const topArtistConcentration = totalArtistScoreSum > 0 ? topArtistScore / totalArtistScoreSum : 0;

  // 1. High Artist Focus User (Concentrated listening)
  if (topArtistConcentration > 0.40 || tasteProfile.artists.length <= 3) {
    weights.artistAffinity = 240;         // Double artist affinity score
    weights.relatedArtistAffinity = 120;
    weights.popularity = 20;              // Halve popularity weight so chart hits don't dominate
    discoveryRatio = 0.08;                // Reduce discovery to 8%
    maxPerArtist = 4;                     // Allow up to 4 tracks per top artist
  } else if (topArtistConcentration > 0.25) {
    weights.artistAffinity = 180;
    weights.relatedArtistAffinity = 100;
    weights.popularity = 30;
    discoveryRatio = 0.15;
    maxPerArtist = 3;
  }

  // 2. High Replay / Loyalist User
  if ((tasteProfile.averageReplayRate || 0) > 25) {
    weights.likeBonus = 160;
    weights.freshness = 15;               // Lower freshness penalty so replayed songs can return
  }

  // 3. Explorer User (High unique artist ratio)
  if ((tasteProfile.discoveryScore || 0) > 60) {
    discoveryRatio = Math.min(0.35, discoveryRatio + 0.10);
    weights.discoveryBonus = 50;
    weights.relatedArtistAffinity = 110;
  }

  // 4. Low Skip / Completion Loyalist User
  if ((tasteProfile.averageCompletionRate || 0) > 85) {
    weights.artistAffinity += 30;
  }

  return {
    weights,
    discoveryRatio,
    maxPerArtist,
  };
}
