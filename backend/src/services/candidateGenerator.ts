// ════════════════════════════════════════════════════════════════
// CANDIDATE GENERATOR ENGINE — Step 2 & Step 6
// Redesigned Candidate Harvester with Hard Eligibility Gatekeeper
// ════════════════════════════════════════════════════════════════

import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { SessionState } from "./sessionEngine.js";
import { Song, searchSongs, getSuggestions, normalizeSongsToCanonical } from "./jiosaavn.js";
import { getRelatedArtists } from "./artistGraphService.js";
import { User } from "../models/User.js";
import { getNegativeAffinityProfile } from "./negativeAffinity.js";
import { computeLanguageConfidence, evaluateCandidateEligibility, EligibilityContext } from "./eligibilityFilter.js";
import { detectActiveEcosystemCluster, getEcosystemArtists } from "./tasteClusters.js";

export interface CandidatePoolResult {
  candidates: Song[];
  candidateSourcesMap: Map<string, string[]>; // songId -> sources
}

export async function generateCandidatePool(
  tasteProfile: IUserTasteProfile | null,
  sessionState: SessionState | null,
  allowedLangs: string[],
  excludeIds: Set<string>,
  userId?: string,
  targetCount: number = 200,
): Promise<CandidatePoolResult> {
  const candidateMap = new Map<string, Song>();
  const sourcesMap = new Map<string, string[]>();

  // 1. Build Eligibility Context
  const negativeProfile = await getNegativeAffinityProfile(userId || "");
  const { highConfidenceLangs } = computeLanguageConfidence(tasteProfile);

  const userArtists = new Set<string>(
    (tasteProfile?.artists || []).map((a) => a.artistName.toLowerCase())
  );

  const relatedArtists = new Set<string>();
  for (const a of (tasteProfile?.artists || []).slice(0, 5)) {
    const rels = await getRelatedArtists(a.artistName, 3);
    rels.forEach((r) => relatedArtists.add(r.toLowerCase()));
  }

  const sessionArtist = sessionState?.dominantArtists?.[0] || tasteProfile?.artists?.[0]?.artistName || "";
  const activeCluster = detectActiveEcosystemCluster(sessionArtist, sessionState?.dominantLanguage);

  const eligibilityContext: EligibilityContext = {
    allowedLanguages: highConfidenceLangs,
    userArtists,
    relatedArtists,
    negativeProfile,
    activeCluster,
  };

  const addCandidate = (song: Song, sourceTag: string) => {
    if (!song || !song.id || excludeIds.has(song.id)) return;

    // HARD ELIGIBILITY CHECK: Reject songs failing language, negative affinity, or cluster rules
    const eligibility = evaluateCandidateEligibility(song, eligibilityContext);
    if (!eligibility.eligible) return; // HARD REJECT: Never enter ranking pool!

    const existing = candidateMap.get(song.id);
    if (!existing) {
      candidateMap.set(song.id, song);
      sourcesMap.set(song.id, [sourceTag]);
    } else {
      const srcList = sourcesMap.get(song.id) || [];
      if (!srcList.includes(sourceTag)) srcList.push(sourceTag);
    }
  };

  const primaryLang = Array.from(highConfidenceLangs)[0] || tasteProfile?.topLanguage || "";
  const langSuffix = primaryLang && primaryLang !== "english" ? ` ${primaryLang}` : "";

  // Source 1: Top Artists Deep Cuts (60 candidates)
  if (tasteProfile && tasteProfile.artists && tasteProfile.artists.length > 0) {
    const topArtists = tasteProfile.artists.slice(0, 10);
    const artistResults = await Promise.allSettled(
      topArtists.map((a) => searchSongs(`${a.artistName}${langSuffix}`, 15))
    );
    for (const res of artistResults) {
      if (res.status === "fulfilled") {
        for (const s of normalizeSongsToCanonical(res.value)) {
          addCandidate(s, "favorite_artists");
        }
      }
    }

    // Source 2: Related Artists Network Graph (40 candidates)
    const relatedQueries: string[] = [];
    for (const a of topArtists.slice(0, 5)) {
      const related = await getRelatedArtists(a.artistName, 3);
      for (const rel of related) {
        relatedQueries.push(`${rel}${langSuffix}`);
      }
    }
    if (relatedQueries.length > 0) {
      const relatedResults = await Promise.allSettled(
        relatedQueries.slice(0, 10).map((q) => searchSongs(q, 10))
      );
      for (const res of relatedResults) {
        if (res.status === "fulfilled") {
          for (const s of normalizeSongsToCanonical(res.value)) {
            addCandidate(s, "similar_artists");
          }
        }
      }
    }
  }

  // Source 3 (user_top_history) REMOVED — discovery surface.

  // Source 4: Suggestions seeded from Liked Songs
  if (userId && userId !== "guest") {
    try {
      const userDoc = await User.findById(userId).select("likedSongs").lean();
      if (userDoc?.likedSongs && userDoc.likedSongs.length > 0) {
        const recentLiked = [...userDoc.likedSongs].reverse().slice(0, 8);
        const likedRecs = await Promise.allSettled(
          recentLiked.map((l) => getSuggestions(l.songId, 15))
        );
        for (const res of likedRecs) {
          if (res.status === "fulfilled") {
            for (const s of normalizeSongsToCanonical(res.value)) {
              addCandidate(s, "liked_seeds");
            }
          }
        }
      }
    } catch {}
  }

  // Source 5: Session Ecosystem Continuation (30 candidates)
  if (sessionArtist) {
    try {
      const ecosystemArtists = Array.from(getEcosystemArtists(sessionArtist));
      const ecoResults = await Promise.allSettled(
        ecosystemArtists.slice(0, 5).map((a) => searchSongs(`${a}${langSuffix}`, 10))
      );
      for (const res of ecoResults) {
        if (res.status === "fulfilled") {
          for (const s of normalizeSongsToCanonical(res.value)) {
            addCandidate(s, "session_ecosystem");
          }
        }
      }
    } catch {}
  }

  const rawCandidates = Array.from(candidateMap.values());

  return {
    candidates: rawCandidates.slice(0, targetCount),
    candidateSourcesMap: sourcesMap,
  };
}

import mongoose from "mongoose";
