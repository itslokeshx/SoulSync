// ════════════════════════════════════════════════════════════════
// ANNOUNCEMENT ROUTES
// ════════════════════════════════════════════════════════════════

import { Router, Request, Response } from "express";
import { Announcement } from "../models/Announcement.js";
import { adminAuthMiddleware } from "../middleware/adminAuth.js";
import { redisGet, redisSet, redisDel } from "../services/redis.js";

const router = Router();

// GET /api/announcements/active
// Returns active, non-expired announcements sorted by priority and creation date
router.get("/active", async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = "announcements:active";
    try {
      const cached = await redisGet(cacheKey);
      if (cached) {
        res.json(JSON.parse(cached));
        return;
      }
    } catch (err) {
      console.warn("[Announcements] Redis get error:", err);
    }

    const now = new Date();
    const activeList = await Announcement.find({
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    }).sort({ priority: -1, createdAt: -1 });

    const responseData = { announcements: activeList };

    try {
      await redisSet(cacheKey, JSON.stringify(responseData), 3600); // 1 hour cache
    } catch (err) {
      console.warn("[Announcements] Redis set error:", err);
    }

    res.json(responseData);
  } catch (err) {
    console.error("[Announcements] Active fetch error:", err);
    res.status(500).json({ error: "Failed to fetch active announcements" });
  }
});

// GET /api/admin/announcements
// Returns all announcements (active or inactive) for dashboard/management
router.get("/admin", adminAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const all = await Announcement.find({}).sort({ createdAt: -1 });
    res.json({ announcements: all });
  } catch (err) {
    console.error("[Announcements Admin] Fetch all error:", err);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

// POST /api/admin/announcements
// Create a new announcement
router.post("/admin", adminAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      type,
      title,
      body,
      version,
      ctaText,
      ctaRoute,
      imageUrl,
      active,
      priority,
      expiresAt,
    } = req.body;

    if (!type || !title || !body) {
      res.status(400).json({ error: "type, title, and body are required." });
      return;
    }

    if (type === "whats_new" && !version) {
      res.status(400).json({ error: "version is required for 'whats_new' announcement type." });
      return;
    }

    const created = await Announcement.create({
      type,
      title,
      body,
      version,
      ctaText,
      ctaRoute,
      imageUrl,
      active: active !== undefined ? active : true,
      priority: Number(priority) || 0,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    try {
      await redisDel("announcements:active");
    } catch (err) {
      console.warn("[Announcements Admin] Redis del error:", err);
    }

    res.status(201).json({ success: true, announcement: created });
  } catch (err) {
    console.error("[Announcements Admin] Create error:", err);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

// PATCH /api/admin/announcements/:id
// Update/deactivate an existing announcement
router.patch("/admin/:id", adminAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove immutable fields if present in body
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    if (updates.expiresAt) {
      updates.expiresAt = new Date(updates.expiresAt);
    }

    const updated = await Announcement.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) {
      res.status(404).json({ error: "Announcement not found." });
      return;
    }

    try {
      await redisDel("announcements:active");
    } catch (err) {
      console.warn("[Announcements Admin] Redis del error:", err);
    }

    res.json({ success: true, announcement: updated });
  } catch (err) {
    console.error("[Announcements Admin] Patch error:", err);
    res.status(500).json({ error: "Failed to update announcement" });
  }
});

// DELETE /api/announcements/admin/:id
// Delete an announcement permanently
router.delete("/admin/:id", adminAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await Announcement.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ error: "Announcement not found." });
      return;
    }

    try {
      await redisDel("announcements:active");
    } catch (err) {
      console.warn("[Announcements Admin] Redis del error:", err);
    }

    res.json({ success: true, message: "Announcement deleted successfully." });
  } catch (err) {
    console.error("[Announcements Admin] Delete error:", err);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
