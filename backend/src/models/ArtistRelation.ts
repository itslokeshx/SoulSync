// ════════════════════════════════════════════════════════════════
// ARTIST RELATION SCHEMA — Artist Graph & Similarity
// Models Artist A -> Related Artist B with similarity weights
// ════════════════════════════════════════════════════════════════

import mongoose, { Schema, Document } from "mongoose";

export interface IArtistRelation extends Document {
  artistNameA: string;            // Lowercase normalized primary artist A
  artistNameB: string;            // Lowercase normalized related artist B
  similarityScore: number;        // 0.0 to 1.0 (higher = closer affinity)
  sharedGenre: string;
  relationType: "style_similar" | "collaborator" | "genre_peer" | "curated_map";
  updatedAt: Date;
}

const ArtistRelationSchema = new Schema<IArtistRelation>(
  {
    artistNameA: { type: String, required: true, index: true },
    artistNameB: { type: String, required: true, index: true },
    similarityScore: { type: Number, required: true, default: 0.5 },
    sharedGenre: { type: String, default: "" },
    relationType: {
      type: String,
      enum: ["style_similar", "collaborator", "genre_peer", "curated_map"],
      default: "style_similar",
    },
  },
  { timestamps: true },
);

ArtistRelationSchema.index({ artistNameA: 1, artistNameB: 1 }, { unique: true });

export const ArtistRelation = mongoose.model<IArtistRelation>(
  "ArtistRelation",
  ArtistRelationSchema,
);
