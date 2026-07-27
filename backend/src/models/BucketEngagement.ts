import mongoose, { Schema, Document } from "mongoose";

export interface IBucketEngagement extends Document {
  userId: mongoose.Types.ObjectId;
  bucket: "discovery" | "forgotten" | "playlist";
  playedCount: number;
  skippedCount: number;
  ignoredCount: number;
  updatedAt: Date;
}

const BucketEngagementSchema = new Schema<IBucketEngagement>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bucket: { type: String, enum: ["discovery", "forgotten", "playlist"], required: true },
    playedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    ignoredCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

BucketEngagementSchema.index({ userId: 1, bucket: 1 }, { unique: true });

export const BucketEngagement = mongoose.model<IBucketEngagement>(
  "BucketEngagement",
  BucketEngagementSchema
);
