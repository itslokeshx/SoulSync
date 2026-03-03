// ─────────────────────────────────────────────────────────────────────────────
// Room Service — CRUD for Duo rooms via Redis (or in-memory fallback)
// ─────────────────────────────────────────────────────────────────────────────
import { nanoid } from "nanoid";
import { redis } from "./redis.js";

const TTL = 86_400; // 24 hours

const roomKey = (code) => `room:${code}`;
const socketKey = (sid) => `socket:${sid}`;

/** Generate a 6-char uppercase room code */
const genCode = () => nanoid(6).toUpperCase();

export const roomService = {
  /**
   * Create a new Duo room.
   * @param {string} hostName
   * @param {string} hostSocketId
   * @returns {{ code: string, room: object }}
   */
  async create(hostName, hostSocketId) {
    const code = genCode();
    const room = {
      code,
      host: { name: hostName, socketId: hostSocketId, connected: true },
      guest: null,
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      songHistory: [],
      reactions: [],
      notes: [],
      moodMode: null,
      createdAt: Date.now(),
    };
    await redis.set(roomKey(code), room, TTL);
    if (hostSocketId) {
      await redis.set(socketKey(hostSocketId), code, TTL);
    }
    return { code, room };
  },

  /** Fetch a room by code */
  async get(code) {
    return redis.get(roomKey(code));
  },

  /** Update a room (partial merge) */
  async update(code, patch) {
    const room = await redis.get(roomKey(code));
    if (!room) return null;
    const updated = { ...room, ...patch };
    await redis.set(roomKey(code), updated, TTL);
    return updated;
  },

  /** Delete a room */
  async remove(code) {
    await redis.del(roomKey(code));
  },

  /** Join a guest to a room */
  async join(code, guestName, guestSocketId) {
    const room = await redis.get(roomKey(code));
    if (!room) return { error: "Room not found" };
    if (room.guest && room.guest.connected) {
      return { error: "Room is full — only 2 people allowed" };
    }
    room.guest = { name: guestName, socketId: guestSocketId, connected: true };
    await redis.set(roomKey(code), room, TTL);
    if (guestSocketId) {
      await redis.set(socketKey(guestSocketId), code, TTL);
    }
    return { room };
  },

  /** Map a socket id → room code for disconnect cleanup */
  async mapSocket(socketId, code) {
    await redis.set(socketKey(socketId), code, TTL);
  },

  /** Look up which room a socket belongs to */
  async roomForSocket(socketId) {
    return redis.get(socketKey(socketId));
  },

  /** Remove socket mapping */
  async unmapSocket(socketId) {
    await redis.del(socketKey(socketId));
  },

  /** Mark a member as disconnected (by socketId) */
  async disconnect(socketId) {
    const code = await redis.get(socketKey(socketId));
    if (!code) return null;
    const room = await redis.get(roomKey(code));
    if (!room) return null;

    let who = null;
    if (room.host?.socketId === socketId) {
      room.host.connected = false;
      who = "host";
    } else if (room.guest?.socketId === socketId) {
      room.guest.connected = false;
      who = "guest";
    }

    // If both disconnected, remove the room
    if (!room.host?.connected && !room.guest?.connected) {
      await redis.del(roomKey(code));
    } else {
      await redis.set(roomKey(code), room, TTL);
    }

    await redis.del(socketKey(socketId));
    return { code, room, who };
  },
};
