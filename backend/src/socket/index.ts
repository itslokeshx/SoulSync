import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { setupRoomHandlers } from "./roomHandlers.js";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export function initializeSocket(httpServer: HttpServer): Server {
  const FRONTEND_URL = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");
  const io = new Server(httpServer, {
    // Start with polling then upgrade — matches client config
    transports: ["polling", "websocket"],
    allowUpgrades: true,
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          origin === "https://localhost" ||
          origin === "capacitor://localhost" ||
          origin === "http://localhost"
        )
          return callback(null, true);
        if (origin === FRONTEND_URL) return callback(null, true);
        if (/^http:\/\/localhost:\d+$/.test(origin))
          return callback(null, true);
        // Allow any Vercel preview / production deploy
        if (/\.vercel\.app$/.test(origin)) return callback(null, true);
        console.warn(`[Socket CORS] Blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Auth middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      // Allow unauthenticated connections for backward compat
      return next();
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret) as { userId: string };
        socket.userId = decoded.userId;
      }
    } catch {
      // Allow connection but without userId
    }
    next();
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    const transport = socket.conn.transport.name;
    console.log(`[Socket] ✅ Connected: ${socket.id} via ${transport} (userId: ${socket.userId || "anon"})`);
    setupRoomHandlers(io, socket);

    socket.conn.on("upgrade", (t: any) => {
      console.log(`[Socket] ⬆ Upgraded ${socket.id}: ${transport} → ${t.name}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] ❌ Disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}
