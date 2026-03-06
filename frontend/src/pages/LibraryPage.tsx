import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  Heart,
  Music2,
  Sparkles,
  Library,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { useApp } from "../context/AppContext";
import { useUIStore } from "../store/uiStore";
import * as api from "../api/backend";
import { Playlist } from "../types/playlist";
import { bestImg, onImgErr, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import toast from "react-hot-toast";

export default function LibraryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { likedSongs } = useApp();
  const { openAIPlaylist } = useUIStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .getPlaylists()
      .then(setPlaylists)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const playlist = await api.createPlaylist({ name: newName.trim() });
      setPlaylists((prev) => [playlist, ...prev]);
      setNewName("");
      setShowCreate(false);
      toast.success("Playlist created!");
      navigate(`/playlist/${playlist._id}`);
    } catch {
      toast.error("Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const likedCount = Object.keys(likedSongs).length;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Your Library
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {user?.name}'s collection
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm font-semibold transition-all duration-300 border border-white/[0.06] hover:border-white/[0.1]"
        >
          <Plus size={16} /> New Playlist
        </button>
      </div>

      {/* Create playlist inline */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name..."
            className="w-full bg-white/[0.06] border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-white/25 outline-none focus:border-sp-green/50 transition-colors mb-3"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-full text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              className="px-5 py-2 rounded-full bg-sp-green text-black text-sm font-bold disabled:opacity-30 hover:bg-sp-green/90 transition-all"
            >
              {creating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Create"
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick access cards */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {/* Liked Songs */}
        <button
          onClick={() => navigate("/liked")}
          className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-600/20 to-purple-600/5 border border-purple-500/10 hover:border-purple-500/20 transition-all duration-300 group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
            <Heart size={20} className="text-white fill-white" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-white font-bold text-sm truncate">Liked Songs</p>
            <p className="text-white/40 text-xs">{likedCount} songs</p>
          </div>
          <ChevronRight
            size={16}
            className="text-white/20 ml-auto group-hover:text-white/50 transition-colors"
          />
        </button>

        {/* AI Playlist Builder */}
        <button
          onClick={() => openAIPlaylist()}
          className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-sp-green/20 to-sp-green/5 border border-sp-green/10 hover:border-sp-green/20 transition-all duration-300 group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sp-green to-emerald-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={20} className="text-black" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-white font-bold text-sm truncate">AI Builder</p>
            <p className="text-white/40 text-xs">Create with AI</p>
          </div>
          <ChevronRight
            size={16}
            className="text-white/20 ml-auto group-hover:text-white/50 transition-colors"
          />
        </button>
      </div>

      {/* Playlists */}
      <div className="flex items-center gap-3 mb-4">
        <Library size={18} className="text-white/40" />
        <h2 className="text-lg font-bold text-white">Playlists</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
      </div>

      {loading ? (
        <div className="space-y-4 animate-fadeIn">
          {/* Quick Access Skeletons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          {/* Playlist Skeletons */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/4 rounded-md opacity-50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-5">
            <Music2 size={28} className="text-sp-muted" />
          </div>
          <p className="text-white font-semibold text-base">No playlists yet</p>
          <p className="text-sp-sub/60 text-sm mt-1.5">
            Create your first playlist to get started
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 px-6 py-2.5 rounded-full bg-sp-green text-black text-sm font-bold hover:bg-sp-green/90 transition-all"
          >
            Create Playlist
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {playlists.map((pl, i) => (
            <motion.button
              key={pl._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/playlist/${pl._id}`)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/[0.04] transition-all duration-200 group"
            >
              <img
                src={pl.coverImage || FALLBACK_IMG}
                onError={onImgErr}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
              />
              <div className="text-left min-w-0 flex-1">
                <p className="text-white font-semibold text-sm truncate">
                  {pl.name}
                </p>
                <p className="text-white/40 text-xs">
                  {pl.songCount} songs
                  {pl.isAIGenerated && (
                    <span className="ml-2 text-sp-green">✦ AI</span>
                  )}
                </p>
              </div>
              <ChevronRight
                size={14}
                className="text-white/10 group-hover:text-white/30 transition-colors"
              />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
