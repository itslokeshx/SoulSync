import { create } from "zustand";

export interface ActiveDownload {
    id: string;
    name: string;
    artist: string;
    albumArt: string;
    progress: number; // 0–100
    status: "downloading" | "saving" | "done" | "error";
}

interface DownloadState {
    active: ActiveDownload[];
}

interface DownloadActions {
    startDownload: (dl: Omit<ActiveDownload, "progress" | "status">) => void;
    updateProgress: (id: string, progress: number) => void;
    setStatus: (id: string, status: ActiveDownload["status"]) => void;
    removeDownload: (id: string) => void;
    isDownloading: (id: string) => boolean;
}

export const useDownloadStore = create<DownloadState & DownloadActions>(
    (set, get) => ({
        active: [],

        startDownload: (dl) =>
            set((s) => ({
                active: [
                    ...s.active.filter((d) => d.id !== dl.id),
                    { ...dl, progress: 0, status: "downloading" },
                ],
            })),

        updateProgress: (id, progress) =>
            set((s) => ({
                active: s.active.map((d) =>
                    d.id === id ? { ...d, progress: Math.min(progress, 100) } : d,
                ),
            })),

        setStatus: (id, status) =>
            set((s) => ({
                active: s.active.map((d) => (d.id === id ? { ...d, status } : d)),
            })),

        removeDownload: (id) =>
            set((s) => ({ active: s.active.filter((d) => d.id !== id) })),

        isDownloading: (id) =>
            get().active.some(
                (d) => d.id === id && (d.status === "downloading" || d.status === "saving"),
            ),
    }),
);
