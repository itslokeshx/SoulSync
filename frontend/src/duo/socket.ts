import { io, Socket } from "socket.io-client";
import { getNativeToken } from "../api/backend";

const BACKEND_URL =
  import.meta.env.VITE_DUO_BACKEND ||
  "https://soulsync-backend-a5fs.onrender.com";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    console.log("[DuoSocket] Creating socket →", BACKEND_URL || "(same origin)");
    socket = io(BACKEND_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
      transports: ["polling", "websocket"],
      upgrade: true,
      rememberUpgrade: true,
      auth: () => {
        const token = getNativeToken();
        return token ? { token } : {};
      },
    });

    socket.on("connect", () => {
      const transport = (socket as any)?.io?.engine?.transport?.name ?? "?";
      console.log("[DuoSocket] ✅ Connected:", socket?.id, "via", transport);
    });

    socket.on("disconnect", (reason) => {
      console.log("[DuoSocket] ❌ Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[DuoSocket] ⚠ Connection error:", err.message);
    });

    socket.io.on("reconnect_attempt", (n) =>
      console.log("[DuoSocket] Reconnect attempt", n),
    );
    socket.io.on("reconnect", (n) =>
      console.log("[DuoSocket] Reconnected after", n, "attempts"),
    );
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected && !s.active) {
    console.log("[DuoSocket] Connecting…");
    s.connect();
  }
  return s;
}

/**
 * Returns the socket once connected.
 * Resolves immediately if already connected, otherwise waits.
 */
export function waitForConnection(): Promise<Socket> {
  const s = connectSocket();
  if (s.connected) return Promise.resolve(s);
  return new Promise<Socket>((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve(s);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      s.off("connect", onConnect);
      s.off("connect_error", onError);
    };
    s.once("connect", onConnect);
    s.once("connect_error", onError);
  });
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
