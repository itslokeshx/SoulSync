// ════════════════════════════════════════════════════════════════
// RADIO ROUTES
// POST /api/radio/start — starts a radio session from a seed song
// ════════════════════════════════════════════════════════════════

import { Router, Response } from "express";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import { fetchSongById } from "../services/jiosaavn.js";
import { getNextRecommendations } from "../services/recommendationEngine.js";

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

      // Fetch seed song metadata
      const seedSong = await fetchSongById(seedSongId);
      if (!seedSong) {
        res.status(404).json({ error: "Seed song not found" });
        return;
      }

      // Fetch next recommendations
      const recommendations = await getNextRecommendations(seedSongId, req.userId);

      // Filter out seed song from recommendations if present
      const filteredRecommendations = recommendations.filter((s) => s.id !== seedSongId);

      res.json({
        songs: [seedSong, ...filteredRecommendations],
      });
    } catch (err) {
      console.error("[Radio] Start radio error:", err);
      res.status(500).json({ error: "Failed to start radio session" });
    }
  },
);

export default router;
