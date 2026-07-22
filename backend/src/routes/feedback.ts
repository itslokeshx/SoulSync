import { Router, Response } from "express";
import { FeedbackService } from "../services/feedbackService.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { adminAuthMiddleware, AdminAuthRequest } from "../middleware/adminAuth.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// USER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/feedback — Submit feedback
router.post("/", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  try {
    const { message, category, appVersion, platform } = req.body;

    if (!message || !category || !appVersion || !platform) {
      res.status(400).json({ error: "message, category, appVersion, and platform are required fields." });
      return;
    }

    if (!["bug", "suggestion", "other"].includes(category)) {
      res.status(400).json({ error: "Invalid feedback category." });
      return;
    }

    if (!["web", "android", "desktop"].includes(platform)) {
      res.status(400).json({ error: "Invalid platform value." });
      return;
    }

    const isAnonymous = !req.userId;

    const created = await FeedbackService.createFeedback({
      message,
      category,
      userId: req.userId || undefined,
      isAnonymous,
      appVersion,
      platform,
    });

    res.status(201).json({ success: true, feedback: created });
  } catch (err) {
    console.error("[Feedback] Submit error:", err);
    res.status(500).json({ error: "Failed to submit feedback." });
  }
});

// GET /api/feedback/history — Get logged-in user's feedback history & replies
router.get("/history", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.json({ history: [] });
      return;
    }
    const history = await FeedbackService.getUserFeedbackHistory(req.userId);
    res.json({ success: true, history });
  } catch (err) {
    console.error("[Feedback User] History fetch error:", err);
    res.status(500).json({ error: "Failed to fetch feedback history." });
  }
});

// PATCH /api/feedback/:id/read — Mark reply as read by user
router.patch("/:id/read", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    if (!req.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const updated = await FeedbackService.markReplySeen(id, req.userId);
    if (!updated) {
      res.status(404).json({ error: "Feedback not found." });
      return;
    }

    res.json({ success: true, feedback: updated });
  } catch (err) {
    console.error("[Feedback User] Mark read error:", err);
    res.status(500).json({ error: "Failed to mark feedback reply as read." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/feedback/admin & /api/admin/feedback — View all feedback with search, filter, sort
const handleAdminGetList = async (req: AdminAuthRequest, res: Response): Promise<void> => {
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
    console.error("[Feedback Admin] Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch feedback list." });
  }
};

router.get("/admin", adminAuthMiddleware, handleAdminGetList);

// POST /api/feedback/admin/:id/reply — Send reply to feedback
const handleAdminReply = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { reply } = req.body;

    if (!reply || typeof reply !== "string" || !reply.trim()) {
      res.status(400).json({ error: "Reply text is required." });
      return;
    }

    if (reply.length > 2000) {
      res.status(400).json({ error: "Reply must not exceed 2000 characters." });
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
    console.error("[Feedback Admin] Reply error:", err);
    res.status(500).json({ error: "Failed to send reply." });
  }
};

router.post("/admin/:id/reply", adminAuthMiddleware, handleAdminReply);

// PUT /api/feedback/admin/:id/reply — Edit existing reply
const handleAdminEditReply = async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { reply } = req.body;

    if (!reply || typeof reply !== "string" || !reply.trim()) {
      res.status(400).json({ error: "Reply text is required." });
      return;
    }

    if (reply.length > 2000) {
      res.status(400).json({ error: "Reply must not exceed 2000 characters." });
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
    console.error("[Feedback Admin] Edit reply error:", err);
    res.status(500).json({ error: "Failed to edit reply." });
  }
};

router.put("/admin/:id/reply", adminAuthMiddleware, handleAdminEditReply);

// DELETE /api/feedback/admin/:id/reply — Delete admin reply
const handleAdminDeleteReply = async (req: AdminAuthRequest, res: Response): Promise<void> => {
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
    console.error("[Feedback Admin] Delete reply error:", err);
    res.status(500).json({ error: "Failed to delete reply." });
  }
};

router.delete("/admin/:id/reply", adminAuthMiddleware, handleAdminDeleteReply);

// PATCH /api/feedback/admin/:id/close — Close feedback item
const handleAdminClose = async (req: AdminAuthRequest, res: Response): Promise<void> => {
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
    console.error("[Feedback Admin] Close error:", err);
    res.status(500).json({ error: "Failed to close feedback." });
  }
};

router.patch("/admin/:id/close", adminAuthMiddleware, handleAdminClose);

// PATCH /api/feedback/admin/:id — Update feedback status directly
router.patch("/admin/:id", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: "Valid status is required." });
      return;
    }

    const updated = await FeedbackService.updateStatus(id, status);

    if (!updated) {
      res.status(404).json({ error: "Feedback item not found." });
      return;
    }

    res.json({ success: true, feedback: updated });
  } catch (err) {
    console.error("[Feedback Admin] Status patch error:", err);
    res.status(500).json({ error: "Failed to update feedback status." });
  }
});

// DELETE /api/feedback/admin/:id — Delete feedback permanently
router.delete("/admin/:id", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const deleted = await FeedbackService.deleteFeedback(id);

    if (!deleted) {
      res.status(404).json({ error: "Feedback item not found." });
      return;
    }

    res.json({ success: true, message: "Feedback deleted successfully." });
  } catch (err) {
    console.error("[Feedback Admin] Delete error:", err);
    res.status(500).json({ error: "Failed to delete feedback." });
  }
});

export default router;
