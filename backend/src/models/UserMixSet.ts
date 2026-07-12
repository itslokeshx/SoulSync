import mongoose, { Schema, Document } from "mongoose";

export interface IMix {
  key: "new_music" | "favorites" | "discovery" | "because_you_liked";
  title: string;
  description: string;
  songIds: string[];
  seedInfo?: {
    seedSongId?: string;
    seedSongTitle?: string;
  };
}

export interface IUserMixSet extends Document {
  userId: mongoose.Types.ObjectId;
  weekOf: Date;
  mixes: IMix[];
  generatedAt: Date;
}

const MixSchema = new Schema<IMix>(
  {
    key: {
      type: String,
      required: true,
      enum: ["new_music", "favorites", "discovery", "because_you_liked"],
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    songIds: { type: [String], required: true, default: [] },
    seedInfo: {
      seedSongId: { type: String },
      seedSongTitle: { type: String },
    },
  },
  { _id: false }
);

const UserMixSetSchema = new Schema<IUserMixSet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    weekOf: { type: Date, required: true },
    mixes: { type: [MixSchema], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserMixSetSchema.index({ userId: 1, weekOf: -1 });

export const UserMixSet = mongoose.model<IUserMixSet>("UserMixSet", UserMixSetSchema);
