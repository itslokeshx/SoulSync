import { Router, Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";

const router = Router();

// Base URL for the Python Music Provider microservice
const MUSIC_PROVIDER_URL = process.env.MUSIC_PROVIDER_URL || "http://127.0.0.1:4002";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "";

/**
 * Helper to proxy HTTP requests to the Python microservice.
 */
async function proxyToMusicProvider(req: Request, res: Response, targetPath: string) {
  try {
    const url = `${MUSIC_PROVIDER_URL}${targetPath}`;
    
    // Pass along query parameters and attach service token header for inter-service auth
    const headers: Record<string, string> = {};
    if (SERVICE_TOKEN) {
      headers["X-Service-Token"] = SERVICE_TOKEN;
    }

    const response = await axios({
      method: req.method,
      url,
      params: req.query,
      data: req.body,
      headers,
      timeout: 5000,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    const err = error as AxiosError;
    console.error(`[MusicProvider Proxy Error] Path: ${targetPath} | Message:`, err.message);
    
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(502).json({
        error: "Bad Gateway",
        message: "Failed to communicate with music provider service",
      });
    }
  }
}

// Route all music discovery and ytmusicapi requests to the Python microservice
router.all("/*", softAuth, async (req: SoftAuthRequest, res: Response) => {
  const targetPath = req.originalUrl.split("?")[0]; // e.g. /api/music/search
  await proxyToMusicProvider(req, res, targetPath);
});

export default router;
