// ════════════════════════════════════════════════════════════════
// RADIO ROUTES
// POST /api/radio/start — starts a radio session from a seed song
// POST /api/radio/next  — gets next batch for periodic radio re-seeding
// ════════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import { fetchSongById } from "../services/jiosaavn.js";
import { getNextRecommendations } from "../services/recommendationEngine.js";
import { recordRecentlyRecommended } from "../services/scoringUtils.js";
import { User } from "../models/User.js";

const router = Router();

router.post(
  "/start",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      const { seedSongId } = req.body;
      if (!seedSongId) {
        res.status(400).json({ error: "seedSongId is required" });
        return;
      }

      const seedSong = await fetchSongById(seedSongId);
      if (!seedSong) {
        res.status(404).json({ error: "Seed song not found" });
        return;
      }

      const user = req.userId ? await User.findById(req.userId).select("preferences").lean() : null;
      const recommendations = await getNextRecommendations(seedSongId, req.userId, [seedSongId], user?.preferences);

      const filteredRecommendations = recommendations.filter((s) => s.id !== seedSongId);

      if (req.userId && filteredRecommendations.length > 0) {
        recordRecentlyRecommended(
          req.userId,
          filteredRecommendations.map((s) => s.id),
          "up_next",
        ).catch(() => {});
      }

      res.json({
        songs: [seedSong, ...filteredRecommendations],
      });
    } catch (err) {
      console.error("[Radio] Start radio error:", err);
      res.status(500).json({ error: "Failed to start radio session" });
    }
  },
);

router.post(
  "/next",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      const { currentSongId, excludeIds } = req.body;
      if (!currentSongId) {
        res.status(400).json({ error: "currentSongId is required" });
        return;
      }

      const excludes = Array.isArray(excludeIds) ? excludeIds : [];
      const user = req.userId ? await User.findById(req.userId).select("preferences").lean() : null;
      const recommendations = await getNextRecommendations(currentSongId, req.userId, excludes, user?.preferences);

      if (req.userId && recommendations.length > 0) {
        recordRecentlyRecommended(
          req.userId,
          recommendations.map((s) => s.id),
          "up_next",
        ).catch(() => {});
      }

      res.json({
        songs: recommendations,
      });
    } catch (err) {
      console.error("[Radio] Next radio error:", err);
      res.status(500).json({ error: "Failed to get next radio songs" });
    }
  },
);

export default router;
