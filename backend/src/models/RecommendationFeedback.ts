// ════════════════════════════════════════════════════════════════
// RECOMMENDATION FEEDBACK SCHEMA — Closed-Loop Reinforcement
// Tracks recommendation surfacing, clicks, skips, & completions
// ════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document } from "mongoose";

export interface IRecommendationFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  songId: string;
  surfacedCount: number;
  clickCount: number;
  playCount: number;
  skipCount: number;
  finishCount: number;
  penaltyScore: number;           // Negative penalty if repeatedly skipped (-150 max)
  lastInteractionAt: Date;
}

const RecommendationFeedbackSchema = new Schema<IRecommendationFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    songId: { type: String, required: true, index: true },
    surfacedCount: { type: Number, default: 1 },
    clickCount: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },
    skipCount: { type: Number, default: 0 },
    finishCount: { type: Number, default: 0 },
    penaltyScore: { type: Number, default: 0 },
    lastInteractionAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

RecommendationFeedbackSchema.index({ userId: 1, songId: 1 }, { unique: true });

export const RecommendationFeedback = mongoose.model<IRecommendationFeedback>(
  "RecommendationFeedback",
  RecommendationFeedbackSchema,
);
