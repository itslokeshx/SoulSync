import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import {
  getOfflineSongs,
  getOfflineBlob,
  removeOfflineSong,
  getOfflineStorageSize,
  saveOfflineSong,
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
      const [s, size] = await Promise.all([getOfflineSongs(), getOfflineStorageSize()]);
      setSongs(s.sort((a: OfflineSong, b: OfflineSong) => b.savedAt - a.savedAt));
      setStorageSize(size);
    } catch { setSongs([]); }
    finally { setLoading(false); }
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

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { shuffledRef.current = shuffled; }, [shuffled]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  const playIndex = useCallback(async (q: OfflineSong[], idx: number) => {
    const song = q[idx];
    if (!song) return;
    try {
      let blobUrl = blobUrlsRef.current.get(song.id);
      if (!blobUrl) {
        const blob = await getOfflineBlob(song.id);
        if (!blob) { toast.error(`Audio not found: "${song.name}"`); return; }
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
      try { await audio.play(); } catch { /* autoplay blocked */ }
    } catch { toast.error("Failed to play song"); }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      const q = queueRef.current;
      const idx = queueIndexRef.current;
      const rep = repeatRef.current;
      if (rep === "one") { audio.currentTime = 0; audio.play().catch(() => {}); return; }
      if (!q.length) return;
      let next: number;
      if (shuffledRef.current) { next = Math.floor(Math.random() * q.length); }
      else {
        next = idx + 1;
        if (next >= q.length) { if (rep === "all") next = 0; else return; }
      }
      playIndex(q, next);
    };
    const onError = () => { toast.error("Audio playback failed"); setIsPlaying(false); };
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
    navigator.mediaSession.setActionHandler("play", () => { audioRef.current.play().catch(() => {}); });
    navigator.mediaSession.setActionHandler("pause", () => { audioRef.current.pause(); });
    navigator.mediaSession.setActionHandler("nexttrack", () => handleNext());
    navigator.mediaSession.setActionHandler("previoustrack", () => handlePrev());
    try {
      navigator.mediaSession.setActionHandler("seekto", (d) => {
        if (d.seekTime != null) { audioRef.current.currentTime = d.seekTime; setCurrentTime(d.seekTime); }
      });
    } catch {}
  }, []);

  // Update media metadata when song changes
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;
    const artwork: MediaImage[] = [];
    const img = bestImg(currentSong.image, "150x150") || (typeof currentSong.albumArt === "string" ? currentSong.albumArt : null);
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
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
      if (duration > 0 && isFinite(duration)) {
        navigator.mediaSession.setPositionState({ duration, playbackRate: 1, position: Math.min(currentTime, duration) });
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
    setShuffled(true); shuffledRef.current = true;
    setQueue(list); queueRef.current = list;
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
    const next = shuffledRef.current ? Math.floor(Math.random() * q.length) : (idx + 1) % q.length;
    playIndex(q, next);
  };

  const handlePrev = () => {
    const audio = audioRef.current;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
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
    if (url) { URL.revokeObjectURL(url); blobUrlsRef.current.delete(id); }
    if (currentSong?.id === id) { audioRef.current.pause(); audioRef.current.src = ""; setQueueIndex(-1); setQueue([]); }
    await removeOfflineSong(id);
    toast.success(`Removed "${name}"`);
    refresh();
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
            a.addEventListener("loadedmetadata", () => { resolve(Math.round(a.duration)); URL.revokeObjectURL(tempUrl); });
            a.addEventListener("error", () => { resolve(0); URL.revokeObjectURL(tempUrl); });
          });
        } catch {}
        const song: OfflineSong = { id, name, artist: "Local file", albumArt: "", image: [], downloadUrl: [], duration: dur, savedAt: Date.now() };
        await saveOfflineSong(song, file);
        imported++;
      } catch { toast.error(`Failed to import "${file.name}"`); }
    }
    if (imported > 0) { toast.success(`Imported ${imported} song${imported > 1 ? "s" : ""}`); refresh(); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cycleRepeat = () => {
    setRepeat((r) => { const n = r === "off" ? "all" : r === "all" ? "one" : "off"; repeatRef.current = n; return n; });
  };

  const songImg = (s: OfflineSong) => bestImg(s.image, "50x50") || (typeof s.albumArt === "string" ? s.albumArt : null) || FALLBACK_IMG;
  const songImgLg = (s: OfflineSong) => bestImg(s.image, "500x500") || bestImg(s.image, "150x150") || (typeof s.albumArt === "string" ? s.albumArt : null) || FALLBACK_IMG;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-sp-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleImportLocal} />

      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-[#060606]/90 border-b border-white/[0.04]">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center">
              <Music2 size={14} className="text-black" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-extrabold text-white">Soul<span className="text-sp-green">Sync</span></span>
          </div>
          <div className="flex items-center gap-2 text-white/40">
            <WifiOff size={16} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Offline</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full overflow-y-auto" style={{ paddingBottom: currentSong ? "140px" : "24px" }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-sp-green border-t-transparent rounded-full animate-spin" />
            <span className="text-white/30 text-sm">Loading songs…</span>
          </div>
        ) : songs.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Your Downloads ({songs.length})</h2>
                <div className="flex items-center gap-1.5 mt-0.5 text-white/30 text-[11px]">
                  <HardDrive size={11} /><span>{storageSize} stored</span>
                </div>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/50 text-[12px] font-semibold hover:bg-white/[0.06] active:scale-95 transition-all">
                <FolderOpen size={13} />Import
              </button>
            </div>
            <div className="flex gap-3 mb-6">
              <button onClick={handlePlayAll} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-sp-green text-black text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all">
                <Play size={16} className="fill-current" />Play All
              </button>
              <button onClick={handleShuffleAll} className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 text-white text-[13px] font-semibold hover:bg-white/[0.06] active:scale-95 transition-all">
                <Shuffle size={14} />Shuffle
              </button>
            </div>
            <div className="space-y-1">
              {songs.map((s) => {
                const isActive = currentSong?.id === s.id;
                return (
                  <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-xl group transition-all ${isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}>
                    <button onClick={() => handlePlay(s, songs)} className="relative flex-shrink-0">
                      <img src={songImg(s)} onError={onImgErr} className="w-12 h-12 rounded-xl object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {isActive && isPlaying ? <Pause size={18} className="text-white fill-white" /> : <Play size={18} className="text-white fill-white ml-0.5" />}
                      </div>
                      {isActive && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-sp-green rounded-full" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-semibold truncate ${isActive ? "text-sp-green" : "text-white"}`}>{s.name}</p>
                      <p className="text-[11px] text-white/35 truncate">{s.artist}</p>
                    </div>
                    <span className="text-[10px] text-white/20 tabular-nums flex-shrink-0">{fmt(s.duration)}</span>
                    <button onClick={() => handleRemove(s.id, s.name)} className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-10 text-center py-6 border-t border-white/[0.04]">
              <p className="text-white/20 text-[12px] mb-3">Sign in when online to access millions of songs</p>
              <button onClick={() => (window.location.href = "/login")} className="px-5 py-2 rounded-full bg-sp-green text-black text-[12px] font-bold hover:brightness-110 active:scale-95 transition-all">Sign In</button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Download size={64} className="text-white/[0.06] mb-6" />
            <h3 className="text-lg font-bold text-white/40 mb-2">No offline songs yet</h3>
            <p className="text-white/20 text-sm mb-8 max-w-xs">Import songs from your device or download while online</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3 rounded-full bg-sp-green text-black text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all">
                <FolderOpen size={16} />Import from device
              </button>
              <button onClick={() => (window.location.href = "/login")} className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-white text-[13px] font-semibold hover:bg-white/[0.06] active:scale-95 transition-all">
                <LogIn size={16} />Sign in to download
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mini Player — tappable to open full-screen */}
      {currentSong && !npOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111]/95 backdrop-blur-2xl border-t border-white/[0.06] px-4 pt-2" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] text-white/30 tabular-nums w-7 text-right">{fmt(currentTime)}</span>
            <div className="flex-1 relative h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-sp-green rounded-full transition-none" style={{ width: `${progress}%` }} />
              <input type="range" min={0} max={duration || 1} value={currentTime} step={0.5} onChange={handleSeek}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
            </div>
            <span className="text-[10px] text-white/30 tabular-nums w-7">{fmt(duration)}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setNpOpen(true)} className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex-shrink-0 overflow-hidden">
                <img src={songImg(currentSong)} onError={onImgErr} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{currentSong.name}</p>
                <p className="text-[10px] text-white/35 truncate">{currentSong.artist}</p>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={handlePrev} className="p-2 text-white/50 hover:text-white transition-colors"><SkipBack size={18} /></button>
              <button onClick={handlePlayPause} className="w-10 h-10 rounded-full bg-sp-green flex items-center justify-center text-black hover:brightness-110 active:scale-95 transition-all">
                {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-0.5" />}
              </button>
              <button onClick={handleNext} className="p-2 text-white/50 hover:text-white transition-colors"><SkipForward size={18} /></button>
            </div>
            <button onClick={() => setShuffled((s) => !s)} className={`p-2 transition-colors ${shuffled ? "text-sp-green" : "text-white/30"}`}>
              <Shuffle size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ══════ Full-Screen Now Playing View ══════ */}
      {currentSong && npOpen && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-b from-[#1a1a1a] to-[#060606] flex flex-col overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
            <button onClick={() => setNpOpen(false)} className="p-2 -ml-2 text-white/60 hover:text-white transition-colors">
              <ChevronDown size={24} />
            </button>
            <div className="text-center">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Now Playing</p>
              <p className="text-[11px] text-white/50 font-medium">Offline Mode</p>
            </div>
            <div className="w-10" />
          </div>

          {/* Album Art */}
          <div className="flex-1 flex items-center justify-center px-10 py-6">
            <div className="w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
              <img src={songImgLg(currentSong)} onError={onImgErr} className="w-full h-full object-cover" alt="" />
            </div>
          </div>

          {/* Song Info */}
          <div className="px-8 mb-4">
            <p className="text-xl font-bold text-white truncate">{currentSong.name}</p>
            <p className="text-[14px] text-white/50 truncate mt-0.5">{currentSong.artist}</p>
          </div>

          {/* Seek Bar */}
          <div className="px-8 mb-3">
            <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden group">
              <div className="absolute inset-y-0 left-0 bg-sp-green rounded-full" style={{ width: `${progress}%` }} />
              <input type="range" min={0} max={duration || 1} value={currentTime} step={0.5} onChange={handleSeek}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[11px] text-white/35 tabular-nums">{fmt(currentTime)}</span>
              <span className="text-[11px] text-white/35 tabular-nums">{fmt(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 px-8 mb-8">
            <button onClick={() => setShuffled((s) => !s)} className={`p-2 transition-colors ${shuffled ? "text-sp-green" : "text-white/35"}`}>
              <Shuffle size={20} />
            </button>
            <button onClick={handlePrev} className="p-2 text-white/70 hover:text-white transition-colors">
              <SkipBack size={28} />
            </button>
            <button onClick={handlePlayPause} className="w-16 h-16 rounded-full bg-sp-green flex items-center justify-center text-black hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-sp-green/30">
              {isPlaying ? <Pause size={28} className="fill-current" /> : <Play size={28} className="fill-current ml-1" />}
            </button>
            <button onClick={handleNext} className="p-2 text-white/70 hover:text-white transition-colors">
              <SkipForward size={28} />
            </button>
            <button onClick={cycleRepeat} className={`p-2 transition-colors ${repeat !== "off" ? "text-sp-green" : "text-white/35"}`}>
              {repeat === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>

          {/* Queue Preview */}
          {queue.length > 1 && (
            <div className="px-6 pb-8">
              <p className="text-[11px] text-white/25 font-semibold uppercase tracking-wider mb-2">Up Next</p>
              <div className="space-y-1 max-h-28 overflow-y-auto hide-scrollbar">
                {queue.slice(queueIndex + 1, queueIndex + 4).map((s, i) => (
                  <button key={`${s.id}-${i}`} onClick={() => playIndex(queue, queueIndex + 1 + i)}
                    className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-white/[0.04] transition-all text-left">
                    <img src={songImg(s)} onError={onImgErr} className="w-8 h-8 rounded-md object-cover flex-shrink-0" alt="" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-white/60 font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-white/25 truncate">{s.artist}</p>
                    </div>
                    <span className="text-[10px] text-white/20 tabular-nums">{fmt(s.duration)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
