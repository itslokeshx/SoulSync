import { useState } from "react";
import { Heart, Play, Shuffle } from "lucide-react";
import { SongRow } from "../components/cards/SongRow";
import { useApp } from "../context/AppContext";
import { GreenButton } from "../components/ui/GreenButton";
import { downloadPlaylist } from "../utils/downloadSong";
import { shuffleLikedSongs } from "../api/backend";
import { Loader2, Download } from "lucide-react";
import toast from "react-hot-toast";

export const LikedPage = () => {
  const {
    likedSongs,
    currentSong,
    isPlaying,
    playSong: onPlay,
    handleLike: onLike,
  } = useApp();
  const [shuffling, setShuffling] = useState(false);
  const songs = Object.values(likedSongs);
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
          <GreenButton onClick={() => onPlay(songs[0], songs)} className="flex-shrink-0">
            <Play size={16} className="fill-black" />
            <span className="hidden sm:inline ml-2">Play All</span>
            <span className="sm:hidden ml-2">Play</span>
          </GreenButton>
          <div className="flex gap-3 sm:gap-4">
            <button
              onClick={async () => {
                setShuffling(true);
                try {
                  await shuffleLikedSongs();
                  toast.success("Songs shuffled and reordered!");
                  setTimeout(() => window.location.reload(), 1000);
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
              {shuffling ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />}
            </button>
            <button
              onClick={() => downloadPlaylist(songs as any, "Liked Songs")}
              title="Download All Liked Songs"
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all"
            >
              <Download size={15} />
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
        <div className="space-y-1">
          {songs.map((s: any, i) => (
            <SongRow
              key={s.id}
              song={s}
              index={i}
              isCurrent={currentSong?.id === s.id}
              isPlaying={isPlaying}
              onPlay={() => onPlay(s, songs)}
              liked
              onLike={onLike}
            />
          ))}
        </div>
      )}
    </div>
  );
};
