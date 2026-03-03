// ─────────────────────────────────────────────────────────────────────────────
// Duo Store — Zustand state for Duo Live Sync feature
// ─────────────────────────────────────────────────────────────────────────────
import { create } from "zustand";

export const useDuoStore = create((set, get) => ({
  // Connection state
  active: false, // Whether a Duo session is active
  role: null, // "host" | "guest"
  roomCode: null,
  myName: "",
  partnerName: "",
  partnerConnected: false,

  // UI state
  modalOpen: false, // Create/Join modal
  panelOpen: false, // Side panel showing Duo info
  endCardOpen: false, // End-of-session card

  // Session data
  songHistory: [],
  reactions: [],
  notes: [],
  moodMode: null,
  lastHeartbeat: null,

  // Incoming reaction animation queue
  incomingReactions: [],

  // Actions
  setModalOpen: (open) => set({ modalOpen: open }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setEndCardOpen: (open) => set({ endCardOpen: open }),

  startSession: ({ role, roomCode, myName }) =>
    set({
      active: true,
      role,
      roomCode,
      myName,
      modalOpen: false,
      partnerConnected: false,
      songHistory: [],
      reactions: [],
      notes: [],
      moodMode: null,
    }),

  partnerJoined: ({ name }) =>
    set({ partnerName: name, partnerConnected: true }),

  partnerDisconnected: () => set({ partnerConnected: false }),

  partnerReconnected: ({ name }) =>
    set({ partnerName: name, partnerConnected: true }),

  setSessionState: (room) =>
    set({
      songHistory: room.songHistory || [],
      reactions: room.reactions || [],
      notes: room.notes || [],
      moodMode: room.moodMode || null,
      partnerConnected: room.guest?.connected || false,
      partnerName: room.guest?.name || room.host?.name || "",
    }),

  addReaction: (reaction) =>
    set((s) => ({
      reactions: [...s.reactions, reaction].slice(-100),
      incomingReactions: [
        ...s.incomingReactions,
        { ...reaction, id: Date.now() + Math.random() },
      ],
    })),

  removeIncomingReaction: (id) =>
    set((s) => ({
      incomingReactions: s.incomingReactions.filter((r) => r.id !== id),
    })),

  addNote: (note) => set((s) => ({ notes: [...s.notes, note].slice(-200) })),

  setMoodMode: (mood) => set({ moodMode: mood }),

  updateHeartbeat: () => set({ lastHeartbeat: Date.now() }),

  endSession: (songHistory = []) =>
    set({
      active: false,
      partnerConnected: false,
      endCardOpen: true,
      songHistory: songHistory.length ? songHistory : get().songHistory,
    }),

  fullReset: () =>
    set({
      active: false,
      role: null,
      roomCode: null,
      myName: "",
      partnerName: "",
      partnerConnected: false,
      modalOpen: false,
      panelOpen: false,
      endCardOpen: false,
      songHistory: [],
      reactions: [],
      notes: [],
      moodMode: null,
      lastHeartbeat: null,
      incomingReactions: [],
    }),
}));
