import { Server, Socket } from "socket.io";

interface RoomData {
  host: { name: string; socketId: string; connected: boolean };
  guest: { name: string | null; socketId: string | null; connected: boolean };
  currentSong: unknown;
  isPlaying: boolean;
  currentTime: number;
  messages: { text: string; from: string; fromName: string; at: number }[];
  songHistory: unknown[];
  stats: {
    duration: number;
    songsPlayed: number;
    reactionsCount: number;
    messagesCount: number;
  };
  createdAt: number;
}

const rooms = new Map<string, RoomData>();

/** Find which room code a socket belongs to */
function findSocketRoom(socketId: string): string | null {
  for (const [code, room] of rooms) {
    if (room.host.socketId === socketId || room.guest.socketId === socketId) {
      return code;
    }
  }
  return null;
}

export function setupRoomHandlers(io: Server, socket: Socket): void {
  // ── Join a room ─────────────────────────────────────────────────────
  // Frontend sends: { code, name, role }
  socket.on(
    "duo:join",
    ({
      code,
      name,
      role,
    }: {
      code: string;
      name: string;
      role: "host" | "guest";
    }) => {
      if (!code || !name) return;
      const roomCode = code.toUpperCase();
      socket.join(roomCode);

      let room = rooms.get(roomCode);
      if (!room) {
        room = {
          host: { name, socketId: socket.id, connected: true },
          guest: { name: null, socketId: null, connected: false },
          currentSong: null,
          isPlaying: false,
          currentTime: 0,
          messages: [],
          songHistory: [],
          stats: {
            duration: 0,
            songsPlayed: 0,
            reactionsCount: 0,
            messagesCount: 0,
          },
          createdAt: Date.now(),
        };
        rooms.set(roomCode, room);
      }

      if (role === "host") {
        room.host = { name, socketId: socket.id, connected: true };
        // If guest already connected, notify host
        if (room.guest.connected && room.guest.name) {
          socket.emit("duo:partner-joined", {
            name: room.guest.name,
            role: "guest",
            room,
          });
        }
      } else {
        room.guest = { name, socketId: socket.id, connected: true };
        // Notify host that guest joined (include room state)
        socket.to(roomCode).emit("duo:partner-joined", {
          name,
          role: "guest",
          room,
        });
        // Send current room state to the joining guest
        socket.emit("duo:session-state", { room });
      }

      console.log(`[Duo] ${role} "${name}" joined room ${roomCode}`);
    },
  );

  // ── Sync play ───────────────────────────────────────────────────────
  // Frontend sends: { currentTime, songId }
  socket.on("duo:sync-play", ({ currentTime, songId }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.isPlaying = true;
      room.currentTime = currentTime;
    }
    socket.to(code).emit("duo:receive-play", { currentTime, songId });
  });

  // ── Sync pause ──────────────────────────────────────────────────────
  // Frontend sends: { currentTime }
  socket.on("duo:sync-pause", ({ currentTime }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.isPlaying = false;
      room.currentTime = currentTime;
    }
    socket.to(code).emit("duo:receive-pause", { currentTime });
  });

  // ── Sync seek ───────────────────────────────────────────────────────
  // Frontend sends: { currentTime }
  socket.on("duo:sync-seek", ({ currentTime }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) room.currentTime = currentTime;
    socket.to(code).emit("duo:receive-seek", { currentTime });
  });

  // ── Sync song change ───────────────────────────────────────────────
  // Frontend sends: { song, queue, queueIndex }
  socket.on("duo:sync-song-change", ({ song, queue, queueIndex }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      if (room.currentSong) {
        room.songHistory.push(room.currentSong);
      }
      room.currentSong = song;
      room.stats.songsPlayed++;
    }
    socket
      .to(code)
      .emit("duo:receive-song-change", { song, queue, queueIndex });
  });

  // ── Messages ────────────────────────────────────────────────────────
  // Frontend sends: { text }
  socket.on("duo:message", ({ text }: { text: string }) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    // Figure out sender name from room data
    const isHost = room.host.socketId === socket.id;
    const fromRole = isHost ? "host" : "guest";
    const fromName = isHost ? room.host.name : room.guest.name || "Guest";

    const msg = { text, from: fromRole, fromName, at: Date.now() };
    room.messages.push(msg);
    room.stats.messagesCount++;

    socket.to(code).emit("duo:receive-message", msg);
  });

  // ── Reactions ───────────────────────────────────────────────────────
  socket.on("duo:reaction", ({ emoji }: { emoji: string }) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const isHost = room.host.socketId === socket.id;
    const fromName = isHost ? room.host.name : room.guest.name || "Guest";
    room.stats.reactionsCount++;

    socket.to(code).emit("duo:receive-reaction", { emoji, from: fromName });
  });

  // ── Heartbeat ───────────────────────────────────────────────────────
  // Frontend sends: { code }
  socket.on("duo:heartbeat", (data: { code?: string } | undefined) => {
    const code = data?.code?.toUpperCase() || findSocketRoom(socket.id);
    if (!code) return;
    socket.to(code).emit("duo:partner-active", { lastSeen: Date.now() });
  });

  // ── End session ─────────────────────────────────────────────────────
  // Frontend sends no code — we find it from socket
  socket.on("duo:end-session", () => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.stats.duration = Math.floor((Date.now() - room.createdAt) / 1000);
      io.to(code).emit("duo:session-ended", {
        stats: room.stats,
        songHistory: room.songHistory,
      });
      rooms.delete(code);
    }
  });

  // ── Handle disconnect ──────────────────────────────────────────────
  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      if (room.host.socketId === socket.id) {
        room.host.connected = false;
        socket
          .to(code)
          .emit("duo:partner-disconnected", { name: room.host.name });
      }
      if (room.guest.socketId === socket.id) {
        room.guest.connected = false;
        socket
          .to(code)
          .emit("duo:partner-disconnected", { name: room.guest.name });
      }
    }
  });
}
