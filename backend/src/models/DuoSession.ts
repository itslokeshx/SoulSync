import mongoose, { Schema, Document } from "mongoose";

export interface IDuoSession extends Document {
  code: string;
  host: {
    userId: mongoose.Types.ObjectId;
    name: string;
    socketId: string | null;
    connected: boolean;
  };
  guest: {
    userId: mongoose.Types.ObjectId | null;
    name: string | null;
    socketId: string | null;
    connected: boolean;
  };
  currentSong: Record<string, unknown> | null;
  isPlaying: boolean;
  currentTime: number;
  reactions: { emoji: string; from: string; at: Date }[];
  notes: { songId: string; text: string; from: string; at: Date }[];
  songHistory: Record<string, unknown>[];
  stats: {
    duration: number;
    reactionsCount: number;
    notesCount: number;
  };
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DuoSessionSchema = new Schema<IDuoSession>(
  {
    code: { type: String, required: true, unique: true, index: true },
    host: {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      name: String,
      socketId: { type: String, default: null },
      connected: { type: Boolean, default: false },
    },
    guest: {
      userId: { type: Schema.Types.ObjectId, default: null },
      name: { type: String, default: null },
      socketId: { type: String, default: null },
      connected: { type: Boolean, default: false },
    },
    currentSong: { type: Schema.Types.Mixed, default: null },
    isPlaying: { type: Boolean, default: false },
    currentTime: { type: Number, default: 0 },
    reactions: [
      {
        emoji: String,
        from: String,
        at: { type: Date, default: Date.now },
      },
    ],
    notes: [
      {
        songId: String,
        text: String,
        from: String,
        at: { type: Date, default: Date.now },
      },
    ],
    songHistory: [Schema.Types.Mixed],
    stats: {
      duration: { type: Number, default: 0 },
      reactionsCount: { type: Number, default: 0 },
      notesCount: { type: Number, default: 0 },
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 86400000),
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

export const DuoSession = mongoose.model<IDuoSession>(
  "DuoSession",
  DuoSessionSchema,
);
