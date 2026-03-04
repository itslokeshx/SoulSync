import { useState } from "react";
import { Play, Pause, Heart, MoreHorizontal } from "lucide-react";
import { EqBars } from "../ui/EqBars";
import { bestImg, getArtists, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";
import { useUIStore } from "../../store/uiStore";
import { useApp } from "../../context/AppContext";

interface SongCardProps {
  song: any;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

export const SongCard = ({
  song,
  isCurrent,
  isPlaying,
  onPlay,
}: SongCardProps) => {
  const [hov, setHov] = useState(false);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const { likedSongs, handleLike } = useApp();
  const img = bestImg(song.image) || FALLBACK_IMG;
  const isLiked = !!likedSongs[song.id];

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onPlay}
      onContextMenu={(e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, song);
      }}
      className={`flex-shrink-0 w-[10.5rem] p-3 rounded-2xl cursor-pointer transition-all duration-300 group ${
        isCurrent
          ? "bg-sp-green/[0.06] border border-sp-green/20"
          : "bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06]"
      }`}
      style={{
        boxShadow: hov
          ? "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)"
          : isCurrent
            ? "0 4px 24px rgba(29,185,84,0.15)"
            : "none",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
      }}
    >
      <div className="relative mb-3 rounded-xl overflow-hidden">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full aspect-square object-cover transition-all duration-500 ${hov ? "scale-110 brightness-[0.35]" : ""}`}
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${hov ? "opacity-100" : "opacity-0"}`}
        />
        {/* Like + More buttons on hover */}
        <div
          className={`absolute top-1.5 right-1.5 flex gap-1 z-20 transition-opacity duration-200 ${hov ? "opacity-100" : "opacity-0"}`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLike(song);
            }}
            className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-all"
          >
            <Heart
              size={12}
              className={isLiked ? "text-sp-green fill-sp-green" : "text-white"}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showContextMenu(e.clientX, e.clientY, song);
            }}
            className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-all"
          >
            <MoreHorizontal size={12} className="text-white" />
          </button>
        </div>
        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${hov || (isCurrent && isPlaying) ? "opacity-100" : "opacity-0"}`}
        >
          {isCurrent && isPlaying && !hov ? (
            <EqBars size="lg" />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              className="w-12 h-12 rounded-full bg-sp-green flex items-center justify-center hover:scale-110 transition-all duration-200 pointer-events-auto"
              style={{ boxShadow: "0 6px 24px rgba(29,185,84,0.5)" }}
            >
              {isCurrent && isPlaying ? (
                <Pause size={17} className="text-black fill-black" />
              ) : (
                <Play size={17} className="text-black fill-black ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>
      <p
        className={`text-[13px] font-semibold truncate leading-tight ${isCurrent ? "text-sp-green" : "text-white"}`}
      >
        {song.name}
      </p>
      <p className="text-[11px] text-sp-sub/70 truncate mt-1">
        {getArtists(song)}
      </p>
    </div>
  );
};
