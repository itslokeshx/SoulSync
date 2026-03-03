// ─────────────────────────────────────────────────────────────────────────────
// Socket.io — Room (Duo sync) handlers
// ─────────────────────────────────────────────────────────────────────────────
import { roomService } from "../services/roomService.js";

export function registerRoomHandlers(io, socket) {
  // ── duo:join ──
  socket.on("duo:join", async ({ code, name, role }) => {
    try {
      code = (code || "").toUpperCase();
      const room = await roomService.get(code);
      if (!room) {
        socket.emit("duo:error", { message: "Room not found" });
        return;
      }

      // Update room with socket id
      if (role === "host") {
        room.host = {
          ...room.host,
          name,
          socketId: socket.id,
          connected: true,
        };
      } else {
        room.guest = { name, socketId: socket.id, connected: true };
      }

      await roomService.update(code, { host: room.host, guest: room.guest });
      await roomService.mapSocket(socket.id, code);

      socket.join(code);
      socket.data.roomCode = code;
      socket.data.role = role;

      // Send full state to the joining user
      socket.emit("duo:session-state", { room });

      // Notify the other person
      socket.to(code).emit("duo:partner-joined", {
        name,
        role,
        room,
      });
    } catch (err) {
      console.error("[duo:join]", err);
      socket.emit("duo:error", { message: "Failed to join room" });
    }
  });

  // ── duo:sync-play ──
  socket.on("duo:sync-play", async ({ currentTime, songId }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    await roomService.update(code, { isPlaying: true, currentTime });
    socket.to(code).emit("duo:receive-play", { currentTime, songId });
  });

  // ── duo:sync-pause ──
  socket.on("duo:sync-pause", async ({ currentTime }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    await roomService.update(code, { isPlaying: false, currentTime });
    socket.to(code).emit("duo:receive-pause", { currentTime });
  });

  // ── duo:sync-seek ──
  socket.on("duo:sync-seek", async ({ currentTime }) => {
    const code = socket.data.roomCode;
    if (!code) return;
    await roomService.update(code, { currentTime });
    socket.to(code).emit("duo:receive-seek", { currentTime });
  });

  // ── duo:sync-song-change ──
  socket.on("duo:sync-song-change", async ({ song, queue, queueIndex }) => {
    const code = socket.data.roomCode;
    if (!code) return;

    const room = await roomService.get(code);
    if (room) {
      const history = room.songHistory || [];
      if (song) history.push({ id: song.id, name: song.name, at: Date.now() });
      await roomService.update(code, {
        currentSong: song,
        currentTime: 0,
        isPlaying: true,
        songHistory: history.slice(-50),
      });
    }

    socket
      .to(code)
      .emit("duo:receive-song-change", { song, queue, queueIndex });
  });

  // ── duo:heartbeat ──
  socket.on("duo:heartbeat", async () => {
    const code = socket.data.roomCode;
    if (!code) return;
    socket.to(code).emit("duo:partner-active", {
      name:
        socket.data.role === "host"
          ? (await roomService.get(code))?.host?.name
          : (await roomService.get(code))?.guest?.name,
      timestamp: Date.now(),
    });
  });

  // ── duo:end-session ──
  socket.on("duo:end-session", async () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = await roomService.get(code);
    socket.to(code).emit("duo:session-ended", {
      songHistory: room?.songHistory || [],
      endedBy: socket.data.role,
    });
    await roomService.remove(code);
    socket.leave(code);
    socket.data.roomCode = null;
  });

  // ── disconnect ──
  socket.on("disconnect", async () => {
    try {
      const result = await roomService.disconnect(socket.id);
      if (result) {
        const { code, room, who } = result;
        // Notify partner
        socket.to(code).emit("duo:partner-disconnected", {
          who,
          room,
        });
      }
    } catch (err) {
      console.error("[disconnect]", err);
    }
  });
}
