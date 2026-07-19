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
import mixesRoutes from "./routes/mixes.js";
import importRoutes from "./routes/import.js";
import recommendationRoutes from "./routes/recommendations.js";
import announcementRoutes from "./routes/announcements.js";
import radioRoutes from "./routes/radio.js";
import feedbackRoutes from "./routes/feedback.js";
import adminRoutes from "./routes/admin.js";
import musicProviderRoutes from "./routes/musicProvider.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { enhancedSearch } from "./services/searchEnhancer.js";
import { runJioSaavnMigration } from "./migrations/jiosaavnMigration.js";

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
        origin === "file://" ||
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
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-admin-secret"],
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
app.use("/api/mixes", mixesRoutes);
app.use("/api/import", importRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/radio", radioRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/music", musicProviderRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Keep-alive self-ping to prevent Render free-tier sleep ───────────────
function startKeepAlive() {
  const raw = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
  const musicProviderUrl = process.env.MUSIC_PROVIDER_URL;
  if (!raw) {
    logger.info("[KeepAlive] No RENDER_EXTERNAL_URL set — skipping self-ping");
    return;
  }
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  const url = `${base.replace(/\/+$/, "")}/health`;
  const INTERVAL = 13 * 60 * 1000;

  setInterval(async () => {
    try {
      const res = await fetch(url);
      logger.info(`[KeepAlive] Pinged ${url} → ${res.status}`);
    } catch (err) {
      logger.warn(`[KeepAlive] Ping failed: ${(err as Error).message}`);
    }

    if (musicProviderUrl) {
      try {
        const providerHealthUrl = `${musicProviderUrl.replace(/\/+$/, "")}/health`;
        const res = await fetch(providerHealthUrl);
        logger.info(`[KeepAlive] Pinged Music Provider ${providerHealthUrl} → ${res.status}`);
      } catch (err) {
        logger.warn(`[KeepAlive] Music Provider ping failed: ${(err as Error).message}`);
      }
    }
  }, INTERVAL);

  logger.info(`[KeepAlive] Self-ping active every 13 min → ${url}`);
  if (musicProviderUrl) {
    logger.info(`[KeepAlive] Music Provider ping active every 13 min → ${musicProviderUrl}/health`);
  }
}

// Initialize Socket.io
initializeSocket(httpServer);

// Connect to MongoDB and start server
const PORT = Number.parseInt(process.env.PORT || "4000", 10);

function handleListenError(error: NodeJS.ErrnoException) {
  if (error.code === "EADDRINUSE") {
    logger.error(
      `[Startup] Port ${PORT} is already in use. Stop the existing process or start this app with a different PORT value.`,
    );
    process.exit(1);
  }

  throw error;
}

async function start() {
  await connectMongoDB();
  runJioSaavnMigration().catch(console.error);

  httpServer.once("error", handleListenError);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 SoulSync Backend running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Frontend: ${FRONTEND_URL}`);
    // Start keep-alive after server boots
    startKeepAlive();

    // Warm the top 10 search queries 15s after boot so first real users
    // get instant cached results instead of a cold-start wait.
    const WARM_QUERIES = [
      "arijit singh",
      "ar rahman",
      "anirudh ravichander",
      "shreya ghoshal",
      "diljit dosanjh",
      "trending songs",
      "bollywood hits",
      "punjabi songs",
      "tamil hits",
      "telugu songs",
      "english hits",
    ];
    setTimeout(async () => {
      logger.info("[CacheWarm] Starting background search cache warm-up…");
      for (const q of WARM_QUERIES) {
        try {
          // "all" fans out into ~8 simultaneous sub-searches (songs, albums,
          // artists, playlists, podcasts, episodes, videos, general). Firing
          // that repeatedly at startup looks exactly like bot traffic to
          // YouTube and is a likely cause of IP-level blocking after every
          // redeploy. Warm only the "songs" filter people actually see
          // first, and pace much more gently between queries.
          await enhancedSearch(q, "songs", 20);
          await new Promise((r) => setTimeout(r, 4000)); // gentle pacing (4s delay)
        } catch {
          // Non-fatal – silently skip
        }
      }
      logger.info("[CacheWarm] Done warming search cache.");
    }, 20_000);
  });
}

start().catch(console.error);
