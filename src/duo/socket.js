// ─────────────────────────────────────────────────────────────────────────────
// Socket.io Client — connects to the Duo backend
// ─────────────────────────────────────────────────────────────────────────────
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_DUO_BACKEND || "http://localhost:4000";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10_000,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}
