// ─────────────────────────────────────────────────────────────────────────────
// Socket.io — Reaction & Note handlers
// ─────────────────────────────────────────────────────────────────────────────
import { roomService } from "../services/roomService.js";

export function registerReactionHandlers(io, socket) {
  // ── duo:reaction ──
  // { emoji: "❤️", x: 0.3, y: 0.5 }  (x/y optional — position ratios for bubbles)
  socket.on("duo:reaction", async ({ emoji, x, y }) => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = await roomService.get(code);
    if (room) {
      const reactions = room.reactions || [];
      reactions.push({ emoji, from: socket.data.role, at: Date.now() });
      await roomService.update(code, { reactions: reactions.slice(-100) });
    }

    socket.to(code).emit("duo:receive-reaction", {
      emoji,
      x,
      y,
      from: socket.data.role,
    });
  });

  // ── duo:note ──
  // { text: "This part is 🔥" }
  socket.on("duo:note", async ({ text }) => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = await roomService.get(code);
    if (room) {
      const notes = room.notes || [];
      notes.push({
        text,
        from: socket.data.role,
        song: room.currentSong?.name || "",
        at: Date.now(),
      });
      await roomService.update(code, { notes: notes.slice(-200) });
    }

    socket.to(code).emit("duo:receive-note", {
      text,
      from: socket.data.role,
      at: Date.now(),
    });
  });

  // ── duo:mood-mode ──
  // { mood: "chill" | "hype" | "sad" | "romantic" | null }
  socket.on("duo:mood-mode", async ({ mood }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    await roomService.update(code, { moodMode: mood });
    socket
      .to(code)
      .emit("duo:receive-mood-mode", { mood, from: socket.data.role });
  });
}
