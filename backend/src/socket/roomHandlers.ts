import { Server, Socket } from "socket.io";
import { DuoSessionService } from "../services/duoSessionService.js";

const debugLog = (..._args: any[]): void => {};

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
  lastSongChangeAt?: number;
  lastSongChangeSongId?: string;
}

const rooms = new Map<string, RoomData>();

// Clean up stale rooms every 30 minutes (rooms inactive for 2+ hours)
setInterval(
  () => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.lastActivity > 2 * 60 * 60 * 1000) {
        rooms.delete(code);
        debugLog(`[Duo] Cleaned up stale room ${code}`);
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
  debugLog(
    `\n[Duo] 📋 ${label} — Room ${code}\n` +
      `       ├─ Host:  ${room.host.name} (${room.host.socketId}) ${room.host.connected ? "🟢" : "🔴"}\n` +
      `       ├─ Guest: ${room.guest.name || "—"} (${room.guest.socketId || "—"}) ${room.guest.connected ? "🟢" : "🔴"}\n` +
      `       ├─ Song:  ${(room.currentSong as any)?.name || "none"}\n` +
      `       ├─ Msgs:  ${room.messages.length} | Songs played: ${room.stats.songsPlayed}\n` +
      `       └─ Active rooms total: ${rooms.size}`,
  );
}

export function setupRoomHandlers(io: Server, socket: Socket): void {
  debugLog(`[Duo] ⚙️  Registered handlers for socket ${socket.id}`);

  // ── Join a room ─────────────────────────────────────────────────────
  // Frontend sends: { code, name, role }
  socket.on(
    "duo:join",
    async ({
      code,
      name,
      role,
    }: {
      code: string;
      name: string;
      role: "host" | "guest";
    }) => {
      debugLog(
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
        try {
          const dbSession = await DuoSessionService.getSessionByCode(roomCode);
          if (dbSession) {
            room = {
              host: {
                name: dbSession.host.name || "",
                socketId: dbSession.host.socketId || "",
                connected: dbSession.host.connected || false,
              },
              guest: {
                name: dbSession.guest.name || null,
                socketId: dbSession.guest.socketId || null,
                connected: dbSession.guest.connected || false,
              },
              currentSong: dbSession.currentSong,
              isPlaying: dbSession.isPlaying || false,
              currentTime: dbSession.currentTime || 0,
              messages: (dbSession.messages || []).map((m: any) => ({
                text: m.text,
                from: m.from,
                fromName: m.fromName || "",
                at: m.at ? new Date(m.at).getTime() : Date.now(),
              })),
              songHistory: dbSession.songHistory || [],
              stats: {
                duration: dbSession.stats?.duration || 0,
                songsPlayed: dbSession.stats?.songsPlayed || 0,
                reactionsCount: dbSession.stats?.reactionsCount || 0,
                messagesCount: dbSession.stats?.messagesCount || 0,
              },
              createdAt: dbSession.createdAt ? new Date(dbSession.createdAt).getTime() : Date.now(),
              lastActivity: Date.now(),
            };
            rooms.set(roomCode, room);
            debugLog(`[Duo] Loaded room ${roomCode} from database`);
          }
        } catch (dbErr) {
          console.error("[Duo] Error loading session from DB:", dbErr);
        }
      }

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
        debugLog(`[Duo] 🆕 Room ${roomCode} created by "${name}"`);
      }

      room.lastActivity = Date.now();

      if (role === "host") {
        room.host = { name, socketId: socket.id, connected: true };
        try {
          await DuoSessionService.updateMemberConnection(roomCode, "host", {
            name,
            socketId: socket.id,
            connected: true,
          });
        } catch (dbErr) {
          console.error("[Duo] DB update error (host join):", dbErr);
        }

        // If guest already connected, notify both sides
        if (room.guest.connected && room.guest.name) {
          debugLog(
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
        try {
          await DuoSessionService.updateMemberConnection(roomCode, "guest", {
            name,
            socketId: socket.id,
            connected: true,
          });
        } catch (dbErr) {
          console.error("[Duo] DB update error (guest join):", dbErr);
        }

        debugLog(
          `[Duo] 👤 Guest "${name}" joined room ${roomCode} → notifying host "${room.host.name}"`,
        );

        // 1. Direct-emit to host socket (most reliable — bypasses room membership)
        const hostSocket = io.sockets.sockets.get(room.host.socketId);
        if (hostSocket) {
          debugLog(
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
        io.to(roomCode).emit("duo:session-state", { room });
      }

      logRoomState(`After ${role} join`, roomCode, room);
    },
  );

  // ── Sync play ───────────────────────────────────────────────────────
  socket.on("duo:sync-play", async ({ currentTime, songId }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.isPlaying = true;
      room.currentTime = currentTime;
      room.lastActivity = Date.now();
    }
    debugLog(
      `[Duo] ▶️  sync-play → room ${code} | time=${currentTime?.toFixed(1)}s | song=${songId}`,
    );
    socket.to(code).emit("duo:receive-play", { currentTime, songId });

    try {
      await DuoSessionService.updatePlayState(code, true, currentTime);
    } catch (err) {
      console.error("[Duo] DB error on sync-play:", err);
    }
  });

  // ── Sync pause ──────────────────────────────────────────────────────
  socket.on("duo:sync-pause", async ({ currentTime }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.isPlaying = false;
      room.currentTime = currentTime;
      room.lastActivity = Date.now();
    }
    debugLog(
      `[Duo] ⏸️  sync-pause → room ${code} | time=${currentTime?.toFixed(1)}s`,
    );
    socket.to(code).emit("duo:receive-pause", { currentTime });

    try {
      await DuoSessionService.updatePlayState(code, false, currentTime);
    } catch (err) {
      console.error("[Duo] DB error on sync-pause:", err);
    }
  });

  // ── Sync seek ───────────────────────────────────────────────────────
  socket.on("duo:sync-seek", async ({ currentTime }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.currentTime = currentTime;
      room.lastActivity = Date.now();
    }
    debugLog(
      `[Duo] ⏩ sync-seek → room ${code} | time=${currentTime?.toFixed(1)}s`,
    );
    socket.to(code).emit("duo:receive-seek", { currentTime });

    try {
      await DuoSessionService.updateSession(code, { $set: { currentTime } });
    } catch (err) {
      console.error("[Duo] DB error on sync-seek:", err);
    }
  });

  // ── Sync song change ───────────────────────────────────────────────
  socket.on("duo:sync-song-change", async ({ song, queue, queueIndex }: any) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || !song || !song.id) return;

    const now = Date.now();
    const LOCK_WINDOW_MS = 3000;

    if (room.lastSongChangeAt && now - room.lastSongChangeAt < LOCK_WINDOW_MS) {
      debugLog(
        `[Duo] 🛑 Ignored duplicate sync-song-change for room ${code} (locked, last change ${now - room.lastSongChangeAt}ms ago)`,
      );
      return;
    }

    if (room.currentSong) {
      room.songHistory.push(room.currentSong);
    }
    room.currentSong = song;
    room.lastSongChangeAt = now;
    room.lastSongChangeSongId = String(song.id);
    room.stats.songsPlayed++;
    room.lastActivity = now;

    debugLog(
      `[Duo] 🎵 sync-song-change accepted → room ${code} | "${song?.name || "??"}" | queue=${queue?.length || 0}`,
    );

    io.to(code).emit("duo:receive-song-change", { song, queue, queueIndex });

    try {
      const historyEntry =
        room.songHistory.length > 0
          ? room.songHistory[room.songHistory.length - 1]
          : null;
      await DuoSessionService.changeSong(code, song, historyEntry);
    } catch (err) {
      console.error("[Duo] DB error on sync-song-change:", err);
    }
  });

  // ── Messages ────────────────────────────────────────────────────────
  socket.on("duo:message", async ({ text }: { text: string }) => {
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

    debugLog(
      `[Duo] 💬 message → room ${code} | ${fromName}: "${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`,
    );
    socket.to(code).emit("duo:receive-message", msg);

    try {
      await DuoSessionService.addMessage(code, {
        text,
        from: fromRole,
        fromName,
        at: new Date(msg.at),
      });
    } catch (err) {
      console.error("[Duo] DB error on message:", err);
    }
  });

  // ── Reactions ───────────────────────────────────────────────────────
  socket.on("duo:reaction", async ({ emoji }: { emoji: string }) => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const isHost = room.host.socketId === socket.id;
    const fromName = isHost ? room.host.name : room.guest.name || "Guest";
    room.stats.reactionsCount++;
    room.lastActivity = Date.now();

    debugLog(`[Duo] ${emoji}  reaction → room ${code} | from ${fromName}`);
    socket.to(code).emit("duo:receive-reaction", { emoji, from: fromName });

    try {
      await DuoSessionService.updateSession(code, {
        $push: {
          reactions: {
            emoji,
            from: fromName,
            at: new Date(),
          },
        },
        $inc: { "stats.reactionsCount": 1 },
      });
    } catch (err) {
      console.error("[Duo] DB error on reaction:", err);
    }
  });

  // ── Request room state (polling fallback) ────────────────────────────
  socket.on("duo:request-state", (data: { code?: string } | undefined) => {
    const code = data?.code?.toUpperCase() || findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.lastActivity = Date.now();
      debugLog(
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
  socket.on("duo:end-session", async () => {
    const code = findSocketRoom(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (room) {
      room.stats.duration = Math.floor((Date.now() - room.createdAt) / 1000);
      const mins = Math.floor(room.stats.duration / 60);
      const secs = room.stats.duration % 60;
      debugLog(
        `\n[Duo] 🛑 Session ended — Room ${code}\n` +
          `       ├─ Duration: ${mins}m ${secs}s\n` +
          `       ├─ Songs: ${room.stats.songsPlayed} | Messages: ${room.stats.messagesCount} | Reactions: ${room.stats.reactionsCount}\n` +
          `       └─ Remaining rooms: ${rooms.size - 1}`,
      );
      io.to(code).emit("duo:session-ended", {
        stats: room.stats,
        songHistory: room.songHistory,
      });

      try {
        await DuoSessionService.updateSession(code, {
          $set: {
            stats: {
              duration: room.stats.duration,
              reactionsCount: room.stats.reactionsCount,
              notesCount: 0,
              messagesCount: room.stats.messagesCount,
              songsPlayed: room.stats.songsPlayed,
            },
            isPlaying: false,
          },
        });
      } catch (err) {
        console.error("[Duo] DB error on end-session:", err);
      }

      rooms.delete(code);
    }
  });

  // ── Handle disconnect ──────────────────────────────────────────────
  socket.on("disconnect", async () => {
    for (const [code, room] of rooms) {
      let changed = false;
      let hostDisconnected = false;
      let guestDisconnected = false;

      if (room.host.socketId === socket.id) {
        room.host.connected = false;
        changed = true;
        hostDisconnected = true;
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
        guestDisconnected = true;
        const hostSocket = io.sockets.sockets.get(room.host.socketId);
        if (hostSocket) {
          hostSocket.emit("duo:partner-disconnected", {
            name: room.guest.name,
          });
        }
      }

      if (changed) {
        debugLog(
          `[Duo] 🔌 Socket ${socket.id} disconnected from room ${code}\n` +
            `       └─ Host: ${room.host.name}(${room.host.connected ? "🟢" : "🔴"}) | Guest: ${room.guest.name || "—"}(${room.guest.connected ? "🟢" : "🔴"})`,
        );

        try {
          const updateObj: any = {};
          if (hostDisconnected) {
            updateObj["host.connected"] = false;
          }
          if (guestDisconnected) {
            updateObj["guest.connected"] = false;
          }
          await DuoSessionService.updateSession(code, { $set: updateObj });
        } catch (err) {
          console.error("[Duo] DB error on disconnect update:", err);
        }
      }
    }
  });
}
