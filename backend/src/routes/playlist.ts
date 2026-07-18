import { Router, Response } from "express";
import { Playlist } from "../models/Playlist.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";

const router = Router();

// GET /api/playlists — All user playlists (without songs for speed)
router.get("/", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.json({ playlists: [] });
      return;
    }
    const playlists = await Playlist.find({ userId: req.userId })
      .select("-songs")
      .sort({ updatedAt: -1 });
    res.json({ playlists });
  } catch (err) {
    console.error("[Playlist] List error:", err);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

// POST /api/playlists — Create
router.post("/", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, isPublic, isAIGenerated, songs, tags } =
      req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: "Playlist name required" });
      return;
    }

    const playlist = await Playlist.create({
      userId: req.userId,
      name: name.trim(),
      description: description || "",
      isPublic: isPublic || false,
      isAIGenerated: isAIGenerated || false,
      songs: songs || [],
      tags: tags || [],
    });

    res.status(201).json({ playlist });
  } catch (err) {
    console.error("[Playlist] Create error:", err);
    res.status(500).json({ error: "Failed to create playlist" });
  }
});

// GET /api/playlists/:id — Single playlist with all songs
router.get("/:id", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);

  if (!isMongoId) {
    try {
      const { getPlaylistDetails, normalizeSongsToCanonical } = await import("../services/youtubeMusicService.js");
      const plData = await getPlaylistDetails(id);
      
      if (!plData) {
        res.status(404).json({ error: "Playlist not found" });
        return;
      }

      const rawTracks = plData.tracks || [];
      const normalizedTracks = normalizeSongsToCanonical(rawTracks);
      
      let coverImage = "";
      const thumbContents = plData.thumbnails || [];
      if (thumbContents.length > 0) {
        coverImage = thumbContents[0].url || coverImage;
      } else if (normalizedTracks.length > 0) {
        // Fallback to first track's image
        const firstImg = normalizedTracks[0].image;
        coverImage = Array.isArray(firstImg) && firstImg.length > 0 ? (firstImg[0].url || firstImg[0]) : (firstImg || "");
      }

      const playlist = {
        _id: id,
        name: plData.title || "YouTube Playlist",
        description: plData.description || "YouTube Music Playlist",
        coverImage,
        isPublic: true,
        isAIGenerated: false,
        songs: normalizedTracks.map((t: any) => ({
          songId: t.id,
          title: t.name,
          artist: t.primaryArtists || "Unknown Artist",
          album: t.album || "",
          albumArt: Array.isArray(t.image) && t.image.length > 0 ? (t.image[0].url || t.image[0]) : (t.image || ""),
          duration: t.duration || 0,
        }))
      };

      res.json({ playlist });
    } catch (err) {
      console.error("[Playlist] Failed to fetch external playlist:", err);
      res.status(500).json({ error: "Failed to fetch external playlist" });
    }
    return;
  }

  try {
    const playlist = await Playlist.findById(id);
    if (!playlist) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }

    // Allow anyone with the exact ID to view the playlist (Unlisted behavior)
    // We only restrict editing/deleting to the owner in the other endpoints.
    res.json({ playlist });
  } catch (err) {
    console.error("[Playlist] Get error:", err);
    res.status(500).json({ error: "Failed to fetch playlist" });
  }
});

// PATCH /api/playlists/:id — Update name/desc/public
router.patch("/:id", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!playlist) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }

    const { name, description, isPublic } = req.body;
    if (name !== undefined) playlist.name = name.trim();
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic;

    await playlist.save();
    res.json({ playlist });
  } catch (err) {
    console.error("[Playlist] Update error:", err);
    res.status(500).json({ error: "Failed to update playlist" });
  }
});

// DELETE /api/playlists/:id
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await Playlist.deleteOne({
        _id: req.params.id,
        userId: req.userId,
      });
      if (result.deletedCount === 0) {
        res.status(404).json({ error: "Playlist not found" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[Playlist] Delete error:", err);
      res.status(500).json({ error: "Failed to delete playlist" });
    }
  },
);

// POST /api/playlists/:id/songs — Add song
router.post(
  "/:id/songs",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const playlist = await Playlist.findOne({
        _id: req.params.id,
        userId: req.userId,
      });
      if (!playlist) {
        res.status(404).json({ error: "Playlist not found" });
        return;
      }

      const { song } = req.body;
      if (!song || !song.songId) {
        res.status(400).json({ error: "Song data required" });
        return;
      }

      // Avoid duplicates
      const exists = playlist.songs.some((s) => s.songId === song.songId);
      if (exists) {
        res.status(409).json({ error: "Song already in playlist" });
        return;
      }

      playlist.songs.push(song);
      await playlist.save();
      res.json({ playlist });
    } catch (err) {
      console.error("[Playlist] Add song error:", err);
      res.status(500).json({ error: "Failed to add song" });
    }
  },
);

// DELETE /api/playlists/:id/songs/:songId — Remove song
router.delete(
  "/:id/songs/:songId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const playlist = await Playlist.findOne({
        _id: req.params.id,
        userId: req.userId,
      });
      if (!playlist) {
        res.status(404).json({ error: "Playlist not found" });
        return;
      }

      playlist.songs = playlist.songs.filter(
        (s) => s.songId !== req.params.songId,
      );
      await playlist.save();
      res.json({ playlist });
    } catch (err) {
      console.error("[Playlist] Remove song error:", err);
      res.status(500).json({ error: "Failed to remove song" });
    }
  },
);

// PATCH /api/playlists/:id/reorder — Reorder songs
router.patch(
  "/:id/reorder",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const playlist = await Playlist.findOne({
        _id: req.params.id,
        userId: req.userId,
      });
      if (!playlist) {
        res.status(404).json({ error: "Playlist not found" });
        return;
      }

      const { songIds } = req.body;
      if (!Array.isArray(songIds)) {
        res.status(400).json({ error: "songIds array required" });
        return;
      }

      // Reorder based on songIds order
      const songMap = new Map(playlist.songs.map((s) => [s.songId, s]));
      const reordered = songIds
        .map((id: string) => songMap.get(id))
        .filter(Boolean);
      playlist.songs = reordered as any;
      await playlist.save();
      res.json({ playlist });
    } catch (err) {
      console.error("[Playlist] Reorder error:", err);
      res.status(500).json({ error: "Failed to reorder" });
    }
  },
);

export default router;
