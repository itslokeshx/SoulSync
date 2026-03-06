import { useState, useEffect, useCallback, useRef } from "react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { SongRow } from "../components/cards/SongRow";
import {
  Download,
  Trash2,
  Play,
  Pause,
  HardDrive,
  Music2,
  Loader2,
  CheckCircle2,
  FolderOpen,
  FileAudio,
  ArrowDownToLine,
  Check,
  X,
  Shuffle,
  GripVertical,
  ListMusic,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  getOfflineSongs,
  getOfflineBlob,
  removeOfflineSong,
  getOfflineStorageSize,
  saveOfflineSong,
  OfflineSong,
} from "../utils/offlineDB";
import { useDownloadStore } from "../store/downloadStore";
import { bestImg, onImgErr, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import toast from "react-hot-toast";

/* Read duration of an audio file via a temporary <audio> element */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      const d = isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(0);
    });
  });
}

const PLAYLIST_ORDER_KEY = "downloads_playlist_order";

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(PLAYLIST_ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOrder(ids: string[]) {
  try {
    localStorage.setItem(PLAYLIST_ORDER_KEY, JSON.stringify(ids));
  } catch { }
}

export default function DownloadsPage() {
  const { playSong, currentSong, isPlaying } = useApp();
  const [songs, setSongs] = useState<OfflineSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageSize, setStorageSize] = useState("0 KB");
  const blobUrlsRef = useRef<Map<string, string>>(new Map());
  const activeDownloads = useDownloadStore((s) => s.active);
  const prevDoneRef = useRef(new Set<string>());
  const [reorderMode, setReorderMode] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "playlists">("all");
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);

  // ── File import ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const applySavedOrder = useCallback((raw: OfflineSong[]): OfflineSong[] => {
    const order = loadOrder();
    if (!order.length) return raw;
    const map = new Map(raw.map((s) => [s.id, s]));
    const ordered: OfflineSong[] = [];
    for (const id of order) {
      const s = map.get(id);
      if (s) {
        ordered.push(s);
        map.delete(id);
      }
    }
    // Append any new songs not in saved order
    map.forEach((s) => ordered.push(s));
    return ordered;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, size] = await Promise.all([
        getOfflineSongs(),
        getOfflineStorageSize(),
      ]);
      const sorted = s.sort(
        (a: OfflineSong, b: OfflineSong) => b.savedAt - a.savedAt,
      );
      setSongs(applySavedOrder(sorted));
      setStorageSize(size);
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, [applySavedOrder]);

  useEffect(() => {
    refresh();
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, [refresh]);

  // Auto-refresh when download completes
  useEffect(() => {
    const doneIds = new Set(
      activeDownloads.filter((d) => d.status === "done").map((d) => d.id),
    );
    for (const id of doneIds) {
      if (!prevDoneRef.current.has(id)) {
        refresh();
        break;
      }
    }
    prevDoneRef.current = doneIds;
  }, [activeDownloads, refresh]);

  const handleReorder = (newOrder: OfflineSong[]) => {
    setSongs(newOrder);
    saveOrder(newOrder.map(s => s.id));
  };

  // ── Play helpers ──
  const buildSongObj = async (song: OfflineSong) => {
    const blob = await getOfflineBlob(song.id);
    if (!blob) {
      toast.error("Audio file not found locally");
      return null;
    }
    const oldUrl = blobUrlsRef.current.get(song.id);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    const blobUrl = URL.createObjectURL(blob);
    blobUrlsRef.current.set(song.id, blobUrl);
    return {
      id: song.id,
      name: song.name,
      image: song.image?.length
        ? song.image
        : [{ quality: "500x500", url: "" }],
      duration: song.duration,
      primaryArtists: song.artist,
      downloadUrl: [{ quality: "320kbps", url: blobUrl }],
      _isOffline: true,
    } as any;
  };

  const handlePlay = async (song: OfflineSong) => {
    const obj = await buildSongObj(song);
    if (!obj) return;
    // Build full queue from current song list so next/prev works
    const queueObjs = songs.map((s) => ({
      id: s.id,
      name: s.name,
      image: s.image?.length ? s.image : [{ quality: "500x500", url: "" }],
      duration: s.duration,
      primaryArtists: s.artist,
      downloadUrl:
        s.id === song.id
          ? [{ quality: "320kbps", url: blobUrlsRef.current.get(s.id)! }]
          : s.downloadUrl,
      _isOffline: true,
    })) as any[];
    const idx = queueObjs.findIndex((s) => s.id === song.id);
    if (idx >= 0) queueObjs[idx] = obj;
    playSong(obj, queueObjs);
  };

  const handlePlayAll = async () => {
    if (!songs.length) return;
    const first = await buildSongObj(songs[0]);
    if (!first) return;
    // For the queue, only load the first song's blob; others will load on demand
    const queueObjs = songs.map((s) => ({
      id: s.id,
      name: s.name,
      image: s.image?.length ? s.image : [{ quality: "500x500", url: "" }],
      duration: s.duration,
      primaryArtists: s.artist,
      downloadUrl:
        s.id === songs[0].id
          ? [{ quality: "320kbps", url: blobUrlsRef.current.get(s.id)! }]
          : s.downloadUrl,
      _isOffline: true,
    })) as any[];
    // Replace the first entry with the one that has the blob URL
    queueObjs[0] = first;
    playSong(first, queueObjs);
  };

  const handleShuffleAll = async () => {
    if (!songs.length) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    const first = await buildSongObj(shuffled[0]);
    if (!first) return;
    const queueObjs = shuffled.map((s) => ({
      id: s.id,
      name: s.name,
      image: s.image?.length ? s.image : [{ quality: "500x500", url: "" }],
      duration: s.duration,
      primaryArtists: s.artist,
      downloadUrl:
        s.id === shuffled[0].id
          ? [{ quality: "320kbps", url: blobUrlsRef.current.get(s.id)! }]
          : s.downloadUrl,
      _isOffline: true,
    })) as any[];
    queueObjs[0] = first;
    playSong(first, queueObjs);
  };

  const handleRemove = async (id: string, name: string) => {
    const existing = blobUrlsRef.current.get(id);
    if (existing) {
      URL.revokeObjectURL(existing);
      blobUrlsRef.current.delete(id);
    }
    await removeOfflineSong(id);
    // Remove from saved order
    const order = loadOrder().filter((oid) => oid !== id);
    saveOrder(order);
    toast.success(`Removed "${name}"`);
    refresh();
  };

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    let imported = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("audio/")) {
        toast.error(`"${file.name}" is not an audio file`);
        continue;
      }
      try {
        const duration = await getAudioDuration(file);
        const id = `local_${file.name.replace(/[^a-zA-Z0-9]/g, "_")}_${file.size}`;
        const displayName = file.name.replace(/\.[^.]+$/, "");
        const offlineSong: OfflineSong = {
          id,
          name: displayName,
          artist: "Local File",
          albumArt: "",
          duration: Math.round(duration),
          downloadUrl: [],
          image: [],
          savedAt: Date.now(),
        };
        await saveOfflineSong(offlineSong, file);
        imported++;
      } catch {
        toast.error(`Failed to import "${file.name}"`);
      }
    }
    if (imported > 0) {
      toast.success(
        `Imported ${imported} song${imported > 1 ? "s" : ""} from device`,
      );
      refresh();
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImporting(false);
  };

  return (
    <div className="animate-fadeIn">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleImportFiles}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
            <Download size={18} className="text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Downloads
            </h1>
            <p className="text-xs text-white/30 mt-0.5">
              {songs.length} songs · {storageSize} used
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.10] text-white/70 hover:text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            {importing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FolderOpen size={16} />
            )}
            <span className="hidden sm:inline">
              {importing ? "Importing…" : "Import"}
            </span>
          </button>
        </div>
      </div>

      {/* Playlist Controls */}
      {songs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 mb-5">
          <div className="flex gap-2.5">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full bg-sp-green text-black text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              <Play size={16} className="fill-current" />
              <span className="hidden sm:inline">Play All</span>
              <span className="sm:hidden">Play</span>
            </button>
            <button
              onClick={handleShuffleAll}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-full border border-white/10 text-white text-[13px] font-semibold hover:bg-white/[0.06] active:scale-95 transition-all"
            >
              <Shuffle size={14} />
              <span className="hidden sm:inline">Shuffle</span>
            </button>
          </div>

          <div className="flex-1 min-w-[10px] hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl">
              <button
                onClick={() => {
                  setViewMode("all");
                  setSelectedPlaylist(null);
                }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${viewMode === "all" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white/60"}`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setViewMode("playlists");
                  setSelectedPlaylist(null);
                }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${viewMode === "playlists" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white/60"}`}
              >
                Playlists
              </button>
            </div>
            <button
              onClick={() => setReorderMode(!reorderMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] sm:text-[12px] font-semibold transition-all ${reorderMode
                ? "bg-sp-green/20 text-sp-green border border-sp-green/30"
                : "border border-white/10 text-white/50 hover:bg-white/[0.06]"
                }`}
            >
              <ListMusic size={13} />
              <span className="hidden xs:inline">{reorderMode ? "Done" : "Reorder"}</span>
              <span className="xs:hidden">{reorderMode ? "Done" : ""}</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Downloads */}
      {activeDownloads.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownToLine size={14} className="text-sp-green" />
            <span className="text-sm font-semibold text-white/60">
              Downloading (
              {
                activeDownloads.filter(
                  (d) => d.status === "downloading" || d.status === "saving",
                ).length
              }
              )
            </span>
          </div>
          <div className="space-y-1">
            {activeDownloads.map((dl) => {
              const isDone = dl.status === "done";
              const isError = dl.status === "error";
              const isSaving = dl.status === "saving";
              return (
                <div
                  key={`dl-${dl.id}`}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 ${isDone
                    ? "bg-sp-green/[0.06]"
                    : isError
                      ? "bg-red-500/[0.06]"
                      : "bg-white/[0.03]"
                    }`}
                >
                  <div className="relative flex-shrink-0 w-10 h-10">
                    {dl.albumArt ? (
                      <img
                        src={dl.albumArt}
                        onError={onImgErr}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                        <Music2 size={16} className="text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/40">
                      {isDone ? (
                        <Check size={16} className="text-sp-green" />
                      ) : isError ? (
                        <X size={16} className="text-red-400" />
                      ) : (
                        <ArrowDownToLine
                          size={14}
                          className="text-white animate-bounce"
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[13px] font-medium text-white truncate">
                        {dl.name}
                      </p>
                      <span
                        className={`text-[11px] font-semibold tabular-nums flex-shrink-0 ${isDone ? "text-sp-green" : isError ? "text-red-400" : "text-white/50"}`}
                      >
                        {isDone
                          ? "Saved"
                          : isError
                            ? "Failed"
                            : isSaving
                              ? "Saving…"
                              : `${dl.progress}%`}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/30 truncate mb-1.5">
                      {dl.artist}
                    </p>
                    <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${isDone ? "bg-sp-green" : isError ? "bg-red-400" : "bg-sp-green shadow-[0_0_8px_rgba(29,185,84,0.4)]"}`}
                        style={{ width: `${isDone ? 100 : dl.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Song List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="text-white/30 animate-spin" />
        </div>
      ) : songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center">
            <HardDrive size={28} className="text-white/20" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">
              Your Music Library
            </p>
            <p className="text-white/40 text-sm mt-1 max-w-xs">
              Download songs for offline play, or import audio files directly
              from your device
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-sp-green hover:bg-sp-green/90 text-black text-sm font-semibold transition-all disabled:opacity-50"
          >
            {importing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileAudio size={16} />
            )}
            {importing ? "Importing…" : "Import from device"}
          </button>
          <p className="text-white/20 text-[11px] mt-1">
            Supports MP3, AAC, WAV, OGG, FLAC & more
          </p>
        </div>
      ) : viewMode === "all" ? (
        <Reorder.Group
          axis="y"
          values={songs}
          onReorder={handleReorder}
          className="space-y-1 pb-20"
        >
          {songs.map((s, i) => (
            <DownloadSongItem
              key={s.id}
              s={s}
              i={i}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={() => handlePlay(s)}
              onRemove={handleRemove}
              reorderMode={reorderMode}
            />
          ))}
        </Reorder.Group>
      ) : selectedPlaylist ? (
        <div className="animate-fadeIn">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setSelectedPlaylist(null)}
              className="p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/70 transition-colors"
            >
              <Shuffle size={16} className="rotate-180" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-white truncate">{selectedPlaylist}</h2>
              <p className="text-xs text-white/30">
                {songs.filter((s) => (s.playlistName || "Other") === selectedPlaylist).length} songs
              </p>
            </div>
          </div>
          <div className="space-y-1">
            {songs
              .filter((s) => (s.playlistName || "Other") === selectedPlaylist)
              .map((s) => {
                const isActive = currentSong?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => handlePlay(s)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                      }`}
                  >
                    <img src={bestImg(s.image, "50x50") || s.albumArt || FALLBACK_IMG} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    <div className="min-w-0 flex-1 ml-1">
                      <p className={`text-[13px] font-medium truncate ${isActive ? "text-sp-green" : "text-white"}`}>
                        {s.name}
                      </p>
                      <p className="text-[11px] text-white/35 truncate">{s.artist}</p>
                    </div>
                    <span className="text-[10px] text-white/20 tabular-nums flex-shrink-0">{fmt(s.duration)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 animate-fadeIn">
          {Array.from(new Set(songs.map((s) => s.playlistName || "Other")))
            .sort()
            .map((playlistName) => {
              const playlistSongs = songs.filter(
                (s) => (s.playlistName || "Other") === playlistName,
              );
              return (
                <div
                  key={playlistName}
                  onClick={() => setSelectedPlaylist(playlistName)}
                  className="group bg-white/[0.03] hover:bg-white/[0.06] p-4 rounded-2xl transition-all cursor-pointer border border-white/[0.02] hover:border-white/[0.08]"
                >
                  <div className="aspect-square rounded-xl overflow-hidden mb-3 shadow-lg relative bg-white/[0.02] flex items-center justify-center">
                    {playlistSongs[0]?.image?.length || playlistSongs[0]?.albumArt ? (
                      <img
                        src={bestImg(playlistSongs[0].image, "250x250") || playlistSongs[0].albumArt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        alt=""
                      />
                    ) : (
                      <Music2 size={32} className="text-white/10" />
                    )}
                  </div>
                  <h3 className="text-[14px] font-bold text-white truncate">{playlistName}</h3>
                  <p className="text-[11px] text-white/40">{playlistSongs.length} songs</p>
                </div>
              );
            })}
        </div>
      )}

      {/* Footer stats */}
      {songs.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-white/15 text-[11px]">
          <HardDrive size={11} />
          <span>
            {songs.length} songs · {storageSize}
          </span>
        </div>
      )}
    </div>
  );
}

interface DownloadSongItemProps {
  s: OfflineSong;
  i: number;
  currentSong: any;
  isPlaying: boolean;
  onPlay: () => void;
  onRemove: (id: string, name: string) => void;
  reorderMode: boolean;
}

function DownloadSongItem({
  s,
  i,
  currentSong,
  isPlaying,
  onPlay,
  onRemove,
  reorderMode,
}: DownloadSongItemProps) {
  const controls = useDragControls();

  // Map OfflineSong to the format expected by SongRow
  const mapped = {
    id: s.id,
    name: s.name,
    primaryArtists: s.artist,
    image: s.image || (s.albumArt ? [{ quality: "500x500", url: s.albumArt }] : []),
    duration: s.duration,
    _isOffline: true,
  };

  return (
    <Reorder.Item
      value={s}
      dragListener={false}
      dragControls={controls}
      className="flex items-center group relative bg-transparent"
    >
      {reorderMode && (
        <div
          onPointerDown={(e) => controls.start(e)}
          className="w-8 flex items-center justify-center cursor-grab active:cursor-grabbing text-white/20 hover:text-white/60 transition-colors"
        >
          <GripVertical size={16} />
        </div>
      )}
      <div className="flex-1 min-w-0 ml-1">
        <SongRow
          song={mapped}
          index={i}
          isCurrent={currentSong?.id === s.id}
          isPlaying={isPlaying}
          onPlay={onPlay}
        />
      </div>
      {!reorderMode && (
        <button
          onClick={() => onRemove(s.id, s.name)}
          className="ml-1 p-2 rounded-full text-white/0 group-hover:text-red-400/70 hover:!text-red-400 hover:bg-red-400/10 transition-all duration-200 flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      )}
    </Reorder.Item>
  );
}
