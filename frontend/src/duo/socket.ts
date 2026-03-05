import { io, Socket } from "socket.io-client";
import { getNativeToken } from "../api/backend";

const BACKEND_URL =
  import.meta.env.VITE_DUO_BACKEND ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    console.log("[DuoSocket] Creating socket →", BACKEND_URL);
    socket = io(BACKEND_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
      // websocket first — bypasses Express middleware (helmet/cors/rate-limiter)
      // polling as fallback for restrictive networks
      transports: ["websocket", "polling"],
      auth: () => {
        const token = getNativeToken();
        return token ? { token } : {};
      },
    });

    socket.on("connect", () => {
      console.log(
        "[DuoSocket] ✅ Connected:",
        socket?.id,
        "transport:",
        socket?.io?.engine?.transport?.name,
      );
    });

    socket.on("disconnect", (reason) => {
      console.log("[DuoSocket] ❌ Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[DuoSocket] Connection error:", err.message);
    });

    socket.on("reconnect_attempt", (attempt) => {
      console.log("[DuoSocket] Reconnect attempt", attempt);
    });
  }
  return socket;
}

/**
 * Connect the socket and return a Promise that resolves once connected.
 * If already connected, resolves immediately.
 */
export function waitForConnection(timeoutMs = 10_000): Promise<Socket> {
  const s = getSocket();
  if (s.connected) return Promise.resolve(s);
  if (!s.active) s.connect();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off("connect", onConnect);
      // Stop reconnection attempts on timeout
      if (!s.connected) {
        s.disconnect();
      }
      reject(new Error("Socket connection timed out"));
    }, timeoutMs);

    function onConnect() {
      clearTimeout(timer);
      resolve(s);
    }
    s.once("connect", onConnect);
  });
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
