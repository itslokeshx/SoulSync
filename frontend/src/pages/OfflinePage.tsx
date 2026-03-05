import { useState, useEffect, useCallback, useRef } from "react";
import {
  WifiOff,
  Play,
  Shuffle,
  Trash2,
  Download,
  Music2,
  LogIn,
  HardDrive,
} from "lucide-react";
import { useNetwork } from "../hooks/useNetwork";
import {
  getOfflineSongs,
  getOfflineBlob,
  removeOfflineSong,
  getOfflineStorageSize,
  type OfflineSong,
} from "../utils/offlineDB";
import { bestImg, onImgErr, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import toast from "react-hot-toast";

interface OfflinePageProps {
  /** Optional – inject playSong from AppContext when available */
  playSong?: (song: any, queue: any[]) => void;
}

export default function OfflinePage({ playSong }: OfflinePageProps) {
  const { isOnline } = useNetwork();
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
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, [refresh]);

  const handlePlay = async (song: OfflineSong, allSongs: OfflineSong[]) => {
    if (!playSong) return;
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
        image: song.image,
        duration: song.duration,
        primaryArtists: song.artist,
        downloadUrl: [{ quality: "320kbps", url: blobUrl }],
        _isOffline: true,
      } as any;

      playSong(songObj, [songObj]);
    } catch {
      toast.error("Failed to play song");
    }
  };

  const handlePlayAll = async () => {
    if (!songs.length || !playSong) return;
    await handlePlay(songs[0], songs);
  };

  const handleShuffleAll = async () => {
    if (!songs.length || !playSong) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    await handlePlay(shuffled[0], shuffled);
  };

  const handleRemove = async (id: string, name: string) => {
    const existing = blobUrlsRef.current.get(id);
    if (existing) {
      URL.revokeObjectURL(existing);
      blobUrlsRef.current.delete(id);
    }
    await removeOfflineSong(id);
    toast.success(`Removed "${name}"`);
    refresh();
  };

  return (
    <div className="min-h-screen bg-sp-black">
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
          <div className="flex items-center gap-2 text-white/40">
            <WifiOff size={16} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Offline
            </span>
          </div>
        </div>

        {/* Offline banner */}
        <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-500/[0.08] border-l-[3px] border-amber-500">
          <span className="text-amber-200/80 text-[12px]">
            📶 {isOnline ? "Offline mode active" : "No internet connection"}
          </span>
          <span className="text-amber-200/50 text-[11px] hidden sm:block">
            — Playing your downloaded songs
          </span>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-sp-green border-t-transparent rounded-full animate-spin" />
            <span className="text-white/30 text-sm">
              Loading downloaded songs…
            </span>
          </div>
        ) : songs.length > 0 ? (
          <>
            {/* Downloads header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Your Downloads ({songs.length})
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5 text-white/30 text-[11px]">
                  <HardDrive size={11} />
                  <span>{storageSize} stored on device</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
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
                Shuffle All
              </button>
            </div>

            {/* Song list */}
            <div className="space-y-1">
              {songs.map((s) => {
                const sImg =
                  bestImg(s.image, "50x50") ||
                  (typeof s.albumArt === "string" ? s.albumArt : null) ||
                  FALLBACK_IMG;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] group transition-all"
                  >
                    <button
                      onClick={() => handlePlay(s, songs)}
                      className="relative flex-shrink-0"
                    >
                      <img
                        src={sImg}
                        onError={onImgErr}
                        className="w-12 h-12 rounded-xl object-cover"
                        alt=""
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play
                          size={18}
                          className="text-white fill-white ml-0.5"
                        />
                      </div>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white truncate">
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
                      onClick={() => handleRemove(s.id, s.name)}
                      className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Remove download"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Download size={64} className="text-white/[0.06] mb-6" />
            <h3 className="text-lg font-bold text-white/40 mb-2">
              No offline songs yet
            </h3>
            <p className="text-white/20 text-sm mb-8 max-w-xs">
              Download songs while online to listen here without internet
            </p>
            {isOnline && (
              <button
                onClick={() => (window.location.href = "/login")}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-sp-green text-black text-[13px] font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                <LogIn size={16} />
                Sign in to download
              </button>
            )}
          </div>
        )}

        {/* Sign-in prompt at bottom */}
        {songs.length > 0 && (
          <div className="mt-10 text-center py-6 border-t border-white/[0.04]">
            <p className="text-white/20 text-[12px] mb-3">
              Sign in when online to access millions of songs
            </p>
            {isOnline && (
              <button
                onClick={() => (window.location.href = "/login")}
                className="px-5 py-2 rounded-full bg-sp-green text-black text-[12px] font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
