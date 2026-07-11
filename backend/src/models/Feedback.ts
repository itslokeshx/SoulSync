import mongoose, { Schema, Document } from "mongoose";

export interface IFeedback extends Document {
  message: string;
  category: "bug" | "suggestion" | "other";
  userId?: mongoose.Types.ObjectId;
  isAnonymous: boolean;
  appVersion: string;
  platform: "web" | "android" | "desktop";
  status: "new" | "seen" | "resolved" | "wontfix";
  createdAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    category: {
      type: String,
      required: true,
      enum: ["bug", "suggestion", "other"],
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    isAnonymous: { type: Boolean, required: true, default: false },
    appVersion: { type: String, required: true },
    platform: {
      type: String,
      required: true,
      enum: ["web", "android", "desktop"],
    },
    status: {
      type: String,
      required: true,
      enum: ["new", "seen", "resolved", "wontfix"],
      default: "new",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FeedbackSchema.index({ status: 1, createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>("Feedback", FeedbackSchema);
