// ════════════════════════════════════════════════════════════════
// EXPLANATION ENGINE SERVICE — Step 16
// Explains every recommendation with human-readable rationale tags
// ════════════════════════════════════════════════════════════════

import { Song } from "./jiosaavn.js";
import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { SessionState } from "./sessionEngine.js";

export function attachRecommendationExplanation(
  song: Song,
  sources: string[] = [],
  tasteProfile: IUserTasteProfile | null,
  sessionState: SessionState | null,
): string {
  const songArtist = (song.primaryArtists || "").split(/[,/&]+/)[0].trim();

  // 1. Top Artist Match
  if (tasteProfile && tasteProfile.artists) {
    const topArtistNames = tasteProfile.artists.slice(0, 5).map((a) => a.artistName.toLowerCase());
    if (topArtistNames.includes(songArtist.toLowerCase())) {
      return `Because you love ${songArtist}`;
    }
  }

  // 2. Session Context Match
  if (sessionState && sessionState.dominantMood) {
    const moodCapitalized = sessionState.dominantMood.charAt(0).toUpperCase() + sessionState.dominantMood.slice(1);
    return `Matches your ${moodCapitalized} ${sessionState.timeOfDay} session`;
  }

  // 3. Source tags
  if (sources.includes("liked_songs")) {
    return "Similar to your Liked Songs";
  }
  if (sources.includes("recent_history")) {
    return "Based on your recent listening";
  }
  if (sources.includes("similar_artists")) {
    return `Recommended for ${song.language || "your preferred"} taste`;
  }

  return `Popular in ${song.language || "your preferences"}`;
}
