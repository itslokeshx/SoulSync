import { Router, Request, Response } from "express";
import { resolveLosslessSource } from "../services/losslessSource.js";

const router = Router();

router.get("/stream", async (req: Request, res: Response): Promise<void> => {
  const title = String(req.query.title || "").trim();
  const artist = String(req.query.artist || "").trim();

  if (!title || !artist) {
    res.status(400).json({ error: "Title and artist parameters are required", streamUrl: null });
    return;
  }

  try {
    const result = await resolveLosslessSource(title, artist);
    if (result && result.streamUrl) {
      res.json({
        success: true,
        streamUrl: result.streamUrl,
        quality: result.quality,
        sourceName: result.sourceName,
      });
      return;
    }
    res.json({ success: false, streamUrl: null, quality: null });
  } catch (err) {
    res.json({ success: false, streamUrl: null, quality: null });
  }
});

export default router;
