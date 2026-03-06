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
import { rateLimiter } from "./middleware/rateLimiter.js";


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
      // Allow Capacitor native WebView origins
      if (
        origin === "https://localhost" ||
        origin === "capacitor://localhost" ||
        origin === "http://localhost"
      ) {
        return callback(null, true);
      }
      // Allow configured frontend URL
      if (origin === FRONTEND_URL) return callback(null, true);
      // Allow localhost dev ports
      if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      // Allow any Vercel preview / production deploy
      if (/\.vercel\.app$/.test(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(rateLimiter(100, 60000));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/user", userRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Keep-alive self-ping to prevent Render free-tier sleep ───────────────
function startKeepAlive() {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
  if (!RENDER_URL) {
    logger.info("[KeepAlive] No RENDER_EXTERNAL_URL set — skipping self-ping");
    return;
  }
  const url = `${RENDER_URL.replace(/\/+$/, "")}/health`;
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


  });
}

start().catch(console.error);
