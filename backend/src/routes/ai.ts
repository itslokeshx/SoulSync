import { Router, Response } from "express";
import { groqManager } from "../services/groq.js";
import { searchSongs } from "../services/jiosaavn.js";
import { parseQuery } from "../services/searchEnhancer.js";
import { redisGet, redisSet } from "../services/redis.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import crypto from "crypto";

const router = Router();
router.use(authMiddleware);

interface AIQuery {
  original: string;
  searchQuery: string;
  artistHint: string | null;
  movieHint: string | null;
}

interface MatchedSong {
  original: string;
  song: unknown;
  confidence: "high" | "partial" | "none";
  score: number;
}

// POST /api/ai/build-playlist
router.post(
  "/build-playlist",
  rateLimiter(15, 60000),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Check if Groq keys are configured
      const hasKeys = [
        process.env.GROQ_KEY_1,
        process.env.GROQ_KEY_2,
        process.env.GROQ_KEY_3,
      ].some(Boolean);
      if (!hasKeys) {
        res
          .status(503)
          .json({ error: "AI service not configured. Add GROQ_KEY env vars." });
        return;
      }

      const { songs, mood } = req.body;

      if (!songs && !mood) {
        res
          .status(400)
          .json({ error: "Provide song names or a mood description" });
        return;
      }

      let songList: string[] = [];

      if (mood && !songs) {
        // Mood-based generation — ask Groq for song suggestions
        const moodResult = await groqManager.callWithFallback(
          "You are a music curator. Given a mood/vibe description, suggest 15 songs that match. Return ONLY valid JSON, no explanation.",
          `Suggest 15 songs for this mood: "${mood}"\n\nReturn JSON:\n{"songs": ["song name - artist", ...], "playlistName": "creative 4-word name"}`,
          800,
        );

        try {
          const parsed = JSON.parse(moodResult);
          songList = parsed.songs || [];

          if (songList.length === 0) {
            res
              .status(400)
              .json({ error: "Could not generate songs for this mood" });
            return;
          }

          // Search each song
          const results = await searchAllSongs(songList);

          res.json({
            playlistName: parsed.playlistName || "AI Generated Mix",
            ...results,
          });
          return;
        } catch {
          res.status(500).json({ error: "AI response parsing failed" });
          return;
        }
      }

      // Song list provided
      songList = Array.isArray(songs)
        ? songs
        : songs
            .split("\n")
            .map((s: string) => s.trim())
            .filter(Boolean);

      if (songList.length === 0) {
        res.status(400).json({ error: "No songs provided" });
        return;
      }

      // Check cache
      const cacheKey = `ai:playlist:${crypto.createHash("md5").update(songList.join("|")).digest("hex")}`;
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          res.json(JSON.parse(cached));
          return;
        } catch {
          /* ignore */
        }
      }

      let queries: AIQuery[];

      if (songList.length <= 5) {
        // Small list — skip Groq, use queryParser directly
        queries = songList.map((s) => {
          const parsed = parseQuery(s);
          return {
            original: s,
            searchQuery: parsed.expandedQueries[0],
            artistHint: parsed.entities.artist,
            movieHint: parsed.entities.movie,
          };
        });
      } else {
        // Use Groq for optimization
        const groqResult = await groqManager.callWithFallback(
          "You are a music search optimizer for JioSaavn. Return ONLY valid JSON. No explanation. No markdown.",
          `Convert these song inputs to optimized JioSaavn search queries:\n${songList.join("\n")}\n\nReturn exactly this JSON:\n{"queries": [{"original": "input", "searchQuery": "optimized query", "artistHint": "artist or null", "movieHint": "movie or null"}], "playlistName": "creative 4-word name"}`,
          1000,
        );

        try {
          const parsed = JSON.parse(groqResult);
          queries =
            parsed.queries ||
            songList.map((s: string) => ({
              original: s,
              searchQuery: s,
              artistHint: null,
              movieHint: null,
            }));
        } catch {
          // Fallback if Groq fails
          queries = songList.map((s) => ({
            original: s,
            searchQuery: parseQuery(s).expandedQueries[0],
            artistHint: null,
            movieHint: null,
          }));
        }
      }

      const results = await searchAllSongs(
        queries.map((q) => q.original),
        queries,
      );

      // Generate playlist name
      let playlistName = "My SoulSync Mix";
      try {
        const nameResult = await groqManager.callWithFallback(
          "Return ONLY a creative 4-word playlist name. No quotes, no explanation.",
          `Give a creative 4-word playlist name for songs: ${songList.slice(0, 5).join(", ")}`,
          50,
        );
        playlistName = nameResult.replace(/['"]/g, "").trim() || playlistName;
      } catch {
        // Use default
      }

      const finalResult = { playlistName, ...results };

      // Cache for 30 minutes
      await redisSet(cacheKey, JSON.stringify(finalResult), 1800);

      res.json(finalResult);
    } catch (err) {
      console.error("[AI] Build playlist error:", err);
      res.status(500).json({ error: "AI playlist generation failed" });
    }
  },
);

async function searchAllSongs(
  originals: string[],
  queries?: AIQuery[],
): Promise<{
  matched: MatchedSong[];
  partial: MatchedSong[];
  unmatched: string[];
  stats: { total: number; found: number; notFound: number };
}> {
  const matched: MatchedSong[] = [];
  const partial: MatchedSong[] = [];
  const unmatched: string[] = [];

  // Search in batches of 5
  const searchPromises = originals.map(async (original, i) => {
    const searchQuery = queries?.[i]?.searchQuery || original;
    try {
      const result = await searchSongs(searchQuery, 5);
      const songs = result.results;

      if (songs.length === 0) {
        unmatched.push(original);
        return;
      }

      // Simple scoring: check if song name contains query words
      const queryWords = original.toLowerCase().split(/\s+/);
      const topSong = songs[0];
      const songNameLower = (topSong.name || "").toLowerCase();
      const matchCount = queryWords.filter((w) =>
        songNameLower.includes(w),
      ).length;
      const score = (matchCount / queryWords.length) * 100;

      if (score > 70) {
        matched.push({ original, song: topSong, confidence: "high", score });
      } else if (score > 30) {
        partial.push({ original, song: topSong, confidence: "partial", score });
      } else if (songs.length > 0) {
        // Still return the best match as partial
        partial.push({
          original,
          song: topSong,
          confidence: "partial",
          score: 30,
        });
      } else {
        unmatched.push(original);
      }
    } catch {
      unmatched.push(original);
    }
  });

  // Execute in batches of 5 concurrent
  for (let i = 0; i < searchPromises.length; i += 5) {
    await Promise.all(searchPromises.slice(i, i + 5));
  }

  return {
    matched,
    partial,
    unmatched,
    stats: {
      total: originals.length,
      found: matched.length + partial.length,
      notFound: unmatched.length,
    },
  };
}

export default router;
