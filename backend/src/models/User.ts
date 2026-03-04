import mongoose, { Schema, Document } from "mongoose";

export interface ISongEmbed {
  songId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  downloadUrl: { quality: string; url: string }[];
}

export const SongEmbedSchema = new Schema<ISongEmbed>(
  {
    songId: String,
    title: String,
    artist: String,
    albumArt: String,
    duration: Number,
    downloadUrl: [{ quality: String, url: String }],
  },
  { _id: false },
);

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  photoURL?: string;
  preferences: {
    languages: string[];
    eras: string[];
    moods: string[];
  };
  likedSongs: ISongEmbed[];
  totalListeningTime: number;
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    photoURL: String,
    preferences: {
      languages: { type: [String], default: [] },
      eras: { type: [String], default: [] },
      moods: { type: [String], default: [] },
    },
    likedSongs: { type: [SongEmbedSchema], default: [] },
    totalListeningTime: { type: Number, default: 0 },
    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>("User", UserSchema);
