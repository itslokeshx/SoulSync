// ════════════════════════════════════════════════════════════════
// RECOMMENDATION DIAGNOSTICS LOGGER — Step 8
// Diagnostics logger for tracing candidate eligibility, clusters, & ranks
// ════════════════════════════════════════════════════════════════

import { Song } from "./jiosaavn.js";
import { EligibilityContext } from "./eligibilityFilter.js";

export function logRecommendationDiagnostics(
  song: Song,
  sourceTag: string,
  eligibility: { eligible: boolean; reason: string },
  context: EligibilityContext,
  finalScore?: number,
  rank?: number,
): void {
  const title = song.name || "Unknown";
  const artist = song.primaryArtists || "Unknown";
  const lang = song.language || "unknown";

  console.log(`[RecDiagnostics] Candidate: "${title}" by ${artist} [Lang: ${lang}]`);
  console.log(`  ├─ Source: ${sourceTag}`);
  console.log(`  ├─ Eligibility: ${eligibility.eligible ? "PASSED" : "REJECTED"} (${eligibility.reason})`);
  console.log(`  ├─ Active Cluster: ${context.activeCluster ? context.activeCluster.clusterName : "Global"}`);
  console.log(`  ├─ Allowed Languages: [${Array.from(context.allowedLanguages).join(", ")}]`);
  if (finalScore !== undefined) {
    console.log(`  └─ Final Rank #${rank}: Total Score ${finalScore}`);
  }
}
