import { Router, Response } from "express";
import { enhancedSearch, parseQuery } from "../services/searchEnhancer.js";
import {
  searchAlbums,
  searchArtists,
  getTopSearches,
  getSuggestions,
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

export default router;
