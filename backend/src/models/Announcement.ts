// ════════════════════════════════════════════════════════════════
// ANNOUNCEMENT MODEL
// Stores in-app announcements, "what's new" notes, maintenance warnings.
// ════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document } from "mongoose";

export type AnnouncementType = "whats_new" | "feature" | "feature_spotlight" | "general" | "maintenance";

export interface IAnnouncement extends Document {
  type: AnnouncementType;
  title: string;
  body: string;
  version?: string;
  ctaText?: string;
  ctaRoute?: string;
  imageUrl?: string;
  active: boolean;
  priority: number;
  createdAt: Date;
  expiresAt?: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    type: {
      type: String,
      enum: ["whats_new", "feature", "feature_spotlight", "general", "maintenance"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    version: { type: String, trim: true }, // Format matching version.json (e.g. "1.2.3")
    ctaText: { type: String, trim: true },
    ctaRoute: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    active: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
AnnouncementSchema.index({ active: 1, type: 1, createdAt: -1 });

export const Announcement = mongoose.model<IAnnouncement>(
  "Announcement",
  AnnouncementSchema
);
