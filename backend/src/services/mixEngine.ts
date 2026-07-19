import mongoose from "mongoose";
import { UserMixSet, IUserMixSet, IMix } from "../models/UserMixSet.js";
import { getTasteProfile } from "./recommendationEngine.js";
import {
  fetchSongsByIds,
  getSongsDetailsBatch,
  normalizeSongsToCanonical,
  searchSongs,
  getSuggestions,
  type Song,
} from "./youtubeMusicService.js";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { User } from "../models/User.js";
import { Playlist } from "../models/Playlist.js";

// Helper to get start of current week (Monday 00:00:00)
export function getStartOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  // Adjust so Monday is the start of the week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

export interface SongMix {
  key: string;
  title: string;
  description: string;
  songs: Song[];
  seedInfo?: {
    seedSongId?: string;
    seedSongTitle?: string;
  };
}

export interface UserMixSetResponse {
  userId: string;
  weekOf: Date;
  mixes: SongMix[];
  generatedAt: Date;
}

// Orchestrator to resolve weekly mixes
export async function getUserMixSet(userId: string): Promise<UserMixSetResponse> {
  const startOfWeek = getStartOfWeek();
  const isGuest = userId === "guest";

  if (isGuest) {
    return generateColdStartMixSet("guest", startOfWeek);
  }

  // 1. Find the latest mix set for this user (any week) to support stale-while-revalidate across week boundaries
  const latestMixSet = await UserMixSet.findOne({
    userId: new mongoose.Types.ObjectId(userId),
  }).sort({ weekOf: -1 }).lean() as IUserMixSet | null;

  if (latestMixSet) {
    const isSameWeek = latestMixSet.weekOf.getTime() === startOfWeek.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const isStale = !isSameWeek || (Date.now() - latestMixSet.generatedAt.getTime() > sevenDaysMs);

    if (isStale) {
      // Regenerate in the background to avoid blocking user response
      triggerBackgroundRegeneration(userId, startOfWeek).catch((err) => {
        console.error(`[MixEngine] Background regeneration failed for ${userId}:`, err);
      });
    }

    // Return the cached latest mixes immediately (even if it's from last week, to keep loading instant!)
    return hydrateMixSet(userId, latestMixSet);
  }

  // 2. Generate new mix set since none exists for this user at all
  const newMixSet = await buildAndSaveMixSet(userId, startOfWeek);
  return hydrateMixSet(userId, newMixSet);
}

// Hydrates string songIds from MongoDB into full Song details
async function hydrateMixSet(userId: string, mixSet: IUserMixSet | any): Promise<UserMixSetResponse> {
  // Collect all unique song IDs across mixes
  const allSongIds = new Set<string>();
  for (const mix of mixSet.mixes) {
    for (const id of mix.songIds) {
      allSongIds.add(id);
    }
  }

  // Batch fetch details
  let songsMap = new Map<string, Song>();
  try {
    const rawSongs = await getSongsDetailsBatch(Array.from(allSongIds));
    const canonicalSongs = normalizeSongsToCanonical(rawSongs);
    for (const s of canonicalSongs) {
      if (s?.id) songsMap.set(s.id, s);
    }
  } catch (err) {
    console.error("[MixEngine] Failed to batch enrich song IDs:", err);
  }

  const hydratedMixes: SongMix[] = mixSet.mixes.map((mix: IMix) => {
    const songs: Song[] = [];
    for (const id of mix.songIds) {
      const song = songsMap.get(id);
      if (song) songs.push(song);
    }
    return {
      key: mix.key,
      title: mix.title,
      description: mix.description,
      songs,
      seedInfo: mix.seedInfo,
    };
  });

  return {
    userId: userId,
    weekOf: mixSet.weekOf,
    mixes: hydratedMixes,
    generatedAt: mixSet.generatedAt,
  };
}

// Background regeneration triggers build and save
async function triggerBackgroundRegeneration(userId: string, weekOf: Date): Promise<void> {
  console.log(`[MixEngine] Triggering background regeneration of mixes for user ${userId}`);
  await buildAndSaveMixSet(userId, weekOf);
}

// Builds the personalized Weekly Mix on real user data
async function buildAndSaveMixSet(userId: string, weekOf: Date): Promise<IUserMixSet> {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const now = Date.now();

  // 1. Fetch listening history
  const history = await ListeningHistory.find({ userId: userObjId }).sort({ playedAt: -1 }).lean();

  // 2. Fetch user's own playlists
  const playlists = await Playlist.find({ userId }).lean();

  // 3. Fetch liked songs
  const userDoc = await User.findById(userId).select("likedSongs").lean();
  const liked = userDoc?.likedSongs || [];

  // Determine unique songs in history to check if user has < 5 played songs
  const uniqueSongsPlayed = new Set(history.map((h) => h.songId));

  const isColdStart = uniqueSongsPlayed.size < 5;

  if (isColdStart) {
    console.log(`[WeeklyMix] Served user ${userId} via cold-start fallback path (< 5 played songs)`);
    const coldStart = await generateColdStartMixSet(userId, weekOf);
    const mixes = coldStart.mixes.map((m) => ({
      key: m.key as any,
      title: m.title,
      description: m.description,
      songIds: m.songs.map((s) => s.id),
    }));

    return (await UserMixSet.findOneAndUpdate(
      { userId: userObjId, weekOf },
      { mixes, generatedAt: new Date() },
      { upsert: true, new: true }
    )) as IUserMixSet;
  }

  console.log(`[WeeklyMix] Served user ${userId} via real taste-based path`);

  // Build scoring maps
  const songScores: Record<string, { score: number; name: string; artist: string; id: string }> = {};
  const artistScores: Record<string, number> = {};

  // Process history (exponential decay with 30-day half life)
  for (const h of history) {
    const ageMs = now - new Date(h.playedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayWeight = Math.pow(0.5, ageDays / 30);

    if (!songScores[h.songId]) {
      songScores[h.songId] = { score: 0, name: h.title, artist: h.artist || "", id: h.songId };
    }
    songScores[h.songId].score += decayWeight;

    if (h.artist) {
      const artName = h.artist.trim().toLowerCase();
      artistScores[artName] = (artistScores[artName] || 0) + decayWeight;
    }
  }

  // Process playlists
  for (const p of playlists) {
    const pSongs = p.songs || [];
    for (const s of pSongs) {
      const songId = s.songId;
      if (!songId) continue;
      if (!songScores[songId]) {
        songScores[songId] = { score: 0, name: s.title, artist: s.artist || "", id: songId };
      }
      songScores[songId].score += 5.0;

      if (s.artist) {
        const artName = s.artist.trim().toLowerCase();
        artistScores[artName] = (artistScores[artName] || 0) + 3.0;
      }
    }
  }

  // Process liked songs
  for (const s of liked) {
    const songId = s.songId;
    if (!songId) continue;
    if (!songScores[songId]) {
      songScores[songId] = { score: 0, name: s.title, artist: s.artist || "", id: songId };
    }
    songScores[songId].score += 10.0;

    if (s.artist) {
      const artName = s.artist.trim().toLowerCase();
      artistScores[artName] = (artistScores[artName] || 0) + 6.0;
    }
  }

  // Exclude songs the user has already played very recently (last 7 days)
  const recentlyPlayedIds = new Set(
    history
      .filter((h) => (now - new Date(h.playedAt).getTime()) / (1000 * 60 * 60 * 24) <= 7)
      .map((h) => h.songId)
  );

  // Select top 5-8 seed songs
  const sortedSongs = Object.values(songScores).sort((a, b) => b.score - a.score);
  const seeds = sortedSongs.slice(0, 8);

  // Fetch watch playlist recommendations from YouTube for each seed song in parallel
  const suggestionBatches = await Promise.all(
    seeds.map((song) => getSuggestions(song.id, 15).catch(() => []))
  );

  const cleanNameForDedup = (name: string) =>
    (name || "")
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\s*-\s*(from|feat|ft).*$/i, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  // Interleave and merge seeds to get variety
  const weeklyMixSongs: Song[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  const maxLen = Math.max(...suggestionBatches.map((b) => b.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const batch of suggestionBatches) {
      if (i < batch.length) {
        const song = batch[i];
        if (!song || !song.id) continue;
        if (seenIds.has(song.id) || recentlyPlayedIds.has(song.id)) continue;

        const cleanName = cleanNameForDedup(song.name);
        if (cleanName && seenNames.has(cleanName)) continue;

        seenIds.add(song.id);
        if (cleanName) seenNames.add(cleanName);
        weeklyMixSongs.push(song);
      }
    }
  }

  // If we don't have enough songs, fill from top artists
  if (weeklyMixSongs.length < 25) {
    const topArtists = Object.entries(artistScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0]);

    if (topArtists.length > 0) {
      const artistHitsBatches = await Promise.all(
        topArtists.map((artistName) => searchSongs(`${artistName} popular songs`, 10).catch(() => []))
      );

      for (const batch of artistHitsBatches) {
        const normalized = normalizeSongsToCanonical(batch);
        for (const song of normalized) {
          if (!song || !song.id) continue;
          if (seenIds.has(song.id) || recentlyPlayedIds.has(song.id)) continue;

          const cleanName = cleanNameForDedup(song.name);
          if (cleanName && seenNames.has(cleanName)) continue;

          seenIds.add(song.id);
          if (cleanName) seenNames.add(cleanName);
          weeklyMixSongs.push(song);
        }
      }
    }
  }

  // If still under 25, fallback to diverse defaults
  if (weeklyMixSongs.length < 25) {
    const rawPop = await searchSongs("top hits popular songs", 25).catch(() => []);
    const normalized = normalizeSongsToCanonical(rawPop);
    for (const song of normalized) {
      if (!song || !song.id) continue;
      if (seenIds.has(song.id) || recentlyPlayedIds.has(song.id)) continue;

      const cleanName = cleanNameForDedup(song.name);
      if (cleanName && seenNames.has(cleanName)) continue;

      seenIds.add(song.id);
      if (cleanName) seenNames.add(cleanName);
      weeklyMixSongs.push(song);
    }
  }

  const finalSongs = weeklyMixSongs.slice(0, 30);

  const mixesData: IMix[] = [
    {
      key: "weekly_mix",
      title: "Weekly Mix",
      description: "A personalized mix of music curated just for you this week.",
      songIds: finalSongs.map((s) => s.id),
    },
  ];

  return (await UserMixSet.findOneAndUpdate(
    { userId: userObjId, weekOf },
    { mixes: mixesData, generatedAt: new Date() },
    { upsert: true, new: true }
  )) as IUserMixSet;
}

// Generates reduced/cold-start mix set for guest and new users
async function generateColdStartMixSet(userId: string, weekOf: Date): Promise<UserMixSetResponse> {
  const currentYear = new Date().getFullYear();
  let popularSongs: Song[] = [];

  try {
    const rawPop = await searchSongs("top hits popular songs", 30);
    popularSongs = normalizeSongsToCanonical(rawPop).slice(0, 25);
  } catch (err) {
    console.error("[MixEngine] Cold start songs fetch failed:", err);
  }

  const mixes: SongMix[] = [
    {
      key: "weekly_mix",
      title: "Weekly Mix",
      description: "Trending hits and popular tracks to start your week.",
      songs: popularSongs,
    },
  ];

  return {
    userId,
    weekOf,
    mixes,
    generatedAt: new Date(),
  };
}
