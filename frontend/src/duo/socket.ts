import { io, Socket } from "socket.io-client";
import { getNativeToken } from "../api/backend";

const BACKEND_URL =
  import.meta.env.VITE_DUO_BACKEND ||
  "https://soulsync-backend-a5fs.onrender.com";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
      // Start with polling (works reliably through any proxy/CDN),
      // then upgrade to websocket once the connection is established.
      transports: ["polling", "websocket"],
      upgrade: true,
      rememberUpgrade: true,
      auth: () => {
        const token = getNativeToken();
        return token ? { token } : {};
      },
    });

    // Auto-rejoin room on reconnect
    socket.on("connect", () => {
      console.log("[DuoSocket] Connected:", socket?.id);
      // Rejoin is handled in useDuo via the 'connect' event
    });

    socket.on("disconnect", (reason) => {
      console.log("[DuoSocket] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[DuoSocket] Connection error:", err.message);
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
