// ════════════════════════════════════════════════════════════════
// USER TASTE PROFILE — Precomputed from ListeningHistory
// Recency-weighted distributions of artist/genre/language.
// Recomputed after every N plays, NOT on every request.
// ════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document } from "mongoose";

export interface IArtistAffinity {
  artistId: string;    // JioSaavn stable artist ID (not name string)
  artistName: string;  // Display name (for debugging / reason tags)
  score: number;       // Recency-weighted play count (higher = more affinity)
  playCount: number;   // Raw play count (un-weighted)
}

export interface ILanguageDistribution {
  language: string;
  weight: number;      // 0–1 proportion of total listening
  playCount: number;
}

export interface IUserTasteProfile extends Document {
  userId: mongoose.Types.ObjectId;
  // Artist affinities — sorted descending by score
  artists: IArtistAffinity[];
  // Language distribution — sorted descending by weight
  languages: ILanguageDistribution[];
  // Top song IDs (for dedup / "already heard" filtering)
  recentSongIds: string[];
  // Metadata
  totalPlays: number;          // Total plays at time of computation
  lastComputedAt: Date;
  lastPlayCountAtCompute: number; // Plays counted when last computed (to trigger recompute after N new plays)
}

const ArtistAffinitySchema = new Schema<IArtistAffinity>(
  {
    artistId: { type: String, required: true },
    artistName: { type: String, required: true },
    score: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const LanguageDistributionSchema = new Schema<ILanguageDistribution>(
  {
    language: { type: String, required: true },
    weight: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const UserTasteProfileSchema = new Schema<IUserTasteProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    artists: { type: [ArtistAffinitySchema], default: [] },
    languages: { type: [LanguageDistributionSchema], default: [] },
    recentSongIds: { type: [String], default: [] },
    totalPlays: { type: Number, default: 0 },
    lastComputedAt: { type: Date, default: Date.now },
    lastPlayCountAtCompute: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index for fast lookup by userId
UserTasteProfileSchema.index({ userId: 1 });

export const UserTasteProfile = mongoose.model<IUserTasteProfile>(
  "UserTasteProfile",
  UserTasteProfileSchema,
);
