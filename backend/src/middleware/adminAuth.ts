import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AdminAuthRequest extends Request {
  isAdmin?: boolean;
}

export function adminAuthMiddleware(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction,
): void {
  // Check cookie or authorization header
  let token = req.cookies?.soulsync_admin_token;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    res.status(401).json({ error: "Admin access required. Please login." });
    return;
  }

  try {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: "ADMIN_JWT_SECRET is not configured on the server." });
      return;
    }

    const decoded = jwt.verify(token, secret) as { isAdmin: boolean };
    if (!decoded.isAdmin) {
      res.status(403).json({ error: "Forbidden. Admin privileges required." });
      return;
    }

    req.isAdmin = true;
    next();
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === "TokenExpiredError") {
      res.status(401).json({ error: "Admin session expired. Please login again." });
      return;
    }
    res.status(401).json({ error: "Invalid admin token." });
  }
}
