import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import {
  bestImg,
  getArtists,
  fmt,
  onImgErr,
  extractColor,
} from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";
import { useUIStore } from "../../store/uiStore";

const API =
  import.meta.env.VITE_JIOSAAVN_API || "https://jiosaavn.rajputhemant.dev";

interface NowPlayingViewProps {
  currentSong: any;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: string;
  liked: boolean;
  onClose: () => void;
  onPlayPause: () => void;
  onSeek: (v: number) => void;
  onSeekStart: () => void;
  onSeekEnd: () => void;
  onVolume: (v: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  onLike: (song: any) => void;
  onPlaySong?: (song: any) => void;
}

export const NowPlayingView = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  shuffle,
  repeat,
  liked,
  onClose,
  onPlayPause,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onVolume,
  onPrev,
  onNext,
  onShuffle,
  onRepeat,
  onLike,
  onPlaySong,
}: NowPlayingViewProps) => {
  const [bgColor, setBgColor] = useState("#121212");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  useEffect(() => {
    if (!currentSong) return;
    const img = bestImg(currentSong.image);
    if (img) extractColor(img).then((c) => c && setBgColor(c));
  }, [currentSong?.id]);

  // Fetch song recommendations
  useEffect(() => {
    if (!currentSong?.id) return;
    setSuggestions([]);
    fetch(`${API}/song/recommend?id=${currentSong.id}&n=3`)
      .then((r) => r.json())
      .then((d) => {
        const songs = Array.isArray(d?.data) ? d.data.slice(0, 3) : [];
        setSuggestions(songs);
      })
      .catch(() => {});
  }, [currentSong?.id]);

  if (!currentSong) return null;
  const img = bestImg(currentSong.image) || FALLBACK_IMG;
  const artists = getArtists(currentSong);
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const volPct = Math.round(volume * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Subtle ambient tint — very faint so it stays dark */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-[0.12] blur-[120px] pointer-events-none"
        style={{ background: bgColor }}
      />

      <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 pt-3 sm:pt-5 pb-1 sm:pb-2 relative">
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white transition-all p-2 rounded-xl hover:bg-white/10 backdrop-blur-sm"
        >
          <ChevronDown size={24} />
        </button>
        <div className="text-center">
          <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em]">
            Now Playing
          </p>
          <p className="text-white/30 text-[11px] mt-0.5 truncate max-w-[220px]">
            {currentSong.album?.name || ""}
          </p>
        </div>
        <button
          onClick={(e) => showContextMenu(e.clientX, e.clientY, currentSong)}
          className="text-white/30 hover:text-white transition-all p-2 rounded-xl hover:bg-white/10 backdrop-blur-sm"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 md:px-10 gap-4 sm:gap-6 md:gap-8 min-h-0 relative overflow-y-auto thin-scrollbar py-2 sm:pb-8">
        <div
          className={`transition-all duration-700 ease-out relative vinyl-ring rounded-2xl sm:rounded-3xl ${isPlaying ? "scale-100" : "scale-[0.9] opacity-70"}`}
          style={{
            boxShadow: `0 30px 80px ${bgColor}60, 0 0 40px ${bgColor}30`,
          }}
        >
          <img
            src={img}
            onError={onImgErr}
            className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-2xl sm:rounded-3xl object-cover"
            style={{ boxShadow: "0 16px 60px rgba(0,0,0,0.7)" }}
          />
          {isPlaying && (
            <div className="absolute -inset-1 rounded-2xl sm:rounded-3xl border border-white/[0.06] animate-breathe pointer-events-none" />
          )}
        </div>

        {/* Controls + Vertical Volume side by side */}
        <div className="w-full max-w-sm flex gap-3 sm:gap-4">
          {/* Main controls column */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3 sm:mb-5">
              <div className="min-w-0 flex-1">
                <p className="text-xl sm:text-2xl md:text-3xl font-black text-white truncate leading-tight">
                  {currentSong.name}
                </p>
                <p className="text-white/50 mt-0.5 sm:mt-1 text-xs sm:text-sm">
                  {artists}
                </p>
              </div>
              <button
                onClick={() => onLike(currentSong)}
                className="mt-1 ml-3 flex-shrink-0 p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition-all duration-200"
              >
                <Heart
                  size={20}
                  className={
                    liked
                      ? "text-sp-green fill-sp-green"
                      : "text-sp-sub hover:text-white transition-colors"
                  }
                />
              </button>
            </div>

            {/* Top features: Shuffle & Repeat */}
            <div className="flex items-center justify-center gap-8 sm:gap-10 mb-3 sm:mb-4">
              <button
                onClick={onShuffle}
                className={`transition-all duration-200 p-2 sm:p-3 rounded-full ${shuffle ? "text-sp-green bg-sp-green/10" : "text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                <Shuffle size={20} />
              </button>
              <button
                onClick={onRepeat}
                className={`transition-all duration-200 p-2 sm:p-3 rounded-full ${repeat !== "off" ? "text-sp-green bg-sp-green/10" : "text-white/40 hover:text-white hover:bg-white/5"}`}
              >
                {repeat === "one" ? (
                  <Repeat1 size={20} />
                ) : (
                  <Repeat size={20} />
                )}
              </button>
            </div>

            {/* Song progress bar */}
            <div className="mb-1 sm:mb-2">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step="any"
                value={currentTime}
                onChange={(e) => onSeek(+e.target.value)}
                onPointerDown={onSeekStart}
                onPointerUp={onSeekEnd}
                className="progress-bar progress-glow w-full h-1.5 rounded-full cursor-pointer"
                style={
                  {
                    "--progress": `${duration ? currentTime / duration : 0}`,
                  } as React.CSSProperties
                }
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px] text-white/40 tabular-nums">
                  {fmt(currentTime)}
                </span>
                <span className="text-[11px] text-white/40 tabular-nums">
                  {fmt(duration)}
                </span>
              </div>
            </div>

            {/* Bottom features: Skip & Play controls */}
            <div className="flex items-center justify-center gap-5 sm:gap-6 mt-2 sm:mt-4 mb-2 sm:mb-4">
              <button
                onClick={onPrev}
                className="text-white hover:scale-110 transition-all p-1"
              >
                <SkipBack
                  size={26}
                  className="fill-current sm:w-[30px] sm:h-[30px]"
                />
              </button>
              <button
                onClick={onPlayPause}
                className="w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full bg-white flex items-center justify-center hover:scale-[1.06] active:scale-95 transition-all duration-200"
                style={{ boxShadow: "0 6px 36px rgba(255,255,255,0.2)" }}
              >
                {isPlaying ? (
                  <Pause
                    size={22}
                    className="text-black fill-black sm:w-[26px] sm:h-[26px]"
                  />
                ) : (
                  <Play
                    size={22}
                    className="text-black fill-black ml-0.5 sm:w-[26px] sm:h-[26px] sm:ml-1"
                  />
                )}
              </button>
              <button
                onClick={onNext}
                className="text-white hover:scale-110 transition-all p-1"
              >
                <SkipForward
                  size={26}
                  className="fill-current sm:w-[30px] sm:h-[30px]"
                />
              </button>
            </div>
          </div>

          {/* Vertical Volume Slider — right side */}
          <div className="flex flex-col items-center gap-1.5 sm:gap-2 pt-10 sm:pt-14 flex-shrink-0">
            <button
              onClick={() => onVolume(1)}
              className="text-white/40 hover:text-white transition-colors"
            >
              <Volume2 size={14} className="sm:w-4 sm:h-4" />
            </button>

            {/* Vertical track */}
            <div
              className="relative w-[5px] sm:w-[6px] h-28 sm:h-36 rounded-full bg-white/[0.08] cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const pct = 1 - y / rect.height;
                onVolume(Math.max(0, Math.min(1, pct)));
              }}
              onTouchMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.touches[0].clientY - rect.top;
                const pct = 1 - y / rect.height;
                onVolume(Math.max(0, Math.min(1, pct)));
              }}
            >
              {/* Filled portion (bottom-up) */}
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full bg-sp-green transition-all duration-100"
                style={{ height: `${volPct}%` }}
              />
              {/* Thumb dot */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white shadow-lg shadow-black/40 transition-all duration-100"
                style={{ bottom: `calc(${volPct}% - 5px)` }}
              />
            </div>

            <button
              onClick={() => onVolume(volume > 0 ? 0 : 0.8)}
              className="text-white/40 hover:text-white transition-colors"
            >
              <VolumeX size={14} className="sm:w-4 sm:h-4" />
            </button>
            <span className="text-[9px] sm:text-[10px] text-white/30 tabular-nums font-medium">
              {volPct}%
            </span>
          </div>
        </div>

        {/* Song Suggestions */}
        <div className="w-full max-w-sm">
          {suggestions.length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3">
                Similar Songs
              </p>
              <div className="space-y-1.5">
                {suggestions.map((s: any) => {
                  const sImg = bestImg(s.image, "50x50") || FALLBACK_IMG;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onPlaySong?.(s)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] transition-all group"
                    >
                      <img
                        src={sImg}
                        onError={onImgErr}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                          {s.name}
                        </p>
                        <p className="text-[11px] text-white/30 truncate">
                          {getArtists(s)}
                        </p>
                      </div>
                      <Play
                        size={14}
                        className="text-white/20 group-hover:text-white flex-shrink-0 transition-colors"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
