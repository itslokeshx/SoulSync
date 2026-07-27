import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { getDailyMix } from "../services/dailyMixService.js";

const router = Router();

router.get("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId || "guest";
    const forcedDate = req.query.date as string | undefined;
    const result = await getDailyMix(userId, forcedDate);
    res.json({
      success: true,
      dateStr: result.dateStr,
      songs: result.songs,
      isCached: result.isCached,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate daily mix", songs: [] });
  }
});

export default router;
