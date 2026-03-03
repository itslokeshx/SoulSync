// ─────────────────────────────────────────────────────────────────────────────
// REST Routes — Session management
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from "express";
import { roomService } from "../services/roomService.js";

const router = Router();

/**
 * POST /api/session/create
 * Body: { hostName: string }
 * → { code, room }
 */
router.post("/create", async (req, res) => {
  try {
    const { hostName } = req.body;
    if (!hostName || typeof hostName !== "string" || !hostName.trim()) {
      return res.status(400).json({ error: "hostName is required" });
    }
    const { code, room } = await roomService.create(hostName.trim(), null);
    res.json({ code, room });
  } catch (err) {
    console.error("[session/create]", err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

/**
 * POST /api/session/join
 * Body: { code: string, guestName: string }
 * → { room }
 */
router.post("/join", async (req, res) => {
  try {
    const { code, guestName } = req.body;
    if (!code || !guestName?.trim()) {
      return res.status(400).json({ error: "code and guestName are required" });
    }
    const result = await roomService.join(
      code.toUpperCase(),
      guestName.trim(),
      null,
    );
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }
    res.json({ room: result.room });
  } catch (err) {
    console.error("[session/join]", err);
    res.status(500).json({ error: "Failed to join session" });
  }
});

/**
 * GET /api/session/:code
 * → { room }
 */
router.get("/:code", async (req, res) => {
  try {
    const room = await roomService.get(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json({ room });
  } catch (err) {
    console.error("[session/get]", err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

/**
 * DELETE /api/session/:code
 */
router.delete("/:code", async (req, res) => {
  try {
    await roomService.remove(req.params.code.toUpperCase());
    res.json({ ok: true });
  } catch (err) {
    console.error("[session/delete]", err);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
