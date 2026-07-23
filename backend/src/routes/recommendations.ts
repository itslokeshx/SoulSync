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
import { recordRecentlyRecommended } from "../services/scoringUtils.js";
import { User } from "../models/User.js";

const router = Router();

// GET /api/recommendations/home — Personalized home feed recs
router.get(
  "/home",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.userId).select("preferences").lean();
      const songs = await getHomeRecommendations(req.userId!, user?.preferences);

      if (req.userId && songs.length > 0) {
        recordRecentlyRecommended(
          req.userId,
          songs.map((s) => s.id),
          "made_for_you",
        ).catch(() => {});
      }

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
        const user = await User.findById(req.userId).select("preferences").lean();
        const songs = await getNextRecommendations(currentSongId, req.userId, excludeIds, user?.preferences);

        if (songs.length > 0) {
          recordRecentlyRecommended(
            req.userId,
            songs.map((s) => s.id),
            "up_next",
          ).catch(() => {});
        }

        res.json({
          songs,
          total: songs.length,
          hasMore: songs.length >= 10,
          source: "personalized",
        });
      } else {
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
      const user = req.userId ? await User.findById(req.userId).select("preferences").lean() : null;
      const songs = await getTasteProfileBatch(tasteProfile, excludeIds, limit, user?.preferences, req.userId);

      if (req.userId && songs.length > 0) {
        recordRecentlyRecommended(
          req.userId,
          songs.map((s) => s.id),
          "made_for_you",
        ).catch(() => {});
      }

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
