import { create } from "zustand";
import { Song } from "../types/song";

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
  isVideoMode: boolean;
  isPlayerExpanded: boolean;
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
  setIsVideoMode: (v: boolean) => void;
  setPlayerExpanded: (v: boolean) => void;
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
    isVideoMode: false,
    isPlayerExpanded: false,

    playSong: (song) =>
      set({ currentSong: song, isPlaying: true, currentTime: 0, duration: Number(song.duration) || 0 }),
    pause: () => set({ isPlaying: false }),
    resume: () => set({ isPlaying: true }),
    togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
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
    setIsVideoMode: (v) => set({ isVideoMode: v }),
    setPlayerExpanded: (v) => set({ isPlayerExpanded: v }),
  }),
);
