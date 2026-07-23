import mongoose, { Schema, Document } from "mongoose";

export interface IRecentlyRecommended extends Document {
  userId: string;
  songId: string;
  surfacedIn: "made_for_you" | "up_next" | "discovery_mix" | "favorites_mix" | "new_music_mix";
  surfacedAt: Date;
}

const RecentlyRecommendedSchema = new Schema<IRecentlyRecommended>(
  {
    userId: { type: String, required: true, index: true },
    songId: { type: String, required: true },
    surfacedIn: {
      type: String,
      enum: ["made_for_you", "up_next", "discovery_mix", "favorites_mix", "new_music_mix"],
      required: true,
    },
    surfacedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// TTL Index: automatically remove records after 7 days (604,800 seconds)
RecentlyRecommendedSchema.index({ surfacedAt: 1 }, { expireAfterSeconds: 604800 });

// Compound index for querying user's recent exclusions
RecentlyRecommendedSchema.index({ userId: 1, surfacedAt: -1 });

export const RecentlyRecommended = mongoose.model<IRecentlyRecommended>(
  "RecentlyRecommended",
  RecentlyRecommendedSchema,
);
