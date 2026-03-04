import mongoose, { Schema, Document } from "mongoose";

export interface IListeningHistory extends Document {
  userId: mongoose.Types.ObjectId;
  songId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  language: string;
  source:
    | "search"
    | "recommendation"
    | "playlist"
    | "duo"
    | "library"
    | "player";
  playedAt: Date;
}

const ListeningHistorySchema = new Schema<IListeningHistory>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  songId: String,
  title: String,
  artist: String,
  albumArt: String,
  duration: Number,
  language: { type: String, default: "" },
  source: {
    type: String,
    enum: ["search", "recommendation", "playlist", "duo", "library", "player"],
    default: "search",
  },
  playedAt: { type: Date, default: Date.now },
});

ListeningHistorySchema.index({ userId: 1, playedAt: -1 });
ListeningHistorySchema.index({ playedAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL

export const ListeningHistory = mongoose.model<IListeningHistory>(
  "ListeningHistory",
  ListeningHistorySchema,
);
