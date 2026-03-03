// ─────────────────────────────────────────────────────────────────────────────
// Socket.io Server — Initialisation
// ─────────────────────────────────────────────────────────────────────────────
import { registerRoomHandlers } from "./roomHandlers.js";
import { registerReactionHandlers } from "./reactionHandlers.js";

/**
 * Attach all Socket.io handlers to the io instance.
 * @param {import("socket.io").Server} io
 */
export function initSocket(io) {
  io.on("connection", (socket) => {
    console.log(`⚡ Socket connected: ${socket.id}`);
    registerRoomHandlers(io, socket);
    registerReactionHandlers(io, socket);
  });
}
