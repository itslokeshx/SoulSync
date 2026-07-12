// ════════════════════════════════════════════════════════════════
// RECOMMENDATION ROUTES
// GET /api/recommendations/home   — auth required
// GET /api/recommendations/next   — soft auth (popularity fallback for guests)
// ════════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import {
  getHomeRecommendations,
  getNextRecommendations,
  getTasteProfile,
  getTasteProfileBatch,
} from "../services/recommendationEngine.js";
import { getSuggestions, normalizeSongsToCanonical } from "../services/jiosaavn.js";

const router = Router();

// GET /api/recommendations/home — Personalized home feed recs
router.get(
  "/home",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const songs = await getHomeRecommendations(req.userId!);
      res.json({
        songs,
        total: songs.length,
        source: "personalized",
      });
    } catch (err) {
      console.error("[Recommendations] Home error:", err);
      res.status(500).json({ error: "Failed to get recommendations", songs: [] });
    }
  },
);

// GET /api/recommendations/next?currentSongId=...
// Soft auth: authenticated users get taste-aware recs,
// guests get popularity-filtered JioSaavn suggestions.
router.get(
  "/next",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      const currentSongId = req.query.currentSongId as string;
      if (!currentSongId) {
        res.status(400).json({ error: "currentSongId query param required" });
        return;
      }

      const excludeIdsRaw = req.query.excludeIds as string;
      const excludeIds = excludeIdsRaw ? excludeIdsRaw.split(",") : [];

      if (req.userId) {
        // Authenticated: full taste-aware recommendations
        const songs = await getNextRecommendations(currentSongId, req.userId, excludeIds);
        res.json({
          songs,
          total: songs.length,
          hasMore: songs.length >= 10,
          source: "personalized",
        });
      } else {
        // Guest: JioSaavn suggestions with basic normalization (no taste data)
        const songs = await getNextRecommendations(currentSongId, undefined, excludeIds);
        res.json({
          songs,
          total: songs.length,
          hasMore: songs.length >= 10,
          source: "popular",
        });
      }
    } catch (err) {
      console.error("[Recommendations] Next error:", err);
      // Fallback: raw JioSaavn suggestions
      try {
        const raw = await getSuggestions(req.query.currentSongId as string, 20);
        const songs = normalizeSongsToCanonical(raw);
        res.json({ songs, total: songs.length, hasMore: false, source: "fallback" });
      } catch {
        res.status(500).json({ error: "Failed to get recommendations", songs: [] });
      }
    }
  },
);

// POST /api/recommendations/feed/more — Paginated Made For You candidates
router.post(
  "/feed/more",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      const excludeIds = Array.isArray(req.body.excludeIds) ? req.body.excludeIds : [];
      const limit = typeof req.body.limit === "number" ? req.body.limit : 20;

      const tasteProfile = req.userId ? await getTasteProfile(req.userId) : null;
      const songs = await getTasteProfileBatch(tasteProfile, excludeIds, limit);

      res.json({
        songs,
        hasMore: songs.length >= limit,
      });
    } catch (err) {
      console.error("[Recommendations] feed/more error:", err);
      res.status(500).json({ error: "Failed to load more recommendations", songs: [] });
    }
  },
);

export default router;
