import { Router, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:4000/api/auth/google/callback",
);

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

      // Return token in body too (for native APK which can't use cookies)
      res.json({ user, isNewUser, token: ourToken });
    } catch (err) {
      console.error("[Auth] Google login error:", err);
      res.status(401).json({ error: "Authentication failed" });
    }
  },
);

// ── Native APK: Google OAuth via redirect flow ──

// GET /api/auth/google/native — Redirect to Google consent screen
router.get("/google/native", (_req: AuthRequest, res: Response): void => {
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.BACKEND_URL || "http://localhost:4000"}/api/auth/google/callback`;
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    redirect_uri: redirectUri,
    prompt: "select_account",
  });
  res.redirect(url);
});

// GET /api/auth/google/callback — Google redirects here after consent
router.get(
  "/google/callback",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== "string") {
        res.status(400).send("Missing authorization code");
        return;
      }

      const redirectUri =
        process.env.GOOGLE_REDIRECT_URI ||
        `${process.env.BACKEND_URL || "http://localhost:4000"}/api/auth/google/callback`;
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri: redirectUri,
      });
      const idToken = tokens.id_token;
      if (!idToken) {
        res.status(400).send("Failed to get ID token from Google");
        return;
      }

      // Verify the ID token
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        res.status(401).send("Invalid Google token");
        return;
      }

      const { sub: googleId, email, name, picture } = payload;

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

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        res.status(500).send("Server config error");
        return;
      }

      const ourToken = jwt.sign(
        { userId: user._id.toString(), googleId: user.googleId },
        secret,
        { expiresIn: 7 * 24 * 60 * 60 },
      );

      // Redirect back to app with token via deep link
      const appScheme = "com.soulsync.app";
      res.redirect(
        `https://${appScheme}/auth-callback?token=${encodeURIComponent(ourToken)}&isNew=${!user.onboardingComplete}`,
      );
    } catch (err) {
      console.error("[Auth] Native Google callback error:", err);
      res.status(500).send(`
        <html><body style="background:#0a0a0a;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2>Login failed</h2>
            <p>Please close this tab and try again in the app.</p>
          </div>
        </body></html>
      `);
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
