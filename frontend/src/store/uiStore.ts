import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  queueOpen: boolean;
  aiPlaylistOpen: boolean;
  contextMenu: {
    show: boolean;
    x: number;
    y: number;
    song: unknown;
  };
  authGate: {
    open: boolean;
    message: string;
  };
}

interface UIActions {
  toggleSidebar: () => void;
  setQueueOpen: (open: boolean) => void;
  toggleQueue: () => void;
  openAIPlaylist: () => void;
  closeAIPlaylist: () => void;
  showContextMenu: (x: number, y: number, song: unknown) => void;
  hideContextMenu: () => void;
  openAuthGate: (message?: string) => void;
  closeAuthGate: () => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  sidebarCollapsed: false,
  queueOpen: false,
  aiPlaylistOpen: false,
  contextMenu: { show: false, x: 0, y: 0, song: null },
  authGate: { open: false, message: "" },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setQueueOpen: (open) => set({ queueOpen: open }),
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  openAIPlaylist: () => set({ aiPlaylistOpen: true }),
  closeAIPlaylist: () => set({ aiPlaylistOpen: false }),
  showContextMenu: (x, y, song) =>
    set({ contextMenu: { show: true, x, y, song } }),
  hideContextMenu: () =>
    set({ contextMenu: { show: false, x: 0, y: 0, song: null } }),
  openAuthGate: (msg) =>
    set({ authGate: { open: true, message: msg || "Sign in to continue" } }),
  closeAuthGate: () => set({ authGate: { open: false, message: "" } }),
}));
