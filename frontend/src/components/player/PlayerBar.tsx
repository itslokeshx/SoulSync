import { useState, useRef, useEffect } from "react";
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
  Volume1,
  Heart,
  ListMusic,
} from "lucide-react";
import { bestImg, getArtists, fmt, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";

interface PlayerBarProps {
  currentSong: any;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: string;
  likedSongs: Record<string, any>;
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
  onOpenFullscreen: () => void;
  onToggleQueue: () => void;
  queueOpen: boolean;
}

const VolumeIcon = ({ volume }: { volume: number }) => {
  if (volume === 0) return <VolumeX size={15} />;
  if (volume < 0.5) return <Volume1 size={15} />;
  return <Volume2 size={15} />;
};

export const PlayerBar = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  shuffle,
  repeat,
  likedSongs,
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
  onOpenFullscreen,
  onToggleQueue,
  queueOpen,
}: PlayerBarProps) => {
  const progress = duration ? currentTime / duration : 0;
  const volPct = Math.round(volume * 100);
  const img = currentSong
    ? bestImg(currentSong.image, "50x50") || FALLBACK_IMG
    : null;

  /* ── Mobile volume popup state ───────────────────────────── */
  const [showMobileVol, setShowMobileVol] = useState(false);
  const volPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMobileVol) return;
    const close = (e: PointerEvent) => {
      if (
        volPopupRef.current &&
        !volPopupRef.current.contains(e.target as Node)
      ) {
        setShowMobileVol(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [showMobileVol]);

  // Don't render the player bar at all when no song is selected
  if (!currentSong) return null;

  return (
    <div className="fixed bottom-[4.5rem] md:bottom-0 left-0 right-0 z-40 select-none">
      {/* ── Mobile progress bar (thin line at top of bar) ──── */}
      <div className="md:hidden w-full h-1 bg-white/[0.08] relative">
        <div
          className="absolute inset-y-0 left-0 bg-sp-green rounded-r-full transition-[width] duration-150 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
        {/* Touch-friendly invisible seek area */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="any"
          value={currentTime}
          onChange={(e) => onSeek(+e.target.value)}
          onPointerDown={onSeekStart}
          onPointerUp={onSeekEnd}
          disabled={!currentSong}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
          style={{ margin: 0, padding: 0 }}
        />
      </div>

      {/* ── Bar content ────────────────────────────────────── */}
      <div
        className="h-16 md:h-[4.75rem] flex items-center px-3 md:px-5 gap-2 md:gap-3"
        style={{
          background:
            "linear-gradient(to top, rgba(5,5,5,0.98), rgba(5,5,5,0.92))",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Ambient color glow */}
        {currentSong && (
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none transition-all duration-1000"
            style={{
              background: `radial-gradient(ellipse at 20% 50%, var(--player-glow, rgba(29,185,84,0.3)) 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Left: song info */}
        <div className="flex items-center gap-2.5 md:gap-3 flex-1 md:flex-none md:w-[28%] min-w-0 relative">
          {currentSong ? (
            <>
              <button
                onClick={onOpenFullscreen}
                className="flex-shrink-0 group relative"
              >
                <img
                  src={img!}
                  onError={onImgErr}
                  className="w-11 h-11 md:w-14 md:h-14 rounded-xl object-cover group-hover:brightness-75 transition-all duration-300 group-hover:scale-105"
                  style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
                />
                {isPlaying && (
                  <div className="absolute inset-0 rounded-xl border-2 border-sp-green/30 animate-breathe pointer-events-none" />
                )}
              </button>
              <div className="min-w-0 flex-1" onClick={onOpenFullscreen}>
                <p className="text-[13px] font-semibold text-white truncate cursor-pointer hover:underline leading-tight">
                  {currentSong.name}
                </p>
                <p className="text-[11px] text-white/35 truncate mt-0.5">
                  {getArtists(currentSong)}
                </p>
              </div>
              <button
                onClick={() => onLike(currentSong)}
                className="ml-1 p-1 flex-shrink-0 hidden md:block"
              >
                <Heart
                  size={14}
                  className={
                    likedSongs?.[currentSong.id]
                      ? "text-sp-green fill-sp-green"
                      : "text-white/25 hover:text-white/50 transition-colors duration-200"
                  }
                />
              </button>
            </>
          ) : (
            <p className="text-sp-muted text-sm hidden md:block">
              Select a song to play
            </p>
          )}
        </div>

        {/* Mobile compact controls */}
        <div className="flex md:hidden items-center gap-1 flex-shrink-0 relative">
          {/* Volume button — mobile */}
          <div ref={volPopupRef} className="relative">
            <button
              onClick={() => setShowMobileVol((v) => !v)}
              className="text-white/50 p-2 hover:text-white transition-all"
            >
              <VolumeIcon volume={volume} />
            </button>

            {/* Volume popup — vertical slider */}
            {showMobileVol && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-4 rounded-2xl flex flex-col items-center gap-2"
                style={{
                  background: "rgba(18,18,18,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(24px)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                <span className="text-[10px] text-white/40 font-semibold tabular-nums">
                  {volPct}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volPct}
                  onChange={(e) => onVolume(+e.target.value / 100)}
                  className="volume-bar volume-bar-vertical"
                  style={
                    {
                      "--volume": `${volume}`,
                      writingMode: "vertical-lr" as any,
                      direction: "rtl",
                      width: "4px",
                      height: "100px",
                    } as React.CSSProperties
                  }
                />
                <button
                  onClick={() => onVolume(volume > 0 ? 0 : 1.0)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <VolumeIcon volume={volume} />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onPrev}
            className="text-white/70 p-2 hover:text-white hover:scale-110 transition-all"
          >
            <SkipBack size={18} className="fill-current" />
          </button>
          <button
            onClick={onPlayPause}
            disabled={!currentSong}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-20"
            style={{ boxShadow: "0 4px 16px rgba(255,255,255,0.15)" }}
          >
            {isPlaying ? (
              <Pause size={15} className="text-black fill-black" />
            ) : (
              <Play size={15} className="text-black fill-black ml-0.5" />
            )}
          </button>
          <button
            onClick={onNext}
            className="text-white/70 p-2 hover:text-white hover:scale-110 transition-all"
          >
            <SkipForward size={18} className="fill-current" />
          </button>
        </div>

        {/* Center: full controls (desktop) */}
        <div className="hidden md:flex flex-col items-center gap-1.5 flex-1 max-w-[44%]">
          <div className="flex items-center gap-4">
            <button
              onClick={onShuffle}
              title="Shuffle"
              className={`transition-colors ${shuffle ? "text-sp-green" : "text-sp-sub hover:text-white"}`}
            >
              <Shuffle size={16} />
            </button>
            <button
              onClick={onPrev}
              title="Previous (←)"
              className="text-white hover:scale-110 transition-transform"
            >
              <SkipBack size={21} className="fill-current" />
            </button>
            <button
              onClick={onPlayPause}
              disabled={!currentSong}
              title="Play/Pause (Space)"
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-[1.08] active:scale-95 transition-all duration-200 disabled:opacity-20"
              style={{ boxShadow: "0 4px 16px rgba(255,255,255,0.15)" }}
            >
              {isPlaying ? (
                <Pause size={16} className="text-black fill-black" />
              ) : (
                <Play size={16} className="text-black fill-black ml-0.5" />
              )}
            </button>
            <button
              onClick={onNext}
              title="Next (→)"
              className="text-white hover:scale-110 transition-transform"
            >
              <SkipForward size={21} className="fill-current" />
            </button>
            <button
              onClick={onRepeat}
              title={`Repeat: ${repeat}`}
              className={`transition-colors ${repeat !== "off" ? "text-sp-green" : "text-sp-sub hover:text-white"}`}
            >
              {repeat === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          </div>
          <div className="flex items-center gap-2 w-full">
            <span className="text-[10px] text-sp-sub w-8 text-right tabular-nums">
              {fmt(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="any"
              value={currentTime}
              onChange={(e) => onSeek(+e.target.value)}
              onPointerDown={onSeekStart}
              onPointerUp={onSeekEnd}
              disabled={!currentSong}
              className="progress-bar flex-1 h-1 rounded-full cursor-pointer disabled:cursor-default"
              style={
                {
                  "--progress": `${duration ? currentTime / duration : 0}`,
                } as React.CSSProperties
              }
            />
            <span className="text-[10px] text-sp-sub w-8 tabular-nums">
              {fmt(duration)}
            </span>
          </div>
        </div>

        {/* Right: volume (desktop) */}
        <div className="hidden md:flex items-center gap-2.5 w-[28%] justify-end min-w-0 pr-1">
          <button
            onClick={onToggleQueue}
            title="Queue (Q)"
            className={`p-1.5 rounded-lg transition-all duration-200 flex-shrink-0 ${queueOpen
              ? "text-sp-green bg-sp-green/10"
              : "text-white/40 hover:text-white/60"
              }`}
          >
            <ListMusic size={15} />
          </button>

          <div className="flex items-center gap-2 flex-1 max-w-[150px]">
            <button
              onClick={() => onVolume(volume > 0 ? 0 : 1.0)}
              title="Mute (M)"
              className="text-white/40 hover:text-white/60 transition-colors duration-200 flex-shrink-0"
            >
              <VolumeIcon volume={volume} />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volPct}
              onChange={(e) => onVolume(+e.target.value / 100)}
              className="volume-bar flex-1 h-1 rounded-full cursor-pointer"
              style={{ "--volume": `${volume}` } as React.CSSProperties}
            />
            <span className="text-[10px] text-white/30 min-w-[28px] tabular-nums text-right">
              {volPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
