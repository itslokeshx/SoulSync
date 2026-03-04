import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download,
  Trash2,
  Play,
  HardDrive,
  Music2,
  Loader2,
  CheckCircle2,
  FolderOpen,
  FileAudio,
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
import { bestImg, onImgErr } from "../lib/helpers";
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

export default function DownloadsPage() {
  const { playSong, currentSong, isPlaying } = useApp();
  const [songs, setSongs] = useState<OfflineSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageSize, setStorageSize] = useState("0 KB");
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, size] = await Promise.all([
        getOfflineSongs(),
        getOfflineStorageSize(),
      ]);
      setSongs(s.sort((a, b) => b.savedAt - a.savedAt));
      setStorageSize(size);
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Cleanup blob URLs on unmount
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, [refresh]);

  const handleRemove = async (id: string, name: string) => {
    // Revoke any existing blob URL for this song
    const existing = blobUrlsRef.current.get(id);
    if (existing) {
      URL.revokeObjectURL(existing);
      blobUrlsRef.current.delete(id);
    }
    await removeOfflineSong(id);
    toast.success(`Removed "${name}"`);
    refresh();
  };

  const handlePlay = async (song: OfflineSong, allSongs: OfflineSong[]) => {
    try {
      // Get the audio blob from IndexedDB
      const blob = await getOfflineBlob(song.id);
      if (!blob) {
        toast.error("Audio file not found locally");
        return;
      }

      // Revoke old blob URL if exists
      const oldUrl = blobUrlsRef.current.get(song.id);
      if (oldUrl) URL.revokeObjectURL(oldUrl);

      // Create blob URL
      const blobUrl = URL.createObjectURL(blob);
      blobUrlsRef.current.set(song.id, blobUrl);

      // Build song object with the blob URL as the highest quality download
      const songObj = {
        id: song.id,
        name: song.name,
        image: song.image,
        duration: song.duration,
        primaryArtists: song.artist,
        downloadUrl: [{ quality: "320kbps", url: blobUrl }],
        _isOffline: true,
      } as any;

      // Build queue: only the clicked song uses blob URL, others will load on demand
      playSong(songObj, [songObj]);
    } catch {
      toast.error("Failed to play offline song");
    }
  };

  // ── Import local audio files from device ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setImporting(true);
    let imported = 0;

    for (const file of Array.from(files)) {
      // Validate audio type
      if (!file.type.startsWith("audio/")) {
        toast.error(`"${file.name}" is not an audio file`);
        continue;
      }

      try {
        // Get duration from audio element
        const duration = await getAudioDuration(file);

        // Generate a stable ID from filename
        const id = `local_${file.name.replace(/[^a-zA-Z0-9]/g, "_")}_${file.size}`;

        // Clean up display name (remove extension)
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

    // Reset input so the same files can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
    setImporting(false);
  };

  const handlePlayLocal = async (song: OfflineSong) => {
    try {
      const blob = await getOfflineBlob(song.id);
      if (!blob) {
        toast.error("Audio file not found");
        return;
      }

      const oldUrl = blobUrlsRef.current.get(song.id);
      if (oldUrl) URL.revokeObjectURL(oldUrl);

      const blobUrl = URL.createObjectURL(blob);
      blobUrlsRef.current.set(song.id, blobUrl);

      const songObj = {
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

      playSong(songObj, [songObj]);
    } catch {
      toast.error("Failed to play local song");
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* Hidden file input for importing local songs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={handleImportFiles}
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
            <Download size={18} className="text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Downloads & Device Music
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
              {importing ? "Importing…" : "Import from device"}
            </span>
          </button>
        </div>
        {/* Offline playback banner */}
        <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-sp-green/[0.08] border border-sp-green/[0.15]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sp-green/20">
            <Music2 size={16} className="text-sp-green" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-sp-green">
              Play songs directly from your device
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              Import MP3s, AAC, or any audio files — plays offline, no internet
              needed
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex-shrink-0 px-3 py-1.5 rounded-full bg-sp-green/20 hover:bg-sp-green/30 text-sp-green text-[11px] font-semibold transition-all"
          >
            {importing ? "…" : "+ Add"}
          </button>
        </div>
      </div>

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
              from your device to listen anywhere — no internet required.
            </p>
          </div>
          <div className="flex gap-3">
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
          </div>
          <p className="text-white/20 text-[11px] mt-1">
            Supports MP3, AAC, WAV, OGG, FLAC & more
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {songs.map((s, i) => {
            const img = bestImg(s.image, "50x50") || s.albumArt || FALLBACK_IMG;
            const isCurrent = currentSong?.id === s.id;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200 group ${
                  isCurrent ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span className="w-5 text-center text-xs text-white/25 tabular-nums">
                  {i + 1}
                </span>
                <button
                  onClick={() => handlePlay(s, songs)}
                  className="relative flex-shrink-0"
                >
                  <img
                    src={img}
                    onError={onImgErr}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={14} className="text-white fill-white" />
                  </div>
                </button>
                <div
                  className="flex-1 min-w-0"
                  onClick={() => handlePlay(s, songs)}
                >
                  <p
                    className={`text-[13px] font-medium truncate cursor-pointer ${
                      isCurrent ? "text-sp-green" : "text-white"
                    }`}
                  >
                    {s.name}
                  </p>
                  <p className="text-[11px] text-white/30 truncate">
                    {s.artist}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {s.id.startsWith("local_") ? (
                    <FileAudio size={14} className="text-white/30" />
                  ) : (
                    <CheckCircle2 size={14} className="text-sp-green/50" />
                  )}
                  <button
                    onClick={() => handleRemove(s.id, s.name)}
                    className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-white/[0.04] transition-all opacity-0 group-hover:opacity-100"
                    title="Remove download"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
