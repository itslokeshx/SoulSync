import { useState, useCallback, useMemo, useRef } from "react";
import {
  Heart,
  Play,
  Shuffle,
  GripVertical,
  ListMusic,
  Loader2,
  Download,
} from "lucide-react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { SongRow } from "../components/cards/SongRow";
import { useApp } from "../context/AppContext";
import { GreenButton } from "../components/ui/GreenButton";
import { downloadPlaylist } from "../utils/downloadSong";
import { shuffleLikedSongs, reorderLikedSongs } from "../api/backend";
import toast from "react-hot-toast";

export const LikedPage = () => {
  const {
    likedSongs,
    currentSong,
    isPlaying,
    playSong: onPlay,
    handleLike: onLike,
    setLikedSongs,
  } = useApp();
  const [shuffling, setShuffling] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  const songs = useMemo(() => Object.values(likedSongs), [likedSongs]);

  // Debounced cloud save — fires 1s after last reorder drag
  const reorderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSaveOrder = useCallback(
    async (newOrder: any[]) => {
      setLikedSongs(newOrder);
      if (reorderDebounceRef.current) clearTimeout(reorderDebounceRef.current);
      reorderDebounceRef.current = setTimeout(async () => {
        try {
          await reorderLikedSongs(newOrder.map((s) => s.id));
        } catch {
          toast.error("Failed to save order to cloud");
        }
      }, 1000);
    },
    [setLikedSongs],
  );

  return (
    <div className="animate-fadeIn">
      <div
        className="flex items-end gap-6 mb-10 p-7 rounded-3xl overflow-hidden relative"
        style={{
          background:
            "linear-gradient(135deg,#450af5 0%,#8b5cf6 50%,#c4efd9 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div
          className="relative w-36 h-36 md:w-40 md:h-40 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg,#450af5,#8b5cf6)",
            boxShadow: "0 20px 60px rgba(69,10,245,0.4)",
          }}
        >
          <Heart size={56} className="text-white fill-white" />
        </div>
        <div className="pb-2 relative">
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.2em] mb-1">
            Playlist
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Liked Songs
          </h1>
          <p className="text-white/60 text-[13px] mt-2">{songs.length} songs</p>
        </div>
      </div>

      {songs.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
          <GreenButton
            onClick={() => onPlay(songs[0], songs)}
            className="flex-shrink-0"
          >
            <Play size={16} className="fill-black" />
            <span className="hidden sm:inline ml-2">Play All</span>
            <span className="sm:hidden ml-2">Play</span>
          </GreenButton>
          <div className="flex gap-3 sm:gap-4 flex-1 items-center">
            <button
              onClick={async () => {
                setShuffling(true);
                try {
                  await shuffleLikedSongs();
                  // Backend shuffles in-place; shuffle local state to reflect it
                  const localShuffled = [...songs].sort(
                    () => Math.random() - 0.5,
                  );
                  setLikedSongs(localShuffled);
                  toast.success("Songs shuffled!");
                } catch {
                  toast.error("Failed to shuffle");
                } finally {
                  setShuffling(false);
                }
              }}
              title="Persistent Shuffle & Reorder"
              disabled={shuffling}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all disabled:opacity-50"
            >
              {shuffling ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Shuffle size={15} />
              )}
            </button>
            <button
              onClick={() => downloadPlaylist(songs as any, "Liked Songs")}
              title="Download All Liked Songs"
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all"
            >
              <Download size={15} />
            </button>

            <button
              onClick={() => setReorderMode(!reorderMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold transition-all ${
                reorderMode
                  ? "bg-sp-green/20 text-sp-green border border-sp-green/30"
                  : "border border-white/10 text-white/50 hover:bg-white/[0.06]"
              }`}
            >
              <ListMusic size={14} />
              {reorderMode ? "Done" : "Reorder"}
            </button>
          </div>
        </div>
      )}

      {songs.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-5">
            <Heart size={28} className="text-sp-muted" />
          </div>
          <p className="text-white font-semibold text-base">
            Songs you like will appear here
          </p>
          <p className="text-sp-sub/60 text-sm mt-1.5">
            Click the ♥ icon next to any song
          </p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={songs}
          onReorder={handleSaveOrder}
          className="space-y-1 pb-10"
        >
          {songs.map((s: any, i) => (
            <LikedSongItem
              key={s.id}
              s={s}
              i={i}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={() => onPlay(s, songs)}
              onLike={onLike}
              reorderMode={reorderMode}
            />
          ))}
        </Reorder.Group>
      )}
    </div>
  );
};

interface LikedSongItemProps {
  s: any;
  i: number;
  currentSong: any;
  isPlaying: boolean;
  onPlay: () => void;
  onLike: (song: any) => void;
  reorderMode: boolean;
}

function LikedSongItem({
  s,
  i,
  currentSong,
  isPlaying,
  onPlay,
  onLike,
  reorderMode,
}: LikedSongItemProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={s}
      dragListener={false}
      dragControls={controls}
      className="flex items-center group relative bg-transparent"
    >
      {reorderMode && (
        <div
          onPointerDown={(e) => controls.start(e)}
          className="w-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-white/20 hover:text-white/60 transition-colors"
        >
          <GripVertical size={16} />
        </div>
      )}
      <div className="flex-1 min-w-0 ml-1">
        <SongRow
          song={s}
          index={i}
          isCurrent={currentSong?.id === s.id}
          isPlaying={isPlaying}
          onPlay={onPlay}
          liked
          onLike={onLike}
        />
      </div>
    </Reorder.Item>
  );
}
