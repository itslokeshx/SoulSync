import { create } from "zustand";
import { Song } from "../types/song";

interface QueueState {
  queue: Song[];
  queueIndex: number;
  history: Song[];
  originalQueue: Song[];
  isShuffled: boolean;
}

interface QueueActions {
  setQueue: (songs: Song[], startIndex?: number) => void;
  addNext: (song: Song) => void;
  addLast: (song: Song) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  clear: () => void;
  shuffle: () => void;
  unshuffle: () => void;
  next: (repeatMode: "off" | "one" | "all") => Song | null;
  prev: () => Song | null;
  getCurrentSong: () => Song | null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const useQueueStore = create<QueueState & QueueActions>((set, get) => ({
  queue: [],
  queueIndex: 0,
  history: [],
  originalQueue: [],
  isShuffled: false,

  setQueue: (songs, startIndex = 0) =>
    set({
      queue: songs,
      queueIndex: startIndex,
      originalQueue: songs,
      history: [],
      isShuffled: false,
    }),

  addNext: (song) =>
    set((s) => {
      const newQueue = [...s.queue];
      newQueue.splice(s.queueIndex + 1, 0, song);
      return { queue: newQueue };
    }),

  addLast: (song) => set((s) => ({ queue: [...s.queue, song] })),

  remove: (index) =>
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index);
      const newIndex = index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex;
      return {
        queue: newQueue,
        queueIndex: Math.min(newIndex, newQueue.length - 1),
      };
    }),

  move: (from, to) =>
    set((s) => {
      const newQueue = [...s.queue];
      const [moved] = newQueue.splice(from, 1);
      newQueue.splice(to, 0, moved);
      let newIndex = s.queueIndex;
      if (from === s.queueIndex) newIndex = to;
      else if (from < s.queueIndex && to >= s.queueIndex) newIndex--;
      else if (from > s.queueIndex && to <= s.queueIndex) newIndex++;
      return { queue: newQueue, queueIndex: newIndex };
    }),

  clear: () => set({ queue: [], queueIndex: 0, history: [] }),

  shuffle: () =>
    set((s) => {
      const current = s.queue[s.queueIndex];
      const rest = s.queue.filter((_, i) => i !== s.queueIndex);
      const shuffled = [current, ...shuffleArray(rest)].filter(Boolean);
      return {
        queue: shuffled,
        queueIndex: 0,
        originalQueue: s.queue,
        isShuffled: true,
      };
    }),

  unshuffle: () =>
    set((s) => {
      const current = s.queue[s.queueIndex];
      const origIndex = s.originalQueue.findIndex(
        (song) => song.id === current?.id,
      );
      return {
        queue: s.originalQueue,
        queueIndex: origIndex >= 0 ? origIndex : 0,
        isShuffled: false,
      };
    }),

  next: (repeatMode) => {
    const s = get();
    if (repeatMode === "one") return s.queue[s.queueIndex] || null;

    const current = s.queue[s.queueIndex];
    if (current) {
      set((state) => ({ history: [current, ...state.history].slice(0, 50) }));
    }

    if (s.queueIndex < s.queue.length - 1) {
      set({ queueIndex: s.queueIndex + 1 });
      return s.queue[s.queueIndex + 1];
    }

    if (repeatMode === "all" && s.queue.length > 0) {
      set({ queueIndex: 0 });
      return s.queue[0];
    }

    return null;
  },

  prev: () => {
    const s = get();
    if (s.history.length > 0) {
      const prev = s.history[0];
      set((state) => ({
        history: state.history.slice(1),
        queueIndex: Math.max(0, state.queueIndex - 1),
      }));
      return prev;
    }

    if (s.queueIndex > 0) {
      set({ queueIndex: s.queueIndex - 1 });
      return s.queue[s.queueIndex - 1];
    }

    return null;
  },

  getCurrentSong: () => {
    const s = get();
    return s.queue[s.queueIndex] || null;
  },
}));
