// ════════════════════════════════════════════════════════════════
// SESSION ENGINE SERVICE — Session Object & Automatic Intent Detector
// ════════════════════════════════════════════════════════════════

import { redisGet, redisSet } from "./redis.js";
import { fetchSongById, Song } from "./jiosaavn.js";
import { getOrCreateSongFeature } from "./songFeatureService.js";
import { getTimeOfDayContext } from "./eventPipeline.js";

export type UserListeningIntent =
  | "workout"
  | "late_night"
  | "driving"
  | "studying"
  | "relaxing"
  | "romantic"
  | "background"
  | "album_listening"
  | "artist_marathon"
  | "discovery"
  | "nostalgia";

export interface SessionState {
  sessionId: string;
  userId?: string;
  currentSongId?: string;
  currentSongName?: string;
  currentArtist?: string;
  currentAlbum?: string;
  previous20Songs: string[];
  dominantArtists: string[];
  dominantAlbums: string[];
  dominantGenre: string;
  dominantLanguage: string;
  dominantEra: string;
  dominantMood: string;
  dominantEnergy: number;       // 0.0 to 1.0
  dominantTempo: number;        // BPM
  listeningDurationSeconds: number;
  recentSkipsCount: number;
  recentReplaysCount: number;
  currentIntent: UserListeningIntent;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  startTime: number;
  lastActiveTime: number;
}

/**
 * Automatically predict User Intent based on time of day, tempo, energy, and listening patterns
 */
export function predictUserIntent(
  timeOfDay: string,
  bpm: number,
  energy: number,
  mood: string,
  recentArtists: string[],
  recentAlbums: string[],
): UserListeningIntent {
  // 1. Album Listening Intent (Multiple consecutive tracks from same album)
  if (recentAlbums.length >= 3 && new Set(recentAlbums.slice(-3)).size === 1) {
    return "album_listening";
  }

  // 2. Artist Marathon Intent (Multiple consecutive tracks from same artist)
  if (recentArtists.length >= 3 && new Set(recentArtists.slice(-3)).size === 1) {
    return "artist_marathon";
  }

  // 3. Late Night Intent
  if (timeOfDay === "night" && energy < 0.5) {
    return "late_night";
  }

  // 4. Workout Intent (High BPM > 125, high energy > 0.75)
  if (bpm >= 125 && energy >= 0.75) {
    return "workout";
  }

  // 5. Studying / Background Intent (Lo-fi / Instrumental / Focus)
  if (mood === "focus" || mood === "chill" && energy < 0.35) {
    return "studying";
  }

  // 6. Romantic Intent
  if (mood === "romantic") {
    return "romantic";
  }

  return "relaxing";
}

/**
 * Get active listening session context from Redis or infer from recent song & time
 */
export async function getActiveSessionContext(
  sessionId?: string,
  userId?: string,
  currentSongId?: string,
): Promise<SessionState> {
  const sId = sessionId || (userId ? `user_session_${userId}` : "guest_session");
  const cacheKey = `rec:session_state:${sId}`;
  const now = Date.now();
  const timeOfDay = getTimeOfDayContext();

  try {
    const cachedRaw = await redisGet(cacheKey);
    if (cachedRaw) {
      const state = JSON.parse(cachedRaw) as SessionState;
      if (now - state.lastActiveTime < 1800 * 1000) {
        state.lastActiveTime = now;
        await redisSet(cacheKey, JSON.stringify(state), 1800).catch(() => {});
        return state;
      }
    }
  } catch {}

  let seedSong: Song | null = null;
  if (currentSongId) {
    try {
      seedSong = await fetchSongById(currentSongId);
    } catch {}
  }

  let mood = "chill";
  let genre = "pop";
  let energy = 0.5;
  let bpm = 110;
  let lang = "english";
  let artist = "";
  let album = "";

  if (seedSong) {
    const features = await getOrCreateSongFeature(seedSong);
    mood = features.mood || "chill";
    genre = features.genre || "pop";
    energy = features.energy || 0.5;
    bpm = features.tempo || 110;
    lang = features.language || "english";
    artist = features.artist || "";
    album = features.album || "";
  }

  const intent = predictUserIntent(timeOfDay, bpm, energy, mood, artist ? [artist] : [], album ? [album] : []);

  const newState: SessionState = {
    sessionId: sId,
    userId,
    currentSongId: currentSongId || "",
    currentSongName: seedSong?.name || "",
    currentArtist: artist,
    currentAlbum: album,
    previous20Songs: currentSongId ? [currentSongId] : [],
    dominantArtists: artist ? [artist.toLowerCase()] : [],
    dominantAlbums: album ? [album.toLowerCase()] : [],
    dominantGenre: genre,
    dominantLanguage: lang,
    dominantEra: "2020s",
    dominantMood: mood,
    dominantEnergy: energy,
    dominantTempo: bpm,
    listeningDurationSeconds: 0,
    recentSkipsCount: 0,
    recentReplaysCount: 0,
    currentIntent: intent,
    timeOfDay,
    startTime: now,
    lastActiveTime: now,
  };

  await redisSet(cacheKey, JSON.stringify(newState), 1800).catch(() => {});
  return newState;
}

/**
 * Update session context as user plays new songs in queue
 */
export async function updateSessionWithSong(
  sessionId: string,
  song: Song,
  userId?: string,
): Promise<SessionState> {
  const session = await getActiveSessionContext(sessionId, userId, song.id);
  const features = await getOrCreateSongFeature(song);

  // Exponential moving average for energy, tempo, and mood continuity
  session.dominantEnergy = Math.round((session.dominantEnergy * 0.3 + (features.energy || 0.5) * 0.7) * 100) / 100;
  session.dominantTempo = Math.round(session.dominantTempo * 0.3 + (features.tempo || 110) * 0.7);
  if (features.mood) session.dominantMood = features.mood;
  if (features.genre) session.dominantGenre = features.genre;
  if (features.language) session.dominantLanguage = features.language;

  session.currentSongId = song.id;
  session.currentSongName = song.name;
  session.currentArtist = song.primaryArtists;
  session.currentAlbum = song.album;

  if (song.id && !session.previous20Songs.includes(song.id)) {
    session.previous20Songs.push(song.id);
    if (session.previous20Songs.length > 20) session.previous20Songs.shift();
  }

  const artist = (song.primaryArtists || "").split(/[,/&]+/)[0].trim().toLowerCase();
  if (artist) {
    session.dominantArtists.push(artist);
    if (session.dominantArtists.length > 10) session.dominantArtists.shift();
  }

  const album = (song.album || "").trim().toLowerCase();
  if (album) {
    session.dominantAlbums.push(album);
    if (session.dominantAlbums.length > 10) session.dominantAlbums.shift();
  }

  session.currentIntent = predictUserIntent(
    session.timeOfDay,
    session.dominantTempo,
    session.dominantEnergy,
    session.dominantMood,
    session.dominantArtists,
    session.dominantAlbums,
  );

  session.lastActiveTime = Date.now();

  const cacheKey = `rec:session_state:${sessionId}`;
  await redisSet(cacheKey, JSON.stringify(session), 1800).catch(() => {});
  return session;
}
