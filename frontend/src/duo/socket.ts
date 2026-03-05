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
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
      // polling first — reliable HTTP transport that works through any middleware.
      // Upgrades to websocket automatically after handshake.
      transports: ["polling", "websocket"],
      upgrade: true,
      // MUST use the callback pattern — Socket.IO ignores the return value!
      auth: (cb) => {
        const token = getNativeToken();
        cb(token ? { token } : {});
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
      console.warn("[DuoSocket] ❌ Connection error:", err.message);
    });

    // Manager-level reconnect events (not available on Socket)
    socket.io.on("reconnect_attempt", (attempt) => {
      console.log("[DuoSocket] 🔄 Reconnect attempt", attempt);
    });

    socket.io.on("reconnect", (attempt) => {
      console.log("[DuoSocket] ✅ Reconnected after", attempt, "attempts");
    });

    socket.io.on("error", (err) => {
      console.warn("[DuoSocket] ❌ Manager error:", err.message);
    });
  }
  return socket;
}

/**
 * Connect the socket and return a Promise that resolves once connected.
 * If already connected, resolves immediately.
 */
export function waitForConnection(timeoutMs = 15_000): Promise<Socket> {
  const s = getSocket();
  if (s.connected) {
    console.log("[DuoSocket] Already connected:", s.id);
    return Promise.resolve(s);
  }

  // Always call connect() — even if active (might be stuck in reconnection)
  console.log(
    "[DuoSocket] Connecting… (connected:",
    s.connected,
    "active:",
    s.active,
    ")",
  );
  s.connect();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off("connect", onConnect);
      console.warn(
        "[DuoSocket] Connection timed out after",
        timeoutMs / 1000,
        "s — socket will keep retrying in background",
      );
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

const DUO_EVENTS = [
  "duo:partner-joined",
  "duo:partner-disconnected",
  "duo:partner-reconnected",
  "duo:partner-active",
  "duo:session-state",
  "duo:receive-play",
  "duo:receive-pause",
  "duo:receive-seek",
  "duo:receive-song-change",
  "duo:receive-message",
  "duo:session-ended",
  "duo:error",
] as const;

/**
 * Fully destroy the socket singleton.
 * ONLY call when the session is intentionally ended.
 */
export function disconnectSocket(): void {
  if (socket) {
    for (const ev of DUO_EVENTS) socket.removeAllListeners(ev);
    socket.disconnect();
    socket = null;
  }
}
