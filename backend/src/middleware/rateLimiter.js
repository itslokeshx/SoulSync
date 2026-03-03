// ─────────────────────────────────────────────────────────────────────────────
// Simple in-memory rate limiter middleware
// ─────────────────────────────────────────────────────────────────────────────
const hits = new Map();
const WINDOW = 60_000; // 1 minute
const MAX = 60; // max requests per window

export function rateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = hits.get(ip);

  if (!record || now - record.start > WINDOW) {
    hits.set(ip, { start: now, count: 1 });
    return next();
  }

  record.count++;
  if (record.count > MAX) {
    return res.status(429).json({ error: "Too many requests" });
  }
  next();
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW;
  for (const [ip, rec] of hits) {
    if (rec.start < cutoff) hits.delete(ip);
  }
}, 300_000);
