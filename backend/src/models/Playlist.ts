import mongoose, { Schema, Document } from "mongoose";
import { SongEmbedSchema, ISongEmbed } from "./User.js";

export interface IPlaylist extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  coverImage: string | null;
  songs: ISongEmbed[];
  isPublic: boolean;
  isAIGenerated: boolean;
  tags: string[];
  songCount: number;
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlaylistSchema = new Schema<IPlaylist>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 300 },
    coverImage: { type: String, default: null },
    songs: { type: [SongEmbedSchema], default: [] },
    isPublic: { type: Boolean, default: false },
    isAIGenerated: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    songCount: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PlaylistSchema.index({ userId: 1, updatedAt: -1 });

PlaylistSchema.pre("save", function (this: IPlaylist) {
  this.songCount = this.songs.length;
  this.totalDuration = this.songs.reduce(
    (a: number, s: ISongEmbed) => a + (s.duration || 0),
    0,
  );
  if (!this.coverImage && this.songs.length > 0) {
    this.coverImage = this.songs[0].albumArt;
  }
});

export const Playlist = mongoose.model<IPlaylist>("Playlist", PlaylistSchema);
