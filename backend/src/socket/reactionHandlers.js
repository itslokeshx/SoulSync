// ─────────────────────────────────────────────────────────────────────────────
// Socket.io — Message (Chat) handler
// ─────────────────────────────────────────────────────────────────────────────
import { roomService } from "../services/roomService.js";

export function registerReactionHandlers(io, socket) {
  // ── duo:message ──
  // { text: "Hey, this song is amazing!" }
  socket.on("duo:message", async ({ text }) => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = await roomService.get(code);
    const msg = {
      text,
      from: socket.data.role,
      fromName: socket.data.name,
      at: Date.now(),
    };

    if (room) {
      const messages = room.messages || [];
      messages.push(msg);
      await roomService.update(code, { messages: messages.slice(-500) });
    }

    // Send to partner only (sender adds locally)
    socket.to(code).emit("duo:receive-message", msg);
  });
}
