// ════════════════════════════════════════════════════════════════
// RECOMMENDATION JOBS SERVICE — Step 18
// Background & nightly jobs for precomputing taste profiles & graph data
// ════════════════════════════════════════════════════════════════

import { User } from "../models/User.js";
import { computeUserTasteProfile } from "./tasteEngine.js";
import { getRelatedArtists } from "./artistGraphService.js";

/**
 * Nightly / Periodic job to recompute taste profiles for all active users
 */
export async function runNightlyTasteProfileRecomputation(): Promise<void> {
  console.log("[RecJobs] Starting nightly taste profile recomputation...");
  try {
    const users = await User.find({ onboardingComplete: true }).select("_id").lean();
    let computed = 0;
    for (const u of users) {
      try {
        await computeUserTasteProfile(u._id.toString());
        computed++;
      } catch (err) {
        console.error(`[RecJobs] Failed for user ${u._id}:`, err);
      }
    }
    console.log(`[RecJobs] Successfully updated ${computed} user taste profiles.`);
  } catch (err) {
    console.error("[RecJobs] Nightly job failed:", err);
  }
}

/**
 * Precompute artist relation graph for top mainstream artists
 */
export async function runPrecomputeArtistGraphJob(): Promise<void> {
  console.log("[RecJobs] Precomputing artist similarity graphs...");
  const mainArtists = [
    "Ed Sheeran", "Taylor Swift", "The Weeknd", "Drake", "Billie Eilish",
    "Ariana Grande", "Dua Lipa", "Arijit Singh", "Anirudh Ravichander",
    "Pritam", "AR Rahman", "Bad Bunny", "BTS", "BLACKPINK"
  ];
  for (const art of mainArtists) {
    try {
      await getRelatedArtists(art, 8);
    } catch {}
  }
  console.log("[RecJobs] Artist graph precomputation complete.");
}
