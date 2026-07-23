// ════════════════════════════════════════════════════════════════
// SONG FEATURE SCHEMA — Normalized Audio & Metadata Features
// Stores acoustic, energy, mood, and metadata signals per song
// ════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document } from "mongoose";

export interface ISongFeature extends Document {
  songId: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  language: string;
  genre: string;
  subGenre: string;
  mood: string;                   // "happy" | "sad" | "chill" | "energetic" | "romantic" | "focus"
  energy: number;                 // 0.0 to 1.0
  tempo: number;                  // Estimated BPM (e.g. 60–180)
  popularity: number;             // 0 to 100
  releaseYear: number;
  duration: number;               // Seconds
  acousticness: number;           // 0.0 to 1.0
  danceability: number;           // 0.0 to 1.0
  instrumental: number;           // 0.0 to 1.0
  isLive: boolean;
  isExplicit: boolean;
  updatedAt: Date;
}

const SongFeatureSchema = new Schema<ISongFeature>(
  {
    songId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    artistId: { type: String, default: "" },
    album: { type: String, default: "" },
    language: { type: String, default: "english", index: true },
    genre: { type: String, default: "pop", index: true },
    subGenre: { type: String, default: "" },
    mood: { type: String, default: "chill", index: true },
    energy: { type: Number, default: 0.5 },
    tempo: { type: Number, default: 110 },
    popularity: { type: Number, default: 50 },
    releaseYear: { type: Number, default: 2024 },
    duration: { type: Number, default: 200 },
    acousticness: { type: Number, default: 0.4 },
    danceability: { type: Number, default: 0.6 },
    instrumental: { type: Number, default: 0.1 },
    isLive: { type: Boolean, default: false },
    isExplicit: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const SongFeature = mongoose.model<ISongFeature>(
  "SongFeature",
  SongFeatureSchema,
);
