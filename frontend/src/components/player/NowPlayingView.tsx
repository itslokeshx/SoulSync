import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  ListMusic,
  GripVertical,
  Trash2,
  Music,
  Download,
  CheckCircle2,
  Minus,
  Plus,
  Moon,
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
import { useOfflineStore } from "../../store/offlineStore";
import { useDownloadStore } from "../../store/downloadStore";
import { usePlayerStore } from "../../store/playerStore";
import { downloadSong } from "../../utils/downloadSong";
import { EqBars } from "../ui/EqBars";
import { ArtistLinks } from "../ui/ArtistLinks";

const API =
  import.meta.env.VITE_JIOSAAVN_API || "https://jiosaavn.rajputhemant.dev";

interface NowPlayingViewProps {
  isOpen?: boolean;
  onOpen?: () => void;
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
  // Queue props
  queue?: any[];
  queueIndex?: number;
  onJump?: (index: number) => void;
  onMove?: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  onShuffleQueue?: () => void;
}

const VolumeIcon = ({ volume }: { volume: number }) => {
  if (volume === 0) return <VolumeX size={20} />;
  if (volume < 0.5) return <Volume1 size={20} />;
  return <Volume2 size={20} />;
};

export const NowPlayingView = ({
  isOpen = false,
  onOpen,
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
  queue = [],
  queueIndex = -1,
  onJump,
  onMove,
  onRemove,
  onShuffleQueue,
}: NowPlayingViewProps) => {
  const [bgColor, setBgColor] = useState("#18181a");
  const [showVol, setShowVol] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // ── Swipe down to minimize ───────────────────────────────────
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setDragOffset(delta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (dragOffset > 120) {
      onClose();
    }
    setDragOffset(0);
  }, [dragOffset, onClose]);

  const isDownloaded = useOfflineStore((s) => s.isDownloaded);
  const isDownloading = useDownloadStore((s) => s.isDownloading);
  const dlProgress = useDownloadStore(
    (s) => s.active.find((d) => d.id === currentSong?.id)?.progress ?? 0,
  );
  const {
    autoplay,
    toggleAutoplay,
    sleepTimerActive,
    sleepTimerSecondsLeft,
    sleepTimerEndOnTrack,
    setSleepTimer,
  } = usePlayerStore();

  const [showSleepTimerMenu, setShowSleepTimerMenu] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  useEffect(() => {
    if (!showSleepTimerMenu) {
      setShowCustomInput(false);
      setCustomMinutes("");
    }
  }, [showSleepTimerMenu]);

  // Queue drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const played = queue.slice(0, queueIndex);
  const upcoming = queue.slice(queueIndex + 1);
  const toAbsolute = (relIdx: number) => queueIndex + 1 + relIdx;

  const handleDragStart = useCallback((e: React.DragEvent, relIdx: number) => {
    setDragIdx(relIdx);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = "move";
    const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
    ghost.style.opacity = "0.6";
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 20);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, relIdx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIdx !== null && relIdx !== dragIdx) setOverIdx(relIdx);
    },
    [dragIdx],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, relIdx: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== relIdx) {
        onMove?.(toAbsolute(dragIdx), toAbsolute(relIdx));
      }
      setDragIdx(null);
      setOverIdx(null);
    },
    [dragIdx, onMove, queueIndex],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);
  const volTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  // Auto-hide volume popup after inactivity
  const scheduleHideVol = useCallback(() => {
    if (volTimeout.current) clearTimeout(volTimeout.current);
    volTimeout.current = setTimeout(() => setShowVol(false), 2500);
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


  if (!currentSong || !isOpen) return null;
  const img = bestImg(currentSong.image) || FALLBACK_IMG;
  const artists = getArtists(currentSong);
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const volPct = Math.round(volume * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: dragOffset }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex flex-col touch-pan-x"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background:
          "radial-gradient(circle at 20% 30%, #1e1e20, transparent 60%),\n           radial-gradient(circle at 80% 70%, #101012, transparent 80%),\n           linear-gradient(135deg, #18181a 0%, #101012 60%, #000 100%)",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ...no ambient orbs, pure dark gradient... */}

      {/* Drag indicator pill */}
      <div className="flex justify-center pt-2 pb-0 flex-shrink-0">
        <div className="w-10 h-1 bg-white/20 rounded-full" />
      </div>

      <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-12 pt-1 sm:pt-2 pb-1 sm:pb-2 relative z-10 flex-shrink-0">
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
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowQueue((q) => !q)}
            className={`flex items-center gap-1.5 transition-all px-3 py-2 rounded-xl active:scale-95 ${showQueue ? "text-sp-green bg-sp-green/10 border border-sp-green/20" : "text-white/40 hover:text-white hover:bg-white/10 border border-transparent"}`}
            aria-label="Toggle Queue"
          >
            <ListMusic size={17} />
            <span className="text-[12px] font-bold tracking-wide">Up Next</span>
          </button>
          <button
            onClick={(e) => showContextMenu(e.clientX, e.clientY, currentSong)}
            className="text-white/40 hover:text-white transition-all p-2.5 rounded-xl hover:bg-white/10 active:scale-95"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
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
                <ArtistLinks song={currentSong} onArtistClick={onClose} />
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
              {/* Download — 3 states */}
              {isDownloaded(currentSong.id) ? (
                <button
                  className="text-sp-green p-1.5 sm:p-2 rounded-full bg-sp-green/10 active:scale-95 transition-all"
                  aria-label="Downloaded"
                  title="Already downloaded"
                >
                  <CheckCircle2 size={19} />
                </button>
              ) : isDownloading(currentSong.id) ? (
                <div
                  className="relative p-1.5 sm:p-2"
                  aria-label={`Downloading ${dlProgress}%`}
                >
                  <svg
                    className="w-[19px] h-[19px] -rotate-90"
                    viewBox="0 0 20 20"
                  >
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      fill="none"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="2"
                    />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      fill="none"
                      stroke="#1db954"
                      strokeWidth="2"
                      strokeDasharray={`${2 * Math.PI * 8}`}
                      strokeDashoffset={`${2 * Math.PI * 8 * (1 - dlProgress / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <Download
                    size={9}
                    className="absolute inset-0 m-auto text-white/50"
                  />
                </div>
              ) : (
                <button
                  onClick={() => downloadSong(currentSong)}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition-all duration-200 text-white/40 hover:text-white"
                  aria-label="Download for offline"
                  title="Download for offline"
                >
                  <Download size={19} />
                </button>
              )}
              {/* Volume icon + popup */}
              <div ref={volRef} className="relative">
                <button
                  onClick={handleVolInteraction}
                  onMouseEnter={() => setShowVol(true)}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition-all duration-200 text-white/40 hover:text-white"
                >
                  <VolumeIcon volume={volume} />
                </button>
                {/* Horizontal volume popup */}
                {showVol && (
                  <div
                    className="absolute bottom-full right-0 mb-4 flex items-center gap-2 py-2 px-3 rounded-2xl z-50"
                    style={{
                      background: "rgba(18,18,18,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      backdropFilter: "blur(24px)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                    }}
                    onMouseEnter={() => {
                      if (volTimeout.current) clearTimeout(volTimeout.current);
                    }}
                    onMouseLeave={scheduleHideVol}
                  >
                    <button
                      onClick={() => onVolume(Math.max(0, volume - 0.1))}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                      title="Decrease Volume"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="w-12 text-center">
                      <span className="text-[11px] text-white/60 tabular-nums font-bold">
                        {volPct}%
                      </span>
                    </div>
                    <button
                      onClick={() => onVolume(Math.min(1, volume + 0.1))}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
                      title="Increase Volume"
                    >
                      <Plus size={14} />
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
            <button
              onClick={() => setShowSleepTimerMenu(true)}
              className={`transition-all duration-200 p-2 rounded-full flex items-center gap-1 ${
                sleepTimerActive
                  ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full animate-pulse"
                  : "text-white/40 hover:text-white"
              }`}
              title={
                sleepTimerActive
                  ? sleepTimerEndOnTrack
                    ? "Sleep Timer: End of track"
                    : `Sleep Timer: ${
                        sleepTimerSecondsLeft !== null && sleepTimerSecondsLeft < 60
                          ? `${sleepTimerSecondsLeft}s left`
                          : `${Math.ceil((sleepTimerSecondsLeft || 0) / 60)}m left`
                      }`
                  : "Set Sleep Timer"
              }
            >
              <Moon
                size={18}
                className={sleepTimerActive ? "fill-indigo-400" : ""}
              />
              {sleepTimerActive && (
                <span className="text-[10px] font-black">
                  {sleepTimerEndOnTrack
                    ? "End"
                    : sleepTimerSecondsLeft !== null && sleepTimerSecondsLeft < 60
                    ? `${sleepTimerSecondsLeft}s`
                    : `${Math.ceil((sleepTimerSecondsLeft || 0) / 60)}m`}
                </span>
              )}
            </button>
          </div>

          <AnimatePresence>
            {showQueue && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/[0.04] w-full overflow-hidden"
              >
                {/* Next Up header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="px-2.5 py-[3px] rounded-full text-[10px] font-black uppercase tracking-[0.12em]"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(29,185,84,0.18), rgba(16,185,129,0.08))",
                        border: "1px solid rgba(29,185,84,0.28)",
                        color: "#1db954",
                      }}
                    >
                      Up Next
                    </span>
                    <span className="text-white/25 text-[11px] tabular-nums">
                      {upcoming.length}{" "}
                      {upcoming.length === 1 ? "track" : "tracks"}
                    </span>
                  </div>
                  {upcoming.length > 1 && (
                    <button
                      onClick={onShuffleQueue}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 active:scale-95 bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white"
                      title="Shuffle upcoming queue"
                    >
                      <Shuffle size={12} />
                      Shuffle
                    </button>
                  )}
                </div>

                {/* Queue list */}
                <div className="max-h-48 sm:max-h-56 lg:max-h-72 overflow-y-auto hide-scrollbar space-y-0.5">
                  {/* ── Played songs (dimmed) ── */}
                  {played.length > 0 && (
                    <>
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest px-2 py-1.5">
                        Played · {played.length}
                      </p>
                      {played.map((s, i) => {
                        const sImg = bestImg(s.image, "50x50") || FALLBACK_IMG;
                        return (
                          <button
                            key={`played-${s.id}-${i}`}
                            onClick={() => onJump?.(i)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/[0.04] transition-all w-full text-left opacity-35 hover:opacity-60"
                          >
                            <img
                              src={sImg}
                              onError={onImgErr}
                              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] text-white/70 truncate">
                                {s.name}
                              </p>
                              <p className="text-[10px] text-white/25 truncate">
                                <ArtistLinks song={s} onArtistClick={onClose} />
                              </p>
                            </div>
                            <span className="text-[10px] text-white/15 tabular-nums flex-shrink-0">
                              {fmt(s.duration)}
                            </span>
                          </button>
                        );
                      })}
                      <div className="border-t border-white/[0.04] my-1" />
                    </>
                  )}

                  {/* ── Currently playing indicator ── */}
                  {currentSong && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-sp-green/[0.08] border border-sp-green/15">
                      <img
                        src={bestImg(currentSong.image, "50x50") || FALLBACK_IMG}
                        onError={onImgErr}
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-sp-green font-semibold truncate">
                          {currentSong.name}
                        </p>
                        <p className="text-[10px] text-white/30 truncate">
                          <ArtistLinks song={currentSong} onArtistClick={onClose} />
                        </p>
                      </div>
                      <EqBars />
                    </div>
                  )}

                  {/* ── Upcoming songs ── */}
                  {upcoming.length === 0 && played.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Music size={32} className="text-white/10 mb-3" />
                      <p className="text-white/30 text-sm font-medium">
                        Nothing queued up
                      </p>
                      <p className="text-white/15 text-xs mt-1">
                        Play a song to get started
                      </p>
                    </div>
                  ) : (
                    upcoming.map((s, i) => {
                      const isDragging = dragIdx === i;
                      const isOver = overIdx === i;
                      const sImg = bestImg(s.image, "50x50") || FALLBACK_IMG;
                      return (
                        <div
                          key={`${s.id}-${i}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, i)}
                          onDragOver={(e) => handleDragOver(e, i)}
                          onDrop={(e) => handleDrop(e, i)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-150 group cursor-default select-none ${isDragging
                            ? "opacity-30 scale-95"
                            : isOver
                              ? "bg-sp-green/10 border border-sp-green/20"
                              : "hover:bg-white/[0.04] border border-transparent"
                            }`}
                        >
                          {/* Drag handle */}
                          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 transition-colors touch-none">
                            <GripVertical size={14} />
                          </div>

                          {/* Song info — tap to jump */}
                          <button
                            onClick={() => onJump?.(toAbsolute(i))}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <img
                              src={sImg}
                              onError={onImgErr}
                              className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] text-white truncate">
                                {s.name}
                              </p>
                              <p className="text-[11px] text-white/30 truncate">
                                <ArtistLinks song={s} onArtistClick={onClose} />
                              </p>
                            </div>
                          </button>

                          {/* Duration + remove */}
                          <span className="text-[10px] text-white/20 tabular-nums flex-shrink-0">
                            {fmt(s.duration)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove?.(toAbsolute(i));
                            }}
                            className="p-1 rounded-lg text-white/15 hover:text-red-400 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="Remove from queue"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sleep Timer Picker Modal */}
      <AnimatePresence>
        {showSleepTimerMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain"
            onClick={() => setShowSleepTimerMenu(false)}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: "100%", scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-sm max-h-[85vh] sm:max-h-[80vh] flex flex-col bg-zinc-900/95 border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl my-0 sm:my-auto overflow-hidden select-none"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {/* Header handle for mobile bottom sheet look */}
              <div className="sm:hidden flex justify-center pb-3 -mt-2">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <Moon size={20} className="fill-current" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">
                      Sleep Timer
                    </h3>
                    <p className="text-xs text-white/50">
                      Stop music automatically
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSleepTimerMenu(false)}
                  className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded-full hover:bg-white/10"
                >
                  <ChevronDown size={20} />
                </button>
              </div>

              {/* Current status */}
              {sleepTimerActive && (
                <div className="mb-4 p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between flex-shrink-0">
                  <span className="text-xs text-white/70 font-medium">
                    Active:{" "}
                    <span className="text-indigo-400 font-bold">
                      {sleepTimerEndOnTrack
                        ? "End of track"
                        : sleepTimerSecondsLeft !== null && sleepTimerSecondsLeft < 60
                        ? `${sleepTimerSecondsLeft}s left`
                        : `${Math.ceil((sleepTimerSecondsLeft || 0) / 60)}m left`}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      setSleepTimer(null);
                      setShowSleepTimerMenu(false);
                    }}
                    className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors px-2.5 py-1 bg-red-500/10 rounded-lg border border-red-500/20 active:scale-95"
                  >
                    Turn Off
                  </button>
                </div>
              )}

              {/* Options List / Custom Input */}
              {showCustomInput ? (
                <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1 scrollbar-thin touch-pan-y">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-white/45 uppercase tracking-wider">
                      Custom Minutes (1 - 240)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="240"
                        placeholder="Minutes before bed"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/40 rounded-2xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none transition-colors"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const mins = parseInt(customMinutes, 10);
                            if (mins > 0 && mins <= 240) {
                              setSleepTimer(mins * 60);
                              setShowSleepTimerMenu(false);
                            }
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const mins = parseInt(customMinutes, 10);
                          if (mins > 0 && mins <= 240) {
                            setSleepTimer(mins * 60);
                            setShowSleepTimerMenu(false);
                          }
                        }}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/10 active:scale-95 flex-shrink-0"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors py-2 mt-2 font-medium"
                  >
                    ← Back to presets
                  </button>
                </div>
              ) : (
                <div className="space-y-1 flex-1 overflow-y-auto pr-1 max-h-[55vh] sm:max-h-[360px] scrollbar-thin touch-pan-y overscroll-contain pb-2">
                  {[
                    { label: "15 minutes", value: 15 * 60 },
                    { label: "30 minutes", value: 30 * 60 },
                    { label: "Custom...", value: "custom" },
                    { label: "End of track", value: "track" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        if (opt.value === "custom") {
                          setShowCustomInput(true);
                        } else if (opt.value === "track") {
                          setSleepTimer(null, true);
                          setShowSleepTimerMenu(false);
                        } else {
                          setSleepTimer(opt.value as number);
                          setShowSleepTimerMenu(false);
                        }
                      }}
                      className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.06] active:bg-white/10 transition-all flex items-center justify-between group"
                    >
                      <span>{opt.label}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white/40">
                        Set →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
