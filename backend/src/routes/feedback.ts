import { Router, Request, Response } from "express";
import { Feedback } from "../models/Feedback.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import { adminAuthMiddleware, AdminAuthRequest } from "../middleware/adminAuth.js";

const router = Router();

// POST /api/feedback
// Public endpoint for submitting user feedback (logged-in or anonymous guest)
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

    const created = await Feedback.create({
      message,
      category,
      userId: req.userId || undefined,
      isAnonymous,
      appVersion,
      platform,
      status: "new",
    });

    res.status(201).json({ success: true, feedback: created });
  } catch (err) {
    console.error("[Feedback] Submit error:", err);
    res.status(500).json({ error: "Failed to submit feedback." });
  }
});

// GET /api/admin/feedback
// Admin endpoint to view feedback list with optional filters
router.get("/admin", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { status, category } = req.query;
    const filter: any = {};

    if (status && ["new", "seen", "resolved", "wontfix"].includes(status as string)) {
      filter.status = status;
    }

    if (category && ["bug", "suggestion", "other"].includes(category as string)) {
      filter.category = category;
    }

    const feedbackList = await Feedback.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "name email") // optional: populate submitter user details if logged in
      .lean();

    res.json({ feedback: feedbackList });
  } catch (err) {
    console.error("[Feedback Admin] Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch feedback." });
  }
});

// PATCH /api/admin/feedback/:id
// Admin endpoint to update feedback status
router.patch("/admin/:id", adminAuthMiddleware, async (req: AdminAuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["new", "seen", "resolved", "wontfix"].includes(status)) {
      res.status(400).json({ error: "Valid status is required." });
      return;
    }

    const updated = await Feedback.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

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

export default router;
