import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { isNative } from "../utils/platform";

export interface OfflineSongMeta {
  songId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  filePath: string; // native URI or blob URL
  downloadedAt: number;
  fileSize: number;
  playlistName?: string;
  /** Full song object so we can build a queue for playback */
  songData?: any;
}

interface OfflineState {
  isOfflineMode: boolean;
  downloads: OfflineSongMeta[];
  lastSyncedAt: number | null;
}

interface OfflineActions {
  enterOfflineMode: () => void;
  exitOfflineMode: () => void;
  addDownloadedSong: (song: OfflineSongMeta) => void;
  deleteDownload: (songId: string) => void;
  updateDownloadsOrder: (downloads: OfflineSongMeta[]) => void;
  clearAllDownloads: () => void;
  getDownloadedSong: (songId: string) => OfflineSongMeta | undefined;
  isDownloaded: (songId: string) => boolean;
  setLastSynced: () => void;
}

/**
 * Build a Capacitor-Preferences backed storage adapter for zustand/persist.
 * Only used on native — web falls back to localStorage automatically.
 */
function capacitorStorage() {
  return createJSONStorage(() => ({
    getItem: async (name: string) => {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: name });
      return value;
    },
    setItem: async (name: string, value: string) => {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: name, value });
    },
    removeItem: async (name: string) => {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: name });
    },
  }));
}

export const useOfflineStore = create<OfflineState & OfflineActions>()(
  persist(
    (set, get) => ({
      isOfflineMode: false,
      downloads: [],
      lastSyncedAt: null,

      enterOfflineMode: () => set({ isOfflineMode: true }),
      exitOfflineMode: () => set({ isOfflineMode: false }),

      addDownloadedSong: (song) =>
        set((s) => ({
          downloads: [
            ...s.downloads.filter((d) => d.songId !== song.songId),
            song,
          ],
        })),

      deleteDownload: (songId) =>
        set((s) => ({
          downloads: s.downloads.filter((d) => d.songId !== songId),
        })),

      updateDownloadsOrder: (downloads) => set({ downloads }),

      clearAllDownloads: () => set({ downloads: [] }),

      getDownloadedSong: (songId) =>
        get().downloads.find((d) => d.songId === songId),

      isDownloaded: (songId) =>
        get().downloads.some((d) => d.songId === songId),

      setLastSynced: () => set({ lastSyncedAt: Date.now() }),
    }),
    {
      name: "soulsync-offline",
      // Use Capacitor Preferences on native, localStorage on web
      ...(isNative() ? { storage: capacitorStorage() } : {}),
    },
  ),
);
