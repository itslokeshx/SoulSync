import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume1,
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
  const [bgColor, setBgColor] = useState("#18181a");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showVol, setShowVol] = useState(false);
  const volTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  // Auto-hide volume popup after inactivity
  const scheduleHideVol = useCallback(() => {
    if (volTimeout.current) clearTimeout(volTimeout.current);
    volTimeout.current = setTimeout(() => setShowVol(false), 1800);
  }, []);

  const handleVolInteraction = useCallback(() => {
    setShowVol(true);
    scheduleHideVol();
  }, [scheduleHideVol]);

  // Close volume popup when tapping outside
  useEffect(() => {
    if (!showVol) return;
    const close = (e: PointerEvent) => {
      if (volRef.current && !volRef.current.contains(e.target as Node)) {
        setShowVol(false);
        if (volTimeout.current) clearTimeout(volTimeout.current);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [showVol]);

  useEffect(() => {
    return () => {
      if (volTimeout.current) clearTimeout(volTimeout.current);
    };
  }, []);

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
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background:
          "linear-gradient(135deg, #18181a 0%, #101012 60%, #000 100%)",
      }}
    >
      {/* ...no ambient orbs, pure dark gradient... */}

      <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-12 pt-3 sm:pt-4 pb-1 sm:pb-2 relative z-10 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-all p-2.5 rounded-xl hover:bg-white/10 active:scale-95"
          aria-label="Close now playing"
        >
          <ChevronDown size={26} />
        </button>
        <div className="text-center">
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
            Now Playing
          </p>
          <p className="text-white/25 text-[11px] mt-0.5 truncate max-w-[220px]">
            {currentSong.album?.name || ""}
          </p>
        </div>
        <button
          onClick={(e) => showContextMenu(e.clientX, e.clientY, currentSong)}
          className="text-white/40 hover:text-white transition-all p-2.5 rounded-xl hover:bg-white/10 active:scale-95"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center px-4 sm:px-8 lg:px-0 gap-4 sm:gap-6 lg:gap-0 min-h-0 relative overflow-y-auto lg:overflow-hidden thin-scrollbar py-2 sm:pb-8 lg:py-0">
        {/* Album art — centered on mobile, left half on desktop */}
        <div className="flex-shrink-0 flex items-center justify-center lg:w-1/2 lg:justify-center">
          <div
            className={`transition-all duration-700 ease-out relative vinyl-ring rounded-2xl sm:rounded-3xl ${isPlaying ? "scale-100" : "scale-[0.9] opacity-70"}`}
            style={{
              boxShadow: `0 20px 60px ${bgColor}30, 0 0 30px ${bgColor}15`,
            }}
          >
            <img
              src={img}
              onError={onImgErr}
              className="w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-[22rem] lg:h-[22rem] xl:w-[26rem] xl:h-[26rem] rounded-2xl sm:rounded-3xl object-cover"
              style={{ boxShadow: "0 16px 50px rgba(0,0,0,0.8)" }}
            />
            {isPlaying && (
              <div className="absolute -inset-1 rounded-2xl sm:rounded-3xl border border-white/[0.04] animate-breathe pointer-events-none" />
            )}
          </div>
        </div>

        {/* Controls column — right half on desktop */}
        <div className="w-full max-w-sm lg:w-1/2 lg:max-w-none lg:px-16 xl:px-24 flex flex-col justify-center">
          <div className="flex items-start justify-between mb-1">
            <div className="min-w-0 flex-1">
              <p className="text-xl sm:text-2xl md:text-3xl font-black text-white truncate leading-tight">
                {currentSong.name}
              </p>
              <p className="text-white/50 mt-0.5 sm:mt-1 text-xs sm:text-sm">
                {artists}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              <button
                onClick={() => onLike(currentSong)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition-all duration-200"
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
              {/* Volume icon + popup */}
              <div ref={volRef} className="relative group">
                <button
                  onClick={handleVolInteraction}
                  onMouseEnter={() => setShowVol(true)}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition-all duration-200 text-white/40 hover:text-white"
                >
                  {volume === 0 ? (
                    <VolumeX size={20} />
                  ) : volume < 0.5 ? (
                    <Volume1 size={20} />
                  ) : (
                    <Volume2 size={20} />
                  )}
                </button>
                {/* Vertical volume popup */}
                {showVol && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col items-center gap-2 py-3 px-2 rounded-2xl z-50"
                    style={{
                      background: "rgba(20,20,20,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      backdropFilter: "blur(24px)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    }}
                    onMouseEnter={() => {
                      if (volTimeout.current) clearTimeout(volTimeout.current);
                    }}
                    onMouseLeave={scheduleHideVol}
                  >
                    <span className="text-[10px] text-white/50 tabular-nums font-semibold">
                      {volPct}%
                    </span>
                    <div
                      className="relative w-[6px] h-28 sm:h-32 rounded-full bg-white/[0.1] cursor-pointer"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const pct = 1 - y / rect.height;
                        onVolume(Math.max(0, Math.min(1, pct)));
                        scheduleHideVol();
                      }}
                      onTouchMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.touches[0].clientY - rect.top;
                        const pct = 1 - y / rect.height;
                        onVolume(Math.max(0, Math.min(1, pct)));
                      }}
                      onTouchEnd={scheduleHideVol}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-full bg-sp-green transition-all duration-100"
                        style={{ height: `${volPct}%` }}
                      />
                      <div
                        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-black/40 transition-all duration-100"
                        style={{ bottom: `calc(${volPct}% - 6px)` }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        onVolume(volume > 0 ? 0 : 0.8);
                        scheduleHideVol();
                      }}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      {volume === 0 ? (
                        <Volume2 size={14} />
                      ) : (
                        <VolumeX size={14} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-1">
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

          {/* Playback controls row */}
          <div className="flex items-center justify-between mt-1 sm:mt-3 mb-1 sm:mb-2 px-2">
            <button
              onClick={onShuffle}
              className={`transition-all duration-200 p-2 rounded-full ${shuffle ? "text-sp-green" : "text-white/40 hover:text-white"}`}
            >
              <Shuffle size={18} />
            </button>
            <button
              onClick={onPrev}
              className="text-white hover:scale-110 transition-all p-1"
            >
              <SkipBack size={26} className="fill-current" />
            </button>
            <button
              onClick={onPlayPause}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center hover:scale-[1.06] active:scale-95 transition-all duration-200"
              style={{ boxShadow: "0 6px 30px rgba(255,255,255,0.18)" }}
            >
              {isPlaying ? (
                <Pause size={22} className="text-black fill-black" />
              ) : (
                <Play size={22} className="text-black fill-black ml-0.5" />
              )}
            </button>
            <button
              onClick={onNext}
              className="text-white hover:scale-110 transition-all p-1"
            >
              <SkipForward size={26} className="fill-current" />
            </button>
            <button
              onClick={onRepeat}
              className={`transition-all duration-200 p-2 rounded-full ${repeat !== "off" ? "text-sp-green" : "text-white/40 hover:text-white"}`}
            >
              {repeat === "one" ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>

          {/* Song Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/[0.06]">
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
