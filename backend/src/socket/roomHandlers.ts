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
  lastActivity: number;
}

const rooms = new Map<string, RoomData>();

// Clean up stale rooms every 30 minutes (rooms inactive for 2+ hours)
setInterval(
  () => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.lastActivity > 2 * 60 * 60 * 1000) {
        rooms.delete(code);
        console.log(`[Duo] Cleaned up stale room ${code}`);
      }
    }
  },
  30 * 60 * 1000,
);

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
  console.log(`[Duo] Setting up handlers for socket ${socket.id}`);

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
      console.log(
        `[Duo] duo:join received → code=${code}, name=${name}, role=${role}, socket=${socket.id}`,
      );
      if (!code || !name) {
        console.warn(`[Duo] duo:join rejected: missing code or name`);
        return;
      }
      const roomCode = code.toUpperCase();

      // Leave any previous rooms this socket was in
      const prevRoom = findSocketRoom(socket.id);
      if (prevRoom && prevRoom !== roomCode) {
        socket.leave(prevRoom);
      }

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
          lastActivity: Date.now(),
        };
        rooms.set(roomCode, room);
      }

      room.lastActivity = Date.now();

      if (role === "host") {
        room.host = { name, socketId: socket.id, connected: true };
        // If guest already connected, notify both sides
        if (room.guest.connected && room.guest.name) {
          console.log(
            `[Duo] Host reconnected → notifying guest "${room.guest.name}"`,
          );
          socket.emit("duo:partner-joined", {
            name: room.guest.name,
            role: "guest",
            room,
          });
          // Tell guest that host reconnected (broadcast to room, excludes this socket)
          socket.to(roomCode).emit("duo:partner-reconnected", {
            name,
            role: "host",
            room,
          });
        }
        // Send current room state to this socket
        socket.emit("duo:session-state", { room });
      } else {
        room.guest = { name, socketId: socket.id, connected: true };
        // Notify host via room broadcast (excludes this guest socket, reaches host)
        console.log(
          `[Duo] Guest "${name}" joined → broadcasting duo:partner-joined to room ${roomCode}`,
        );
        socket.to(roomCode).emit("duo:partner-joined", {
          name,
          role: "guest",
          room,
        });
        // Send current room state to this socket
        socket.emit("duo:session-state", { room });
      }

      console.log(
        `[Duo] ${role} "${name}" joined room ${roomCode} (socket: ${socket.id})`,
      );
      console.log(
        `[Duo] Room ${roomCode} state → host: ${room.host.name}(${room.host.connected ? "✅" : "❌"}), guest: ${room.guest.name || "none"}(${room.guest.connected ? "✅" : "❌"})`,
      );
      console.log(`[Duo] Active rooms: ${rooms.size}`);
    },
  );

  // ── Sync play ───────────────────────────────────────────────────────
  socket.on("duo:sync-play", ({ currentTime, songId }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.isPlaying = true;
      room.currentTime = currentTime;
      room.lastActivity = Date.now();
    }
    socket.to(code).emit("duo:receive-play", { currentTime, songId });
  });

  // ── Sync pause ──────────────────────────────────────────────────────
  socket.on("duo:sync-pause", ({ currentTime }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.isPlaying = false;
      room.currentTime = currentTime;
      room.lastActivity = Date.now();
    }
    socket.to(code).emit("duo:receive-pause", { currentTime });
  });

  // ── Sync seek ───────────────────────────────────────────────────────
  socket.on("duo:sync-seek", ({ currentTime }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.currentTime = currentTime;
      room.lastActivity = Date.now();
    }
    socket.to(code).emit("duo:receive-seek", { currentTime });
  });

  // ── Sync song change ───────────────────────────────────────────────
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
      room.lastActivity = Date.now();
    }
    socket
      .to(code)
      .emit("duo:receive-song-change", { song, queue, queueIndex });
  });

  // ── Messages ────────────────────────────────────────────────────────
  socket.on("duo:message", ({ text }: { text: string }) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const isHost = room.host.socketId === socket.id;
    const fromRole = isHost ? "host" : "guest";
    const fromName = isHost ? room.host.name : room.guest.name || "Guest";

    const msg = { text, from: fromRole, fromName, at: Date.now() };
    room.messages.push(msg);
    room.stats.messagesCount++;
    room.lastActivity = Date.now();

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
    room.lastActivity = Date.now();

    socket.to(code).emit("duo:receive-reaction", { emoji, from: fromName });
  });

  // ── Heartbeat ───────────────────────────────────────────────────────
  socket.on("duo:heartbeat", (data: { code?: string } | undefined) => {
    const code = data?.code?.toUpperCase() || findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) room.lastActivity = Date.now();
    socket.to(code).emit("duo:partner-active", { lastSeen: Date.now() });
  });

  // ── End session ─────────────────────────────────────────────────────
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
      let changed = false;
      if (room.host.socketId === socket.id) {
        room.host.connected = false;
        changed = true;
        // Notify everyone else in the room (the guest)
        io.to(code).emit("duo:partner-disconnected", {
          name: room.host.name,
        });
      }
      if (room.guest.socketId === socket.id) {
        room.guest.connected = false;
        changed = true;
        // Notify everyone else in the room (the host)
        io.to(code).emit("duo:partner-disconnected", {
          name: room.guest.name,
        });
      }
      // Don't delete room on disconnect — allow reconnection
      // Stale rooms get cleaned by the interval above
      if (changed) {
        console.log(`[Duo] Socket ${socket.id} disconnected from room ${code}`);
      }
    }
  });
}
