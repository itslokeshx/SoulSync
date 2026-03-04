import { Router, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /api/auth/google — Login / register with Google
router.post(
  "/google",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        res.status(400).json({ error: "ID token required" });
        return;
      }

      // Verify Google ID token
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        res.status(401).json({ error: "Invalid Google token" });
        return;
      }

      const { sub: googleId, email, name, picture } = payload;

      // Upsert user
      const user = await User.findOneAndUpdate(
        { googleId },
        {
          $setOnInsert: {
            googleId,
            email,
            name,
            photoURL: picture,
            onboardingComplete: false,
            preferences: { languages: [], eras: [], moods: [] },
            likedSongs: [],
            totalListeningTime: 0,
          },
        },
        { upsert: true, new: true },
      );

      const isNewUser = !user.onboardingComplete;

      // Sign our own JWT
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        res.status(500).json({ error: "Server config error" });
        return;
      }

      const ourToken = jwt.sign(
        { userId: user._id.toString(), googleId: user.googleId },
        secret,
        { expiresIn: 7 * 24 * 60 * 60 },
      );

      // Set httpOnly cookie
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("saavn_token", ourToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ user, isNewUser });
    } catch (err) {
      console.error("[Auth] Google login error:", err);
      res.status(401).json({ error: "Authentication failed" });
    }
  },
);

// POST /api/auth/logout
router.post("/logout", (_req: AuthRequest, res: Response): void => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("saavn_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
  res.json({ success: true });
});

// GET /api/auth/me — Get current user
router.get(
  "/me",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.userId).select("-likedSongs");
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ user });
    } catch (err) {
      console.error("[Auth] Get me error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
