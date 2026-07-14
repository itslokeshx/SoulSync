import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { rateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Password gate verification. Returns a signed JWT token on success.
// Rate limited to 5 attempts per minute.
router.post(
  "/login",
  rateLimiter(5, 60000),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { password } = req.body;

      const secret = process.env.ADMIN_SECRET;
      if (!secret) {
        res.status(500).json({ error: "ADMIN_SECRET is not configured on the server." });
        return;
      }

      if (password !== secret) {
        res.status(401).json({ error: "Invalid admin password." });
        return;
      }

      const jwtSecret = process.env.ADMIN_JWT_SECRET;
      if (!jwtSecret) {
        res.status(500).json({ error: "ADMIN_JWT_SECRET is not configured on the server." });
        return;
      }

      // Issue token with 24 hour expiry
      const token = jwt.sign({ isAdmin: true }, jwtSecret, { expiresIn: "24h" });

      // Set cookie
      res.cookie("soulsync_admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({ success: true, token });
    } catch (err) {
      console.error("[Admin Auth] Login error:", err);
      res.status(500).json({ error: "An unexpected error occurred during login." });
    }
  }
);

// Clears the admin token cookie
router.post("/logout", (req: Request, res: Response): void => {
  res.clearCookie("soulsync_admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.json({ success: true });
});

export default router;
