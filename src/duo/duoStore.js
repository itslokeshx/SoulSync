// ─────────────────────────────────────────────────────────────────────────────
// Duo Store — Zustand state for Duo Live Sync feature
// ─────────────────────────────────────────────────────────────────────────────
import { create } from "zustand";

const SESSION_KEY = "duo_session";

const persistSession = (data) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {}
};
const clearPersistedSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
};
export const getPersistedSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Restore from sessionStorage if available
const saved = getPersistedSession();

export const useDuoStore = create((set, get) => ({
  // Connection state
  active: !!saved, // Whether a Duo session is active
  role: saved?.role || null, // "host" | "guest"
  roomCode: saved?.roomCode || null,
  myName: saved?.myName || "",
  partnerName: saved?.partnerName || "",
  partnerConnected: false, // always start disconnected, will get updated on rejoin

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

  startSession: ({ role, roomCode, myName }) => {
    persistSession({ role, roomCode, myName });
    set({
      active: true,
      role,
      roomCode,
      myName,
      modalOpen: false,
      partnerConnected: false,
      songHistory: [],
      messages: [],
    });
  },

  partnerJoined: ({ name }) => {
    // Persist partner name so rejoin knows who partner is
    const s = getPersistedSession();
    if (s) persistSession({ ...s, partnerName: name });
    set({ partnerName: name, partnerConnected: true });
  },

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

  endSession: (songHistory = []) => {
    clearPersistedSession();
    set({
      active: false,
      partnerConnected: false,
      endCardOpen: true,
      songHistory: songHistory.length ? songHistory : get().songHistory,
    });
  },

  fullReset: () => {
    clearPersistedSession();
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
    });
  },
}));
