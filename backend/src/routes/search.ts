import { Router, Response } from "express";
import {
  enhancedSearch,
  parseQuery,
  scoreSong,
  normalizeSearchKey,
} from "../services/searchEnhancer.js";
import {
  searchAlbums,
  searchAlbumsDirect,
  searchArtists,
  searchArtistsDirect,
  searchSongsDirect,
  getTopSearches,
  getSuggestions,
  JioSaavnSong,
} from "../services/jiosaavn.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { redisGet, redisSet } from "../services/redis.js";

const router = Router();

// GET /api/search — Smart enhanced search
router.get(
  "/",
  rateLimiter(40, 60000),
  async (req: any, res: Response): Promise<void> => {
    try {
      const q = req.query.q as string;
      const type = (req.query.type as string) || "all";
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 50);

      if (!q || q.trim().length === 0) {
        res.status(400).json({ error: "Query required" });
        return;
      }

      if (type === "songs") {
        const result = await enhancedSearch(q, type, limit);
        res.json(result);
        return;
      }

      if (type === "albums") {
        const albums = await searchAlbums(q, limit);
        res.json({ albums });
        return;
      }

      if (type === "artists") {
        const artists = await searchArtists(q, limit);
        res.json({ artists });
        return;
      }

      // type === "all" → enriched parallel search
      const result = await enhancedSearch(q, type, limit);

      // Fire albums + artists in parallel
      const [albums, artists] = await Promise.all([
        searchAlbums(q, 8).catch(() => ({ results: [] })),
        searchArtists(q, 8).catch(() => ({ results: [] })),
      ]);

      res.json({
        ...result,
        albums: albums,
        artists: artists,
      });
    } catch (err) {
      console.error("[Search] Error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  },
);

// GET /api/search/suggestions — Live autocomplete
router.get(
  "/suggestions",
  rateLimiter(60, 60000),
  async (req: any, res: Response): Promise<void> => {
    try {
      const q = req.query.q as string;
      if (!q || q.trim().length < 2) {
        res.json({ suggestions: [] });
        return;
      }

      const cacheKey = `suggest:${q.toLowerCase().trim()}`;
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          res.json(JSON.parse(cached));
          return;
        } catch {}
      }

      const data = await getSuggestions(q);
      const parsed = parseQuery(q);

      const result = {
        suggestions: data,
        parsedPreview: {
          intent: parsed.intent,
          artist: parsed.entities.artist,
          mood: parsed.entities.mood,
          displayContext: parsed.displayContext,
        },
      };
      await redisSet(cacheKey, JSON.stringify(result), 1800);
      res.json(result);
    } catch {
      res.json({ suggestions: [] });
    }
  },
);

// GET /api/search/top — Trending searches
router.get("/top", async (_req: any, res: Response): Promise<void> => {
  try {
    const top = await getTopSearches();
    res.json({ trending: top });
  } catch {
    res.json({ trending: [] });
  }
});

// GET /api/search/smart — Overlay search with full context + pagination
router.get(
  "/smart",
  rateLimiter(60, 60000),
  async (req: any, res: Response): Promise<void> => {
    try {
      const q = req.query.q as string;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      if (!q || q.trim().length < 2) {
        res.status(400).json({ error: "Query must be at least 2 characters" });
        return;
      }

      const cacheKey = `smart:${q.toLowerCase().replace(/\s+/g, "_")}:p${page}:l${limit}`;
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          res.json(JSON.parse(cached));
          return;
        } catch {}
      }

      // Fire all in parallel (direct = no throttle queue)
      const [searchResult, albums, artists] = await Promise.all([
        enhancedSearch(q, "all", limit * page + 10),
        searchAlbumsDirect(q, 6).catch(() => []),
        searchArtistsDirect(q, 6).catch(() => []),
      ]);

      const allSongs = searchResult.songs;
      const start = (page - 1) * limit;
      const pageSongs = allSongs.slice(start, start + limit);
      const hasMore = allSongs.length > start + limit;

      // Related searches: extract artist/mood context
      const parsed = searchResult.parsedIntent;
      const relatedSearches: string[] = [];
      if (parsed.entities.artist) {
        relatedSearches.push(
          `Best of ${parsed.entities.artist}`,
          `${parsed.entities.artist} latest`,
        );
      }
      if (parsed.entities.mood) {
        relatedSearches.push(
          `${parsed.entities.mood} songs`,
          `${parsed.entities.mood} playlist`,
        );
      }
      if (parsed.entities.language && parsed.entities.language !== "hindi") {
        relatedSearches.push(`${parsed.entities.language} hits`);
      }

      const result = {
        query: q,
        page,
        limit,
        hasMore,
        total: allSongs.length,
        topResult: page === 1 ? searchResult.topResult : null,
        songs: pageSongs,
        albums: page === 1 ? (albums as any[]) : [],
        artists: page === 1 ? (artists as any[]) : [],
        parsedIntent: {
          intent: parsed.intent,
          artist: parsed.entities.artist,
          mood: parsed.entities.mood,
          language: parsed.entities.language,
          displayContext: searchResult.displayContext,
        },
        relatedSearches: relatedSearches.slice(0, 4),
        matchReason: searchResult.displayContext,
      };

      // Cache for 30 min (shorter than full search)
      await redisSet(cacheKey, JSON.stringify(result), 1800);
      res.json(result);
    } catch (err) {
      console.error("[Search] Smart error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  },
);

// GET /api/search/related — Related songs for queue auto-fill
router.get(
  "/related",
  rateLimiter(30, 60000),
  async (req: any, res: Response): Promise<void> => {
    try {
      const {
        songId,
        page = "1",
        limit = "50",
      } = req.query as Record<string, string>;
      if (!songId) {
        res.status(400).json({ error: "songId required" });
        return;
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(parseInt(limit), 100);
      const cacheKey = `related:${songId}:p${pageNum}:l${limitNum}`;
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          res.json(JSON.parse(cached));
          return;
        } catch {}
      }

      // 5-layer strategy: recommendations + related artist tracks
      const songs = (await getSuggestions(songId, limitNum).catch(
        () => [],
      )) as any[];

      const start = (pageNum - 1) * limitNum;
      const pageSongs = songs.slice(start, start + limitNum);

      const result = {
        songs: pageSongs,
        total: songs.length,
        page: pageNum,
        hasMore: songs.length > start + limitNum,
      };
      await redisSet(cacheKey, JSON.stringify(result), 3600);
      res.json(result);
    } catch (err) {
      console.error("[Search] Related error:", err);
      res.status(500).json({ error: "Failed to get related songs" });
    }
  },
);

// GET /api/search/stream — SSE streaming search
// Sends a `partial` event (~400 ms TTFB) when the first JioSaavn query
// resolves, then a `complete` event once all queries + albums/artists finish.
// Cache hits are returned as a single `complete` event instantly.
router.get(
  "/stream",
  rateLimiter(30, 60000),
  async (req: any, res: Response): Promise<void> => {
    // Set SSE headers before any async work so the client sees the stream
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // prevent nginx buffering
    res.flushHeaders();

    let active = true;
    req.on("close", () => {
      active = false;
    });

    const sendEvent = (event: string, data: object) => {
      if (!active || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const q = req.query.q as string;
    if (!q || q.trim().length < 2) {
      sendEvent("error", { message: "Query required" });
      res.end();
      return;
    }

    try {
      // ── Cache hit → single complete event, no partial needed ──────────
      const ck = normalizeSearchKey(q);
      const cached = await redisGet(`smart:${ck}:p1:l20`);
      if (cached && active) {
        try {
          sendEvent("complete", { ...JSON.parse(cached), fromCache: true });
          res.end();
          return;
        } catch {
          /* corrupted cache entry — fall through to fresh fetch */
        }
      }

      if (!active) {
        res.end();
        return;
      }

      // ── Live fetch: all queries fire in TRUE parallel ─────────────────
      const parsed = parseQuery(q);
      const queries = parsed.expandedQueries.slice(0, 3);

      const allSongs: JioSaavnSong[] = [];
      const seen = new Set<string>();

      const addSongs = (songs: JioSaavnSong[]) => {
        for (const s of songs) {
          if (s?.id && !seen.has(s.id)) {
            seen.add(s.id);
            allSongs.push(s);
          }
        }
      };

      const computeScored = () =>
        allSongs
          .map((s) => scoreSong(s, parsed))
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .filter((s) => s.relevanceScore >= 5);

      let partialSent = false;

      // Kick off all song queries simultaneously — no throttle queue
      const songPromises = queries.map((pq) => searchSongsDirect(pq, 20));

      // Send `partial` as soon as ANY query resolves (≈ 400 ms TTFB)
      songPromises.forEach((p) => {
        p.then((result) => {
          if (!active) return;
          addSongs(result.results);
          if (!partialSent && allSongs.length > 0) {
            partialSent = true;
            const scored = computeScored().slice(0, 10);
            sendEvent("partial", {
              songs: scored,
              total: scored.length,
              phase: "partial",
            });
          }
        }).catch(() => {});
      });

      // Collect everything
      const settled = await Promise.allSettled(songPromises);
      if (!active) {
        res.end();
        return;
      }
      for (const r of settled) {
        if (r.status === "fulfilled") addSongs(r.value.results);
      }

      // Albums + artists in parallel (also direct, no queue)
      const [albums, artists] = await Promise.all([
        searchAlbumsDirect(q, 6).catch(() => []),
        searchArtistsDirect(q, 6).catch(() => []),
      ]);

      if (!active) {
        res.end();
        return;
      }

      const finalScored = computeScored().slice(0, 25);
      const topResult =
        finalScored.length > 0 && finalScored[0].relevanceScore > 70
          ? finalScored[0]
          : null;

      const relatedSearches: string[] = [];
      if (parsed.entities.artist) {
        relatedSearches.push(
          `Best of ${parsed.entities.artist}`,
          `${parsed.entities.artist} latest`,
        );
      }
      if (parsed.entities.mood) {
        relatedSearches.push(
          `${parsed.entities.mood} songs`,
          `${parsed.entities.mood} playlist`,
        );
      }

      const completeData = {
        query: q,
        page: 1,
        limit: 20,
        hasMore: finalScored.length > 20,
        total: finalScored.length,
        topResult,
        songs: finalScored.slice(0, 20),
        albums: (albums as any[]) || [],
        artists: (artists as any[]) || [],
        parsedIntent: {
          intent: parsed.intent,
          artist: parsed.entities.artist,
          mood: parsed.entities.mood,
          language: parsed.entities.language,
          displayContext: parsed.displayContext,
        },
        relatedSearches: relatedSearches.slice(0, 4),
        matchReason: parsed.displayContext,
      };

      // Cache 30 min so next visit is instant
      redisSet(`smart:${ck}:p1:l20`, JSON.stringify(completeData), 1800).catch(
        () => {},
      );

      sendEvent("complete", completeData);
      res.end();
    } catch (err) {
      console.error("[Search] Stream error:", err);
      sendEvent("error", { message: "Search failed" });
      res.end();
    }
  },
);

export default router;
