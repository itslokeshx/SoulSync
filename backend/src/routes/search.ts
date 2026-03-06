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
  markUserQueryStart,
  markUserQueryEnd,
  JioSaavnSong,
} from "../services/jiosaavn.js";

import { redisGet, redisSet } from "../services/redis.js";

const router = Router();

// GET /api/search — Smart enhanced search
router.get(
  "/",
  async (req: any, res: Response): Promise<void> => {
    try {
      const q = req.query.q as string;
      const type = (req.query.type as string) || "all";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

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
        } catch { }
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
  async (req: any, res: Response): Promise<void> => {
    const q = req.query.q as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    if (!q || q.trim().length < 2) {
      res.status(400).json({ error: "Query must be at least 2 characters" });
      return;
    }

    markUserQueryStart();
    try {
      const cacheKey = `smart:${normalizeSearchKey(q)}:p${page}:l${limit}`;
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          res.json(JSON.parse(cached));
          return;
        } catch { }
      }

      const [searchResult, albums, artists] = await Promise.all([
        enhancedSearch(q, "all", limit * page + 10),
        searchAlbumsDirect(q, 6).catch(() => []),
        searchArtistsDirect(q, 6).catch(() => []),
      ]);

      const allSongs = searchResult.songs;
      const start = (page - 1) * limit;
      const pageSongs = allSongs.slice(start, start + limit);
      const hasMore = allSongs.length > start + limit;

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

      await redisSet(cacheKey, JSON.stringify(result), 1800);
      res.json(result);
    } catch (err) {
      console.error("[Search] Smart error:", err);
      res.status(500).json({ error: "Search failed" });
    } finally {
      markUserQueryEnd();
    }
  },
);

// GET /api/search/related — Related songs for queue auto-fill
router.get(
  "/related",
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
        } catch { }
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
//
// Speed architecture:
//   t=0 ms   SSE opens.
//             ① songs query  → USER queue (900 ms gap, nothing else uses it)
//             ② album query  → BG  queue  (1200 ms gap, separate lane)
//             Both fire in true parallel.
//   t~900ms  Song results arrive → score → send `partial` event immediately.
//            User sees songs under 1 second for cold queries.
//   t~1200ms Album results arrive → send `complete` with songs + albums.
//   Cache hit → single `complete` event in < 5 ms.
router.get(
  "/stream",
  async (req: any, res: Response): Promise<void> => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
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

    markUserQueryStart();
    try {
      // ── Cache hit → instant complete ──────────────────────────────────
      const ck = normalizeSearchKey(q);
      const cached = await redisGet(`smart:${ck}:p1:l20`);
      if (cached && active) {
        try {
          sendEvent("complete", { ...JSON.parse(cached), fromCache: true });
          res.end();
          return;
        } catch {
          /* corrupted — fall through */
        }
      }
      if (!active) {
        res.end();
        return;
      }

      const parsed = parseQuery(q);
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

      const buildComplete = (albums: any[]) => {
        const scored = computeScored();
        const topResult =
          scored.length > 0 && scored[0].relevanceScore > 70 ? scored[0] : null;
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
        return {
          query: q,
          page: 1,
          limit: 50,
          hasMore: scored.length > 50,
          total: scored.length,
          topResult,
          songs: scored.slice(0, 50),
          albums,
          artists: [],
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
      };

      // ── Fire songs (user queue) + albums (bg queue) simultaneously ────
      // They run on independent throttle lanes so neither waits for the other.
      const albumsP = searchAlbumsDirect(q, 15).catch((): any[] => []);
      const primary = await searchSongsDirect(parsed.expandedQueries[0], 40);
      if (!active) {
        res.end();
        return;
      }
      addSongs(primary.results);

      // If completely empty, try one more query (rare edge case, accepts extra latency)
      if (computeScored().length === 0 && parsed.expandedQueries.length > 1) {
        const extra = await searchSongsDirect(parsed.expandedQueries[1], 15);
        if (active) addSongs(extra.results);
      }

      // ── Partial: songs visible NOW (under 1 second for most queries) ──
      const scoredPartial = computeScored();
      if (scoredPartial.length > 0 && active) {
        sendEvent("partial", {
          query: q,
          total: scoredPartial.length,
          songs: scoredPartial.slice(0, 50),
          hasMore: scoredPartial.length > 50,
        });
      }

      if (!active) {
        res.end();
        return;
      }

      // ── Albums were already in flight — should be done or nearly done ─
      const albums = (await albumsP) as any[];

      if (!active) {
        res.end();
        return;
      }

      const completeData = buildComplete(albums);
      redisSet(`smart:${ck}:p1:l50`, JSON.stringify(completeData), 1800).catch(
        () => { },
      );
      sendEvent("complete", completeData);
      res.end();
    } catch (err) {
      console.error("[Search] Stream error:", err);
      sendEvent("error", { message: "Search failed" });
      res.end();
    } finally {
      markUserQueryEnd();
    }
  },
);

export default router;
