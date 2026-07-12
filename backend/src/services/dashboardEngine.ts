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

  const { greeting, subtitle } = getGreeting(userName);
  const globalExcludeIds = new Set<string>();

  // Exclude Discovery Mix songs from dynamic Made For You to prevent duplicates
  if (!isGuest) {
    try {
      const { UserMixSet } = await import("../models/UserMixSet.js");
      const { getStartOfWeek } = await import("./mixEngine.js");
      const startOfWeek = getStartOfWeek();
      const mixSet = await UserMixSet.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        weekOf: startOfWeek,
      }).lean();
      if (mixSet) {
        const discoveryMix = mixSet.mixes.find((m) => m.key === "discovery");
        if (discoveryMix) {
          for (const sId of discoveryMix.songIds) {
            globalExcludeIds.add(sId);
          }
        }
      }
    } catch (err) {
      console.warn("[Dashboard] Failed to fetch weekly mixes for exclusions:", err);
    }
  }

  // A. Recently Played (Distinct, latest 12 songs)
  let recentlyPlayed: Song[] = [];
  if (!isGuest) {
    try {
      const userObjId = new mongoose.Types.ObjectId(userId);
      const recent = await ListeningHistory.find({ userId: userObjId })
        .sort({ playedAt: -1 })
        .limit(50)
        .lean();

      const seen = new Set<string>();
      const uniqueRecent: any[] = [];
      for (const h of recent) {
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
    } catch (err) {
      console.error("[Dashboard] Recently Played fetch error:", err);
    }
  }

  // Fetch taste profile
  const tasteProfile = isGuest ? null : await getTasteProfile(userId);

  // B. New Releases from Industry (generic for preferred languages, not personalized)
  let newReleasesSongs: Song[] = [];
  let newReleasesTitle = "New Releases";
  let guestNewReleases: { title: string; songs: Song[] }[] | undefined;

  try {
    if (isGuest) {
      const [english, tamil, hindi, telugu] = await Promise.all([
        getIndustryNewReleases(["english"], 20),
        getIndustryNewReleases(["tamil"], 20),
        getIndustryNewReleases(["hindi"], 20),
        getIndustryNewReleases(["telugu"], 20),
      ]);
      guestNewReleases = [
        { title: "New English Releases", songs: english },
        { title: "New Tamil Releases", songs: tamil },
        { title: "New Hindi Releases", songs: hindi },
        { title: "New Telugu Releases", songs: telugu },
      ];
    } else {
      let langs: string[] = ["hindi"];
      const user = await User.findById(userId).select("preferences").lean();
      if (user?.preferences?.languages && user.preferences.languages.length > 0) {
        langs = user.preferences.languages;
      }
      newReleasesTitle = `New ${langs.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(" & ")} Releases`;

      const rawNewReleases = await getIndustryNewReleases(langs, 25);
      newReleasesSongs = rawNewReleases
        .filter((s) => !globalExcludeIds.has(s.id))
        .slice(0, 20);

      for (const s of newReleasesSongs) {
        globalExcludeIds.add(s.id);
      }
    }
  } catch (err) {
    console.error("[Dashboard] New Releases fetch error:", err);
  }

  // C. Made For You (Taste profile batch or global fallback, cap at 30)
  let madeForYouSongs: Song[] = [];
  try {
    const rawMadeForYou = await getTasteProfileBatch(
      tasteProfile,
      Array.from(globalExcludeIds),
      35,
    );
    madeForYouSongs = rawMadeForYou
      .filter((s) => !globalExcludeIds.has(s.id))
      .slice(0, 30);

    for (const s of madeForYouSongs) {
      globalExcludeIds.add(s.id);
    }
  } catch (err) {
    console.error("[Dashboard] Made For You fetch error:", err);
  }

  // Liked Songs and Playlists
  let likedSongs: Song[] = [];
  let playlists: any[] = [];
  if (!isGuest) {
    try {
      const user = await User.findById(userId).select("likedSongs").lean();
      const liked = user?.likedSongs || [];
      likedSongs = liked.map((s) => ({
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
    } catch (err) {
      console.error("[Dashboard] Liked songs fetch error:", err);
    }

    try {
      playlists = await Playlist.find({ userId }).lean();
    } catch (err) {
      console.error("[Dashboard] Playlists fetch error:", err);
    }
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

  // Cache response (2 min for auth, 30 min for guest) — skip in dev
  if (!isDev) {
    const ttl = isGuest ? 1800 : 120;
    await redisSet(cacheKey, JSON.stringify(response), ttl).catch(() => {});
  }

  return response;
}
