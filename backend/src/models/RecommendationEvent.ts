// ════════════════════════════════════════════════════════════════
// RECOMMENDATION EVENT SCHEMA — Centralized Event Pipeline
// Tracks all implicit and explicit user interactions with time & context
// ════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document } from "mongoose";

export type EventType =
  | "song_started"
  | "song_finished"
  | "skip"
  | "replay"
  | "like"
  | "unlike"
  | "playlist_add"
  | "playlist_remove"
  | "search"
  | "queue_change"
  | "artist_visit"
  | "album_visit"
  | "session_start"
  | "session_end";

export interface IRecommendationEvent extends Document {
  userId: mongoose.Types.ObjectId;
  eventType: EventType;
  songId?: string;
  artistId?: string;
  artistName?: string;
  albumId?: string;
  playlistId?: string;
  searchQuery?: string;
  weight: number;                 // Calculated interaction weight (-10 to +15)
  completionPercent?: number;     // 0 to 100
  listeningDurationSeconds?: number;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  dayOfWeek: number;              // 0 (Sun) to 6 (Sat)
  sessionId?: string;
  contextLanguage?: string;
  timestamp: Date;
}

const RecommendationEventSchema = new Schema<IRecommendationEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventType: {
      type: String,
      enum: [
        "song_started",
        "song_finished",
        "skip",
        "replay",
        "like",
        "unlike",
        "playlist_add",
        "playlist_remove",
        "search",
        "queue_change",
        "artist_visit",
        "album_visit",
        "session_start",
        "session_end",
      ],
      required: true,
      index: true,
    },
    songId: { type: String, default: "", index: true },
    artistId: { type: String, default: "" },
    artistName: { type: String, default: "" },
    albumId: { type: String, default: "" },
    playlistId: { type: String, default: "" },
    searchQuery: { type: String, default: "" },
    weight: { type: Number, required: true },
    completionPercent: { type: Number, default: 0 },
    listeningDurationSeconds: { type: Number, default: 0 },
    timeOfDay: {
      type: String,
      enum: ["morning", "afternoon", "evening", "night"],
      default: "evening",
    },
    dayOfWeek: { type: Number, default: 0 },
    sessionId: { type: String, default: "", index: true },
    contextLanguage: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

// Index for fast recency aggregation
RecommendationEventSchema.index({ userId: 1, timestamp: -1 });

// TTL index: keep raw events for 90 days (7,776,000 seconds)
RecommendationEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

export const RecommendationEvent = mongoose.model<IRecommendationEvent>(
  "RecommendationEvent",
  RecommendationEventSchema,
);
