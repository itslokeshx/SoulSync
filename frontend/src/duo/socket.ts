import { io, Socket } from "socket.io-client";
import { getNativeToken } from "../api/backend";

const BACKEND_URL =
  import.meta.env.VITE_DUO_BACKEND ||
  "https://soulsync-backend-a5fs.onrender.com";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    console.log("[DuoSocket] Creating →", BACKEND_URL);
    socket = io(BACKEND_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
      // polling first — works through any proxy/CDN, then upgrades
      transports: ["polling", "websocket"],
      auth: () => {
        const token = getNativeToken();
        return token ? { token } : {};
      },
    });

    socket.on("connect", () => {
      console.log("[DuoSocket] ✅ Connected:", socket?.id);
    });
    socket.on("disconnect", (reason) => {
      console.log("[DuoSocket] ❌ Disconnected:", reason);
    });
    socket.on("connect_error", (err) => {
      console.warn("[DuoSocket] Connection error:", err.message);
    });
  }
  return socket;
}

/**
 * Ensure socket is connected (or connecting).
 * Socket.io automatically buffers emits until connected,
 * so callers can emit immediately after this returns.
 */
export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}
