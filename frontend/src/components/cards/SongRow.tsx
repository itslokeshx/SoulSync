import { useState } from "react";
import { Play, Heart, MoreHorizontal } from "lucide-react";
import { EqBars } from "../ui/EqBars";
import { bestImg, getArtists, fmt, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";
import { useUIStore } from "../../store/uiStore";

interface SongRowProps {
  song: any;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  liked?: boolean;
  onLike?: (song: any) => void;
}

export const SongRow = ({
  song,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  liked,
  onLike,
}: SongRowProps) => {
  const [hov, setHov] = useState(false);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const img = bestImg(song.image, "50x50") || FALLBACK_IMG;

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, song);
  };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, song);
      }}
      onClick={onPlay}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-300 group/row ${
        isCurrent
          ? "bg-sp-green/[0.08] border border-sp-green/10"
          : "hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        {isCurrent && isPlaying ? (
          <EqBars />
        ) : hov ? (
          <Play size={13} className="text-white fill-white" />
        ) : (
          <span
            className={`text-xs tabular-nums ${isCurrent ? "text-sp-green" : "text-sp-sub"}`}
          >
            {index + 1}
          </span>
        )}
      </div>
      <img
        src={img}
        onError={onImgErr}
        loading="lazy"
        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 group-hover/row:scale-105 transition-transform duration-200"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate ${isCurrent ? "text-sp-green" : "text-white"}`}
        >
          {song.name}
        </p>
        <p className="text-xs text-sp-sub/70 truncate">{getArtists(song)}</p>
      </div>
      <p className="hidden lg:block text-xs text-sp-muted truncate w-36 text-center">
        {song.album?.name || ""}
      </p>
      {onLike && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(song);
          }}
          className={`p-1.5 rounded-full transition-all duration-150 ${
            liked
              ? "text-sp-green opacity-100"
              : `text-sp-sub hover:text-white ${hov ? "opacity-100" : "opacity-0"}`
          }`}
        >
          <Heart size={14} className={liked ? "fill-sp-green" : ""} />
        </button>
      )}
      <button
        onClick={handleMoreClick}
        className={`p-1.5 rounded-full transition-all duration-150 text-sp-sub hover:text-white flex-shrink-0 ${hov ? "opacity-100" : "opacity-0"}`}
      >
        <MoreHorizontal size={14} />
      </button>
      <p className="text-xs text-sp-muted w-9 text-right flex-shrink-0 tabular-nums">
        {fmt(song.duration)}
      </p>
    </div>
  );
};
