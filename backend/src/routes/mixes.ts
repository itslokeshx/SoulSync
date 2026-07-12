import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { getUserMixSet } from "../services/mixEngine.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// GET /api/mixes — Retrieve authenticated user's weekly mixes
router.get(
  "/",
  rateLimiter(300, 60000),
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const mixSet = await getUserMixSet(req.userId);
      res.json(mixSet);
    } catch (err) {
      console.error("[MixesRoute] Error fetching user mixes:", err);
      res.status(500).json({ error: "Failed to load weekly mixes" });
    }
  }
);

// GET /api/mixes/guest — Retrieve cold-start mix set for guests
router.get(
  "/guest",
  rateLimiter(200, 60000),
  async (_req: any, res: Response): Promise<void> => {
    try {
      const mixSet = await getUserMixSet("guest");
      res.json(mixSet);
    } catch (err) {
      console.error("[MixesRoute] Error fetching guest mixes:", err);
      res.status(500).json({ error: "Failed to load guest mixes" });
    }
  }
);

export default router;
