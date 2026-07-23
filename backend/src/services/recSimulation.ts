// ════════════════════════════════════════════════════════════════
// RECOMMENDATION TELEMETRY — Real Behavioral Metrics
//
// The old recSimulation.ts evaluated the recommendation engine
// against its own confidence scores. That was circular and meaningless.
//
// This module reads REAL user interaction events from the database:
//   - song_finished → the recommendation was good
//   - skip → the recommendation was bad
//   - replay → the recommendation was excellent
//   - like / playlist_add → the recommendation was excellent
//
// These are the ONLY metrics that matter.
// ════════════════════════════════════════════════════════════════

import { RecommendationEvent } from "../models/RecommendationEvent.js";
import { ListeningHistory } from "../models/ListeningHistory.js";
import mongoose from "mongoose";

export interface RealTelemetryReport {
  userId: string;
  windowDays: number;
  totalRecommendationEvents: number;
  // Play / Finish
  songStartedCount: number;
  songFinishedCount: number;
  completionRate: number;       // songFinished / songStarted (0.0 to 1.0)
  // Skip
  skipCount: number;
  skipRate: number;             // skip / songStarted (0.0 to 1.0)
  // Positive signals
  replayCount: number;
  likeCount: number;
  playlistAddCount: number;
  positiveSignalRate: number;   // (replay + like + playlistAdd) / songStarted
  // Quality verdict
  qualityScore: number;         // Composite 0–100. Higher = recommendations feel correct.
  qualityVerdict: "excellent" | "good" | "needs_work" | "poor" | "insufficient_data";
}

/**
 * Compute real recommendation quality for a user from database events.
 * Never uses simulated or estimated values.
 */
export async function computeRealTelemetry(
  userId: string,
  windowDays: number = 30,
): Promise<RealTelemetryReport> {
  const empty: RealTelemetryReport = {
    userId,
    windowDays,
    totalRecommendationEvents: 0,
    songStartedCount: 0,
    songFinishedCount: 0,
    completionRate: 0,
    skipCount: 0,
    skipRate: 0,
    replayCount: 0,
    likeCount: 0,
    playlistAddCount: 0,
    positiveSignalRate: 0,
    qualityScore: 0,
    qualityVerdict: "insufficient_data",
  };

  if (!userId || userId === "guest") return empty;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  let userObjId: mongoose.Types.ObjectId;
  try {
    userObjId = new mongoose.Types.ObjectId(userId);
  } catch {
    return empty;
  }

  try {
    const events = await RecommendationEvent.find({
      userId: userObjId,
      timestamp: { $gte: since },
    })
      .select("eventType completionPercent")
      .lean();

    if (events.length === 0) return empty;

    let songStarted = 0;
    let songFinished = 0;
    let skips = 0;
    let replays = 0;
    let likes = 0;
    let playlistAdds = 0;

    for (const e of events) {
      switch (e.eventType) {
        case "song_started":   songStarted++; break;
        case "song_finished":  songFinished++; break;
        case "skip":           skips++; break;
        case "replay":         replays++; break;
        case "like":           likes++; break;
        case "playlist_add":   playlistAdds++; break;
      }
    }

    if (songStarted === 0) return { ...empty, totalRecommendationEvents: events.length };

    const completionRate = songFinished / songStarted;
    const skipRate = skips / songStarted;
    const positiveSignalRate = (replays + likes + playlistAdds) / songStarted;

    // Quality score: weighted combination of real signals
    // completion (high weight) + positive signals - skip rate
    const qualityScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          completionRate * 50 +
          positiveSignalRate * 35 -
          skipRate * 40 +
          15  // baseline offset
        )
      )
    );

    let qualityVerdict: RealTelemetryReport["qualityVerdict"];
    if (songStarted < 10) qualityVerdict = "insufficient_data";
    else if (qualityScore >= 75) qualityVerdict = "excellent";
    else if (qualityScore >= 55) qualityVerdict = "good";
    else if (qualityScore >= 35) qualityVerdict = "needs_work";
    else qualityVerdict = "poor";

    return {
      userId,
      windowDays,
      totalRecommendationEvents: events.length,
      songStartedCount: songStarted,
      songFinishedCount: songFinished,
      completionRate: Math.round(completionRate * 1000) / 1000,
      skipCount: skips,
      skipRate: Math.round(skipRate * 1000) / 1000,
      replayCount: replays,
      likeCount: likes,
      playlistAddCount: playlistAdds,
      positiveSignalRate: Math.round(positiveSignalRate * 1000) / 1000,
      qualityScore,
      qualityVerdict,
    };
  } catch (err) {
    console.error("[RecTelemetry] Failed to compute real telemetry:", err);
    return empty;
  }
}

/**
 * Compute per-recommendation-source skip/finish rates.
 * Tells you which candidate sources produce bad recommendations.
 */
export async function computeSourceTelemetry(
  userId: string,
  windowDays: number = 30,
): Promise<Record<string, { played: number; skipped: number; skipRate: number }>> {
  if (!userId || userId === "guest") return {};

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  let userObjId: mongoose.Types.ObjectId;
  try {
    userObjId = new mongoose.Types.ObjectId(userId);
  } catch {
    return {};
  }

  try {
    const history = await ListeningHistory.find({
      userId: userObjId,
      source: "recommendation",
      playedAt: { $gte: since },
    })
      .select("completionPercent source")
      .lean();

    const sourceStats: Record<string, { played: number; skipped: number }> = {};

    for (const h of history) {
      const src = h.source || "unknown";
      if (!sourceStats[src]) sourceStats[src] = { played: 0, skipped: 0 };
      sourceStats[src].played++;
      // A play with <25% completion is effectively a skip
      if ((h.completionPercent ?? 100) < 25) {
        sourceStats[src].skipped++;
      }
    }

    const result: Record<string, { played: number; skipped: number; skipRate: number }> = {};
    for (const [src, stats] of Object.entries(sourceStats)) {
      result[src] = {
        ...stats,
        skipRate: stats.played > 0 ? Math.round((stats.skipped / stats.played) * 1000) / 1000 : 0,
      };
    }
    return result;
  } catch {
    return {};
  }
}
