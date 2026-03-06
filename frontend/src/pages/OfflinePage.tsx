import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  WifiOff,
  Play,
  Pause,
  Shuffle,
  Trash2,
  Download,
  Music2,
  LogIn,
  HardDrive,
  FolderOpen,
  SkipBack,
  SkipForward,
  ChevronDown,
  Repeat,
  Repeat1,
  GripVertical,
  ChevronUp,
  ListMusic,
  Music,
  UserPlus,
} from "lucide-react";
import {
  getOfflineSongs,
  getOfflineBlob,
  removeOfflineSong,
  getOfflineStorageSize,
  saveOfflineSong,
  updateOfflineSongOrder,
  type OfflineSong,
} from "../utils/offlineDB";
import { bestImg, onImgErr, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import toast from "react-hot-toast";

export default function OfflinePage() {
  const [songs, setSongs] = useState<OfflineSong[]>([]);
  const [queue, setQueue] = useState<OfflineSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [storageSize, setStorageSize] = useState("0 KB");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffled, setShuffled] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [npOpen, setNpOpen] = useState(false);
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [showQueue, setShowQueue] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const blobUrlsRef = useRef<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<OfflineSong[]>([]);
  const queueIndexRef = useRef(-1);
  const shuffledRef = useRef(false);
  const repeatRef = useRef<"off" | "all" | "one">("off");

  const currentSong = queueIndex >= 0 ? queue[queueIndex] : null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, size] = await Promise.all([
        getOfflineSongs(),
        getOfflineStorageSize(),
      ]);
      // Sort by order if it exists, else by savedAt
      const sorted = s.sort((a: OfflineSong, b: OfflineSong) => {
        if (a.order !== undefined && b.order !== undefined)
          return a.order - b.order;
        return b.savedAt - a.savedAt;
      });
      setSongs(sorted);
      setStorageSize(size);
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
      audioRef.current.pause();
      audioRef.current.src = "";
    };
  }, [refresh]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);
  useEffect(() => {
    shuffledRef.current = shuffled;
  }, [shuffled]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const playIndex = useCallback(async (q: OfflineSong[], idx: number) => {
    const song = q[idx];
    if (!song) return;
    try {
      let blobUrl = blobUrlsRef.current.get(song.id);
      if (!blobUrl) {
        const blob = await getOfflineBlob(song.id);
        if (!blob) {
          toast.error(`Audio not found: "${song.name}"`);
          return;
        }
        blobUrl = URL.createObjectURL(blob);
        blobUrlsRef.current.set(song.id, blobUrl);
      }
      const audio = audioRef.current;
      audio.pause();
      audio.src = blobUrl;
      audio.currentTime = 0;
      setCurrentTime(0);
      setDuration(0);
      setQueueIndex(idx);
      queueIndexRef.current = idx;
      try {
        await audio.play();
      } catch {
        /* autoplay blocked */
      }
    } catch {
      toast.error("Failed to play song");
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () =>
      setDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const q = queueRef.current;
      const idx = queueIndexRef.current;
      const rep = repeatRef.current;
      if (rep === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      if (!q.length) return;
      let next: number;
      if (shuffledRef.current) {
        next = Math.floor(Math.random() * q.length);
      } else {
        next = idx + 1;
        if (next >= q.length) {
          if (rep === "all") next = 0;
          else return;
        }
      }
      playIndex(q, next);
    };
    const onError = () => {
      toast.error("Audio playback failed");
      setIsPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [playIndex]);

  // Media Session for notification / lock screen controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current.pause();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => handleNext());
    navigator.mediaSession.setActionHandler("previoustrack", () =>
      handlePrev(),
    );
    try {
      navigator.mediaSession.setActionHandler("seekto", (d) => {
        if (d.seekTime != null) {
          audioRef.current.currentTime = d.seekTime;
          setCurrentTime(d.seekTime);
        }
      });
    } catch {}
  }, []);

  // Update media metadata when song changes
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;
    const artwork: MediaImage[] = [];
    const img =
      bestImg(currentSong.image, "150x150") ||
      (typeof currentSong.albumArt === "string" ? currentSong.albumArt : null);
    if (img) artwork.push({ src: img, sizes: "150x150", type: "image/jpeg" });
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.name || "Unknown",
      artist: currentSong.artist || "Unknown",
      artwork,
    });
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [currentSong?.id, isPlaying]);

  // Update position state for notification seek bar
  useEffect(() => {
    if (
      !("mediaSession" in navigator) ||
      !navigator.mediaSession.setPositionState
    )
      return;
    try {
      if (duration > 0 && isFinite(duration)) {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(currentTime, duration),
        });
      }
    } catch {}
  }, [currentTime, duration]);

  const handlePlay = async (song: OfflineSong, allSongs: OfflineSong[]) => {
    const idx = allSongs.findIndex((s) => s.id === song.id);
    setQueue(allSongs);
    queueRef.current = allSongs;
    await playIndex(allSongs, idx >= 0 ? idx : 0);
  };

  const handlePlayAll = async () => {
    if (!songs.length) return;
    setQueue(songs);
    queueRef.current = songs;
    await playIndex(songs, 0);
  };

  const handleShuffleAll = async () => {
    if (!songs.length) return;
    const list = [...songs].sort(() => Math.random() - 0.5);
    setShuffled(true);
    shuffledRef.current = true;
    setQueue(list);
    queueRef.current = list;
    await playIndex(list, 0);
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio.src) return;
    if (isPlaying) audio.pause();
    else audio.play().catch(() => {});
  };

  const handleNext = () => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    if (!q.length) return;
    const next = shuffledRef.current
      ? Math.floor(Math.random() * q.length)
      : (idx + 1) % q.length;
    playIndex(q, next);
  };

  const handlePrev = () => {
    const audio = audioRef.current;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    playIndex(q, Math.max(0, idx - 1));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    audioRef.current.currentTime = v;
    setCurrentTime(v);
  };

  const handleRemove = async (id: string, name: string) => {
    const url = blobUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(id);
    }
    if (currentSong?.id === id) {
      audioRef.current.pause();
      audioRef.current.src = "";
      setQueueIndex(-1);
      setQueue([]);
    }
    await removeOfflineSong(id);
    toast.success(`Removed "${name}"`);
    refresh();
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    setIsDragging(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (isDragging === null || isDragging === index) return;

    const newList = [...songs];
    const item = newList[isDragging];
    newList.splice(isDragging, 1);
    newList.splice(index, 0, item);

    setIsDragging(index);
    setSongs(newList);
  };

  const onDragEnd = async () => {
    setIsDragging(null);
    try {
      await updateOfflineSongOrder(songs.map((s) => s.id));
    } catch {
      toast.error("Failed to save order");
    }
  };

  const handleImportLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    let imported = 0;
    for (const file of Array.from(files)) {
      try {
        const name = file.name.replace(/\.[^/.]+$/, "");
        const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let dur = 0;
        try {
          const tempUrl = URL.createObjectURL(file);
          const a = new Audio(tempUrl);
          dur = await new Promise<number>((resolve) => {
            a.addEventListener("loadedmetadata", () => {
              resolve(Math.round(a.duration));
              URL.revokeObjectURL(tempUrl);
            });
            a.addEventListener("error", () => {
              resolve(0);
              URL.revokeObjectURL(tempUrl);
            });
          });
        } catch {}
        const song: OfflineSong = {
          id,
          name,
          artist: "Local file",
          albumArt: "",
          image: [],
          downloadUrl: [],
          duration: dur,
          savedAt: Date.now(),
        };
        await saveOfflineSong(song, file);
        imported++;
      } catch {
        toast.error(`Failed to import "${file.name}"`);
      }
    }
    if (imported > 0) {
      toast.success(`Imported ${imported} song${imported > 1 ? "s" : ""}`);
      refresh();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cycleRepeat = () => {
    setRepeat((r) => {
      const n = r === "off" ? "all" : r === "all" ? "one" : "off";
      repeatRef.current = n;
      return n;
    });
  };

  const songImg = (s: OfflineSong) =>
    bestImg(s.image, "50x50") ||
    (typeof s.albumArt === "string" ? s.albumArt : null) ||
    FALLBACK_IMG;
  const songImgLg = (s: OfflineSong) =>
    bestImg(s.image, "500x500") ||
    bestImg(s.image, "150x150") ||
    (typeof s.albumArt === "string" ? s.albumArt : null) ||
    FALLBACK_IMG;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="h-screen bg-sp-black flex flex-col overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleImportLocal}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-[#060606]/90 border-b border-white/[0.04]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center">
              <Music2 size={14} className="text-black" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-extrabold text-white">
              Soul<span className="text-sp-green">Sync</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-white/35">
              <WifiOff size={14} />
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Offline
              </span>
            </div>
            <button
              onClick={() => (window.location.href = "/login?mode=register")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sp-green text-black text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              <UserPlus size={12} />
              Sign Up
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full overflow-y-auto hide-scrollbar"
        style={{ paddingBottom: currentSong ? "140px" : "24px" }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-sp-green border-t-transparent rounded-full animate-spin" />
            <span className="text-white/30 text-sm">Loading songs…</span>
          </div>
        ) : songs.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Your Downloads ({songs.length})
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5 text-white/30 text-[11px]">
                  <HardDrive size={11} />
                  <span>{storageSize} stored</span>
                </div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-[12px] font-semibold hover:bg-white/[0.06] active:scale-95 transition-all"
              >
                <FolderOpen size={13} />
                Import
              </button>
            </div>
            <div className="flex gap-3 mb-6">
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-sp-green text-black text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                <Play size={16} className="fill-current" />
                Play All
              </button>
              <button
                onClick={handleShuffleAll}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 text-white text-[13px] font-semibold hover:bg-white/[0.06] active:scale-95 transition-all"
              >
                <Shuffle size={14} />
                Shuffle
              </button>
            </div>
            <div className="space-y-1">
              {songs.map((s, i) => {
                const isActive = currentSong?.id === s.id;
                return (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDragEnd={onDragEnd}
                    onClick={() => {
                      handlePlay(s, songs);
                      setNpOpen(true);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl group transition-all cursor-pointer active:scale-[0.98] ${
                      isDragging === i ? "opacity-30 bg-white/[0.08]" : ""
                    } ${isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}
                  >
                    <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical size={16} className="text-white/20" />
                    </div>
                    <div className="relative flex-shrink-0">
                      <img
                        src={songImg(s)}
                        onError={onImgErr}
                        className="w-12 h-12 rounded-xl object-cover"
                        alt=""
                      />
                      {isActive && isPlaying && (
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                          <div className="flex items-end gap-[2px] h-3">
                            {[0.2, 0.4, 0.3, 0.5].map((d, idx) => (
                              <motion.div
                                key={idx}
                                animate={{ height: [4, 12, 4] }}
                                transition={{
                                  duration: 0.6,
                                  delay: d,
                                  repeat: Infinity,
                                }}
                                className="w-1 bg-sp-green rounded-full"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 ml-1">
                      <p
                        className={`text-[13px] font-semibold truncate ${isActive ? "text-sp-green" : "text-white"}`}
                      >
                        {s.name}
                      </p>
                      <p className="text-[11px] text-white/35 truncate">
                        {s.artist}
                      </p>
                    </div>
                    <span className="text-[10px] text-white/20 tabular-nums flex-shrink-0">
                      {fmt(s.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(s.id, s.name);
                      }}
                      className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Download size={64} className="text-white/[0.06] mb-6" />
            <h3 className="text-lg font-bold text-white/40 mb-2">
              No offline songs yet
            </h3>
            <p className="text-white/20 text-sm mb-8 max-w-xs">
              Import songs from your device or download while online
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-sp-green text-black text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                <FolderOpen size={16} />
                Import from device
              </button>
              <button
                onClick={() => (window.location.href = "/login")}
                className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-white text-[13px] font-semibold hover:bg-white/[0.06] active:scale-95 transition-all"
              >
                <LogIn size={16} />
                Sign in
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mini Player — tappable to open full-screen */}
      {currentSong && !npOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-2xl border-t border-white/[0.06] px-4 pt-2"
          style={{
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] text-white/30 tabular-nums w-7 text-right">
              {fmt(currentTime)}
            </span>
            <div className="flex-1 relative h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-sp-green rounded-full transition-none"
                style={{ width: `${progress}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 1}
                value={currentTime}
                step={0.5}
                onChange={handleSeek}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
              />
            </div>
            <span className="text-[10px] text-white/30 tabular-nums w-7">
              {fmt(duration)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNpOpen(true)}
              className="flex items-center gap-2.5 flex-1 min-w-0"
            >
              <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex-shrink-0 overflow-hidden">
                <img
                  src={songImg(currentSong)}
                  onError={onImgErr}
                  className="w-full h-full object-cover"
                  alt=""
                />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">
                  {currentSong.name}
                </p>
                <p className="text-[10px] text-white/35 truncate">
                  {currentSong.artist}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-2 text-white/50 hover:text-white transition-colors"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={handlePlayPause}
                className="w-10 h-10 rounded-full bg-sp-green flex items-center justify-center text-black hover:brightness-110 active:scale-95 transition-all"
              >
                {isPlaying ? (
                  <Pause size={18} className="fill-current" />
                ) : (
                  <Play size={18} className="fill-current ml-0.5" />
                )}
              </button>
              <button
                onClick={handleNext}
                className="p-2 text-white/50 hover:text-white transition-colors"
              >
                <SkipForward size={18} />
              </button>
            </div>
            <button
              onClick={() => setShuffled((s) => !s)}
              className={`p-2 transition-colors ${shuffled ? "text-sp-green" : "text-white/30"}`}
            >
              <Shuffle size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ══════ Full-Screen Now Playing View ══════ */}
      {currentSong && npOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            background:
              "linear-gradient(180deg, #1c1c1e 0%, #0e0e0f 45%, #060606 100%)",
          }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
            <button
              onClick={() => {
                setNpOpen(false);
                setShowQueue(false);
              }}
              className="p-2 -ml-2 text-white/60 hover:text-white transition-colors"
            >
              <ChevronDown size={24} />
            </button>
            <div className="text-center">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
                {showQueue ? "Up Next" : "Now Playing"}
              </p>
              <p className="text-[11px] text-white/50 font-medium truncate max-w-[180px]">
                {showQueue
                  ? `${Math.max(0, queue.length - queueIndex - 1)} tracks left`
                  : "Offline Mode"}
              </p>
            </div>
            <button
              onClick={() => setShowQueue((q) => !q)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl active:scale-95 transition-all border ${
                showQueue
                  ? "text-sp-green bg-sp-green/10 border-sp-green/20"
                  : "text-white/40 hover:text-white hover:bg-white/[0.08] border-transparent"
              }`}
            >
              <ListMusic size={17} />
              <span className="text-[12px] font-bold tracking-wide">Queue</span>
            </button>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {!showQueue ? (
              /* ── Now Playing ── */
              <>
                {/* Album Art */}
                <div className="flex-1 flex items-center justify-center px-10 py-4">
                  <motion.div
                    animate={isPlaying ? { scale: 1 } : { scale: 0.9 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/70 relative"
                  >
                    <img
                      src={songImgLg(currentSong)}
                      onError={onImgErr}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 rounded-2xl border border-white/[0.04] animate-breathe pointer-events-none" />
                    )}
                  </motion.div>
                </div>

                {/* Song Info */}
                <div className="px-8 mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold text-white truncate">
                      {currentSong.name}
                    </p>
                    <p className="text-[14px] text-white/50 truncate mt-0.5">
                      {currentSong.artist}
                    </p>
                  </div>
                  <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-white/[0.06] text-white/30 text-[10px] font-semibold tabular-nums">
                    {queueIndex + 1} / {queue.length}
                  </span>
                </div>

                {/* Seek Bar */}
                <div className="px-8 mb-3">
                  <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-sp-green rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={duration || 1}
                      value={currentTime}
                      step={0.5}
                      onChange={handleSeek}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[11px] text-white/35 tabular-nums">
                      {fmt(currentTime)}
                    </span>
                    <span className="text-[11px] text-white/35 tabular-nums">
                      {fmt(duration)}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6 px-8 mb-10">
                  <button
                    onClick={() => setShuffled((s) => !s)}
                    className={`p-2 transition-colors ${
                      shuffled ? "text-sp-green" : "text-white/35"
                    }`}
                  >
                    <Shuffle size={20} />
                  </button>
                  <button
                    onClick={handlePrev}
                    className="p-2 text-white/70 hover:text-white transition-colors"
                  >
                    <SkipBack size={28} />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="w-16 h-16 rounded-full bg-sp-green flex items-center justify-center text-black hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-sp-green/30"
                  >
                    {isPlaying ? (
                      <Pause size={28} className="fill-current" />
                    ) : (
                      <Play size={28} className="fill-current ml-1" />
                    )}
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-2 text-white/70 hover:text-white transition-colors"
                  >
                    <SkipForward size={28} />
                  </button>
                  <button
                    onClick={cycleRepeat}
                    className={`p-2 transition-colors ${
                      repeat !== "off" ? "text-sp-green" : "text-white/35"
                    }`}
                  >
                    {repeat === "one" ? (
                      <Repeat1 size={20} />
                    ) : (
                      <Repeat size={20} />
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* ── Up Next Queue ── */
              <div className="flex-1 overflow-y-auto px-5 pb-4 hide-scrollbar">
                {/* Now Playing highlighted row */}
                <p className="text-[10px] font-bold text-sp-green uppercase tracking-[0.15em] mb-2 mt-1">
                  Now Playing
                </p>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-sp-green/[0.08] border border-sp-green/10 mb-5">
                  <img
                    src={songImg(currentSong)}
                    onError={onImgErr}
                    className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-sp-green truncate">
                      {currentSong.name}
                    </p>
                    <p className="text-[11px] text-white/40 truncate">
                      {currentSong.artist}
                    </p>
                  </div>
                  {/* Equalizer animation */}
                  <div className="flex items-end gap-[3px] h-4 flex-shrink-0 pr-1">
                    {[0.2, 0.5, 0.3, 0.6].map((d, idx) => (
                      <motion.div
                        key={idx}
                        animate={
                          isPlaying ? { height: [4, 14, 4] } : { height: 4 }
                        }
                        transition={{
                          duration: 0.7,
                          delay: d,
                          repeat: Infinity,
                        }}
                        className="w-[3px] bg-sp-green rounded-full"
                      />
                    ))}
                  </div>
                </div>

                {/* Up Next header */}
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
                      {Math.max(0, queue.length - queueIndex - 1)}{" "}
                      {Math.max(0, queue.length - queueIndex - 1) === 1
                        ? "track"
                        : "tracks"}
                    </span>
                  </div>
                  <button
                    onClick={handleShuffleAll}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all active:scale-95 bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white"
                  >
                    <Shuffle size={12} />
                    Shuffle
                  </button>
                </div>

                {/* Queue items */}
                {queue.length <= queueIndex + 1 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Music size={40} className="text-white/10 mb-3" />
                    <p className="text-white/30 text-sm font-medium">
                      Nothing queued up
                    </p>
                    <p className="text-white/15 text-xs mt-1">End of queue</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {queue.slice(queueIndex + 1).map((s, i) => {
                      const absIdx = queueIndex + 1 + i;
                      return (
                        <div
                          key={`${s.id}-${i}`}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-all group"
                        >
                          <GripVertical
                            size={14}
                            className="text-white/15 flex-shrink-0"
                          />
                          <button
                            onClick={() => {
                              playIndex(queue, absIdx);
                              setShowQueue(false);
                            }}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <img
                              src={songImg(s)}
                              onError={onImgErr}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              alt=""
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] text-white/80 truncate group-hover:text-white transition-colors">
                                {s.name}
                              </p>
                              <p className="text-[11px] text-white/30 truncate">
                                {s.artist}
                              </p>
                            </div>
                          </button>
                          <span className="text-[10px] text-white/20 tabular-nums flex-shrink-0">
                            {fmt(s.duration)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky mini-controls shown only when queue panel is open */}
          {showQueue && (
            <div className="flex-shrink-0 border-t border-white/[0.06] bg-black/40 backdrop-blur-xl px-5 py-3">
              <div className="flex items-center gap-3">
                <img
                  src={songImg(currentSong)}
                  onError={onImgErr}
                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">
                    {currentSong.name}
                  </p>
                  <p className="text-[11px] text-white/35 truncate">
                    {currentSong.artist}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrev}
                    className="p-2 text-white/50 hover:text-white transition-colors"
                  >
                    <SkipBack size={20} />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="w-11 h-11 rounded-full bg-sp-green flex items-center justify-center text-black hover:brightness-110 active:scale-95 transition-all"
                  >
                    {isPlaying ? (
                      <Pause size={20} className="fill-current" />
                    ) : (
                      <Play size={20} className="fill-current ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-2 text-white/50 hover:text-white transition-colors"
                  >
                    <SkipForward size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
