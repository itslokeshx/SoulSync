import mongoose from "mongoose";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { Playlist } from "../models/Playlist.js";
import { User } from "../models/User.js";
import { fetchSongById, Song } from "./jiosaavn.js";
import { redisGet, redisSet, redisDel } from "./redis.js";
import {
  getTasteProfile,
  generateSeedAnchoredBatch,
  getTasteProfileBatch,
  getLanguageAwareNewReleases,
  getIndustryNewReleases,
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
}

const INDIAN_LANGS = new Set([
  "hindi",
  "tamil",
  "telugu",
  "punjabi",
  "malayalam",
  "kannada",
  "marathi",
  "bengali",
  "bhojpuri",
  "gujarati",
  "assamese",
  "rajasthani",
  "haryanvi",
  "harianvi",
  "odiya",
]);

function isIndianSong(song: Song): boolean {
  if (!song) return false;
  const lang = (song.language || "").toLowerCase().trim();
  if (INDIAN_LANGS.has(lang)) return true;

  const text = `${song.name || ""} ${song.primaryArtists || ""} ${song.album || ""}`;
  if (/[\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0A00-\u0A7F\u0D00-\u0D7F]/.test(text)) {
    return true;
  }
  return false;
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

  // Check cache (skip in development for fresh Made For You on every reload)
  const cacheKey = `dashboard:${userId}`;
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev) {
    const cached = await redisGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const ttl = isGuest ? 30 * 60 * 1000 : 2 * 60 * 1000;
        if (Date.now() - parsed.generatedAt < ttl) {
          return parsed;
        }
      } catch {
        /* ignore */
      }
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

      // Parallelize all non-dependent MongoDB / Taste profile calls
      const [userRes, mixRes, recentRes, tasteRes, playlistsRes] = await Promise.all([
        User.findById(userId).select("name preferences likedSongs").lean(),
        UserMixSet.findOne({ userId: userObjId, weekOf: startOfWeek }).lean(),
        ListeningHistory.find({ userId: userObjId }).sort({ playedAt: -1 }).limit(50).lean(),
        getTasteProfile(userId),
        Playlist.find({ userId }).lean(),
      ]);

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

  // B. New Releases from Industry (generic for preferred languages, not personalized)
  let newReleasesSongs: Song[] = [];
  let newReleasesTitle = "New Releases";
  let guestNewReleases: { title: string; songs: Song[] }[] | undefined;

  let langs: string[] = ["hindi"];
  if (userDoc?.preferences?.languages && userDoc.preferences.languages.length > 0) {
    langs = userDoc.preferences.languages;
  }

  try {
    if (isGuest) {
      // Aggregate top global songs across all users from ListeningHistory
      let trendingWorldwide: Song[] = [];
      try {
        const topHistory = await ListeningHistory.aggregate([
          {
            $group: {
              _id: "$songId",
              playCount: { $sum: 1 },
              title: { $first: "$title" },
              artist: { $first: "$artist" },
              albumArt: { $first: "$albumArt" },
              duration: { $first: "$duration" },
              language: { $first: "$language" },
            },
          },
          { $sort: { playCount: -1 } },
          { $limit: 20 },
        ]);

        if (topHistory.length > 0) {
          trendingWorldwide = topHistory.map((h: any) => ({
            id: h._id,
            name: h.title,
            primaryArtists: h.artist || "Unknown Artist",
            image: h.albumArt || "",
            album: "",
            albumId: "",
            duration: h.duration || 0,
            language: h.language || "",
            year: "",
            streamUrl: null,
            downloadUrl: [],
            playCount: h.playCount,
            url: "",
          }));
        }
      } catch (e) {
        console.error("[Dashboard] Guest aggregate error:", e);
      }

      const [rawGlobal, english, tamil, hindi] = await Promise.all([
        getIndustryNewReleases(["english", "pop", "french", "spanish", "latin"], 35),
        getIndustryNewReleases(["english"], 20),
        getIndustryNewReleases(["tamil"], 20),
        getIndustryNewReleases(["hindi"], 20),
      ]);

      const pureGlobal = rawGlobal.filter((s) => !isIndianSong(s));

      guestNewReleases = [
        {
          title: "Global New Releases",
          songs: pureGlobal.length > 0 ? pureGlobal : english.filter((s) => !isIndianSong(s)),
        },
        { title: "Trending English Hits", songs: english },
        { title: "Tamil Chartbusters", songs: tamil },
        { title: "Hindi Hits & Releases", songs: hindi },
      ].filter((sec) => sec.songs && sec.songs.length > 0);
    } else {
      newReleasesTitle = `New ${langs.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(" & ")} Releases`;
    }
  } catch (err) {
    console.error("[Dashboard] New Releases setup error:", err);
  }

  // C. Made For You & B. New Releases (if not guest) in parallel
  let madeForYouSongs: Song[] = [];
  try {
    if (isGuest) {
      const rawMadeForYou = await getTasteProfileBatch(
        null,
        Array.from(globalExcludeIds),
        45,
        null,
        "guest"
      );
      madeForYouSongs = rawMadeForYou
        .filter((s) => !globalExcludeIds.has(s.id))
        .slice(0, 36);
    } else {
      const [rawNewReleases, rawMadeForYou] = await Promise.all([
        getIndustryNewReleases(langs, 25),
        getTasteProfileBatch(
          tasteProfile,
          Array.from(globalExcludeIds),
          45,
          userDoc?.preferences,
          userId
        ),
      ]);

      newReleasesSongs = rawNewReleases
        .filter((s) => !globalExcludeIds.has(s.id))
        .slice(0, 20);

      for (const s of newReleasesSongs) {
        globalExcludeIds.add(s.id);
      }

      madeForYouSongs = rawMadeForYou
        .filter((s) => !globalExcludeIds.has(s.id))
        .slice(0, 36);

      if (madeForYouSongs.length < 24) {
        for (const s of rawMadeForYou) {
          if (!madeForYouSongs.some((m) => m.id === s.id)) {
            madeForYouSongs.push(s);
            if (madeForYouSongs.length >= 36) break;
          }
        }
      }
    }

    for (const s of madeForYouSongs) {
      globalExcludeIds.add(s.id);
    }

    // Record surfaced Made For You songs in RecentlyRecommended collection
    if (!isGuest && userId && madeForYouSongs.length > 0) {
      const surfacedIds = madeForYouSongs.map((s) => s.id);
      const { recordRecentlyRecommended } = await import("./scoringUtils.js");
      recordRecentlyRecommended(userId, surfacedIds, "made_for_you").catch(() => {});
    }
  } catch (err) {
    console.error("[Dashboard] Recommendations fetches error:", err);
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
    generatedAt: Date.now(),
  };

  // Cache response for guests only (30 min); auth user requests generate fresh personalized recs on every refresh
  if (!isDev && isGuest) {
    await redisSet(cacheKey, JSON.stringify(response), 1800).catch(() => {});
  }

  return response;
}
