// ════════════════════════════════════════════════════════════════
// SONG FEATURE SERVICE — Step 5
// Normalizes and infers audio features, mood, genre, BPM, & energy
// ════════════════════════════════════════════════════════════════

import { SongFeature, ISongFeature } from "../models/SongFeature.js";
import { Song } from "./jiosaavn.js";
import { detectSongLanguage } from "./scoringUtils.js";

const GENRE_KEYWORD_MAP: Record<string, { genre: string; mood: string; energy: number; bpm: number }> = {
  pop: { genre: "pop", mood: "energetic", energy: 0.75, bpm: 120 },
  dance: { genre: "dance", mood: "energetic", energy: 0.85, bpm: 128 },
  party: { genre: "dance", mood: "energetic", energy: 0.90, bpm: 130 },
  edm: { genre: "electronic", mood: "energetic", energy: 0.92, bpm: 128 },
  lofi: { genre: "lofi", mood: "chill", energy: 0.35, bpm: 80 },
  chill: { genre: "chillout", mood: "chill", energy: 0.40, bpm: 85 },
  acoustic: { genre: "acoustic", mood: "chill", energy: 0.38, bpm: 90 },
  romantic: { genre: "romance", mood: "romantic", energy: 0.50, bpm: 95 },
  love: { genre: "romance", mood: "romantic", energy: 0.52, bpm: 98 },
  sad: { genre: "ballad", mood: "sad", energy: 0.30, bpm: 75 },
  heartbreak: { genre: "ballad", mood: "sad", energy: 0.32, bpm: 78 },
  rap: { genre: "hiphop", mood: "energetic", energy: 0.80, bpm: 100 },
  hiphop: { genre: "hiphop", mood: "energetic", energy: 0.82, bpm: 98 },
  rock: { genre: "rock", mood: "energetic", energy: 0.88, bpm: 135 },
  classical: { genre: "classical", mood: "focus", energy: 0.25, bpm: 70 },
  devotional: { genre: "devotional", mood: "focus", energy: 0.45, bpm: 90 },
  chalisa: { genre: "devotional", mood: "focus", energy: 0.50, bpm: 95 },
  bhajan: { genre: "devotional", mood: "focus", energy: 0.42, bpm: 85 },
};

/**
 * Infer missing metadata & audio features from song title, artist, and album
 */
export function inferSongFeatures(song: Song): Partial<ISongFeature> {
  const combined = `${song.name} ${song.primaryArtists} ${song.album}`.toLowerCase();
  let genre = "pop";
  let mood = "chill";
  let energy = 0.55;
  let tempo = 110;
  let acousticness = 0.45;
  let danceability = 0.60;

  for (const [kw, info] of Object.entries(GENRE_KEYWORD_MAP)) {
    if (combined.includes(kw)) {
      genre = info.genre;
      mood = info.mood;
      energy = info.energy;
      tempo = info.bpm;
      break;
    }
  }

  if (mood === "chill" || mood === "sad") {
    acousticness = 0.70;
    danceability = 0.40;
  } else if (mood === "energetic") {
    acousticness = 0.20;
    danceability = 0.82;
  }

  const detectedLang = detectSongLanguage(song) || "english";
  const releaseYear = parseInt(song.year || "2024", 10) || 2024;

  return {
    songId: song.id,
    title: song.name,
    artist: song.primaryArtists,
    artistId: (song as any).artistId || "",
    album: song.album || "",
    language: detectedLang,
    genre,
    mood,
    energy,
    tempo,
    popularity: Math.min(100, Math.max(10, Math.round(Math.log10(Math.max(1, song.playCount)) * 12))),
    releaseYear,
    duration: song.duration || 200,
    acousticness,
    danceability,
    instrumental: 0.1,
    isLive: /\b(live|concert)\b/i.test(combined),
    isExplicit: false,
  };
}

/**
 * Get or create normalized SongFeature
 */
export async function getOrCreateSongFeature(song: Song): Promise<Partial<ISongFeature>> {
  if (!song || !song.id) return inferSongFeatures(song);

  try {
    const existing = await SongFeature.findOne({ songId: song.id }).lean();
    if (existing) return existing as unknown as Partial<ISongFeature>;

    const inferred = inferSongFeatures(song);
    const created = new SongFeature(inferred);
    await created.save().catch(() => {});
    return created.toObject() as unknown as Partial<ISongFeature>;
  } catch {
    return inferSongFeatures(song);
  }
}
