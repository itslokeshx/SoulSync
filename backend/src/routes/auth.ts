import { Router, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { User } from "../models/User.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";

const router = Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:4000/api/auth/google/callback",
);

// ── Shared helpers ──────────────────────────────────────────────────────────

function signJwt(userId: string, extra?: Record<string, string>) {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign({ userId, ...extra }, secret, {
    expiresIn: 7 * 24 * 60 * 60,
  });
}

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER;
  res.cookie("saavn_token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  if (isProd) {
    console.log("[Auth] Setting secure cross-site cookie");
  }
}

// ── Validation schemas ──────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1).max(50),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores")
    .optional(),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[A-Z])(?=.*\d)/,
      "Must contain at least one uppercase letter and one number",
    ),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post(
  "/register",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          error: "Validation failed",
          details: parsed.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }

      const { name, email, password } = parsed.data;
      let username = parsed.data.username;

      // Auto-generate username from name if not provided
      if (!username) {
        const base =
          name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 20) || "user";
        const taken = await User.findOne({ username: base });
        username = taken
          ? `${base}${Math.floor(1000 + Math.random() * 9000)}`
          : base;
      }

      const [emailExists, usernameExists] = await Promise.all([
        User.findOne({ email: email.toLowerCase() }),
        parsed.data.username
          ? User.findOne({ username })
          : Promise.resolve(null),
      ]);

      if (emailExists) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      if (usernameExists) {
        res.status(409).json({ error: "Username taken" });
        return;
      }

      const user = await User.create({
        name,
        email: email.toLowerCase(),
        username,
        passwordHash: password, // pre-save hook hashes it
        authProvider: "local",
        isEmailVerified: false,
        onboardingComplete: false,
        preferences: { languages: [], eras: [], moods: [] },
        likedSongs: [],
        totalListeningTime: 0,
      });

      const token = signJwt(user._id.toString());
      setAuthCookie(res, token);

      res.status(201).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          username: user.username,
          photoURL: user.photoURL,
          onboardingComplete: user.onboardingComplete,
          authProvider: user.authProvider,
        },
        isNewUser: true,
        token,
        message: "Account created",
      });
    } catch (err) {
      console.error("[Auth] Register error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  },
);

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  "/login",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }

      const { identifier, password } = parsed.data;

      const user = await User.findOne({
        $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
      }).select("+passwordHash");

      if (!user) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      if (user.authProvider === "google" && !user.passwordHash) {
        res.status(401).json({
          error: "This account uses Google login. Sign in with Google instead.",
        });
        return;
      }

      if (!user.passwordHash) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const token = signJwt(user._id.toString());
      setAuthCookie(res, token);

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          username: user.username,
          photoURL: user.photoURL,
          onboardingComplete: user.onboardingComplete,
          authProvider: user.authProvider,
        },
        isNewUser: !user.onboardingComplete,
        token,
      });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  },
);

// ── GET /api/auth/check-username ────────────────────────────────────────────
router.get(
  "/check-username",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const u = (req.query.u as string)?.trim();
      if (!u || u.length < 3 || u.length > 30) {
        res.json({ available: false });
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(u)) {
        res.json({ available: false, reason: "Invalid characters" });
        return;
      }
      const exists = await User.findOne({ username: u });
      res.json({ available: !exists });
    } catch {
      res.json({ available: false });
    }
  },
);

// ── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post(
  "/forgot-password",
  async (req: AuthRequest, res: Response): Promise<void> => {
    // Always return 200 for security (don't reveal if email exists)
    const SAFE_RESPONSE = {
      message: "If that email exists, a reset link was sent",
    };
    try {
      const { email } = req.body;
      if (!email) {
        res.json(SAFE_RESPONSE);
        return;
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        res.json(SAFE_RESPONSE);
        return;
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      user.passwordResetToken = hashedToken;
      user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save({ validateBeforeSave: false });

      // Send email if configured
      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${rawToken}`;

      try {
        if (process.env.RESEND_API_KEY) {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: process.env.FROM_EMAIL || "noreply@soulsync.app",
            to: user.email,
            subject: "Reset your SoulSync password",
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0a0a0a;color:white;padding:32px;border-radius:16px">
                <h2 style="color:#1db954">Reset your password</h2>
                <p>Click the link below to reset your SoulSync password. It expires in 1 hour.</p>
                <a href="${resetUrl}" style="display:inline-block;background:#1db954;color:black;padding:12px 24px;border-radius:8px;font-weight:bold;text-decoration:none;margin:16px 0">Reset Password</a>
                <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>
              </div>
            `,
          });
        } else if (process.env.SMTP_HOST) {
          const nodemailer = await import("nodemailer");
          const transporter = nodemailer.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });
          await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: user.email,
            subject: "Reset your SoulSync password",
            html: `<p>Reset link: <a href="${resetUrl}">${resetUrl}</a> (expires in 1 hour)</p>`,
          });
        }
      } catch (emailErr) {
        console.error("[Auth] Email send failed:", emailErr);
        // Don't fail the request — just log
      }

      res.json(SAFE_RESPONSE);
    } catch (err) {
      console.error("[Auth] Forgot password error:", err);
      res.json(SAFE_RESPONSE); // Always safe response
    }
  },
);

// ── POST /api/auth/reset-password ───────────────────────────────────────────
router.post(
  "/reset-password",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        res.status(400).json({ error: "Token and new password required" });
        return;
      }

      const pwSchema = z
        .string()
        .min(8)
        .regex(/^(?=.*[A-Z])(?=.*\d)/);
      if (!pwSchema.safeParse(newPassword).success) {
        res.status(422).json({
          error:
            "Password must be at least 8 characters with one uppercase letter and one number",
        });
        return;
      }

      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpiry: { $gt: new Date() },
      });

      if (!user) {
        res.status(400).json({ error: "Invalid or expired reset token" });
        return;
      }

      user.passwordHash = newPassword; // pre-save hook hashes it
      user.passwordResetToken = undefined;
      user.passwordResetExpiry = undefined;
      if (user.authProvider === "google") user.authProvider = "both";
      await user.save();

      res.json({ message: "Password updated successfully" });
    } catch (err) {
      console.error("[Auth] Reset password error:", err);
      res.status(500).json({ error: "Reset failed" });
    }
  },
);

// ── POST /api/auth/google — Web OAuth (Google ID token) ─────────────────────
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

      // Upsert user - match by googleId first, then by email (in case they registered with email before)
      let user = await User.findOne({ googleId });
      if (!user) {
        user = (await User.findOneAndUpdate(
          { email: email?.toLowerCase() },
          {
            $set: { googleId, photoURL: picture, name: name || "User" },
            $setOnInsert: {
              email: email?.toLowerCase(),
              name: name || "User",
              authProvider: "both",
              onboardingComplete: false,
              preferences: { languages: [], eras: [], moods: [] },
              likedSongs: [],
              totalListeningTime: 0,
            },
          },
          { upsert: true, new: true },
        )) as any;
      } else if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }

      const isNewUser = !user!.onboardingComplete;
      const ourToken = signJwt(user!._id.toString());
      setAuthCookie(res, ourToken);

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
            authProvider: "google",
            photoURL: picture,
            onboardingComplete: false,
            preferences: { languages: [], eras: [], moods: [] },
            likedSongs: [],
            totalListeningTime: 0,
          },
        },
        { upsert: true, new: true },
      );

      const ourToken = signJwt(user._id.toString());

      // Redirect back to app via custom URL scheme deep link
      res.redirect(
        `soulsync://auth-callback?token=${encodeURIComponent(ourToken)}&isNew=${!user.onboardingComplete}`,
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
  const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER;
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
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.userId) {
        res.json({ user: null });
        return;
      }
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
