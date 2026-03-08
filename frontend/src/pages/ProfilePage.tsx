import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LogOut,
  Heart,
  Clock,
  Music2,
  BarChart3,
  User as UserIcon,
  Settings,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api/backend";
import { UserStats } from "../types/user";
import { onImgErr } from "../lib/helpers";
import toast from "react-hot-toast";

const ALL_LANGUAGES = [
  "hindi",
  "english",
  "punjabi",
  "tamil",
  "telugu",
  "bengali",
  "marathi",
  "gujarati",
  "kannada",
  "malayalam",
  "urdu",
  "bhojpuri",
  "rajasthani",
  "haryanvi",
  "assamese",
  "odia",
];
const ALL_MOODS = [
  "happy",
  "sad",
  "romantic",
  "chill",
  "energetic",
  "party",
  "devotional",
  "workout",
  "focus",
  "sleep",
  "melancholy",
  "nostalgic",
];

export default function ProfilePage() {
  const { user, logout, updateUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState(user?.name || "");
  const [editLanguages, setEditLanguages] = useState<string[]>(
    user?.preferences?.languages || [],
  );
  const [editMoods, setEditMoods] = useState<string[]>(
    user?.preferences?.moods || [],
  );

  useEffect(() => {
    api
      .getUserStats()
      .then(setStats)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  // Reset edit fields when user changes
  useEffect(() => {
    if (user) {
      setEditName(user.name || "");
      setEditLanguages(user.preferences?.languages || []);
      setEditMoods(user.preferences?.moods || []);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch {
      toast.error("Logout failed");
    }
  };

  const toggleTag = (
    list: string[],
    setList: (v: string[]) => void,
    tag: string,
  ) => {
    setList(
      list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag],
    );
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error("Name can't be empty");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updatePreferences({
        name: editName.trim(),
        languages: editLanguages,
        moods: editMoods,
      });
      updateUser(updated);
      setEditing(false);
      // Clear dashboard caches so home page refreshes with new language prefs
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("ss_dashboard")) sessionStorage.removeItem(key);
      }
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(user?.name || "");
    setEditLanguages(user?.preferences?.languages || []);
    setEditMoods(user?.preferences?.moods || []);
    setEditing(false);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (!isAuthenticated) {
    return (
      <div className="animate-fadeIn max-w-md mx-auto h-[70vh] flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 rounded-full bg-white/[0.04] flex items-center justify-center mb-6 ring-4 ring-sp-green/10">
          <UserIcon size={40} className="text-white/40" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">
          Your Profile awaits
        </h1>
        <p className="text-sm text-white/40 mb-8 max-w-xs leading-relaxed">
          Sign in to view your listening stats, customize your preferences, and sync your data across devices.
        </p>
        <button
          onClick={() => navigate("/login")}
          className="px-8 py-3.5 rounded-full bg-sp-green text-black font-bold text-[14px] hover:bg-sp-green/90 hover:scale-105 active:scale-95 transition-all w-full max-w-[200px]"
          style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.2)" }}
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      {/* Profile header */}
      <div className="flex items-center gap-5 mb-10">
        <div className="relative">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              onError={onImgErr}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-sp-green/20"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sp-green to-emerald-600 flex items-center justify-center">
              <UserIcon size={32} className="text-black" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-sp-green flex items-center justify-center ring-2 ring-[#0a0a0a]">
            <Music2 size={10} className="text-black" />
          </div>
        </div>
        <div className="flex-1">
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="text-2xl font-black text-white tracking-tight bg-white/[0.06] border border-white/10 rounded-xl px-3 py-1.5 outline-none focus:border-sp-green/40 transition-colors w-full max-w-xs"
              placeholder="Your name"
            />
          ) : (
            <h1 className="text-2xl font-black text-white tracking-tight">
              {user?.name}
            </h1>
          )}
          <p className="text-white/40 text-sm">{user?.email}</p>
          {!editing && (
            <div className="flex gap-2 mt-2">
              {user?.preferences?.languages?.map((lang) => (
                <span
                  key={lang}
                  className="px-2.5 py-0.5 rounded-full bg-white/[0.06] text-white/50 text-[10px] font-semibold uppercase"
                >
                  {lang}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Edit / Save / Cancel buttons */}
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all"
                title="Cancel"
              >
                <X size={16} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-2.5 rounded-xl bg-sp-green/20 hover:bg-sp-green/30 text-sp-green transition-all disabled:opacity-50"
                title="Save"
              >
                <Check size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white transition-all"
              title="Edit profile"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <BarChart3 size={18} className="text-sp-green" />
        Listening Stats
      </h2>

      {loading ? (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.04] text-center"
            >
              <div className="w-5 h-5 rounded-full bg-white/[0.06] mx-auto mb-2 animate-pulse" />
              <div className="h-7 w-12 rounded-lg bg-white/[0.06] mx-auto mb-1.5 animate-pulse" />
              <div className="h-3 w-16 rounded bg-white/[0.04] mx-auto animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.04] text-center"
          >
            <Music2 size={20} className="text-sp-green mx-auto mb-2" />
            <p className="text-2xl font-black text-white">
              {stats?.totalSongsPlayed || 0}
            </p>
            <p className="text-[11px] text-white/40 font-medium mt-1">
              Songs Played
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.04] text-center"
          >
            <Clock size={20} className="text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-black text-white">
              {formatTime(stats?.totalListeningTime || 0)}
            </p>
            <p className="text-[11px] text-white/40 font-medium mt-1">
              Listen Time
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.04] text-center"
          >
            <Heart size={20} className="text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-black text-white">
              {stats?.likedSongsCount || 0}
            </p>
            <p className="text-[11px] text-white/40 font-medium mt-1">
              Liked Songs
            </p>
          </motion.div>
        </div>
      )}

      {/* Top Artists */}
      {loading ? (
        <div className="mb-8">
          <div className="h-3.5 w-24 rounded bg-white/[0.06] mb-4 animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02]"
              >
                <div className="w-5 h-4 rounded bg-white/[0.04] animate-pulse" />
                <div className="w-10 h-10 rounded-full bg-white/[0.06] animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-2.5 w-14 rounded bg-white/[0.04] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : stats?.topArtists && stats.topArtists.length > 0 ? (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
            Top Artists
          </h3>
          <div className="space-y-2">
            {stats.topArtists.slice(0, 5).map((artist, i) => (
              <div
                key={artist._id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all"
              >
                <span className="text-sm font-bold text-white/20 w-5 text-center">
                  {i + 1}
                </span>
                {artist.albumArt ? (
                  <img
                    src={artist.albumArt}
                    onError={onImgErr}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center">
                    <UserIcon size={16} className="text-white/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {artist._id}
                  </p>
                  <p className="text-white/30 text-xs">{artist.count} plays</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Language breakdown */}
      {loading ? (
        <div className="mb-8">
          <div className="h-3.5 w-20 rounded bg-white/[0.06] mb-4 animate-pulse" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-7 rounded-full bg-white/[0.04] animate-pulse"
                style={{ width: `${60 + i * 12}px` }}
              />
            ))}
          </div>
        </div>
      ) : stats?.languageBreakdown && stats.languageBreakdown.length > 0 ? (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
            Languages
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.languageBreakdown.map((lb) => (
              <span
                key={lb._id}
                className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-300 text-xs font-semibold capitalize"
              >
                {lb._id} · {lb.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Preferences (editable) */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Settings size={14} /> Preferences
        </h3>
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.04] space-y-5">
          {/* Languages */}
          <div>
            <p className="text-xs text-white/40 mb-2.5">Languages</p>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {ALL_LANGUAGES.map((l) => {
                  const active = editLanguages.includes(l);
                  return (
                    <button
                      key={l}
                      onClick={() =>
                        toggleTag(editLanguages, setEditLanguages, l)
                      }
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all duration-200 border ${active
                        ? "bg-sp-green/20 text-sp-green border-sp-green/30"
                        : "bg-white/[0.04] text-white/30 border-white/[0.06] hover:text-white/50 hover:border-white/10"
                        }`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            ) : user?.preferences?.languages?.length ? (
              <div className="flex flex-wrap gap-2">
                {user.preferences.languages.map((l) => (
                  <span
                    key={l}
                    className="px-3 py-1 rounded-full bg-sp-green/10 text-sp-green text-xs font-semibold capitalize"
                  >
                    {l}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-white/20 text-xs italic">
                No languages set — tap edit to add
              </p>
            )}
          </div>

          {/* Moods */}
          <div>
            <p className="text-xs text-white/40 mb-2.5">Moods</p>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {ALL_MOODS.map((m) => {
                  const active = editMoods.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggleTag(editMoods, setEditMoods, m)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all duration-200 border ${active
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                        : "bg-white/[0.04] text-white/30 border-white/[0.06] hover:text-white/50 hover:border-white/10"
                        }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            ) : user?.preferences?.moods?.length ? (
              <div className="flex flex-wrap gap-2">
                {user.preferences.moods.map((m) => (
                  <span
                    key={m}
                    className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs font-semibold capitalize"
                  >
                    {m}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-white/20 text-xs italic">
                No moods set — tap edit to add
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-all duration-300 border border-red-500/10 hover:border-red-500/20"
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );
}
