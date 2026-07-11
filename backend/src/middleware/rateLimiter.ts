import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function rateLimiter(maxRequests = 60, windowMs = 60000) {
  const store = new Map<string, RateLimitEntry>();

  // Cleanup every 5 minutes
  const intervalId = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 300000);

  // Prevent holding process open
  if (intervalId.unref) {
    intervalId.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV !== "production") {
      next();
      return;
    }
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ error: "Too many requests. Please slow down." });
      return;
    }

    entry.count++;
    next();
  };
}
