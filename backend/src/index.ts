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
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);
app.use(
  cors({
    origin: FRONTEND_URL,
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
  });
}

start().catch(console.error);
