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
}

interface UIActions {
  toggleSidebar: () => void;
  setQueueOpen: (open: boolean) => void;
  toggleQueue: () => void;
  openAIPlaylist: () => void;
  closeAIPlaylist: () => void;
  showContextMenu: (x: number, y: number, song: unknown) => void;
  hideContextMenu: () => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  sidebarCollapsed: false,
  queueOpen: false,
  aiPlaylistOpen: false,
  contextMenu: { show: false, x: 0, y: 0, song: null },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setQueueOpen: (open) => set({ queueOpen: open }),
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  openAIPlaylist: () => set({ aiPlaylistOpen: true }),
  closeAIPlaylist: () => set({ aiPlaylistOpen: false }),
  showContextMenu: (x, y, song) =>
    set({ contextMenu: { show: true, x, y, song } }),
  hideContextMenu: () =>
    set({ contextMenu: { show: false, x: 0, y: 0, song: null } }),
}));
