import mongoose from "mongoose";
import { DailyMixCache } from "../models/DailyMixCache.js";
import { User } from "../models/User.js";
import {
  getTasteProfile,
  getTasteProfileBatch,
  getColdStartBatch,
} from "./recommendationEngine.js";
import { searchSongs, normalizeSongsToCanonical } from "./jiosaavn.js";
import { resolveLanguageFilter, filterByLanguages } from "./scoringUtils.js";

export interface DailyMixResult {
  dateStr: string;
  songs: any[];
  isCached: boolean;
}

function getDeterministicIndex(str: string, max: number): number {
  if (!max || max <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

function getCleanTitle(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[\(\[\-].*?[\)\]]/g, "")
    .trim();
}

export async function getDailyMix(
  userId: string,
  forcedDateStr?: string
): Promise<DailyMixResult> {
  const targetDateStr = forcedDateStr || new Date().toISOString().split("T")[0];

  if (!userId || userId === "guest" || !mongoose.Types.ObjectId.isValid(userId)) {
    const coldSongs = await getColdStartBatch([], 18, ["english", "hindi"]);
    return {
      dateStr: targetDateStr,
      songs: coldSongs,
      isCached: false,
    };
  }

  const userObjId = new mongoose.Types.ObjectId(userId);
  const existingCache = await DailyMixCache.findOne({
    userId: userObjId,
    dateStr: targetDateStr,
  });

  if (existingCache && Array.isArray(existingCache.songs) && existingCache.songs.length > 0) {
    return {
      dateStr: targetDateStr,
      songs: existingCache.songs,
      isCached: true,
    };
  }

  const userDoc = await User.findById(userObjId).lean();
  const taste = await getTasteProfile(userId);
  const { languages: allowedLangs } = resolveLanguageFilter(userDoc?.preferences, taste);

  let rawBatch = await getTasteProfileBatch(taste, [], 48, userDoc?.preferences, userId);
  let filteredBatch = filterByLanguages(rawBatch, allowedLangs);

  let seedSongs: any[] = [];
  if (taste && Array.isArray(taste.artists) && taste.artists.length > 0) {
    const seedIndex = getDeterministicIndex(`${userId}_${targetDateStr}`, taste.artists.length);
    const seedArtist = taste.artists[seedIndex]?.artistName || taste.artists[0]?.artistName;
    if (seedArtist) {
      const primaryLang = allowedLangs[0] || "";
      const query = primaryLang && primaryLang !== "english" ? `${seedArtist} ${primaryLang}` : seedArtist;
      try {
        const rawSeedResults = await searchSongs(query, 15);
        const normSeedResults = normalizeSongsToCanonical(rawSeedResults);
        seedSongs = filterByLanguages(normSeedResults, allowedLangs).map((s) => ({
          ...s,
          reason: `Daily Mix · ${seedArtist} Radio`,
        }));
      } catch (e) {}
    }
  }

  const combinedCandidatePool = [...seedSongs, ...filteredBatch];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const artistCounts = new Map<string, number>();
  const finalSongs: any[] = [];

  for (const song of combinedCandidatePool) {
    if (!song || !song.id || seenIds.has(song.id)) continue;

    const cleanTitle = getCleanTitle(song.name);
    if (cleanTitle && seenTitles.has(cleanTitle)) continue;

    const artist = (song.primaryArtists || "").split(",")[0].trim().toLowerCase();
    const currentArtistCount = artistCounts.get(artist) || 0;
    if (currentArtistCount >= 2) continue;

    seenIds.add(song.id);
    if (cleanTitle) seenTitles.add(cleanTitle);
    artistCounts.set(artist, currentArtistCount + 1);
    finalSongs.push(song);

    if (finalSongs.length >= 20) break;
  }

  if (finalSongs.length < 12) {
    const cold = await getColdStartBatch(Array.from(seenIds), 20 - finalSongs.length, allowedLangs);
    const filteredCold = filterByLanguages(cold, allowedLangs);
    for (const song of filteredCold) {
      const cleanTitle = getCleanTitle(song.name);
      if (!seenIds.has(song.id) && (!cleanTitle || !seenTitles.has(cleanTitle))) {
        seenIds.add(song.id);
        if (cleanTitle) seenTitles.add(cleanTitle);
        finalSongs.push(song);
      }
    }
  }

  const strictlyValidatedSongs = filterByLanguages(finalSongs, allowedLangs);

  await DailyMixCache.findOneAndUpdate(
    { userId: userObjId, dateStr: targetDateStr },
    {
      userId: userObjId,
      dateStr: targetDateStr,
      songs: strictlyValidatedSongs,
      generatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return {
    dateStr: targetDateStr,
    songs: strictlyValidatedSongs,
    isCached: false,
  };
}
