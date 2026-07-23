// ════════════════════════════════════════════════════════════════
// ELIGIBILITY FILTER & LANGUAGE CONFIDENCE BOUNDARIES — Step 2, Step 6, Step 7
// Hard gatekeeper: Candidate songs MUST satisfy eligibility before ranking
// ════════════════════════════════════════════════════════════════

import { Song } from "./jiosaavn.js";
import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { NegativeAffinityProfile } from "./negativeAffinity.js";
import { EcosystemCluster } from "./tasteClusters.js";
import { detectSongLanguage } from "./scoringUtils.js";

export interface EligibilityContext {
  allowedLanguages: Set<string>;        // High confidence languages (confidence >= 5%)
  userArtists: Set<string>;            // User's favorite & history artists
  relatedArtists: Set<string>;         // Graph peer artists
  negativeProfile: NegativeAffinityProfile;
  activeCluster?: EcosystemCluster | null;
}

/**
 * Compute Language Confidence Distribution with 7-Day Exponential Recency Decay
 */
export function computeLanguageConfidence(
  tasteProfile: IUserTasteProfile | null,
  userPrefs?: { languages?: string[] } | null,
): { confidenceMap: Map<string, number>; highConfidenceLangs: Set<string> } {
  const confidenceMap = new Map<string, number>();
  const highConfidenceLangs = new Set<string>();

  if (userPrefs?.languages && userPrefs.languages.length > 0) {
    for (const l of userPrefs.languages) {
      const clean = l.toLowerCase().trim();
      confidenceMap.set(clean, 1.0 / userPrefs.languages.length);
      highConfidenceLangs.add(clean);
    }
    return { confidenceMap, highConfidenceLangs };
  }

  if (!tasteProfile || !tasteProfile.languages || tasteProfile.languages.length === 0) {
    highConfidenceLangs.add("english");
    confidenceMap.set("english", 1.0);
    return { confidenceMap, highConfidenceLangs };
  }

  const totalWeight = tasteProfile.languages.reduce((sum, l) => sum + (l.weight || 0), 0);

  for (const langItem of tasteProfile.languages) {
    const lang = langItem.language.toLowerCase().trim();
    const conf = totalWeight > 0 ? langItem.weight / totalWeight : 0;
    confidenceMap.set(lang, conf);

    // Hard threshold: Only languages with >= 5% confidence are allowed
    if (conf >= 0.05) {
      highConfidenceLangs.add(lang);
    }
  }

  if (highConfidenceLangs.size === 0) {
    highConfidenceLangs.add("english");
  }

  return { confidenceMap, highConfidenceLangs };
}

/**
 * HARD ELIGIBILITY EVALUATOR
 * Rejects candidate songs immediately if they fail language boundaries, negative affinity, or cluster ecosystem
 */
export function evaluateCandidateEligibility(
  song: Song,
  context: EligibilityContext,
): { eligible: boolean; reason: string } {
  if (!song || !song.id) {
    return { eligible: false, reason: "Hard reject: Invalid song object" };
  }

  const songLang = (detectSongLanguage(song) || song.language || "").toLowerCase().trim();
  const songArtists = (song.primaryArtists || "")
    .toLowerCase()
    .split(/[,/&]+/)
    .map((a) => a.trim())
    .filter(Boolean);

  const primaryArtist = songArtists[0] || "";

  // 1. HARD REJECT: Negative Language Affinity
  if (songLang && context.negativeProfile.negativeLanguages.has(songLang)) {
    return { eligible: false, reason: `Hard reject: Negative language affinity ("${songLang}")` };
  }

  // 2. HARD REJECT: Negative Artist Affinity
  for (const sa of songArtists) {
    if (context.negativeProfile.negativeArtists.has(sa)) {
      return { eligible: false, reason: `Hard reject: Negative artist affinity ("${sa}")` };
    }
  }

  // 3. HARD REJECT: Language Confidence Boundary
  if (songLang && context.allowedLanguages.size > 0 && !context.allowedLanguages.has(songLang)) {
    return { eligible: false, reason: `Hard reject: Language "${songLang}" below 5% confidence threshold` };
  }

  // 4. HARD PASS: User Favorite / History Artist
  for (const sa of songArtists) {
    if (context.userArtists.has(sa)) {
      return { eligible: true, reason: `Pass: User favorite/history artist ("${sa}")` };
    }
  }

  // 5. HARD PASS: Related Ecosystem Artist
  for (const sa of songArtists) {
    if (context.relatedArtists.has(sa)) {
      return { eligible: true, reason: `Pass: Ecosystem peer artist ("${sa}")` };
    }
  }

  // 6. HARD PASS: Active Cluster Ecosystem Match
  if (context.activeCluster && primaryArtist) {
    const clusterArtists = new Set([
      ...context.activeCluster.primaryArtists,
      ...context.activeCluster.peerEcosystem,
    ]);
    if (clusterArtists.has(primaryArtist)) {
      return { eligible: true, reason: `Pass: Active cluster match ("${context.activeCluster.clusterName}")` };
    }
  }

  // 7. General Language Match Pass (If candidate matches high-confidence language)
  if (songLang && context.allowedLanguages.has(songLang)) {
    return { eligible: true, reason: `Pass: Language confidence match ("${songLang}")` };
  }

  return { eligible: false, reason: "Hard reject: Outside established user taste ecosystem" };
}
