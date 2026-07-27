import mongoose, { Schema, Document } from "mongoose";

export interface IDailyMixCache extends Document {
  userId: mongoose.Types.ObjectId;
  dateStr: string;
  songs: any[];
  generatedAt: Date;
}

const DailyMixCacheSchema = new Schema<IDailyMixCache>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dateStr: { type: String, required: true },
    songs: { type: Schema.Types.Mixed, default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DailyMixCacheSchema.index({ userId: 1, dateStr: 1 }, { unique: true });

export const DailyMixCache = mongoose.model<IDailyMixCache>("DailyMixCache", DailyMixCacheSchema);
