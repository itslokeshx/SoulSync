import { create } from "zustand";
import { Song } from "../types/song";
import { recordRecentlyPlayed } from "../utils/recentHistory";

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: "off" | "one" | "all";
  autoplay: boolean;
  isPlayerExpanded: boolean;
  // Sleep Timer
  sleepTimerActive: boolean;
  sleepTimerSecondsLeft: number | null;
  sleepTimerEndOnTrack: boolean;
}

interface PlayerActions {
  playSong: (song: Song) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setDuration: (d: number) => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (v: boolean) => void;
  toggleAutoplay: () => void;
  setPlayerExpanded: (v: boolean) => void;
  setSleepTimer: (seconds: number | null, endOnTrack?: boolean) => void;
}

export const usePlayerStore = create<PlayerState & PlayerActions>(
  (set, get) => ({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1.0,
    isMuted: false,
    isShuffle: false,
    repeatMode: "off",
    autoplay: true,
    isPlayerExpanded: false,
    // Sleep Timer
    sleepTimerActive: false,
    sleepTimerSecondsLeft: null,
    sleepTimerEndOnTrack: false,

    playSong: (song) => {
      recordRecentlyPlayed(song);
      set({
        currentSong: song,
        isPlaying: true,
        currentTime: 0,
        duration: Number(song.duration) || 0,
      });
      const audio = document.querySelector("audio");
      if (audio) {
        audio.play().catch(() => {});
      }
    },
    pause: () => {
      const audio = document.querySelector("audio");
      if (audio) {
        audio.pause();
      }
      set({ isPlaying: false });
    },
    resume: () => {
      const audio = document.querySelector("audio");
      if (audio) {
        audio.play().catch(() => {});
      }
      set({ isPlaying: true });
    },
    togglePlay: () => {
      const audio = document.querySelector("audio");
      const nextIsPlaying = !get().isPlaying;
      if (audio) {
        if (nextIsPlaying) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      }
      set({ isPlaying: nextIsPlaying });
    },
    seekTo: (time) => set({ currentTime: time }),
    setVolume: (vol) => set({ volume: vol, isMuted: vol === 0 }),
    toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
    toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
    cycleRepeat: () =>
      set((s) => ({
        repeatMode:
          s.repeatMode === "off"
            ? "all"
            : s.repeatMode === "all"
              ? "one"
              : "off",
      })),
    setDuration: (d) => set({ duration: d }),
    setCurrentTime: (t) => set({ currentTime: t }),
    setIsPlaying: (v) => set({ isPlaying: v }),
    toggleAutoplay: () => set((s) => ({ autoplay: !s.autoplay })),
    setPlayerExpanded: (v) => set({ isPlayerExpanded: v }),
    setSleepTimer: (seconds, endOnTrack = false) =>
      set({
        sleepTimerActive: seconds !== null || endOnTrack,
        sleepTimerSecondsLeft: seconds,
        sleepTimerEndOnTrack: endOnTrack,
      }),
  }),
);

