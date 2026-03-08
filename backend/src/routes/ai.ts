import { Router, Response } from "express";
import { groqManager } from "../services/groq.js";
import { searchSongs } from "../services/jiosaavn.js";
import { parseQuery } from "../services/searchEnhancer.js";
import { redisGet, redisSet } from "../services/redis.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import crypto from "crypto";

const router = Router();

const CHUNK_SIZE = 20;
const MAX_GROQ_CONCURRENT = 3;
const MAX_SEARCH_CONCURRENT = 10;
const MAX_TARGET_COUNT = 100;

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

// ─── Helper: send SSE event ─────────────────────────────────────────────────
function sseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // Flush if supported
  if (typeof (res as any).flush === "function") (res as any).flush();
}

// ─── Helper: parse song list string ─────────────────────────────────────────
function parseSongList(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.replace(/^\d+[\.\)]\s*/, "").trim())
    .filter((s) => s.length > 0 && s.length < 200);
}

// ─── Helper: chunk array ────────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── Helper: run promises with concurrency limit ────────────────────────────
async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function run() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, run));
  return results;
}

// ─── Search a single song with scoring ─────────────────────────────────────
async function searchOneSong(
  original: string,
  searchQuery: string,
  artistHint?: string | null,
): Promise<MatchedSong> {
  try {
    const songs = await searchSongs(searchQuery, 10);
    if (songs.length === 0)
      return { original, song: null, confidence: "none", score: 0 };

    const cleanOrig = original
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .trim();

    const queryWords = cleanOrig
      .split(/\s+/)
      .filter((w) => w.length > 1);

    let bestSong = songs[0];
    let bestScore = -1;

    for (const song of songs) {
      const songNameLower = (song.name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
      const artists = (song.artists?.primary || []).map((a: any) =>
        a.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim()
      );
      if (song.subtitle) {
        artists.push(song.subtitle.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim());
      }

      const combined = songNameLower + " " + artists.join(" ");
      let matchCount = queryWords.filter((w) => combined.includes(w)).length;
      let score = queryWords.length > 0 ? (matchCount / queryWords.length) * 100 : 50;

      // Exact title match bonus
      if (songNameLower === cleanOrig || cleanOrig.includes(songNameLower)) {
        score += 30;
      }

      // Hint bonus
      if (artistHint) {
        const hintLower = artistHint.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
        if (artists.some((a: string) => a.includes(hintLower) || hintLower.includes(a))) {
          score += 40;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestSong = song;
      }
    }

    if (bestScore >= 80)
      return { original, song: bestSong, confidence: "high", score: bestScore };
    if (bestScore >= 40)
      return { original, song: bestSong, confidence: "partial", score: bestScore };

    // Low score implies incorrect song
    return { original, song: null, confidence: "none", score: bestScore };
  } catch {
    return { original, song: null, confidence: "none", score: 0 };
  }
}

// ─── Process one chunk via Groq ─────────────────────────────────────────────
async function processChunkWithGroq(songList: string[]): Promise<AIQuery[]> {
  try {
    const groqResult = await groqManager.callWithFallback(
      "You are a music search optimizer for JioSaavn. Return ONLY valid JSON. No explanation. No markdown.",
      `Convert these song inputs to optimized JioSaavn search queries:\n${songList.join("\n")}\n\nReturn exactly:\n{"queries": [{"original": "input", "searchQuery": "optimized query", "artistHint": "artist or null", "movieHint": "movie or null"}]}`,
      1200,
    );
    const parsed = JSON.parse(groqResult);
    if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
      return parsed.queries;
    }
  } catch {
    // Fallback to parseQuery
  }
  return songList.map((s) => ({
    original: s,
    searchQuery: parseQuery(s).expandedQueries[0] || s,
    artistHint: null,
    movieHint: null,
  }));
}

// ─── POST /api/ai/build-playlist ─────────────────────────────────────────────
router.post(
  "/build-playlist",
  rateLimiter(15, 60000),
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    const isSSE =
      (req.headers.accept || "").includes("text/event-stream") ||
      req.body.stream === true;

    try {
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

      const { songs, mood, targetCount } = req.body;
      const maxSongs = Math.min(parseInt(targetCount) || 20, MAX_TARGET_COUNT);

      if (!songs && !mood) {
        res
          .status(400)
          .json({ error: "Provide song names or a mood description" });
        return;
      }

      // ── SSE setup ──
      if (isSSE) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();
      }

      const emit = (event: string, data: unknown) => {
        if (isSSE) sseEvent(res, event, data);
      };

      // ── Mood-based generation ──
      if (mood && !songs) {
        emit("progress", {
          step: "thinking",
          message: `Crafting ${maxSongs} songs for your mood...`,
          percent: 5,
        });

        const moodResult = await groqManager.callWithFallback(
          "You are a world-class music curator. Return ONLY valid JSON, no explanation.",
          `Suggest exactly ${maxSongs} songs for this mood/vibe: "${mood}"\n\nReturn JSON:\n{"songs": ["song name - artist", ...], "playlistName": "creative 4-word name"}`,
          maxSongs > 30 ? 2000 : 1000,
        );

        let songList: string[] = [];
        let playlistName = "AI Generated Mix";

        try {
          const parsed = JSON.parse(moodResult);
          songList = (parsed.songs || []).slice(0, maxSongs);
          playlistName = parsed.playlistName || playlistName;
        } catch (err) {
          console.error("[AI] Mood suggestion parsing failed:", err, moodResult);
          if (res.headersSent) {
            sseEvent(res, "error", { error: "AI response parsing failed" });
            res.end();
          } else {
            res.status(500).json({ error: "AI response parsing failed" });
          }
          return;
        }

        if (songList.length === 0) {
          res
            .status(400)
            .json({ error: "Could not generate songs for this mood" });
          return;
        }

        emit("progress", {
          step: "searching",
          message: `Searching ${songList.length} songs...`,
          percent: 30,
        });

        const tasks = songList.map(
          (s, i) => () =>
            searchOneSong(s, parseQuery(s).expandedQueries[0] || s).then(
              (result) => {
                const pct = 30 + Math.round(((i + 1) / songList.length) * 60);
                emit("song", {
                  ...result,
                  index: i,
                  total: songList.length,
                  percent: pct,
                });
                return result;
              },
            ),
        );

        const allResults = await withConcurrency(tasks, MAX_SEARCH_CONCURRENT);
        const matched = allResults.filter((r) => r.confidence === "high");
        const partial = allResults.filter((r) => r.confidence === "partial");
        const unmatched = allResults
          .filter((r) => r.confidence === "none")
          .map((r) => r.original);

        const finalResult = {
          playlistName,
          matched,
          partial,
          unmatched,
          stats: {
            total: songList.length,
            found: matched.length + partial.length,
            notFound: unmatched.length,
          },
        };

        emit("progress", {
          step: "done",
          message: "Playlist ready!",
          percent: 100,
        });
        if (isSSE) {
          emit("done", finalResult);
          res.end();
        } else {
          res.json(finalResult);
        }
        return;
      }

      // ── Song-list based generation ──
      let songList: string[] = parseSongList(
        Array.isArray(songs) ? songs.join("\n") : songs,
      ).slice(0, maxSongs);

      if (songList.length === 0) {
        res.status(400).json({ error: "No songs provided" });
        return;
      }

      // Cache check
      const cacheKey = `ai:playlist:v2:${crypto
        .createHash("md5")
        .update(songList.join("|") + maxSongs)
        .digest("hex")}`;
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          emit("progress", {
            step: "done",
            message: "Retrieved from cache!",
            percent: 100,
          });
          if (isSSE) {
            emit("done", parsed);
            res.end();
          } else res.json(parsed);
          return;
        } catch { }
      }

      emit("progress", {
        step: "thinking",
        message: `Optimizing ${songList.length} songs with AI...`,
        percent: 5,
      });

      // ── Chunked Groq processing ──
      let allQueries: AIQuery[] = [];

      if (songList.length <= 5) {
        allQueries = songList.map((s) => {
          const parsed = parseQuery(s);
          return {
            original: s,
            searchQuery: parsed.expandedQueries[0] || s,
            artistHint: parsed.entities.artist,
            movieHint: parsed.entities.movie,
          };
        });
      } else {
        const chunks = chunk(songList, CHUNK_SIZE);
        emit("progress", {
          step: "thinking",
          message: `Processing ${chunks.length} batches...`,
          percent: 10,
        });

        const chunkTasks = chunks.map((c, ci) => async () => {
          const queries = await processChunkWithGroq(c);
          const pct = 10 + Math.round(((ci + 1) / chunks.length) * 20);
          emit("progress", {
            step: "thinking",
            message: `Processed batch ${ci + 1}/${chunks.length}`,
            percent: pct,
          });
          return queries;
        });

        const chunkedResults = await withConcurrency(
          chunkTasks,
          MAX_GROQ_CONCURRENT,
        );
        allQueries = chunkedResults.flat();
      }

      // Generate playlist name in parallel
      const [playlistName] = await Promise.all([
        groqManager
          .callWithFallback(
            "Return ONLY a creative 4-word playlist name. No quotes, no explanation.",
            `Creative 4-word playlist name for: ${songList.slice(0, 5).join(", ")}`,
            60,
          )
          .then((n) => n.replace(/['"]/g, "").trim() || "My SoulSync Mix")
          .catch(() => "My SoulSync Mix"),
      ]);

      emit("progress", {
        step: "searching",
        message: `Searching ${allQueries.length} songs on JioSaavn...`,
        percent: 35,
      });

      // ── Parallel search with progress ──
      const searchTasks = allQueries.map(
        (q, i) => () =>
          searchOneSong(q.original, q.searchQuery || q.original, q.artistHint).then(
            (result) => {
              const pct = 35 + Math.round(((i + 1) / allQueries.length) * 55);
              emit("song", {
                ...result,
                index: i,
                total: allQueries.length,
                percent: pct,
              });
              return result;
            },
          ),
      );

      const allResults = await withConcurrency(
        searchTasks,
        MAX_SEARCH_CONCURRENT,
      );

      const matched = allResults.filter((r) => r.confidence === "high");
      const partial = allResults.filter((r) => r.confidence === "partial");
      const unmatched = allResults
        .filter((r) => r.confidence === "none")
        .map((r) => r.original);

      const finalResult = {
        playlistName,
        matched,
        partial,
        unmatched,
        stats: {
          total: allQueries.length,
          found: matched.length + partial.length,
          notFound: unmatched.length,
        },
      };

      // Cache 30 min
      await redisSet(cacheKey, JSON.stringify(finalResult), 1800);

      emit("progress", {
        step: "done",
        message: `Found ${finalResult.stats.found} songs!`,
        percent: 100,
      });
      if (isSSE) {
        emit("done", finalResult);
        res.end();
      } else {
        res.json(finalResult);
      }
    } catch (err) {
      console.error("[AI] Build playlist error:", err);
      const errMsg = { error: "AI playlist generation failed" };
      if (res.headersSent) {
        sseEvent(res, "error", errMsg);
        res.end();
      } else {
        res.status(500).json(errMsg);
      }
    }
  },
);

export default router;
