// ─────────────────────────────────────────────────────────────────────────────
// Saavn Duo — Backend Entry Point
// Express + Socket.io + Redis (Upstash / in-memory fallback)
// ─────────────────────────────────────────────────────────────────────────────
import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";

import sessionRoutes from "./routes/session.js";
import { initSocket } from "./socket/index.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { redis } from "./services/redis.js";

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ── Express ──
const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(rateLimiter);

// Health check
app.get("/", (_req, res) => res.json({ status: "ok", redis: redis.mode }));
app.get("/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() }),
);

// REST routes
app.use("/api/session", sessionRoutes);

// ── HTTP + Socket.io ──
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10_000,
  pingTimeout: 5_000,
});

initSocket(io);

// ── Start ──
httpServer.listen(PORT, () => {
  console.log(`\n🎵 Saavn Duo backend running on http://localhost:${PORT}`);
  console.log(`   Redis mode: ${redis.mode}`);
  console.log(`   CORS origin: ${FRONTEND_URL}\n`);
});
