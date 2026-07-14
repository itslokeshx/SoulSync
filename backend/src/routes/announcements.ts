// ════════════════════════════════════════════════════════════════
// ANNOUNCEMENT ROUTES
// ════════════════════════════════════════════════════════════════

import { Router, Request, Response } from "express";
import { AnnouncementService } from "../services/announcementService.js";
import { adminAuthMiddleware } from "../middleware/adminAuth.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";

const router = Router();

// POST /api/announcements/version/seen
// Update the user's last seen what's new version
router.post("/version/seen", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { version } = req.body;
    const userId = req.userId as string;

    if (!version) {
      res.status(400).json({ error: "version is required" });
      return;
    }

    const success = await AnnouncementService.markWhatsNewSeen(userId, version);
    if (!success) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Announcements] Version seen error:", err);
    res.status(500).json({ error: "Failed to update seen version" });
  }
});

// POST /api/announcements/:id/seen
// Mark an announcement as seen for the logged-in user
router.post("/:id/seen", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.userId as string;

    const success = await AnnouncementService.markAnnouncementSeen(userId, id);
    if (!success) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Announcements] Seen error:", err);
    res.status(500).json({ error: "Failed to mark announcement as seen" });
  }
});

// GET /api/announcements/active
// Returns active, non-expired announcements sorted by priority and creation date
router.get("/active", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  try {
    const activeList = await AnnouncementService.getActiveAnnouncements();

    // If authenticated, fetch user's seen status
    if (req.userId) {
      const userState = await AnnouncementService.getAnnouncementStateForUser(req.userId, activeList);
      if (userState) {
        res.json(userState);
        return;
      }
    }

    res.json({ announcements: activeList });
  } catch (err) {
    console.error("[Announcements] Active fetch error:", err);
    res.status(500).json({ error: "Failed to fetch active announcements" });
  }
});

// GET /api/admin/announcements
// Returns all announcements (active or inactive) for dashboard/management
router.get("/admin", adminAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const all = await AnnouncementService.getAllAnnouncements();
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

    const created = await AnnouncementService.createAnnouncement({
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
    const id = req.params.id as string;
    const updates = req.body;

    // Remove immutable fields if present in body
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    if (updates.expiresAt) {
      updates.expiresAt = new Date(updates.expiresAt);
    }

    const updated = await AnnouncementService.updateAnnouncement(id, updates);
    if (!updated) {
      res.status(404).json({ error: "Announcement not found." });
      return;
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
    const id = req.params.id as string;
    const deleted = await AnnouncementService.deleteAnnouncement(id);
    if (!deleted) {
      res.status(404).json({ error: "Announcement not found." });
      return;
    }

    res.json({ success: true, message: "Announcement deleted successfully." });
  } catch (err) {
    console.error("[Announcements Admin] Delete error:", err);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

export default router;
