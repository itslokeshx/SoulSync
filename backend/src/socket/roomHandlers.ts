import { Server, Socket } from "socket.io";

interface RoomData {
  host: { name: string; socketId: string; connected: boolean };
  guest: { name: string | null; socketId: string | null; connected: boolean };
  currentSong: unknown;
  isPlaying: boolean;
  currentTime: number;
  messages: { text: string; from: string; at: number }[];
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

export function setupRoomHandlers(io: Server, socket: Socket): void {
  // Join a room
  socket.on(
    "duo:join",
    ({
      code,
      userName,
      role,
    }: {
      code: string;
      userName: string;
      role: "host" | "guest";
    }) => {
      socket.join(code);

      let room = rooms.get(code);
      if (!room) {
        room = {
          host: { name: userName, socketId: socket.id, connected: true },
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
        rooms.set(code, room);
      }

      if (role === "host") {
        room.host = { name: userName, socketId: socket.id, connected: true };
      } else {
        room.guest = { name: userName, socketId: socket.id, connected: true };
        // Notify host
        socket
          .to(code)
          .emit("duo:partner-joined", { name: userName, connected: true });
        // Send current state to guest
        socket.emit("duo:session-state", room);
      }
    },
  );

  // Sync play
  socket.on(
    "duo:sync-play",
    ({
      code,
      songData,
      currentTime,
    }: {
      code: string;
      songData: unknown;
      currentTime: number;
    }) => {
      const room = rooms.get(code);
      if (room) {
        room.currentSong = songData;
        room.isPlaying = true;
        room.currentTime = currentTime;
      }
      socket.to(code).emit("duo:receive-play", { songData, currentTime });
    },
  );

  // Sync pause
  socket.on(
    "duo:sync-pause",
    ({ code, currentTime }: { code: string; currentTime: number }) => {
      const room = rooms.get(code);
      if (room) {
        room.isPlaying = false;
        room.currentTime = currentTime;
      }
      socket.to(code).emit("duo:receive-pause", { currentTime });
    },
  );

  // Sync seek
  socket.on(
    "duo:sync-seek",
    ({ code, currentTime }: { code: string; currentTime: number }) => {
      const room = rooms.get(code);
      if (room) room.currentTime = currentTime;
      socket.to(code).emit("duo:receive-seek", { currentTime });
    },
  );

  // Sync song change
  socket.on(
    "duo:sync-song",
    ({ code, songData }: { code: string; songData: unknown }) => {
      const room = rooms.get(code);
      if (room) {
        if (room.currentSong) {
          room.songHistory.push(room.currentSong);
        }
        room.currentSong = songData;
        room.stats.songsPlayed++;
      }
      socket.to(code).emit("duo:receive-song", { songData });
    },
  );

  // Reactions
  socket.on(
    "duo:reaction",
    ({
      code,
      emoji,
      userName,
    }: {
      code: string;
      emoji: string;
      userName: string;
    }) => {
      const room = rooms.get(code);
      if (room) room.stats.reactionsCount++;
      socket.to(code).emit("duo:receive-reaction", { emoji, from: userName });
    },
  );

  // Messages
  socket.on(
    "duo:message",
    ({
      code,
      text,
      userName,
    }: {
      code: string;
      text: string;
      userName: string;
    }) => {
      const room = rooms.get(code);
      if (room) {
        room.messages.push({ text, from: userName, at: Date.now() });
        room.stats.messagesCount++;
      }
      socket
        .to(code)
        .emit("duo:receive-message", { text, from: userName, at: Date.now() });
    },
  );

  // Notes
  socket.on(
    "duo:note",
    ({
      code,
      songId,
      text,
      userName,
    }: {
      code: string;
      songId: string;
      text: string;
      userName: string;
    }) => {
      socket
        .to(code)
        .emit("duo:receive-note", { text, songId, from: userName });
    },
  );

  // Heartbeat
  socket.on("duo:heartbeat", (data: { code: string } | undefined) => {
    if (!data?.code) return;
    socket.to(data.code).emit("duo:partner-active", { lastSeen: Date.now() });
  });

  // End session
  socket.on("duo:end-session", (data: { code: string } | undefined) => {
    if (!data?.code) return;
    const room = rooms.get(data.code);
    if (room) {
      room.stats.duration = Math.floor((Date.now() - room.createdAt) / 1000);
      io.to(data.code).emit("duo:session-ended", {
        stats: room.stats,
        songHistory: room.songHistory,
      });
      rooms.delete(data.code);
    }
  });

  // Handle disconnect
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
