// ════════════════════════════════════════════════════════════════
// RECOMMENDATION INSPECTOR & SATISFACTION PROBABILITY ENGINE — Task 9 & Task 10
// Developer inspection tool & expected satisfaction calculator
// ════════════════════════════════════════════════════════════════

import { Song } from "./jiosaavn.js";
import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { SessionState } from "./sessionEngine.js";

export interface RecommendationInspectionReport {
  songId: string;
  songTitle: string;
  artist: string;
  candidateSource: string;
  confidenceScore: number; // 0 to 100
  pPlay: number;           // Estimated P(Play)
  pFinish: number;         // Estimated P(Finish)
  pReplay: number;         // Estimated P(Replay)
  pSkip: number;           // Estimated P(Skip)
  pLike: number;           // Estimated P(Like)
  expectedSatisfaction: number;
  expectedByHuman: boolean;
  reasonSelected: string;
  signals: Record<string, number>;
  penalties: Record<string, number>;
  competingSongs: string[];
}

/**
 * Calculate expected satisfaction score based on estimated satisfaction probabilities:
 * ExpectedSatisfaction = 1.0 * P(Finish) + 2.0 * P(Replay) + 3.0 * P(Like) - 2.5 * P(Skip)
 */
export function calculateExpectedSatisfaction(
  pFinish: number,
  pReplay: number,
  pLike: number,
  pSkip: number
): number {
  const satisfaction = 1.0 * pFinish + 2.0 * pReplay + 3.0 * pLike - 2.5 * pSkip;
  return Math.round(satisfaction * 100) / 100;
}

/**
 * Inspect candidate recommendation and produce detailed developer inspection report
 */
export function inspectRecommendation(
  song: Song,
  sourceTag: string,
  signals: Record<string, number>,
  tasteProfile?: IUserTasteProfile | null,
  sessionState?: SessionState | null,
): RecommendationInspectionReport {
  const title = song.name || "Unknown";
  const artist = (song.primaryArtists || "").split(/[,/&]+/)[0].trim();

  // Estimate Probabilities
  let pFinish = 0.70;
  let pReplay = 0.15;
  let pLike = 0.20;
  let pSkip = 0.15;

  // Boost probabilities if user loves artist or song matches session
  if (signals.sameArtist) {
    pFinish += 0.15;
    pReplay += 0.10;
    pSkip -= 0.08;
  }

  if (signals.albumContinuity) {
    pFinish += 0.18;
    pSkip -= 0.10;
  }

  if (signals.languageMatch) {
    pFinish += 0.10;
    pSkip -= 0.05;
  }

  if (signals.coverPenalty && signals.coverPenalty < 0) {
    pSkip += 0.25;
    pFinish -= 0.20;
  }

  pFinish = Math.min(0.98, Math.max(0.10, pFinish));
  pReplay = Math.min(0.85, Math.max(0.02, pReplay));
  pLike = Math.min(0.90, Math.max(0.05, pLike));
  pSkip = Math.min(0.90, Math.max(0.02, pSkip));

  const expectedSatisfaction = calculateExpectedSatisfaction(pFinish, pReplay, pLike, pSkip);

  // Confidence Score (0 to 100)
  const confidenceScore = Math.min(99, Math.max(40, Math.round(expectedSatisfaction * 30 + 35)));
  const expectedByHuman = confidenceScore >= 70;

  return {
    songId: song.id,
    songTitle: title,
    artist,
    candidateSource: sourceTag,
    confidenceScore,
    pPlay: Math.round(pFinish * 0.95 * 100) / 100,
    pFinish: Math.round(pFinish * 100) / 100,
    pReplay: Math.round(pReplay * 100) / 100,
    pSkip: Math.round(pSkip * 100) / 100,
    pLike: Math.round(pLike * 100) / 100,
    expectedSatisfaction,
    expectedByHuman,
    reasonSelected: (song as any).reason || `Selected via ${sourceTag}`,
    signals,
    penalties: signals.coverPenalty ? { coverPenalty: signals.coverPenalty } : {},
    competingSongs: [],
  };
}
