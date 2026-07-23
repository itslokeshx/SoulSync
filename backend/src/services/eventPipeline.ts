// ════════════════════════════════════════════════════════════════
// EVENT PIPELINE & BEHAVIOR LEARNING SERVICE — Step 2 & Step 8
// Centralized event logging and behavior-weighted score calculation
// ════════════════════════════════════════════════════════════════

import mongoose from "mongoose";
import { RecommendationEvent, EventType } from "../models/RecommendationEvent.js";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { redisSet, redisGet } from "./redis.js";

export interface LogEventParams {
  userId: string;
  eventType: EventType;
  songId?: string;
  artistId?: string;
  artistName?: string;
  albumId?: string;
  playlistId?: string;
  searchQuery?: string;
  completionPercent?: number;
  listeningDurationSeconds?: number;
  sessionId?: string;
  contextLanguage?: string;
}

/**
 * Calculate dynamic interaction weight based on interaction type & completion
 * Step 8 Rules:
 * Play: +1 | Completed: +4 | Replay: +8 | Like: +15 | Playlist Add: +12 | Share: +15
 * Skip <10s: -10 | Skip <30s: -6 | Remove Playlist: -12
 */
export function calculateInteractionWeight(
  eventType: EventType,
  completionPercent: number = 0,
  listeningDurationSeconds: number = 0,
): number {
  switch (eventType) {
    case "like":
      return 15;
    case "playlist_add":
      return 12;
    case "replay":
      return 8;
    case "song_finished":
      return 4;
    case "song_started":
      return 1;
    case "unlike":
      return -8;
    case "playlist_remove":
      return -12;
    case "skip":
      if (listeningDurationSeconds < 10 || completionPercent < 10) return -10;
      if (listeningDurationSeconds < 30 || completionPercent < 30) return -6;
      return -3;
    case "search":
      return 3;
    case "artist_visit":
      return 5;
    case "album_visit":
      return 4;
    case "queue_change":
      return 2;
    default:
      return 1;
  }
}

/**
 * Determine Time of Day context
 */
export function getTimeOfDayContext(date: Date = new Date()): "morning" | "afternoon" | "evening" | "night" {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * Log a recommendation event centrally into RecommendationEvent collection
 */
export async function recordRecommendationEvent(params: LogEventParams): Promise<void> {
  if (!params.userId || params.userId === "guest") return;

  try {
    const userObjId = new mongoose.Types.ObjectId(params.userId);
    const now = new Date();
    const timeOfDay = getTimeOfDayContext(now);
    const dayOfWeek = now.getDay();

    const weight = calculateInteractionWeight(
      params.eventType,
      params.completionPercent,
      params.listeningDurationSeconds,
    );

    const event = new RecommendationEvent({
      userId: userObjId,
      eventType: params.eventType,
      songId: params.songId || "",
      artistId: params.artistId || "",
      artistName: params.artistName || "",
      albumId: params.albumId || "",
      playlistId: params.playlistId || "",
      searchQuery: params.searchQuery || "",
      weight,
      completionPercent: params.completionPercent || 0,
      listeningDurationSeconds: params.listeningDurationSeconds || 0,
      timeOfDay,
      dayOfWeek,
      sessionId: params.sessionId || "",
      contextLanguage: params.contextLanguage || "",
      timestamp: now,
    });

    await event.save();

    // Cache recent event in Redis session buffer for real-time Session Engine
    if (params.sessionId && params.songId) {
      const sessionKey = `rec:session_events:${params.sessionId}`;
      const existingRaw = await redisGet(sessionKey).catch(() => null);
      const sessionEvents = existingRaw ? JSON.parse(existingRaw) : [];
      sessionEvents.push({
        songId: params.songId,
        artistName: params.artistName || "",
        eventType: params.eventType,
        weight,
        timestamp: now.getTime(),
      });
      // Keep last 30 events in active session
      const trimmed = sessionEvents.slice(-30);
      await redisSet(sessionKey, JSON.stringify(trimmed), 7200).catch(() => {});
    }
  } catch (err) {
    console.error("[EventPipeline] Error recording event:", err);
  }
}
