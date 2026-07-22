import mongoose, { Schema, Document } from "mongoose";

export interface IFeedbackAuditLog {
  action: "reply" | "edit_reply" | "delete_reply" | "close";
  performedBy: string;
  timestamp: Date;
  details?: string;
}

export interface IFeedback extends Document {
  message: string;
  category: "bug" | "suggestion" | "other";
  userId?: mongoose.Types.ObjectId;
  isAnonymous: boolean;
  appVersion: string;
  platform: "web" | "android" | "desktop";
  status: "pending" | "replied" | "closed" | "new" | "seen" | "resolved" | "wontfix";
  reply?: string;
  replyAt?: Date;
  repliedBy?: string;
  replySeen?: boolean;
  auditLogs?: IFeedbackAuditLog[];
  createdAt: Date;
}

const FeedbackAuditLogSchema = new Schema<IFeedbackAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: ["reply", "edit_reply", "delete_reply", "close"],
    },
    performedBy: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    details: String,
  },
  { _id: false }
);

const FeedbackSchema = new Schema<IFeedback>(
  {
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    category: {
      type: String,
      required: true,
      enum: ["bug", "suggestion", "other"],
    },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
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
      enum: ["pending", "replied", "closed", "new", "seen", "resolved", "wontfix"],
      default: "pending",
    },
    reply: { type: String, trim: true, maxlength: 2000 },
    replyAt: Date,
    repliedBy: String,
    replySeen: { type: Boolean, default: false },
    auditLogs: { type: [FeedbackAuditLogSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ userId: 1, createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>("Feedback", FeedbackSchema);
