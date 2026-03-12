import { Router, Response } from "express";
import { User } from "../models/User.js";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import { redisDel } from "../services/redis.js";

const router = Router();

// GET /api/user/me — Current user profile
router.get(
  "/me",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ user });
    } catch (err) {
      console.error("[User] Get me error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// PATCH /api/user/preferences — Update preferences + mark onboarding complete
router.patch(
  "/preferences",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, languages, eras, moods } = req.body;

      const update: Record<string, unknown> = { onboardingComplete: true };
      if (name) update.name = name;
      if (languages) update["preferences.languages"] = languages;
      if (eras) update["preferences.eras"] = eras;
      if (moods) update["preferences.moods"] = moods;

      const user = await User.findByIdAndUpdate(
        req.userId,
        { $set: update },
        { new: true },
      );
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Clear cached dashboard so it rebuilds with new language prefs
      await redisDel(`dashboard:${req.userId}`).catch(() => {});

      res.json({ user });
    } catch (err) {
      console.error("[User] Update preferences error:", err);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  },
);

// POST /api/user/history — Log a play event
router.post(
  "/history",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.json({ success: true, guest: true });
        return;
      }

      const { songId, title, artist, albumArt, duration, source, language } =
        req.body;

      await ListeningHistory.create({
        userId: req.userId,
        songId,
        title,
        artist,
        albumArt,
        duration,
        language: language || "",
        source: source || "search",
      });

      // Update total listening time
      if (duration) {
        await User.findByIdAndUpdate(req.userId, {
          $inc: { totalListeningTime: duration },
        });
      }

      // Invalidate the dashboard cache so "Continue Listening" stays fresh
      await redisDel(`dashboard:${req.userId}`).catch(() => {});

      res.json({ success: true });
    } catch (err) {
      console.error("[User] History log error:", err);
      res.status(500).json({ error: "Failed to log history" });
    }
  },
);

// GET /api/user/history — Paginated history
router.get(
  "/history",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.json({ history: [], total: 0, page: 1, limit: 20 });
        return;
      }
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const page = parseInt(req.query.page as string) || 1;
      const skip = (page - 1) * limit;

      const history = await ListeningHistory.find({ userId: req.userId })
        .sort({ playedAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await ListeningHistory.countDocuments({
        userId: req.userId,
      });

      res.json({ history, total, page, limit });
    } catch (err) {
      console.error("[User] History get error:", err);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  },
);

// POST /api/user/liked — Like a song
router.post(
  "/liked",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { song } = req.body;
      if (!song || !song.songId) {
        res.status(400).json({ error: "Song data required" });
        return;
      }

      const user = await User.findById(req.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const exists = user.likedSongs.some((s) => s.songId === song.songId);
      if (!exists) {
        user.likedSongs.unshift(song);
        await user.save();
      }

      res.json({ success: true, likedCount: user.likedSongs.length });
    } catch (err) {
      console.error("[User] Like error:", err);
      res.status(500).json({ error: "Failed to like song" });
    }
  },
);

// POST /api/user/liked/shuffle — Persistent shuffle of liked songs
router.post(
  "/liked/shuffle",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.userId);
      if (!user || !user.likedSongs.length) {
        res.json({ success: true, likedCount: 0 });
        return;
      }

      // Fisher-Yates shuffle
      const songs = [...user.likedSongs];
      for (let i = songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songs[i], songs[j]] = [songs[j], songs[i]];
      }

      user.likedSongs = songs;
      await user.save();

      res.json({ success: true, likedCount: user.likedSongs.length });
    } catch (err) {
      console.error("[User] Shuffle error:", err);
      res.status(500).json({ error: "Failed to shuffle liked songs" });
    }
  },
);

// PATCH /api/user/liked/reorder — Reorder liked songs manually
router.patch(
  "/liked/reorder",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { songIds } = req.body;
      if (!Array.isArray(songIds)) {
        res.status(400).json({ error: "songIds array required" });
        return;
      }

      const user = await User.findById(req.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const songMap = new Map(user.likedSongs.map((s) => [s.songId, s]));
      const newOrder: any[] = [];
      for (const id of songIds) {
        const s = songMap.get(id);
        if (s) {
          newOrder.push(s);
          songMap.delete(id);
        }
      }
      // Keep any missing ones
      songMap.forEach((s) => newOrder.push(s));

      user.likedSongs = newOrder;
      await user.save();

      res.json({ success: true, likedCount: user.likedSongs.length });
    } catch (err) {
      console.error("[User] Reorder error:", err);
      res.status(500).json({ error: "Failed to reorder liked songs" });
    }
  },
);

// DELETE /api/user/liked/:songId — Unlike
router.delete(
  "/liked/:songId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const before = user.likedSongs.length;
      user.likedSongs = user.likedSongs.filter(
        (s) => s.songId !== req.params.songId,
      );

      if (user.likedSongs.length === before) {
        res.status(404).json({ error: "Song not found in liked songs" });
        return;
      }

      await user.save();
      res.json({ success: true, likedCount: user.likedSongs.length });
    } catch (err) {
      console.error("[User] Unlike error:", err);
      res.status(500).json({ error: "Failed to unlike song" });
    }
  },
);

// GET /api/user/liked — All liked songs
router.get(
  "/liked",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.json({ likedSongs: [] });
        return;
      }
      const user = await User.findById(req.userId).select("likedSongs");
      res.json({ likedSongs: user?.likedSongs || [] });
    } catch (err) {
      console.error("[User] Get liked error:", err);
      res.status(500).json({ error: "Failed to fetch liked songs" });
    }
  },
);

// GET /api/user/stats — Aggregated listening stats
router.get(
  "/stats",
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.json({
          totalSongsPlayed: 0,
          totalListeningTime: 0,
          likedSongsCount: 0,
          topArtists: [],
          languageBreakdown: [],
        });
        return;
      }
      const user = await User.findById(req.userId).select(
        "totalListeningTime likedSongs",
      );
      const totalPlayed = await ListeningHistory.countDocuments({
        userId: req.userId,
      });

      // Top artists — split comma-separated artist strings
      const topArtists = await ListeningHistory.aggregate([
        { $match: { userId: user?._id } },
        {
          $group: {
            _id: "$artist",
            count: { $sum: 1 },
            albumArt: { $first: "$albumArt" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

      // Language breakdown — only include entries that have a language
      const languageBreakdown = await ListeningHistory.aggregate([
        {
          $match: {
            userId: user?._id,
            language: { $exists: true, $ne: "" },
          },
        },
        { $group: { _id: "$language", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      res.json({
        totalSongsPlayed: totalPlayed,
        totalListeningTime: user?.totalListeningTime || 0,
        likedSongsCount: user?.likedSongs?.length || 0,
        topArtists,
        languageBreakdown,
      });
    } catch (err) {
      console.error("[User] Stats error:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  },
);

export default router;
