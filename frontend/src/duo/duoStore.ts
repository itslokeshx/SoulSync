import { create } from "zustand";

const SESSION_KEY = "duo_session";

interface SessionData {
  role: string;
  roomCode: string;
  myName: string;
  partnerName?: string;
}

const persistSession = (data: SessionData) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {}
};
const clearPersistedSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
};
export const getPersistedSession = (): SessionData | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saved = getPersistedSession();

interface DuoMessage {
  text: string;
  from: string;
  fromName: string;
  at: number;
}

interface DuoState {
  active: boolean;
  role: string | null;
  roomCode: string | null;
  myName: string;
  partnerName: string;
  partnerConnected: boolean;
  modalOpen: boolean;
  panelOpen: boolean;
  endCardOpen: boolean;
  songHistory: any[];
  messages: DuoMessage[];
  lastHeartbeat: number | null;

  setModalOpen: (open: boolean) => void;
  setPanelOpen: (open: boolean) => void;
  setEndCardOpen: (open: boolean) => void;
  startSession: (opts: {
    role: string;
    roomCode: string;
    myName: string;
  }) => void;
  partnerJoined: (opts: { name: string }) => void;
  partnerDisconnected: () => void;
  partnerReconnected: (opts: { name: string }) => void;
  setSessionState: (room: any) => void;
  addMessage: (msg: DuoMessage) => void;
  updateHeartbeat: () => void;
  endSession: (songHistory?: any[]) => void;
  fullReset: () => void;
}

export const useDuoStore = create<DuoState>((set, get) => ({
  active: !!saved,
  role: saved?.role || null,
  roomCode: saved?.roomCode || null,
  myName: saved?.myName || "",
  partnerName: saved?.partnerName || "",
  partnerConnected: false,
  modalOpen: false,
  panelOpen: false,
  endCardOpen: false,
  songHistory: [],
  messages: [],
  lastHeartbeat: null,

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
      // Don't reset partnerConnected — setSessionState handles it
      songHistory: [],
      messages: [],
    });
  },

  partnerJoined: ({ name }) => {
    const s = getPersistedSession();
    if (s) persistSession({ ...s, partnerName: name });
    set({ partnerName: name, partnerConnected: true });
  },

  partnerDisconnected: () => set({ partnerConnected: false }),
  partnerReconnected: ({ name }) =>
    set({ partnerName: name, partnerConnected: true }),

  setSessionState: (room) => {
    const role = get().role;
    const isHost = role === "host";
    set({
      songHistory: room.songHistory || [],
      messages: room.messages || room.notes || [],
      partnerConnected: isHost
        ? room.guest?.connected || false
        : room.host?.connected || false,
      partnerName: isHost ? room.guest?.name || "" : room.host?.name || "",
    });
  },

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
