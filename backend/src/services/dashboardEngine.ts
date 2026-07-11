import mongoose from "mongoose";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { User } from "../models/User.js";
import { fetchSongById, Song } from "./jiosaavn.js";
import { redisGet, redisSet, redisDel } from "./redis.js";
import {
  getTasteProfile,
  generateSeedAnchoredBatch,
  getTasteProfileBatch,
  getLanguageAwareNewReleases,
} from "./recommendationEngine.js";

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface DashboardResponse {
  greeting: string;
  subtitle: string;
  recentlyPlayed: Song[];
  newReleases: { title: string; songs: Song[] };
  madeForYou: { title: string; songs: Song[]; hasMore: boolean };
  becauseYouLiked: { seedSongId: string; seedSongTitle: string; songs: Song[] }[];
  generatedAt: number;
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

  // Check cache
  const cacheKey = `dashboard:${userId}`;
  const cached = await redisGet(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const ttl = isGuest ? 30 * 60 * 1000 : 10 * 60 * 1000;
      if (Date.now() - parsed.generatedAt < ttl) {
        return parsed;
      }
    } catch {
      /* ignore */
    }
  }

  const { greeting, subtitle } = getGreeting(userName);
  const globalExcludeIds = new Set<string>();

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

  // B. New Releases For You (Language-aware, cap at 20)
  let newReleasesSongs: Song[] = [];
  try {
    const rawNewReleases = await getLanguageAwareNewReleases(tasteProfile, 25);
    newReleasesSongs = rawNewReleases
      .filter((s) => !globalExcludeIds.has(s.id))
      .slice(0, 20);

    for (const s of newReleasesSongs) {
      globalExcludeIds.add(s.id);
    }
  } catch (err) {
    console.error("[Dashboard] New Releases fetch error:", err);
  }

  // C. Made For You (Taste profile batch or global fallback, cap at 20)
  let madeForYouSongs: Song[] = [];
  try {
    const rawMadeForYou = await getTasteProfileBatch(
      tasteProfile,
      Array.from(globalExcludeIds),
      25,
    );
    madeForYouSongs = rawMadeForYou
      .filter((s) => !globalExcludeIds.has(s.id))
      .slice(0, 20);

    for (const s of madeForYouSongs) {
      globalExcludeIds.add(s.id);
    }
  } catch (err) {
    console.error("[Dashboard] Made For You fetch error:", err);
  }

  // D. Because You Liked ___ (Multiple shelves, 3-5 rotated liked seeds)
  let becauseYouLiked: { seedSongId: string; seedSongTitle: string; songs: Song[] }[] = [];
  if (!isGuest) {
    try {
      const user = await User.findById(userId).select("likedSongs").lean();
      const liked = user?.likedSongs || [];

      if (liked.length >= 3) {
        const rotationKey = `homefeed:seed-rotation:${userId}`;
        let rotationHit = await redisGet(rotationKey);
        let rotationState: { shuffledIds: string[]; lastIndex: number } | null = null;
        if (rotationHit) {
          try {
            rotationState = JSON.parse(rotationHit);
          } catch {}
        }

        const likedIds = liked.map((s) => s.songId);

        // Validate rotation state
        if (
          !rotationState ||
          !Array.isArray(rotationState.shuffledIds) ||
          rotationState.shuffledIds.length === 0 ||
          rotationState.shuffledIds.some((id) => !likedIds.includes(id))
        ) {
          const shuffled = [...likedIds].sort(() => Math.random() - 0.5);
          rotationState = { shuffledIds: shuffled, lastIndex: 0 };
        }

        const seedCount = Math.min(rotationState.shuffledIds.length, 5);
        const selectedIds: string[] = [];
        let idx = rotationState.lastIndex;
        for (let i = 0; i < seedCount; i++) {
          selectedIds.push(rotationState.shuffledIds[idx]);
          idx = (idx + 1) % rotationState.shuffledIds.length;
        }

        // Save updated rotation state
        rotationState.lastIndex = idx;
        await redisSet(rotationKey, JSON.stringify(rotationState), 30 * 24 * 3600).catch(() => {});

        // Fetch canonical Song metadata for selected seeds
        const seedSongsResults = await Promise.allSettled(
          selectedIds.map((id) => fetchSongById(id))
        );
        const seeds = seedSongsResults
          .filter((r) => r.status === "fulfilled" && r.value)
          .map((r) => (r as any).value as Song);

        const sectionExcludeIds = new Set<string>([...globalExcludeIds, ...likedIds]);

        for (const seed of seeds) {
          const seedRecommendations = await generateSeedAnchoredBatch(
            seed,
            tasteProfile,
            Array.from(sectionExcludeIds),
            8,
          );

          const filteredRecommendations = seedRecommendations
            .filter((s) => !sectionExcludeIds.has(s.id))
            .slice(0, 8);

          if (filteredRecommendations.length >= 6) {
            for (const s of filteredRecommendations) {
              sectionExcludeIds.add(s.id);
              globalExcludeIds.add(s.id);
            }
            becauseYouLiked.push({
              seedSongId: seed.id,
              seedSongTitle: seed.name,
              songs: filteredRecommendations,
            });
          }
        }
      }
    } catch (err) {
      console.error("[Dashboard] Because You Liked fetch error:", err);
    }
  }

  const response: DashboardResponse = {
    greeting,
    subtitle,
    recentlyPlayed,
    newReleases: {
      title: "New Releases For You",
      songs: newReleasesSongs,
    },
    madeForYou: {
      title: isGuest || !tasteProfile || tasteProfile.artists.length === 0 ? "Popular Right Now" : "Made For You",
      songs: madeForYouSongs,
      hasMore: true,
    },
    becauseYouLiked,
    generatedAt: Date.now(),
  };

  // Cache response (10 min for auth, 30 min for guest)
  const ttl = isGuest ? 1800 : 600;
  await redisSet(cacheKey, JSON.stringify(response), ttl).catch(() => {});

  return response;
}
