import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { buildDashboard } from "../services/dashboardEngine.js";
import { User } from "../models/User.js";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// GET /api/dashboard — Personalized dashboard
router.get(
  "/",
  rateLimiter(300, 60000),
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.userId).select("name").lean();
      const userName = (user as any)?.name || "there";

      const dashboard = await buildDashboard(req.userId!, userName);
      res.json(dashboard);
    } catch (err) {
      console.error("[Dashboard] Error:", err);
      res.status(500).json({ error: "Failed to build dashboard" });
    }
  },
);

// GET /api/dashboard/guest — For unauthenticated users
router.get(
  "/guest",
  rateLimiter(200, 60000),
  async (_req: any, res: Response): Promise<void> => {
    try {
      const dashboard = await buildDashboard("guest", "there");
      res.json(dashboard);
    } catch (err) {
      console.error("[Dashboard] Guest error:", err);
      res.status(500).json({ error: "Failed to build dashboard" });
    }
  },
);

export default router;
