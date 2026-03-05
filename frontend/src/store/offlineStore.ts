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
  /** Full song object so we can build a queue for playback */
  songData?: any;
}

interface OfflineState {
  isOfflineMode: boolean;
  downloadedSongs: OfflineSongMeta[];
  lastSyncedAt: number | null;
}

interface OfflineActions {
  enterOfflineMode: () => void;
  exitOfflineMode: () => void;
  addDownloadedSong: (song: OfflineSongMeta) => void;
  removeDownloadedSong: (songId: string) => void;
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
      downloadedSongs: [],
      lastSyncedAt: null,

      enterOfflineMode: () => set({ isOfflineMode: true }),
      exitOfflineMode: () => set({ isOfflineMode: false }),

      addDownloadedSong: (song) =>
        set((s) => ({
          downloadedSongs: [
            ...s.downloadedSongs.filter((d) => d.songId !== song.songId),
            song,
          ],
        })),

      removeDownloadedSong: (songId) =>
        set((s) => ({
          downloadedSongs: s.downloadedSongs.filter((d) => d.songId !== songId),
        })),

      getDownloadedSong: (songId) =>
        get().downloadedSongs.find((d) => d.songId === songId),

      isDownloaded: (songId) =>
        get().downloadedSongs.some((d) => d.songId === songId),

      setLastSynced: () => set({ lastSyncedAt: Date.now() }),
    }),
    {
      name: "soulsync-offline",
      // Use Capacitor Preferences on native, localStorage on web
      ...(isNative() ? { storage: capacitorStorage() } : {}),
    },
  ),
);
