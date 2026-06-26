import { Router, Response } from "express";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import {
  getRecommendations,
  SongMeta,
} from "../services/recommendationEngine.js";

const router = Router();

// POST /api/recommendations
router.post(
  "/",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      const song = req.body?.song as SongMeta | undefined;
      const excludeIds = Array.isArray(req.body?.excludeIds)
        ? req.body.excludeIds.map((id: unknown) => String(id))
        : [];

      if (!song?.id) {
        res.status(400).json({ error: "Song id required" });
        return;
      }

      const songs = await getRecommendations(song, excludeIds);
      res.json({ songs });
    } catch {
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  },
);

export default router;
