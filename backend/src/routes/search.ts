import { Router, Response } from "express";
import { parseIntent } from "../services/intentParser.js";
import {
  executeSearch,
  getSuggestions,
  getTopSearches,
  searchSongsDirect,
  markUserQueryStart,
  markUserQueryEnd,
  getArtistDetails,
  getArtistSongs,
  getAlbumDetails,
  getAlbumSongs,
  getSongDetails
} from "../services/jiosaavn.js";

const router = Router();

// GET /api/search/smart — Smart enhanced search with intelligent parser (No Cache)
router.get("/smart", async (req: any, res: Response): Promise<void> => {
  const { q } = req.query as { q: string };

  if (!q || q.trim().length < 1) {
    res.status(400).json({ error: "Query required" });
    return;
  }

  try {
    markUserQueryStart();
    const intent = parseIntent(q);
    const result = await executeSearch(intent);
    res.json(result);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed", songs: [], albums: [], artists: [] });
  } finally {
    markUserQueryEnd();
  }
});

// GET /api/search/related — Related songs
router.get("/related", async (req: any, res: Response): Promise<void> => {
  try {
    markUserQueryStart();
    const songId = req.query.songId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    if (!songId) {
      res.status(400).json({ error: "Song ID required" });
      return;
    }

    const suggestions = await getSuggestions(songId, limit);
    res.json({ songId, limit, total: suggestions.length, songs: suggestions });
  } catch (err) {
    console.error("[Search] Related songs error:", err);
    res.status(500).json({ error: "Failed to fetch related songs" });
  } finally {
    markUserQueryEnd();
  }
});

// GET /api/search/suggestions — Autocomplete
router.get("/suggestions", async (req: any, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim().length < 2) {
      const top = await getTopSearches();
      res.json({ suggestions: top.map((t: any) => t.title || t.name) });
      return;
    }

    const results = await searchSongsDirect(q, 8);
    const suggestions = Array.from(new Set(results.flatMap((s: any) => [s.name, s.primaryArtists || s.artist]))).slice(0, 10);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

// Artist Endpoints (Restored to fix 404s)
router.get("/song", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const song = await getSongDetails(id as string);
    res.json(song);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch song" });
  }
});

// GET /api/search/stream-url — Resolve fresh stream URL for a song ID
// Used by the frontend when a liked/playlist song has an expired CDN URL
router.get("/stream-url", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const song = await getSongDetails(id as string);
    if (!song) return res.status(404).json({ error: "Song not found" });

    // Extract all download URLs from the response
    const songData = Array.isArray(song) ? song[0] : song;
    const downloadUrl = songData?.downloadUrl || [];

    // Find the best available URL (highest quality)
    let streamUrl: string | null = null;
    const qualities = ["320kbps", "160kbps", "96kbps", "48kbps", "12kbps"];
    for (const q of qualities) {
      const entry = downloadUrl.find((u: any) => u.quality === q);
      const url = entry?.url || entry?.link;
      if (url && url !== "null" && url !== "") {
        streamUrl = url.replace(/&amp;/g, "&");
        break;
      }
    }
    // Fallback to last entry
    if (!streamUrl && downloadUrl.length > 0) {
      const last = downloadUrl[downloadUrl.length - 1];
      streamUrl = (last?.url || last?.link || "").replace(/&amp;/g, "&");
    }

    res.json({ streamUrl, downloadUrl, song: songData });
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve stream URL" });
  }
});

router.get("/artist", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const artist = await getArtistDetails(id as string);
    res.json(artist);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artist" });
  }
});

router.get("/artist/songs", async (req: any, res: Response) => {
  const { id, page } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const songs = await getArtistSongs(id as string, parseInt(page as string) || 1);
    res.json(songs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch artist songs" });
  }
});

// Album Endpoints
router.get("/album", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const album = await getAlbumDetails(id as string);
    res.json(album);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch album" });
  }
});

router.get("/album/songs", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const songs = await getAlbumSongs(id as string);
    res.json(songs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch album songs" });
  }
});

export default router;
