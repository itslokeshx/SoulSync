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

/** Pretty-print room state for debug */
function logRoomState(label: string, code: string, room: RoomData): void {
  console.log(
    `\n[Duo] 📋 ${label} — Room ${code}\n` +
      `       ├─ Host:  ${room.host.name} (${room.host.socketId}) ${room.host.connected ? "🟢" : "🔴"}\n` +
      `       ├─ Guest: ${room.guest.name || "—"} (${room.guest.socketId || "—"}) ${room.guest.connected ? "🟢" : "🔴"}\n` +
      `       ├─ Song:  ${(room.currentSong as any)?.name || "none"}\n` +
      `       ├─ Msgs:  ${room.messages.length} | Songs played: ${room.stats.songsPlayed}\n` +
      `       └─ Active rooms total: ${rooms.size}`,
  );
}

export function setupRoomHandlers(io: Server, socket: Socket): void {
  console.log(`[Duo] ⚙️  Registered handlers for socket ${socket.id}`);

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
        `\n[Duo] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `[Duo] 🚪 duo:join → code=${code} | name="${name}" | role=${role}\n` +
          `[Duo]    socket=${socket.id}`,
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
        console.log(`[Duo] 🆕 Room ${roomCode} created by "${name}"`);
      }

      room.lastActivity = Date.now();

      if (role === "host") {
        room.host = { name, socketId: socket.id, connected: true };
        // If guest already connected, notify both sides
        if (room.guest.connected && room.guest.name) {
          console.log(
            `[Duo] 🔄 Host "${name}" reconnected → notifying guest "${room.guest.name}"`,
          );
          socket.emit("duo:partner-joined", {
            name: room.guest.name,
            role: "guest",
            room,
          });
          // Tell guest that host reconnected — direct emit to guest socket
          const guestSocket = io.sockets.sockets.get(room.guest.socketId!);
          if (guestSocket) {
            guestSocket.emit("duo:partner-reconnected", {
              name,
              role: "host",
              room,
            });
          }
          // Also broadcast to room as fallback
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
        console.log(
          `[Duo] 👤 Guest "${name}" joined room ${roomCode} → notifying host "${room.host.name}"`,
        );

        // 1. Direct-emit to host socket (most reliable — bypasses room membership)
        const hostSocket = io.sockets.sockets.get(room.host.socketId);
        if (hostSocket) {
          console.log(
            `[Duo] 📨 Direct-emit duo:partner-joined → host socket ${room.host.socketId} ✅`,
          );
          hostSocket.emit("duo:partner-joined", {
            name,
            role: "guest",
            room,
          });
        } else {
          console.warn(
            `[Duo] ⚠️  Host socket ${room.host.socketId} NOT FOUND in io.sockets — direct emit failed!`,
          );
        }

        // 2. Also broadcast to room as fallback (reaches host if in Socket.IO room)
        socket.to(roomCode).emit("duo:partner-joined", {
          name,
          role: "guest",
          room,
        });

        // 3. Tell the guest about the host
        socket.emit("duo:partner-joined", {
          name: room.host.name,
          role: "host",
          room,
        });

        // Send room state to ALL sockets in the room (host + guest)
        // This ensures the host gets the updated state even if partner-joined was lost
        io.to(roomCode).emit("duo:session-state", { room });
      }

      logRoomState(`After ${role} join`, roomCode, room);
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
    console.log(
      `[Duo] ▶️  sync-play → room ${code} | time=${currentTime?.toFixed(1)}s | song=${songId}`,
    );
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
    console.log(
      `[Duo] ⏸️  sync-pause → room ${code} | time=${currentTime?.toFixed(1)}s`,
    );
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
    console.log(
      `[Duo] ⏩ sync-seek → room ${code} | time=${currentTime?.toFixed(1)}s`,
    );
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
    console.log(
      `[Duo] 🎵 sync-song-change → room ${code} | "${song?.name || "??"}" | queue=${queue?.length || 0}`,
    );
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

    console.log(
      `[Duo] 💬 message → room ${code} | ${fromName}: "${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`,
    );
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

    console.log(`[Duo] ${emoji}  reaction → room ${code} | from ${fromName}`);
    socket.to(code).emit("duo:receive-reaction", { emoji, from: fromName });
  });

  // ── Request room state (polling fallback) ────────────────────────────
  socket.on("duo:request-state", (data: { code?: string } | undefined) => {
    const code = data?.code?.toUpperCase() || findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.lastActivity = Date.now();
      console.log(
        `[Duo] 🔍 request-state → room ${code} | host: ${room.host.name}(${room.host.connected ? "🟢" : "🔴"}) guest: ${room.guest.name || "—"}(${room.guest.connected ? "🟢" : "🔴"})`,
      );
      socket.emit("duo:session-state", { room });
    } else {
      console.warn(`[Duo] ⚠️  request-state → room ${code} not found`);
    }
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
      const mins = Math.floor(room.stats.duration / 60);
      const secs = room.stats.duration % 60;
      console.log(
        `\n[Duo] 🛑 Session ended — Room ${code}\n` +
          `       ├─ Duration: ${mins}m ${secs}s\n` +
          `       ├─ Songs: ${room.stats.songsPlayed} | Messages: ${room.stats.messagesCount} | Reactions: ${room.stats.reactionsCount}\n` +
          `       └─ Remaining rooms: ${rooms.size - 1}`,
      );
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
        // Direct-emit to guest socket (most reliable)
        if (room.guest.socketId) {
          const guestSocket = io.sockets.sockets.get(room.guest.socketId);
          if (guestSocket) {
            guestSocket.emit("duo:partner-disconnected", {
              name: room.host.name,
            });
          }
        }
      }
      if (room.guest.socketId === socket.id) {
        room.guest.connected = false;
        changed = true;
        // Direct-emit to host socket (most reliable)
        const hostSocket = io.sockets.sockets.get(room.host.socketId);
        if (hostSocket) {
          hostSocket.emit("duo:partner-disconnected", {
            name: room.guest.name,
          });
        }
      }
      // Don't delete room on disconnect — allow reconnection
      // Stale rooms get cleaned by the interval above
      if (changed) {
        console.log(
          `[Duo] 🔌 Socket ${socket.id} disconnected from room ${code}\n` +
            `       └─ Host: ${room.host.name}(${room.host.connected ? "🟢" : "🔴"}) | Guest: ${room.guest.name || "—"}(${room.guest.connected ? "🟢" : "🔴"})`,
        );
      }
    }
  });
}
