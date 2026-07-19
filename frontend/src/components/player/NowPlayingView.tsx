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
  Infinity,
  Video,
  Maximize2,
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

interface NowPlayingViewProps {
  isOpen?: boolean;
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
    isVideoMode, 
    setIsVideoMode,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    isMuted
  } = usePlayerStore();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isSeekingRef = useRef(false);

  const [videoStartTime, setVideoStartTime] = useState(0);
  const prevVideoMode = useRef(isVideoMode);
  const prevSongId = useRef(currentSong?.id);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVideoMode && (!prevVideoMode.current || prevSongId.current !== currentSong?.id)) {
      setVideoStartTime(Math.floor(currentTime));
    }
    prevVideoMode.current = isVideoMode;
    prevSongId.current = currentSong?.id;
  }, [isVideoMode, currentSong?.id, currentTime]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    if (isFullscreen) {
      setShowControls(true);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("pointerdown", handleMouseMove);
    } else {
      setShowControls(true);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerdown", handleMouseMove);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerdown", handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  // Sync YouTube playback events (Time, Duration, PlayState, EndOfVideo)
  useEffect(() => {
    if (!isVideoMode) return;

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes("youtube.com")) return;

      let payload = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!payload || typeof payload !== "object") return;

      if (payload.event === "infoDelivery" || payload.event === "initialDelivery") {
        const info = payload.info;
        if (info) {
          if (typeof info.currentTime === "number" && !isSeekingRef.current) {
            setCurrentTime(info.currentTime);
          }
          if (typeof info.duration === "number") {
            setDuration(info.duration);
          }
          if (typeof info.playerState === "number") {
            if (info.playerState === 1) {
              setIsPlaying(true);
            } else if (info.playerState === 2) {
              setIsPlaying(false);
            } else if (info.playerState === 0) {
              setIsPlaying(false);
              onNext(); // Trigger auto-advance to next song
            }
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isVideoMode, setCurrentTime, setDuration, setIsPlaying, onNext]);

  // Sync state changes from app -> YouTube player
  useEffect(() => {
    if (!isVideoMode || !iframeRef.current || !iframeRef.current.contentWindow) return;

    const command = isPlaying ? "playVideo" : "pauseVideo";
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: command, args: [] }),
      "*"
    );
  }, [isPlaying, isVideoMode]);

  useEffect(() => {
    if (!isVideoMode || !iframeRef.current || !iframeRef.current.contentWindow) return;

    const targetVol = volume * 100;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "setVolume", args: [targetVol] }),
      "*"
    );
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: isMuted ? "mute" : "unMute", args: [] }),
      "*"
    );
  }, [volume, isMuted, isVideoMode]);

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

  const handleSeek = (val: number) => {
    onSeek(val);
    if (isVideoMode && iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [val, true] }),
        "*"
      );
    }
  };

  const handleSeekStart = () => {
    isSeekingRef.current = true;
    onSeekStart();
  };

  const handleSeekEnd = () => {
    isSeekingRef.current = false;
    onSeekEnd();
  };


  if (!currentSong) return null;
  const img = bestImg(currentSong.image) || FALLBACK_IMG;
  const artists = getArtists(currentSong);
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const volPct = Math.round(volume * 100);

  const openTransform = `translateY(${dragOffset}px)`;
  const closedTransform = `translateY(100%)`;
  const transformVal = isOpen ? openTransform : closedTransform;

  const openOpacity = 1 - Math.min(dragOffset / 500, 0.4);
  const opacityVal = isOpen ? openOpacity : 0;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col touch-pan-x transition-all duration-300 ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background:
          "radial-gradient(circle at 20% 30%, #1e1e20, transparent 60%),\n           radial-gradient(circle at 80% 70%, #101012, transparent 80%),\n           linear-gradient(135deg, #18181a 0%, #101012 60%, #000 100%)",
        transform: transformVal,
        transition: isDragging.current ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease",
        opacity: opacityVal,
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
        {/* Album art / Video player container */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center lg:w-1/2 lg:justify-center gap-4">
          {/* Audio / Video Switcher Pills */}
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] p-0.5 rounded-full z-10">
            <button
              onClick={() => setIsVideoMode(false)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                !isVideoMode
                  ? "bg-white/10 text-white shadow-md font-semibold"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Music size={12} />
              <span>Audio</span>
            </button>
            <button
              onClick={() => setIsVideoMode(true)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                isVideoMode
                  ? "bg-white/10 text-white shadow-md font-semibold"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Video size={12} />
              <span>Video</span>
            </button>
          </div>

          <div
            className={`transition-all duration-500 ease-out relative rounded-2xl sm:rounded-3xl overflow-hidden`}
            style={{
              boxShadow: `0 20px 60px ${bgColor}30, 0 0 30px ${bgColor}15`,
            }}
          >
            {isVideoMode ? (
              <div ref={containerRef} className="w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72 lg:w-[22rem] lg:h-[22rem] xl:w-[26rem] xl:h-[26rem] bg-black relative flex items-center justify-center group">
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${currentSong.id}?autoplay=1&controls=0&rel=0&modestbranding=1&enablejsapi=1&origin=${window.location.origin}&iv_load_policy=3&fs=0&disablekb=1&cc_load_policy=0&start=${videoStartTime}`}
                  title={currentSong.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded-2xl sm:rounded-3xl pointer-events-none"
                />
                {!isFullscreen && (
                  <button
                    onClick={toggleFullscreen}
                    className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 border border-white/10 text-white p-2.5 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all active:scale-95 flex items-center justify-center shadow-lg"
                    title="Toggle Fullscreen"
                  >
                    <Maximize2 size={14} className="text-white/80" />
                  </button>
                )}
                {isFullscreen && (
                  <div
                    className={`absolute inset-0 bg-black/60 flex flex-col justify-between p-8 transition-opacity duration-300 pointer-events-auto ${
                      showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    {/* Top Bar */}
                    <div className="flex items-center justify-between w-full">
                      <div className="text-left">
                        <h2 className="text-white text-2xl font-black truncate max-w-xl">{currentSong.name}</h2>
                        <p className="text-white/50 text-sm mt-1 truncate max-w-md">{artists}</p>
                      </div>
                      <button
                        onClick={toggleFullscreen}
                        className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full backdrop-blur-md transition-all active:scale-95 flex items-center justify-center border border-white/10"
                        title="Exit Fullscreen"
                      >
                        <ChevronDown size={24} className="rotate-180 text-white/80" />
                      </button>
                    </div>

                    {/* Play/Pause controls in middle */}
                    <div className="flex items-center justify-center gap-10">
                      <button
                        onClick={onPrev}
                        className="text-white/60 hover:text-white transition-all hover:scale-110 active:scale-90"
                      >
                        <SkipBack size={36} className="fill-current" />
                      </button>
                      <button
                        onClick={onPlayPause}
                        className="w-20 h-20 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl"
                      >
                        {isPlaying ? (
                          <Pause size={30} className="text-black fill-black" />
                        ) : (
                          <Play size={30} className="text-black fill-black ml-1.5" />
                        )}
                      </button>
                      <button
                        onClick={onNext}
                        className="text-white/60 hover:text-white transition-all hover:scale-110 active:scale-90"
                      >
                        <SkipForward size={36} className="fill-current" />
                      </button>
                    </div>

                    {/* Bottom Progress Bar */}
                    <div className="w-full space-y-3">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-white/50 tabular-nums font-medium">{fmt(currentTime)}</span>
                        <input
                          type="range"
                          min={0}
                          max={duration || 0}
                          step="any"
                          value={currentTime}
                          onChange={(e) => handleSeek(+e.target.value)}
                          onPointerDown={handleSeekStart}
                          onPointerUp={handleSeekEnd}
                          className="progress-bar progress-glow flex-1 h-1.5 rounded-full cursor-pointer"
                          style={{
                            "--progress": `${duration ? currentTime / duration : 0}`,
                          } as React.CSSProperties}
                        />
                        <span className="text-xs text-white/50 tabular-nums font-medium">{fmt(duration)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`relative vinyl-ring rounded-2xl sm:rounded-3xl ${isPlaying ? "scale-100" : "scale-[0.9] opacity-70"} transition-all duration-700`}>
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
                <ArtistLinks song={currentSong} />
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
              onChange={(e) => handleSeek(+e.target.value)}
              onPointerDown={handleSeekStart}
              onPointerUp={handleSeekEnd}
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
              onClick={toggleAutoplay}
              className={`transition-all duration-200 p-2 rounded-full ${autoplay ? "text-sp-green" : "text-sp-sub hover:text-white"}`}
              aria-label={autoplay ? "Autoplay on" : "Autoplay off"}
              title={autoplay ? "Autoplay: On" : "Autoplay: Off"}
            >
              <Infinity size={18} />
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
                                <ArtistLinks song={s} />
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
                          <ArtistLinks song={currentSong} />
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
                                <ArtistLinks song={s} />
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
    </div>
  );
};
