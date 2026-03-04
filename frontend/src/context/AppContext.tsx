import { createContext, useContext } from "react";

export interface AppContextType {
  playSong: (song: any, queue?: any[]) => void;
  currentSong: any;
  isPlaying: boolean;
  likedSongs: Record<string, any>;
  handleLike: (song: any) => void;
  recentlyPlayed: any[];
  handlePlayPause: () => void;
  addToQueue: (song: any) => void;
  playNext: (song: any) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppLayout");
  return ctx;
}

export { AppContext };
