import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, Reorder, useDragControls } from "framer-motion";
import {
  Play,
  Shuffle,
  ChevronLeft,
  Trash2,
  Pencil,
  Music2,
  Loader2,
  GripVertical,
  ListMusic,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import * as api from "../api/backend";
import { Playlist, PlaylistSong } from "../types/playlist";
import { SongRow } from "../components/cards/SongRow";
import { GreenButton } from "../components/ui/GreenButton";
import { Skeleton } from "../components/ui/Skeleton";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { onImgErr, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { downloadPlaylist } from "../utils/downloadSong";
import { Download } from "lucide-react";
import toast from "react-hot-toast";

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying, likedSongs, handleLike } = useApp();

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [localSongs, setLocalSongs] = useState<PlaylistSong[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<() => void>(() => { });
  const [reorderMode, setReorderMode] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getPlaylist(id)
      .then((pl) => {
        setPlaylist(pl);
        setLocalSongs(pl.songs || []);
        setEditName(pl.name);
        setEditDesc(pl.description);
      })
      .catch(() => toast.error("Playlist not found"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (playlist?.songs) {
      setLocalSongs(playlist.songs);
    }
  }, [playlist?.songs]);

  const handleSave = async () => {
    if (!id || !editName.trim()) return;
    try {
      const updated = await api.updatePlaylist(id, {
        name: editName.trim(),
        description: editDesc,
      });
      setPlaylist((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
      toast.success("Playlist updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleSaveOrder = async (newOrder: PlaylistSong[]) => {
    if (!id || !playlist) return;
    setSavingOrder(true);
    try {
      const updated = await api.reorderPlaylist(
        id,
        newOrder.map((s) => s.songId),
      );
      setPlaylist(updated);
    } catch {
      toast.error("Failed to save order");
      setLocalSongs(playlist.songs || []);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleShuffle = async () => {
    if (!id || !playlist || localSongs.length === 0) return;
    const shuffled = [...localSongs].sort(() => Math.random() - 0.5);
    setLocalSongs(shuffled);
    await handleSaveOrder(shuffled);
  };

  const handleDelete = useCallback(() => {
    if (!id) return;
    setConfirmTitle("Delete Playlist");
    setConfirmMessage(
      `Are you sure you want to delete "${playlist?.name || "this playlist"}"? This action cannot be undone.`,
    );
    setConfirmAction(() => async () => {
      setConfirmOpen(false);
      try {
        await api.deletePlaylist(id);
        toast.success("Playlist deleted");
        navigate("/library", { replace: true });
      } catch {
        toast.error("Failed to delete");
      }
    });
    setConfirmOpen(true);
  }, [id, playlist?.name, navigate]);

  const handleRemoveSong = useCallback(
    (songId: string, songName: string) => {
      if (!id) return;
      setConfirmTitle("Remove Song");
      setConfirmMessage(`Remove "${songName}" from this playlist?`);
      setConfirmAction(() => async () => {
        setConfirmOpen(false);
        try {
          const updated = await api.removeSongFromPlaylist(id, songId);
          setPlaylist(updated);
          toast.success("Song removed");
        } catch {
          toast.error("Failed to remove song");
        }
      });
      setConfirmOpen(true);
    },
    [id],
  );

  if (loading) {
    return (
      <div className="animate-fadeIn space-y-4">
        <div className="flex gap-6 flex-wrap">
          <Skeleton className="w-52 h-52 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <div className="space-y-2 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="text-sp-sub p-10 text-center">Playlist not found.</div>
    );
  }


  const songs = playlist.songs || [];
  const coverImg = playlist.coverImage || FALLBACK_IMG;
  const totalDur = songs.reduce((a, s) => a + (s.duration || 0), 0);

  // Map playlist songs → player-compatible format with download URLs
  const mapSong = (s: PlaylistSong) =>
    ({
      id: s.songId,
      name: s.title,
      image: s.albumArt ? [{ quality: "500x500", url: s.albumArt }] : [],
      duration: s.duration,
      primaryArtists: s.artist,
      downloadUrl: (s.downloadUrl || []).map((u) => ({
        quality: u.quality,
        url: u.url,
      })),
      download_url: (s.downloadUrl || []).map((u) => ({
        quality: u.quality,
        link: u.url,
      })),
    }) as any;

  const playableSongs = localSongs.filter((s) => s.songId).map(mapSong);

  return (
    <div className="animate-fadeIn -mt-6 -mx-6">
      {/* Header */}
      <div className="px-6 pt-6 pb-6 bg-gradient-to-b from-white/[0.03] to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-[13px] mb-6 transition-colors"
        >
          <ChevronLeft size={14} /> Back
        </button>

        <div className="flex gap-6 flex-wrap items-end">
          <img
            src={coverImg}
            onError={onImgErr}
            className="w-48 h-48 md:w-52 md:h-52 object-cover rounded-2xl flex-shrink-0"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
          />
          <div className="flex flex-col justify-end min-w-0 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                Playlist
              </p>
              {playlist.isAIGenerated && (
                <span className="text-[10px] font-bold text-sp-green bg-sp-green/10 px-2 py-0.5 rounded-full">
                  ✦ AI Generated
                </span>
              )}
            </div>

            {editing ? (
              <div className="space-y-2 mb-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-black text-white bg-white/[0.06] border border-white/[0.08] rounded-xl px-3 py-2 outline-none focus:border-sp-green/50 w-full"
                />
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Description..."
                  className="text-sm text-white/60 bg-white/[0.06] border border-white/[0.06] rounded-xl px-3 py-2 outline-none focus:border-sp-green/50 w-full"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-1.5 rounded-full bg-sp-green text-black text-xs font-bold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-1.5 rounded-full text-white/50 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl md:text-4xl font-black text-white mb-2 leading-tight tracking-tight">
                  {playlist.name}
                </h1>
                {playlist.description && (
                  <p className="text-sm text-white/40 mb-2">
                    {playlist.description}
                  </p>
                )}
              </>
            )}

            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-white/50">
                {songs.length} songs, {fmt(totalDur)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-5 flex flex-wrap items-center gap-3 sm:gap-4">
        <GreenButton
          onClick={() =>
            playableSongs.length && playSong(playableSongs[0], playableSongs)
          }
          className="flex-shrink-0"
        >
          <Play size={16} className="fill-black" />
          <span className="hidden sm:inline ml-2">Play All</span>
          <span className="sm:hidden ml-2">Play</span>
        </GreenButton>
        <div className="flex gap-3 sm:gap-4 flex-1 items-center">
          <button
            onClick={handleShuffle}
            disabled={savingOrder}
            title="Shuffle Playlist Order"
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all disabled:opacity-50"
          >
            {savingOrder ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />}
          </button>
          <button
            onClick={() => downloadPlaylist(playableSongs, playlist.name || "Playlist")}
            title="Download Entire Playlist"
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all"
          >
            <Download size={15} />
          </button>
          <button
            onClick={() => setEditing(true)}
            title="Edit Playlist"
            className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all"
          >
            <Pencil size={15} />
          </button>

          <button
            onClick={() => setReorderMode(!reorderMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold transition-all ${reorderMode
              ? "bg-sp-green/20 text-sp-green border border-sp-green/30"
              : "border border-white/10 text-white/50 hover:bg-white/[0.06]"
              }`}
          >
            <ListMusic size={14} />
            {reorderMode ? "Done" : "Reorder"}
          </button>

          <button
            onClick={handleDelete}
            title="Delete Playlist"
            className="w-10 h-10 rounded-full border border-red-500/20 flex items-center justify-center text-red-400/60 hover:text-red-400 hover:border-red-400/40 transition-all ml-auto"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Songs */}
      <div className="px-6">
        {
          localSongs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-5">
                <Music2 size={28} className="text-sp-muted" />
              </div>
              <p className="text-white font-semibold">No songs yet</p>
              <p className="text-white/30 text-sm mt-1">
                Search for songs to add to this playlist
              </p>
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={localSongs}
              onReorder={setLocalSongs}
              className="space-y-0.5 pb-10"
            >
              {localSongs.map((s, i) => {
                const mapped = mapSong(s);
                if (!s.songId) return null;
                return (
                  <PlaylistSongItem
                    key={s.songId}
                    s={s}
                    i={i}
                    mapped={mapped}
                    playableSongs={playableSongs}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    playSong={playSong}
                    likedSongs={likedSongs}
                    handleLike={handleLike}
                    handleRemoveSong={handleRemoveSong}
                    handleSaveOrder={() => handleSaveOrder(localSongs)}
                    reorderMode={reorderMode}
                  />
                );
              })}
            </Reorder.Group>
          )
        }
      </div >

      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

interface PlaylistSongItemProps {
  s: PlaylistSong;
  i: number;
  mapped: any;
  playableSongs: any[];
  currentSong: any;
  isPlaying: boolean;
  playSong: (song: any, queue: any[]) => void;
  likedSongs: Record<string, any>;
  handleLike: (song: any) => void;
  handleRemoveSong: (id: string, name: string) => void;
  handleSaveOrder: () => void;
  reorderMode: boolean;
}

function PlaylistSongItem({
  s,
  i,
  mapped,
  playableSongs,
  currentSong,
  isPlaying,
  playSong,
  likedSongs,
  handleLike,
  handleRemoveSong,
  handleSaveOrder,
  reorderMode,
}: PlaylistSongItemProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={s}
      dragListener={false}
      dragControls={controls}
      onDragEnd={handleSaveOrder}
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
          isCurrent={currentSong?.id === s.songId}
          isPlaying={isPlaying}
          onPlay={() => playSong(mapped, playableSongs)}
          liked={!!likedSongs?.[s.songId]}
          onLike={handleLike}
        />
      </div>
      {!reorderMode && (
        <button
          onClick={() => handleRemoveSong(s.songId, s.title || s.songId)}
          title="Remove from playlist"
          className="ml-1 p-2 rounded-full text-white/0 group-hover:text-red-400/70 hover:!text-red-400 hover:bg-red-400/10 transition-all duration-200 flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      )}
    </Reorder.Item>
  );
}
