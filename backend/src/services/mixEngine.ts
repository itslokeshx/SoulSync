import mongoose from "mongoose";
import { UserMixSet, IUserMixSet, IMix } from "../models/UserMixSet.js";
import { getTasteProfile, generateNewMusicMix, generateFavoritesMix, generateDiscoveryMix, generateSeedAnchoredBatch } from "./recommendationEngine.js";
import { fetchSongsByIds, getSongsDetailsBatch, normalizeSongsToCanonical, searchSongs, type Song } from "./jiosaavn.js";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { User } from "../models/User.js";

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

  // 1. Check database for existing mix set of the current week
  const existing = await UserMixSet.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    weekOf: startOfWeek,
  }).lean() as IUserMixSet | null;

  if (existing) {
    // Check if mixes need regeneration (older than 7 days, which shouldn't happen with weekOf matching, but as a safety)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const isStale = Date.now() - existing.generatedAt.getTime() > sevenDaysMs;

    if (isStale) {
      // Regenerate in the background to avoid blocking user response
      triggerBackgroundRegeneration(userId, startOfWeek).catch((err) => {
        console.error(`[MixEngine] Background regeneration failed for ${userId}:`, err);
      });
    }

    // Return the cached mixes immediately
    return hydrateMixSet(userId, existing);
  }

  // 2. Generate new mix set since none exists for this week
  const newMixSet = await buildAndSaveMixSet(userId, startOfWeek);
  return hydrateMixSet(userId, newMixSet);
}

// Hydrates string songIds from MongoDB into full Song details from JioSaavn
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

// Builds the personalized mixes sequentially to support strict deduplication
async function buildAndSaveMixSet(userId: string, weekOf: Date): Promise<IUserMixSet> {
  const tasteProfile = await getTasteProfile(userId);

  // If no taste profile or no listening history, return cold start mixes
  if (!tasteProfile || tasteProfile.artists.length === 0) {
    const coldStart = await generateColdStartMixSet(userId, weekOf);
    // Save to DB
    return (await UserMixSet.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId), weekOf },
      {
        mixes: coldStart.mixes.map((m) => ({
          key: m.key as any,
          title: m.title,
          description: m.description,
          songIds: m.songs.map((s) => s.id),
        })),
        generatedAt: new Date(),
      },
      { upsert: true, new: true }
    )) as IUserMixSet;
  }

  const userDoc = await User.findById(userId).select("preferences").lean();
  const userPrefs = userDoc?.preferences || null;
  const excludeIds: string[] = [];

  // 1. Favorites Mix (Comfort listening - high priority)
  const favorites = await generateFavoritesMix(tasteProfile, excludeIds, 25, userPrefs, userId);
  favorites.forEach((s) => excludeIds.push(s.id));

  // 2. New Music Mix (Personalized releases)
  const newMusic = await generateNewMusicMix(tasteProfile, excludeIds, 25, userPrefs, userId);
  newMusic.forEach((s) => excludeIds.push(s.id));

  // 3. Discovery Mix (Exploratory picks)
  const discovery = await generateDiscoveryMix(tasteProfile, excludeIds, 25, userPrefs, userId);
  discovery.forEach((s) => excludeIds.push(s.id));

  // 4. Because You Liked Mix (Blended seed recommendation)
  let becauseYouLikedSongs: Song[] = [];
  let seedInfo: { seedSongId?: string; seedSongTitle?: string } | undefined;

  try {
    // Select top 3 seed songs from listening history
    const userObjId = new mongoose.Types.ObjectId(userId);
    const recentHistory = await ListeningHistory.find({ userId: userObjId })
      .sort({ playedAt: -1 })
      .limit(30)
      .lean();

    // Find the 3 most frequent recent songs to act as blended seeds
    const counts: Record<string, { count: number; title: string; song: Song }> = {};
    for (const h of recentHistory) {
      if (!counts[h.songId]) {
        counts[h.songId] = {
          count: 1,
          title: h.title,
          song: {
            id: h.songId,
            name: h.title,
            primaryArtists: h.artist || "",
            image: h.albumArt || "",
            album: "",
            albumId: "",
            duration: h.duration || 0,
            language: h.language || "",
            year: "",
            streamUrl: null,
            downloadUrl: [],
            playCount: 0,
            url: "",
          },
        };
      } else {
        counts[h.songId].count += 1;
      }
    }

    const sortedSeeds = Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    if (sortedSeeds.length > 0) {
      // Keep the primary seed info for metadata display
      seedInfo = {
        seedSongId: sortedSeeds[0].song.id,
        seedSongTitle: sortedSeeds[0].song.name,
      };

      const seedBatches = await Promise.all(
        sortedSeeds.map((seedData) =>
          generateSeedAnchoredBatch(seedData.song, tasteProfile, excludeIds, 10, userPrefs, userId).catch(() => [] as Song[])
        )
      );

      // Blend seeds
      const blendedSet = new Set<string>();
      for (const batch of seedBatches) {
        for (const s of batch) {
          if (!blendedSet.has(s.id)) {
            blendedSet.add(s.id);
            becauseYouLikedSongs.push(s);
          }
        }
      }
      becauseYouLikedSongs = becauseYouLikedSongs.slice(0, 25);
    }
  } catch (err) {
    console.error("[MixEngine] Failed to generate Because You Liked Mix:", err);
  }

  const mixesData: IMix[] = [
    {
      key: "favorites",
      title: "Favorites Mix",
      description: "Your comfort songs and artists you listen to most.",
      songIds: favorites.map((s) => s.id),
    },
    {
      key: "new_music",
      title: "New Music Mix",
      description: "Fresh tracks from your favorite artists and languages.",
      songIds: newMusic.map((s) => s.id),
    },
    {
      key: "discovery",
      title: "Discovery Mix",
      description: "Expand your horizons with artists you haven't explored yet.",
      songIds: discovery.map((s) => s.id),
    },
  ];

  if (becauseYouLikedSongs.length > 0) {
    mixesData.push({
      key: "because_you_liked",
      title: seedInfo?.seedSongTitle ? `Because You Liked: ${seedInfo.seedSongTitle}` : "For You Mix",
      description: "Recommendations anchored around your recent listening taste.",
      songIds: becauseYouLikedSongs.map((s) => s.id),
      seedInfo,
    });
  }

  // Update or insert database document
  return (await UserMixSet.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), weekOf },
    {
      mixes: mixesData,
      generatedAt: new Date(),
    },
    { upsert: true, new: true }
  )) as IUserMixSet;
}

// Generates reduced/cold-start mix set for guest and new users
async function generateColdStartMixSet(userId: string, weekOf: Date): Promise<UserMixSetResponse> {
  const currentYear = new Date().getFullYear();
  let newMusicSongs: Song[] = [];
  let popularSongs: Song[] = [];

  try {
    const [rawNew, rawPop] = await Promise.all([
      searchSongs(`new songs ${currentYear}`, 25),
      searchSongs("top hits", 25),
    ]);
    newMusicSongs = normalizeSongsToCanonical(rawNew);
    popularSongs = normalizeSongsToCanonical(rawPop);
  } catch (err) {
    console.error("[MixEngine] Cold start songs fetch failed:", err);
  }

  const mixes: SongMix[] = [
    {
      key: "new_music",
      title: "New Music Mix",
      description: "The latest hits and trending releases.",
      songs: newMusicSongs,
    },
    {
      key: "favorites",
      title: "Hits Mix",
      description: "Trending songs that everyone is listening to right now.",
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
