import { Song } from "./song";

export interface PlaylistSong {
  songId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  downloadUrl: { quality: string; url: string }[];
}

export interface Playlist {
  _id: string;
  userId: string;
  name: string;
  description: string;
  coverImage: string | null;
  songs: PlaylistSong[];
  isPublic: boolean;
  isAIGenerated: boolean;
  tags: string[];
  songCount: number;
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIMatchedSong {
  original: string;
  song: Song;
  confidence: "high" | "partial" | "none";
  score: number;
}

export interface AIPlaylistResult {
  playlistName: string;
  matched: AIMatchedSong[];
  partial: AIMatchedSong[];
  unmatched: string[];
  stats: { total: number; found: number; notFound: number };
}
