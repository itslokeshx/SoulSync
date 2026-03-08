import { Router, Response } from "express";
import { nanoid } from "nanoid";
import { DuoSession } from "../models/DuoSession.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";

const router = Router();

// POST /api/session/create
router.post(
  "/create",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { hostName } = req.body;
      const code = nanoid(6).toUpperCase();

      const session = await DuoSession.create({
        code,
        host: {
          userId: req.userId,
          name: hostName || "Host",
          socketId: null,
          connected: false,
        },
        guest: {
          userId: null,
          name: null,
          socketId: null,
          connected: false,
        },
      });

      res.status(201).json({ code: session.code, sessionId: session._id });
    } catch (err) {
      console.error("[Session] Create error:", err);
      res.status(500).json({ error: "Failed to create session" });
    }
  },
);

// POST /api/session/join
router.post("/join", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  try {
    const { code, guestName } = req.body;

    const session = await DuoSession.findOne({ code: code.toUpperCase() });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (session.guest.connected && session.guest.userId) {
      res.status(409).json({ error: "Session already has a partner" });
      return;
    }

    session.guest.userId = (req.userId || `guest_${nanoid(8)}`) as any;
    session.guest.name = guestName || "Guest";
    await session.save();

    res.json({ session });
  } catch (err) {
    console.error("[Session] Join error:", err);
    res.status(500).json({ error: "Failed to join session" });
  }
});

// GET /api/session/:code
router.get("/:code", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  try {
    const code = req.params.code as string;
    const session = await DuoSession.findOne({
      code: code.toUpperCase(),
    });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ session });
  } catch (err) {
    console.error("[Session] Get error:", err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;
