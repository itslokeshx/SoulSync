import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import winston from "winston";
import { connectMongoDB } from "./services/mongodb.js";
import { initializeSocket } from "./socket/index.js";
import authRoutes from "./routes/auth.js";
import searchRoutes from "./routes/search.js";
import playlistRoutes from "./routes/playlist.js";
import userRoutes from "./routes/user.js";
import aiRoutes from "./routes/ai.js";
import sessionRoutes from "./routes/session.js";
import dashboardRoutes from "./routes/dashboard.js";
import importRoutes from "./routes/import.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { enhancedSearch } from "./services/searchEnhancer.js";

// Logger
export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  ],
});

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = (
  process.env.FRONTEND_URL || "http://localhost:5173"
).replace(/\/+$/, "");

// Middleware
app.use((_req, res, next) => {
  // Fix Google OAuth COOP issue — must be before cors()
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false, // disabled — interferes with postMessage & Vite HMR
  }),
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      const isAllowed =
        origin === "https://localhost" ||
        origin === "capacitor://localhost" ||
        origin === "http://localhost" ||
        origin === FRONTEND_URL ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /\.vercel\.app$/.test(origin);

      if (isAllowed) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
// React StrictMode in dev mounts every component twice, triggering 4-6 requests
// per page navigation.  Use a generous limit in dev so you never hit the ceiling
// during normal work; production keeps the tight security limit.
const RATE_LIMIT = process.env.NODE_ENV === "production" ? 300 : 1000;
app.use(rateLimiter(RATE_LIMIT, 60000));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/user", userRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/import", importRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Keep-alive self-ping to prevent Render free-tier sleep ───────────────
function startKeepAlive() {
  const raw = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
  if (!raw) {
    logger.info("[KeepAlive] No RENDER_EXTERNAL_URL set — skipping self-ping");
    return;
  }
  // render.yaml property:host gives bare hostname without scheme — add it
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  const url = `${base.replace(/\/+$/, "")}/health`;
  const INTERVAL = 13 * 60 * 1000; // every 13 minutes (Render sleeps after 15)

  setInterval(async () => {
    try {
      const res = await fetch(url);
      logger.info(`[KeepAlive] Pinged ${url} → ${res.status}`);
    } catch (err) {
      logger.warn(`[KeepAlive] Ping failed: ${(err as Error).message}`);
    }
  }, INTERVAL);

  logger.info(`[KeepAlive] Self-ping active every 13 min → ${url}`);
}

// Initialize Socket.io
initializeSocket(httpServer);

// Connect to MongoDB and start server
const PORT = parseInt(process.env.PORT || "4000", 10);

async function start() {
  await connectMongoDB();

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 SoulSync Backend running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Frontend: ${FRONTEND_URL}\n`);

    // Start keep-alive after server boots
    startKeepAlive();

    // Warm the top 20 search queries 10s after boot so first real users
    // get instant cached results instead of a cold-start wait.
    const WARM_QUERIES = [
      "arijit singh",
      "ar rahman",
      "anirudh ravichander",
      "shreya ghoshal",
      "diljit dosanjh",
      "ap dhillon",
      "atif aslam",
      "badshah",
      "trending songs 2024",
      "bollywood hits",
      "punjabi songs",
      "sad songs",
      "party songs",
      "chill lofi songs",
      "romantic songs",
      "tamil hits",
      "telugu songs",
      "english hits 2024",
      "gym workout songs",
      "devotional songs",
    ];
    setTimeout(async () => {
      logger.info("[CacheWarm] Starting background search cache warm-up…");
      for (const q of WARM_QUERIES) {
        try {
          await enhancedSearch(q, "all", 20);
          await new Promise((r) => setTimeout(r, 400)); // gentle pacing
        } catch {
          // Non-fatal – silently skip
        }
      }
      logger.info("[CacheWarm] Done warming search cache.");
    }, 10_000);
  });
}

start().catch(console.error);
