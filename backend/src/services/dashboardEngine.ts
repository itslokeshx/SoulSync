import mongoose from "mongoose";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { Playlist } from "../models/Playlist.js";
import { User } from "../models/User.js";
import { fetchSongById, Song } from "./youtubeMusicService.js";
import { redisGet, redisSet, redisDel } from "./redis.js";
import {
  getTasteProfile,
  generateSeedAnchoredBatch,
  getTasteProfileBatch,
  getLanguageAwareNewReleases,
  getIndustryNewReleases,
  getPodcastRecommendations,
} from "./recommendationEngine.js";

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface DashboardResponse {
  greeting: string;
  subtitle: string;
  recentlyPlayed: Song[];
  newReleases: { title: string; songs: Song[] };
  likedSongs: Song[];
  playlists: any[];
  madeForYou: { title: string; songs: Song[] };
  generatedAt: number;
  guestNewReleases?: { title: string; songs: Song[] }[];
  podcasts?: any[];
  _timings?: any;
}

// ─── TIME-AWARE GREETING ─────────────────────────────────────────────────────
function getGreeting(name: string): {
  greeting: string;
  subtitle: string;
} {
  const hr = new Date().getHours();
  let greeting: string, subtitle: string;

  if (hr >= 5 && hr < 12) {
    greeting = `Good morning, ${name}`;
    subtitle = "Start your day with great music";
  } else if (hr >= 12 && hr < 17) {
    greeting = `Good afternoon, ${name}`;
    subtitle = "Perfect tunes for the afternoon";
  } else if (hr >= 17 && hr < 21) {
    greeting = `Good evening, ${name}`;
    subtitle = "Wind down with your favourites";
  } else {
    greeting = `Good night, ${name}`;
    subtitle = "Late night vibes, just for you";
  }

  return { greeting, subtitle };
}

// ─── MAIN DASHBOARD BUILDER ─────────────────────────────────────────────────
export async function buildDashboard(
  userId: string,
  userName: string,
): Promise<DashboardResponse> {
  const isGuest = userId === "guest";

  const t0 = performance.now();
  const timings: any = {};

  // Check cache (with 30-second TTL in development, and 2-minute TTL in production for authenticated users)
  const cacheKey = `dashboard:${userId}`;
  const isDev = process.env.NODE_ENV !== "production";
  
  const tCacheStart = performance.now();
  const cached = await redisGet(cacheKey);
  timings.redisCacheCheck = performance.now() - tCacheStart;
  
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const ttl = isGuest ? 30 * 60 * 1000 : (isDev ? 30 * 1000 : 2 * 60 * 1000);
      if (Date.now() - parsed.generatedAt < ttl) {
        parsed._timings = timings;
        return parsed;
      }
    } catch {
      /* ignore */
    }
  }

  // Run independent database queries in parallel
  let userDoc: any = null;
  let mixSet: any = null;
  let recentHistory: any[] = [];
  let tasteProfile: any = null;
  let playlists: any[] = [];

  if (!isGuest) {
    try {
      const userObjId = new mongoose.Types.ObjectId(userId);
      const { UserMixSet } = await import("../models/UserMixSet.js");
      const { getStartOfWeek } = await import("./mixEngine.js");
      const startOfWeek = getStartOfWeek();

      const tDbStart = performance.now();
      // Parallelize all non-dependent MongoDB / Taste profile calls
      const [userRes, mixRes, recentRes, tasteRes, playlistsRes] = await Promise.all([
        User.findById(userId).select("name preferences likedSongs").lean(),
        UserMixSet.findOne({ userId: userObjId, weekOf: startOfWeek }).lean(),
        ListeningHistory.find({ userId: userObjId }).sort({ playedAt: -1 }).limit(50).lean(),
        getTasteProfile(userId),
        Playlist.find({ userId }).lean(),
      ]);
      timings.dbQueriesParallel = performance.now() - tDbStart;

      userDoc = userRes;
      mixSet = mixRes;
      recentHistory = recentRes;
      tasteProfile = tasteRes;
      playlists = playlistsRes;
    } catch (err) {
      console.error("[Dashboard] Parallel database queries failed:", err);
    }
  }

  // Time-aware greeting
  const resolvedName = userDoc?.name || userName;
  const { greeting, subtitle } = getGreeting(resolvedName);
  const globalExcludeIds = new Set<string>();

  // Exclude Discovery Mix songs from dynamic Made For You to prevent duplicates
  if (!isGuest && mixSet) {
    const discoveryMix = mixSet.mixes?.find((m: any) => m.key === "discovery");
    if (discoveryMix) {
      for (const sId of discoveryMix.songIds) {
        globalExcludeIds.add(sId);
      }
    }
  }

  // A. Recently Played (Distinct, latest 12 songs)
  let recentlyPlayed: Song[] = [];
  if (!isGuest && recentHistory && recentHistory.length > 0) {
    const seen = new Set<string>();
    const uniqueRecent: any[] = [];
    for (const h of recentHistory) {
      if (!seen.has(h.songId)) {
        seen.add(h.songId);
        uniqueRecent.push(h);
      }
    }

    recentlyPlayed = uniqueRecent.slice(0, 12).map((h) => ({
      id: h.songId,
      name: h.title,
      primaryArtists: h.artist || "Unknown",
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
    }));

    // Add to global exclusions
    for (const s of recentlyPlayed) {
      globalExcludeIds.add(s.id);
    }
  }

  let newReleasesSongs: Song[] = [];
  let newReleasesTitle = "New Releases";
  let guestNewReleases: { title: string; songs: Song[] }[] | undefined;
  let madeForYouSongs: Song[] = [];
  let recommendedPodcasts: any[] = [];

  let langs: string[] = ["hindi"];
  if (userDoc?.preferences?.languages && userDoc.preferences.languages.length > 0) {
    langs = userDoc.preferences.languages;
  }

  try {
    const tExternalStart = performance.now();
    if (isGuest) {
      const [guestReleaseResults, rawMadeForYou] = await Promise.all([
        Promise.all([
          getIndustryNewReleases(["english"], 20),
          getIndustryNewReleases(["tamil"], 20),
          getIndustryNewReleases(["hindi"], 20),
          getIndustryNewReleases(["telugu"], 20),
        ]),
        getTasteProfileBatch(null, Array.from(globalExcludeIds), 35),
      ]);

      const [english, tamil, hindi, telugu] = guestReleaseResults;
      guestNewReleases = [
        { title: "New English Releases", songs: english },
        { title: "New Tamil Releases", songs: tamil },
        { title: "New Hindi Releases", songs: hindi },
        { title: "New Telugu Releases", songs: telugu },
      ];

      madeForYouSongs = rawMadeForYou
        .filter((s) => !globalExcludeIds.has(s.id))
        .slice(0, 30);
      recommendedPodcasts = [];
    } else {
      newReleasesTitle = `New ${langs.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(" & ")} Releases`;

      const [rawNewReleases, rawMadeForYou] = await Promise.all([
        getIndustryNewReleases(langs, 25),
        getTasteProfileBatch(tasteProfile, Array.from(globalExcludeIds), 35),
      ]);

      newReleasesSongs = rawNewReleases
        .filter((s) => !globalExcludeIds.has(s.id))
        .slice(0, 20);

      for (const s of newReleasesSongs) {
        globalExcludeIds.add(s.id);
      }

      madeForYouSongs = rawMadeForYou
        .filter((s) => !globalExcludeIds.has(s.id))
        .slice(0, 30);
      recommendedPodcasts = [];
    }

    for (const s of madeForYouSongs) {
      globalExcludeIds.add(s.id);
    }
    timings.externalFetch = performance.now() - tExternalStart;
  } catch (err) {
    console.error("[Dashboard] External fetches error:", err);
  }

  // Liked Songs mapping (from pre-loaded userDoc)
  let likedSongs: Song[] = [];
  if (!isGuest && userDoc) {
    const liked = userDoc.likedSongs || [];
    likedSongs = liked.map((s: any) => ({
      id: s.songId,
      name: s.title,
      primaryArtists: s.artist,
      image: s.albumArt,
      album: "",
      albumId: "",
      duration: s.duration,
      language: "",
      year: "",
      streamUrl: null,
      downloadUrl: s.downloadUrl || [],
      playCount: 0,
      url: "",
    }));
  }

  const response: DashboardResponse = {
    greeting,
    subtitle,
    recentlyPlayed,
    newReleases: {
      title: newReleasesTitle,
      songs: newReleasesSongs,
    },
    likedSongs,
    playlists,
    madeForYou: {
      title: isGuest || !tasteProfile || tasteProfile.artists.length === 0 ? "Popular Right Now" : "Made For You",
      songs: madeForYouSongs,
    },
    guestNewReleases,
    podcasts: recommendedPodcasts,
    generatedAt: Date.now(),
  };

  timings.totalBuildTime = performance.now() - t0;
  response._timings = timings;

  // Cache response (30 sec in dev, 2 min in prod for auth; 30 min for guest)
  const ttl = isGuest ? 1800 : (isDev ? 30 : 120);
  
  const tCacheWrite = performance.now();
  await redisSet(cacheKey, JSON.stringify(response), ttl).catch(() => {});
  timings.redisCacheWrite = performance.now() - tCacheWrite;

  return response;
}
