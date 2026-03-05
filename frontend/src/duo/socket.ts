import { io, Socket } from "socket.io-client";
import { getNativeToken } from "../api/backend";

const BACKEND =
  import.meta.env.VITE_DUO_BACKEND ||
  import.meta.env.VITE_BACKEND_URL ||
  "https://soulsync-backend-a5fs.onrender.com";

let socket: Socket | null = null;

/** Get or create the singleton socket (never auto-connects) */
export function getSocket(): Socket {
  if (!socket) {
    console.log("[DuoSocket] Creating socket →", BACKEND);
    socket = io(BACKEND, {
      autoConnect: false,
      transports: ["polling", "websocket"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20_000,
      auth: () => {
        const token = getNativeToken();
        return token ? { token } : {};
      },
    });

    socket.on("connect", () =>
      console.log("[DuoSocket] ✅ Connected:", socket?.id),
    );
    socket.on("disconnect", (r) =>
      console.log("[DuoSocket] ❌ Disconnected:", r),
    );
    socket.on("connect_error", (e) =>
      console.warn("[DuoSocket] Connection error:", e.message),
    );
  }
  return socket;
}

/**
 * Returns a Promise that resolves with the connected socket.
 * If already connected → resolves immediately.
 * Otherwise starts connecting and waits up to 15 s.
 * Does NOT reject on transient connect_error (socket.io retries internally).
 */
export function ensureConnected(): Promise<Socket> {
  const s = getSocket();
  if (s.connected) return Promise.resolve(s);

  return new Promise<Socket>((resolve, reject) => {
    // If socket is not active (was disconnected), start connecting
    if (!s.connected && !s.active) s.connect();

    const timer = setTimeout(() => {
      s.off("connect", onConnect);
      // Stop the reconnection loop so we don't leave a zombie socket
      s.disconnect();
      reject(new Error("Connection timed out — check your network"));
    }, 15_000);

    function onConnect() {
      clearTimeout(timer);
      resolve(s);
    }

    s.once("connect", onConnect);
  });
}

/**
 * Emit a socket event with an ack callback, wrapped in a Promise.
 * Ensures the socket is connected first.
 * Rejects on timeout (default 10 s).
 */
export async function emitAsync<T = any>(
  event: string,
  data: any,
  timeoutMs = 10_000,
): Promise<T> {
  const s = await ensureConnected();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Request timed out — try again"));
    }, timeoutMs);

    s.emit(event, data, (response: T) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

/** Disconnect the socket */
export function disconnectSocket(): void {
  socket?.disconnect();
}
