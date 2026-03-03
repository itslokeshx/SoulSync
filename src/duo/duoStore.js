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
  messages: [], // WhatsApp-style persistent chat messages
  lastHeartbeat: null,

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
      messages: [],
    }),

  partnerJoined: ({ name }) =>
    set({ partnerName: name, partnerConnected: true }),

  partnerDisconnected: () => set({ partnerConnected: false }),

  partnerReconnected: ({ name }) =>
    set({ partnerName: name, partnerConnected: true }),

  setSessionState: (room) =>
    set({
      songHistory: room.songHistory || [],
      messages: room.messages || room.notes || [],
      partnerConnected: room.guest?.connected || false,
      partnerName: room.guest?.name || room.host?.name || "",
    }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg].slice(-500) })),

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
      messages: [],
      lastHeartbeat: null,
    }),
}));
