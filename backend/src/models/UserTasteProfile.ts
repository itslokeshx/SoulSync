// ════════════════════════════════════════════════════════════════
// USER TASTE PROFILE — Comprehensive Long-Term Preference Model
// Computes recency-weighted affinities across artists, genres, moods, eras, & time
// ════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document } from "mongoose";

export interface IArtistAffinity {
  artistId: string;    // JioSaavn stable artist ID or artist name string
  artistName: string;  // Display name
  score: number;       // Recency-weighted play score
  playCount: number;   // Raw play count
}

export interface ILanguageDistribution {
  language: string;
  weight: number;      // 0–1 proportion of listening
  playCount: number;
}

export interface IGenreAffinity {
  genre: string;
  weight: number;
  playCount: number;
}

export interface IMoodAffinity {
  mood: string;
  weight: number;
  playCount: number;
}

export interface IEraAffinity {
  decade: string;      // "1980s", "1990s", "2000s", "2010s", "2020s"
  weight: number;
  playCount: number;
}

export interface IUserTasteProfile extends Document {
  userId: mongoose.Types.ObjectId;
  
  // Affinities
  artists: IArtistAffinity[];
  languages: ILanguageDistribution[];
  genres: IGenreAffinity[];
  moods: IMoodAffinity[];
  eras: IEraAffinity[];

  // Top Summaries
  topArtist?: string;
  topGenre?: string;
  topLanguage?: string;
  topMood?: string;
  topTempo?: number;            // Target BPM preference
  topDecade?: string;

  // Behavioral Traits & Weights (Computed from events)
  popularityPreference: number; // 0 (indie/niche) to 100 (mainstream top chart)
  discoveryScore: number;       // 0 (repeater) to 100 (explorer)
  repeatTolerance: number;      // 0 (hates repeat) to 100 (loves replaying)
  averageCompletionRate: number;// 0 to 100%
  averageSkipRate: number;      // 0 to 100%
  averageReplayRate: number;    // 0 to 100%

  // Time-of-Day & Contextual Preferences
  morningPreference: string[];   // Preferred moods/genres in morning
  afternoonPreference: string[]; // Preferred moods/genres in afternoon
  nightPreference: string[];     // Preferred moods/genres at night
  weekendPreference: string[];   // Preferred moods/genres on weekends

  // Deduplication & Tracking
  recentSongIds: string[];
  totalPlays: number;
  lastComputedAt: Date;
  lastPlayCountAtCompute: number;
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

const GenreAffinitySchema = new Schema<IGenreAffinity>(
  {
    genre: { type: String, required: true },
    weight: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const MoodAffinitySchema = new Schema<IMoodAffinity>(
  {
    mood: { type: String, required: true },
    weight: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const EraAffinitySchema = new Schema<IEraAffinity>(
  {
    decade: { type: String, required: true },
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
    genres: { type: [GenreAffinitySchema], default: [] },
    moods: { type: [MoodAffinitySchema], default: [] },
    eras: { type: [EraAffinitySchema], default: [] },

    topArtist: { type: String, default: "" },
    topGenre: { type: String, default: "" },
    topLanguage: { type: String, default: "" },
    topMood: { type: String, default: "" },
    topTempo: { type: Number, default: 110 },
    topDecade: { type: String, default: "2020s" },

    popularityPreference: { type: Number, default: 70 },
    discoveryScore: { type: Number, default: 30 },
    repeatTolerance: { type: Number, default: 50 },
    averageCompletionRate: { type: Number, default: 80 },
    averageSkipRate: { type: Number, default: 15 },
    averageReplayRate: { type: Number, default: 10 },

    morningPreference: { type: [String], default: ["chill", "acoustic"] },
    afternoonPreference: { type: [String], default: ["pop", "energetic"] },
    nightPreference: { type: [String], default: ["chill", "romantic", "focus"] },
    weekendPreference: { type: [String], default: ["party", "dance"] },

    recentSongIds: { type: [String], default: [] },
    totalPlays: { type: Number, default: 0 },
    lastComputedAt: { type: Date, default: Date.now },
    lastPlayCountAtCompute: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const UserTasteProfile = mongoose.model<IUserTasteProfile>(
  "UserTasteProfile",
  UserTasteProfileSchema,
);
