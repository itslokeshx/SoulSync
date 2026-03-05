import { Server, Socket } from "socket.io";
import { nanoid } from "nanoid";

// ── Types ───────────────────────────────────────────────────────────────

interface Participant {
  name: string;
  socketId: string;
  connected: boolean;
}

interface Guest {
  name: string | null;
  socketId: string | null;
  connected: boolean;
}

interface RoomData {
  code: string;
  host: Participant;
  guest: Guest;
  currentSong: any;
  isPlaying: boolean;
  currentTime: number;
  messages: { text: string; from: string; fromName: string; at: number }[];
  songHistory: any[];
  createdAt: number;
  lastActivity: number;
}

// ── In-memory room store ────────────────────────────────────────────────

const rooms = new Map<string, RoomData>();

// Clean up stale rooms every 30 min (inactive > 2 hours)
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

// ── Helpers ─────────────────────────────────────────────────────────────

/** Find the room a socket belongs to */
function findRoom(socketId: string): RoomData | null {
  for (const room of rooms.values()) {
    if (room.host.socketId === socketId || room.guest.socketId === socketId) {
      return room;
    }
  }
  return null;
}

/** Is this socket the host of the room? */
function isHost(room: RoomData, socketId: string): boolean {
  return room.host.socketId === socketId;
}

/** Sanitised room snapshot sent to clients (no raw socketIds) */
function roomSnapshot(room: RoomData) {
  return {
    code: room.code,
    host: { name: room.host.name, connected: room.host.connected },
    guest: { name: room.guest.name, connected: room.guest.connected },
    currentSong: room.currentSong,
    isPlaying: room.isPlaying,
    currentTime: room.currentTime,
  };
}

// ── Handler registration ────────────────────────────────────────────────

export function setupRoomHandlers(io: Server, socket: Socket): void {
  // ═══ CREATE ROOM ═══════════════════════════════════════════════════
  // Client sends name, receives { ok, code } via ack callback
  socket.on(
    "duo:create-room",
    (data: { name: string }, ack?: (res: any) => void) => {
      if (!data?.name?.trim()) {
        return ack?.({ ok: false, error: "Name is required" });
      }

      // Leave any previous room
      const prev = findRoom(socket.id);
      if (prev) socket.leave(prev.code);

      const code = nanoid(6).toUpperCase();
      const room: RoomData = {
        code,
        host: { name: data.name.trim(), socketId: socket.id, connected: true },
        guest: { name: null, socketId: null, connected: false },
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        messages: [],
        songHistory: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };

      rooms.set(code, room);
      socket.join(code);

      console.log(
        `[Duo] Room ${code} created by "${data.name}" (${socket.id})`,
      );
      ack?.({ ok: true, code });
    },
  );

  // ═══ JOIN ROOM ═════════════════════════════════════════════════════
  // Guest sends { code, name }, receives { ok, room } via ack
  socket.on(
    "duo:join-room",
    (data: { code: string; name: string }, ack?: (res: any) => void) => {
      if (!data?.code?.trim() || !data?.name?.trim()) {
        return ack?.({ ok: false, error: "Code and name are required" });
      }

      const roomCode = data.code.toUpperCase().trim();
      const room = rooms.get(roomCode);

      if (!room) {
        return ack?.({
          ok: false,
          error: "Room not found — check the code and try again.",
        });
      }

      // Already full? (allow same socket to re-join)
      if (
        room.guest.connected &&
        room.guest.socketId &&
        room.guest.socketId !== socket.id
      ) {
        return ack?.({ ok: false, error: "Room is full." });
      }

      // Leave any previous room
      const prev = findRoom(socket.id);
      if (prev && prev.code !== roomCode) socket.leave(prev.code);

      // Register guest
      room.guest = {
        name: data.name.trim(),
        socketId: socket.id,
        connected: true,
      };
      room.lastActivity = Date.now();
      socket.join(roomCode);

      console.log(
        `[Duo] Guest "${data.name}" joined room ${roomCode} (${socket.id})`,
      );

      // Notify the host
      io.to(room.host.socketId).emit("duo:partner-joined", {
        name: room.guest.name,
        room: roomSnapshot(room),
      });

      // Ack to guest with full room state
      ack?.({ ok: true, room: roomSnapshot(room) });
    },
  );

  // ═══ REJOIN ROOM (page reload / reconnect) ═════════════════════════
  socket.on(
    "duo:rejoin-room",
    (
      data: { code: string; name: string; role: string },
      ack?: (res: any) => void,
    ) => {
      if (!data?.code || !data?.name || !data?.role) {
        return ack?.({ ok: false, error: "Invalid rejoin data" });
      }

      const roomCode = data.code.toUpperCase().trim();
      const room = rooms.get(roomCode);

      if (!room) {
        return ack?.({ ok: false, error: "Session expired" });
      }

      socket.join(roomCode);
      room.lastActivity = Date.now();

      if (data.role === "host") {
        room.host = {
          name: data.name,
          socketId: socket.id,
          connected: true,
        };
        // Notify guest
        if (room.guest.socketId && room.guest.connected) {
          io.to(room.guest.socketId).emit("duo:partner-reconnected", {
            name: data.name,
          });
        }
      } else {
        room.guest = {
          name: data.name,
          socketId: socket.id,
          connected: true,
        };
        // Notify host
        if (room.host.socketId && room.host.connected) {
          io.to(room.host.socketId).emit("duo:partner-reconnected", {
            name: data.name,
          });
        }
      }

      console.log(
        `[Duo] ${data.role} "${data.name}" rejoined room ${roomCode}`,
      );
      ack?.({ ok: true, room: roomSnapshot(room) });
    },
  );

  // ═══ SYNC: PLAY ════════════════════════════════════════════════════
  socket.on(
    "duo:sync-play",
    (data: { currentTime: number; songId?: string }) => {
      const room = findRoom(socket.id);
      if (!room) return;
      room.isPlaying = true;
      room.currentTime = data.currentTime;
      room.lastActivity = Date.now();
      socket.to(room.code).emit("duo:receive-play", data);
    },
  );

  // ═══ SYNC: PAUSE ═══════════════════════════════════════════════════
  socket.on("duo:sync-pause", (data: { currentTime: number }) => {
    const room = findRoom(socket.id);
    if (!room) return;
    room.isPlaying = false;
    room.currentTime = data.currentTime;
    room.lastActivity = Date.now();
    socket.to(room.code).emit("duo:receive-pause", data);
  });

  // ═══ SYNC: SEEK ════════════════════════════════════════════════════
  socket.on("duo:sync-seek", (data: { currentTime: number }) => {
    const room = findRoom(socket.id);
    if (!room) return;
    room.currentTime = data.currentTime;
    room.lastActivity = Date.now();
    socket.to(room.code).emit("duo:receive-seek", data);
  });

  // ═══ SYNC: SONG CHANGE ════════════════════════════════════════════
  socket.on(
    "duo:sync-song-change",
    (data: { song: any; queue: any[]; queueIndex: number }) => {
      const room = findRoom(socket.id);
      if (!room) return;
      if (room.currentSong) room.songHistory.push(room.currentSong);
      room.currentSong = data.song;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastActivity = Date.now();
      socket.to(room.code).emit("duo:receive-song-change", data);
    },
  );

  // ═══ CHAT MESSAGE ══════════════════════════════════════════════════
  socket.on("duo:message", (data: { text: string }) => {
    const room = findRoom(socket.id);
    if (!room || !data?.text) return;

    const amHost = isHost(room, socket.id);
    const msg = {
      text: data.text,
      from: amHost ? "host" : "guest",
      fromName: amHost ? room.host.name : room.guest.name || "Guest",
      at: Date.now(),
    };

    room.messages.push(msg);
    room.lastActivity = Date.now();
    socket.to(room.code).emit("duo:receive-message", msg);
  });

  // ═══ HEARTBEAT ═════════════════════════════════════════════════════
  socket.on("duo:heartbeat", () => {
    const room = findRoom(socket.id);
    if (!room) return;
    room.lastActivity = Date.now();
    socket.to(room.code).emit("duo:partner-active");
  });

  // ═══ END SESSION ═══════════════════════════════════════════════════
  socket.on("duo:end-session", () => {
    const room = findRoom(socket.id);
    if (!room) return;

    // Notify PARTNER only (the ender handles their own cleanup)
    socket.to(room.code).emit("duo:session-ended", {
      songHistory: room.songHistory,
    });

    console.log(`[Duo] Room ${room.code} ended`);
    rooms.delete(room.code);
  });

  // ═══ DISCONNECT ════════════════════════════════════════════════════
  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      if (room.host.socketId === socket.id) {
        room.host.connected = false;
        if (room.guest.socketId && room.guest.connected) {
          io.to(room.guest.socketId).emit("duo:partner-disconnected");
        }
        console.log(`[Duo] Host disconnected from room ${room.code}`);
      }

      if (room.guest.socketId === socket.id) {
        room.guest.connected = false;
        if (room.host.socketId && room.host.connected) {
          io.to(room.host.socketId).emit("duo:partner-disconnected");
        }
        console.log(`[Duo] Guest disconnected from room ${room.code}`);
      }
    }
  });
}
