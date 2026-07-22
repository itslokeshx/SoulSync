import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { adminAuthMiddleware, AdminAuthRequest } from "../middleware/adminAuth.js";
import { FeedbackService } from "../services/feedbackService.js";

const router = Router();

// Password gate verification. Returns a signed JWT token on success.
router.post(
  "/login",
  rateLimiter(5, 60000),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { password } = req.body;

      const secret = process.env.ADMIN_SECRET;
      if (!secret) {
        res.status(500).json({ error: "ADMIN_SECRET is not configured on the server." });
        return;
      }

      if (password !== secret) {
        res.status(401).json({ error: "Invalid admin password." });
        return;
      }

      const jwtSecret = process.env.ADMIN_JWT_SECRET;
      if (!jwtSecret) {
        res.status(500).json({ error: "ADMIN_JWT_SECRET is not configured on the server." });
        return;
      }

      // Issue token with 24 hour expiry
      const token = jwt.sign({ isAdmin: true }, jwtSecret, { expiresIn: "24h" });

      // Set cookie
      res.cookie("soulsync_admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({ success: true, token });
    } catch (err) {
      console.error("[Admin Auth] Login error:", err);
      res.status(500).json({ error: "An unexpected error occurred during login." });
    }
  }
);

// Clears the admin token cookie
router.post("/logout", (_req: Request, res: Response): void => {
  res.clearCookie("soulsync_admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN FEEDBACK MANAGEMENT (Mounted at /api/admin/feedback)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/feedback", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { status, category, search, sort } = req.query;
    const feedbackList = await FeedbackService.getFeedbackList({
      status: status as string,
      category: category as string,
      search: search as string,
      sort: sort as string,
    });
    res.json({ feedback: feedbackList });
  } catch (err) {
    console.error("[Admin] GET feedback error:", err);
    res.status(500).json({ error: "Failed to fetch feedback." });
  }
});

router.post("/feedback/:id/reply", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { reply } = req.body;

    if (!reply || typeof reply !== "string" || !reply.trim()) {
      res.status(400).json({ error: "Reply text is required." });
      return;
    }

    if (reply.length > 2000) {
      res.status(400).json({ error: "Reply text must not exceed 2000 characters." });
      return;
    }

    const adminIdentifier = (req as any).admin?.username || "SoulSync Support";
    const updated = await FeedbackService.replyToFeedback(id, reply.trim(), adminIdentifier);

    if (!updated) {
      res.status(404).json({ error: "Feedback item not found." });
      return;
    }

    res.json({ success: true, feedback: updated });
  } catch (err) {
    console.error("[Admin] POST reply error:", err);
    res.status(500).json({ error: "Failed to send reply." });
  }
});

router.put("/feedback/:id/reply", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { reply } = req.body;

    if (!reply || typeof reply !== "string" || !reply.trim()) {
      res.status(400).json({ error: "Reply text is required." });
      return;
    }

    if (reply.length > 2000) {
      res.status(400).json({ error: "Reply text must not exceed 2000 characters." });
      return;
    }

    const adminIdentifier = (req as any).admin?.username || "SoulSync Support";
    const updated = await FeedbackService.editReply(id, reply.trim(), adminIdentifier);

    if (!updated) {
      res.status(404).json({ error: "Feedback item not found." });
      return;
    }

    res.json({ success: true, feedback: updated });
  } catch (err) {
    console.error("[Admin] PUT reply error:", err);
    res.status(500).json({ error: "Failed to edit reply." });
  }
});

router.delete("/feedback/:id/reply", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const adminIdentifier = (req as any).admin?.username || "SoulSync Support";

    const updated = await FeedbackService.deleteReply(id, adminIdentifier);

    if (!updated) {
      res.status(404).json({ error: "Feedback item not found." });
      return;
    }

    res.json({ success: true, message: "Reply deleted successfully.", feedback: updated });
  } catch (err) {
    console.error("[Admin] DELETE reply error:", err);
    res.status(500).json({ error: "Failed to delete reply." });
  }
});

router.patch("/feedback/:id/close", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const adminIdentifier = (req as any).admin?.username || "SoulSync Support";

    const updated = await FeedbackService.closeFeedback(id, adminIdentifier);

    if (!updated) {
      res.status(404).json({ error: "Feedback item not found." });
      return;
    }

    res.json({ success: true, feedback: updated });
  } catch (err) {
    console.error("[Admin] PATCH close error:", err);
    res.status(500).json({ error: "Failed to close feedback." });
  }
});

export default router;
