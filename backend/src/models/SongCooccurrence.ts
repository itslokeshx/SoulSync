// ════════════════════════════════════════════════════════════════
// SONG CO-OCCURRENCE — Tracks which songs get played together
// across all users' sessions, with time decay.
//
// "Users who listened to Song A also listened to Song B"
// This is the strongest recommendation signal that doesn't
// depend on JioSaavn's metadata at all.
// ════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document } from "mongoose";

export interface ISongCooccurrence extends Document {
  songIdA: string;     // The "source" song
  songIdB: string;     // The "co-played" song
  // Metadata about songB (for fast candidate retrieval without a second lookup)
  songBName: string;
  songBArtist: string;
  songBArtistId: string;
  songBImage: string;
  songBLanguage: string;
  // Scoring
  count: number;       // How many times this pair was played together
  decayedScore: number; // Time-decayed score (recomputed periodically)
  lastSeenAt: Date;    // Last time this pair co-occurred
}

const SongCooccurrenceSchema = new Schema<ISongCooccurrence>(
  {
    songIdA: { type: String, required: true },
    songIdB: { type: String, required: true },
    songBName: { type: String, default: "" },
    songBArtist: { type: String, default: "" },
    songBArtistId: { type: String, default: "" },
    songBImage: { type: String, default: "" },
    songBLanguage: { type: String, default: "" },
    count: { type: Number, default: 1 },
    decayedScore: { type: Number, default: 1 },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Compound index: fast lookup of all co-occurrences for a given song
SongCooccurrenceSchema.index({ songIdA: 1, decayedScore: -1 });
SongCooccurrenceSchema.index({ songIdB: 1 });
// Unique constraint: one document per (A, B) pair
SongCooccurrenceSchema.index({ songIdA: 1, songIdB: 1 }, { unique: true });
// TTL: auto-delete pairs not seen in 120 days
SongCooccurrenceSchema.index(
  { lastSeenAt: 1 },
  { expireAfterSeconds: 120 * 24 * 60 * 60 },
);

export const SongCooccurrence = mongoose.model<ISongCooccurrence>(
  "SongCooccurrence",
  SongCooccurrenceSchema,
);
