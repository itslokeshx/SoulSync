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
  Download,
  User,
  BellRing,
  Flame,
  Info,
} from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { useAuthGate } from "../hooks/useAuthGate";
import { useApp } from "../context/AppContext";
import { useUIStore } from "../store/uiStore";
import * as api from "../api/backend";
import { Playlist } from "../types/playlist";
import { bestImg, onImgErr, fmt } from "../lib/helpers";
import { analytics } from "../services/analytics";
import { FALLBACK_IMG } from "../lib/constants";
import toast from "react-hot-toast";

export default function LibraryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { gate } = useAuthGate();
  const { likedSongs } = useApp();
  const { openAIPlaylist } = useUIStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [followedArtists, setFollowedArtists] = useState<any[]>([]);

  const KNOWN_ARTIST_NAMES: Record<string, string> = {
    "456269": "A.R. Rahman",
    "596989": "Anirudh Ravichander",
    "456863": "Anirudh Ravichander",
    "702776": "Arijit Singh",
    "456262": "Harris Jayaraj",
    "456263": "Yuvan Shankar Raja",
    "456264": "G.V. Prakash Kumar",
    "456265": "Hiphop Tamizha",
    "456266": "Santhosh Narayanan",
    "456267": "Ilaiyaraaja",
    "456268": "Vijay Antony",
    "456270": "D. Imman",
    "3799917": "Taylor Swift",
    "1433699": "The Weeknd",
    "17063328": "Drake",
    "929381": "Ed Sheeran",
    "16568113": "Shreya Ghoshal",
  };

  const loadFollowedArtists = () => {
    try {
      const full: any[] = JSON.parse(
        localStorage.getItem("ss_followed_artists_full") || "[]"
      );
      const cleaned = full.map((art: any) => {
        let name = (art.name || "").trim();
        if (!name || /^\d+$/.test(name) || name === "null") {
          name = KNOWN_ARTIST_NAMES[String(art.id)] || "A.R. Rahman";
        }
        return { ...art, name };
      });
      setFollowedArtists(cleaned);
    } catch {
      setFollowedArtists([]);
    }

    api.getFollowedArtists().then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        const cleaned = list.map((art: any) => {
          let name = (art.name || "").trim();
          if (!name || /^\d+$/.test(name) || name === "null") {
            name = KNOWN_ARTIST_NAMES[String(art.id)] || "A.R. Rahman";
          }
          return { ...art, name };
        });
        localStorage.setItem("ss_followed_artists_full", JSON.stringify(cleaned));
        localStorage.setItem("ss_followed_artists", JSON.stringify(cleaned.map((a: any) => String(a.id))));
        setFollowedArtists(cleaned);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadFollowedArtists();
    window.addEventListener("soulsync:followed_artists_updated", loadFollowedArtists);
    return () =>
      window.removeEventListener("soulsync:followed_artists_updated", loadFollowedArtists);
  }, []);

  useEffect(() => {
    api
      .getPlaylists()
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const playlist = await api.createPlaylist({ name: newName.trim() });
      analytics.track("playlist_create", { name: playlist.name, count: 0 });
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => gate(() => navigate("/import"), "Sign in to import your Spotify playlists")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all border border-[#1DB954]/30 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 hover:border-[#1DB954]/50 text-white/70 hover:text-white active:scale-95 group"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-[#1DB954] flex-shrink-0"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Import from Spotify
          </button>
          <button
            onClick={() =>
              gate(
                () => setShowCreate(true),
                "Sign in to create your own playlists",
              )
            }
            className="flex items-center gap-2 px-4 py-[7px] rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white text-[12px] font-bold transition-all duration-300 border border-white/[0.06] hover:border-white/[0.1]"
          >
            <Plus size={14} /> New Playlist
          </button>
        </div>
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

      {/* ── Playlists Section (First) ─────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <Library size={18} className="text-white/40" />
        <h2 className="text-lg font-bold text-white">Playlists</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
      </div>

      {loading ? (
        <div className="space-y-4 animate-fadeIn">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
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
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 animate-fadeIn mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 flex-shrink-0">
              <Music2 size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">No playlists yet</p>
              <p className="text-xs text-white/40">Create custom playlists to organize your favorite tracks</p>
            </div>
          </div>
          <button
            onClick={() =>
              gate(
                () => setShowCreate(true),
                "Sign in to create your own playlists",
              )
            }
            className="px-4 py-2 rounded-full bg-sp-green text-black text-xs font-bold hover:bg-sp-green/90 transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus size={14} /> Create Playlist
          </button>
        </div>
      ) : (
        <div className="space-y-2 mb-8">
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

      {/* ── Followed Artists Section (Second) ─────────────────────────── */}
      {followedArtists.length > 0 && (
        <div className="mt-8 mb-8 space-y-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <User size={18} className="text-purple-400" />
            <h2 className="text-lg font-bold text-white">Followed Artists</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
              {followedArtists.length}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {followedArtists.map((art) => (
              <button
                key={art.id}
                onClick={() => navigate(`/artist/${art.id}`)}
                className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all text-center group flex flex-col items-center"
              >
                <img
                  src={art.image || FALLBACK_IMG}
                  onError={onImgErr}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-md group-hover:scale-105 transition-transform duration-200 mb-2"
                />
                <p className="text-xs font-bold text-white truncate w-full group-hover:text-sp-green transition-colors">
                  {art.name}
                </p>
                <span className="text-[10px] text-purple-400 font-medium mt-0.5">
                  Followed
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
