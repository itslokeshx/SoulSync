import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Song } from "../types/song";
import { usePlayerStore } from "./playerStore";

interface QueueState {
  queue: Song[];
  queueIndex: number;
  autoplay: boolean;
}

interface QueueActions {
  setQueue: (songs: Song[], startIndex?: number) => void;
  addToQueue: (song: Song) => void;
  addNext: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playAtIndex: (index: number) => void;
  playNext: () => void;
  playPrev: () => void;
  setAutoplay: (val: boolean) => void;
  getUpcoming: () => Song[];
  getPast: () => Song[];
  getCurrentSong: () => Song | null;

  // Compatibility aliases for existing components.
  addLast: (song: Song) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  clear: () => void;
  shuffle: () => void;
  unshuffle: () => void;
  next: (repeatMode?: "off" | "one" | "all") => Song | null;
  prev: () => Song | null;
}

function playSong(song: Song | null) {
  if (song) {
    usePlayerStore.getState().playSong(song);
  } else {
    usePlayerStore.setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
    });
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const useQueueStore = create<QueueState & QueueActions>()(
  persist(
    (set, get) => ({
      queue: [],
      queueIndex: -1,
      autoplay: true,

      setQueue: (songs, startIndex = 0) => {
        if (!songs.length) {
          set({ queue: [], queueIndex: -1 });
          playSong(null);
          return;
        }

        const safeIndex = Math.max(0, Math.min(startIndex, songs.length - 1));
        set({ queue: songs, queueIndex: safeIndex });
        playSong(songs[safeIndex] || null);
      },

      addToQueue: (song) =>
        set((state) => {
          if (!state.queue.length || state.queueIndex === -1) {
            playSong(song);
            return { queue: [song], queueIndex: 0 };
          }

          return { queue: [...state.queue, song] };
        }),

      addNext: (song) =>
        set((state) => {
          if (!state.queue.length || state.queueIndex === -1) {
            playSong(song);
            return { queue: [song], queueIndex: 0 };
          }

          const queue = [...state.queue];
          queue.splice(state.queueIndex + 1, 0, song);
          return { queue };
        }),

      removeFromQueue: (index) =>
        set((state) => {
          if (index < 0 || index >= state.queue.length) return {};

          const queue = state.queue.filter((_, i) => i !== index);
          if (!queue.length) {
            playSong(null);
            return { queue: [], queueIndex: -1 };
          }

          let queueIndex = state.queueIndex;
          if (index < state.queueIndex) {
            queueIndex = state.queueIndex - 1;
          } else if (index === state.queueIndex) {
            queueIndex = Math.min(index, queue.length - 1);
            playSong(queue[queueIndex] || null);
          }

          return { queue, queueIndex };
        }),

      clearQueue: () => {
        set({ queue: [], queueIndex: -1 });
        playSong(null);
      },

      playAtIndex: (index) => {
        const song = get().queue[index];
        if (!song) return;
        set({ queueIndex: index });
        playSong(song);
      },

      playNext: () => {
        const state = get();
        if (!state.queue.length) return;

        if (state.queueIndex < 0) {
          get().playAtIndex(0);
          return;
        }

        if (state.queueIndex < state.queue.length - 1) {
          get().playAtIndex(state.queueIndex + 1);
        }
      },

      playPrev: () => {
        const state = get();
        if (state.queueIndex > 0) {
          get().playAtIndex(state.queueIndex - 1);
        }
      },

      setAutoplay: (val) => set({ autoplay: val }),

      getUpcoming: () => {
        const state = get();
        return state.queue.slice(state.queueIndex + 1);
      },

      getPast: () => {
        const state = get();
        if (state.queueIndex <= 0) return [];
        return state.queue.slice(0, state.queueIndex);
      },

      getCurrentSong: () => {
        const state = get();
        return state.queue[state.queueIndex] || null;
      },

      addLast: (song) => get().addToQueue(song),
      remove: (index) => get().removeFromQueue(index),
      clear: () => get().clearQueue(),

      move: (from, to) =>
        set((state) => {
          if (
            from < 0 ||
            to < 0 ||
            from >= state.queue.length ||
            to >= state.queue.length ||
            from === to
          ) {
            return {};
          }

          const queue = [...state.queue];
          const [moved] = queue.splice(from, 1);
          queue.splice(to, 0, moved);

          let queueIndex = state.queueIndex;
          if (from === state.queueIndex) queueIndex = to;
          else if (from < state.queueIndex && to >= state.queueIndex) {
            queueIndex--;
          } else if (from > state.queueIndex && to <= state.queueIndex) {
            queueIndex++;
          }

          return { queue, queueIndex };
        }),

      shuffle: () =>
        set((state) => {
          if (state.queueIndex < 0) return {};
          const pastAndCurrent = state.queue.slice(0, state.queueIndex + 1);
          const upcoming = state.queue.slice(state.queueIndex + 1);
          return { queue: [...pastAndCurrent, ...shuffleArray(upcoming)] };
        }),

      unshuffle: () => {},

      next: (repeatMode) => {
        if (repeatMode === "one") return get().getCurrentSong();
        get().playNext();
        return get().getCurrentSong();
      },

      prev: () => {
        get().playPrev();
        return get().getCurrentSong();
      },
    }),
    {
      name: "soulsync-queue",
      partialize: (state) => ({ autoplay: state.autoplay }),
    },
  ),
);
