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
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useApp } from "../context/AppContext";
import * as api from "../api/backend";
import { UserStats } from "../types/user";
import { onImgErr } from "../lib/helpers";
import { isNative } from "../utils/platform";
import toast from "react-hot-toast";
import SoulSyncWrapped from "../components/profile/SoulSyncWrapped";
import { FeedbackModal } from "../components/ui/FeedbackModal";

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
  const { likedSongs } = useApp();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState(user?.name || "");
  const [editLanguages, setEditLanguages] = useState<string[]>(
    user?.preferences?.languages || [],
  );
  const [editMoods, setEditMoods] = useState<string[]>(
    user?.preferences?.moods || [],
  );

  const fetchStats = (showLoading = true) => {
    if (showLoading) setLoading(true);
    api
      .getUserStats()
      .then((data) => {
        setStats(data);
        setStatsError(false);
      })
      .catch(() => setStatsError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Fetch on mount
    fetchStats();
    // Re-fetch whenever the tab/app comes back into focus — silently, no skeleton
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchStats(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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
          Sign in to view your listening stats, customize your preferences, and
          sync your data across devices.
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
    <div className="animate-fadeIn max-w-3xl mx-auto pb-12">
      {/* Profile Header Banner */}
      <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 md:p-8 border border-white/[0.06] bg-white/[0.01] backdrop-blur-md flex flex-row items-center justify-between gap-4 sm:gap-6 mb-8">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.01] to-transparent pointer-events-none" />
        
        <div className="flex flex-row items-center gap-4 sm:gap-6 relative z-10 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                onError={onImgErr}
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full object-cover ring-2 ring-sp-green/20"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-sp-green to-emerald-600 flex items-center justify-center">
                <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-black" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-sp-green flex items-center justify-center ring-2 ring-[#08080a]">
              <Music2 size={10} className="text-black" />
            </div>
          </div>

          <div className="text-left space-y-1 min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-wrap min-w-0">
              {editing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight bg-white/[0.06] border border-white/10 rounded-xl px-3 py-1 outline-none focus:border-sp-green/45 transition-colors w-full max-w-[160px] sm:max-w-xs"
                  placeholder="Your name"
                />
              ) : (
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight truncate">
                  {user?.name}
                </h1>
              )}
              {user?.username && (
                <span className="text-[10px] sm:text-xs text-white/30 font-mono sm:mt-1">
                  @{user.username}
                </span>
              )}
            </div>

            <p className="text-white/40 text-[11px] sm:text-xs md:text-sm truncate">{user?.email}</p>

            <div className="flex items-center gap-1.5 mt-1 sm:mt-2 flex-wrap">
              {(user as any)?.authProvider && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider border ${
                    (user as any).authProvider === "google" ||
                    (user as any).authProvider === "both"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : "bg-white/[0.03] text-white/30 border-white/[0.05]"
                  }`}
                >
                  {(user as any).authProvider === "google"
                    ? "🔵 Google"
                    : (user as any).authProvider === "both"
                      ? "🔵 Google + Email"
                      : "📧 Email"}
                </span>
              )}
              {(editing ? editLanguages : user?.preferences?.languages || [])
                .slice(0, 3)
                .map((lang) => (
                  <span
                    key={lang}
                    className="px-2 py-0.5 rounded-full bg-white/[0.04] text-white/40 text-[8px] sm:text-[9px] font-bold uppercase border border-white/[0.05]"
                  >
                    {lang}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* Edit / Save / Cancel buttons */}
        <div className="flex gap-2 relative z-10 flex-shrink-0">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                className="p-2 sm:p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all active:scale-95"
                title="Cancel"
              >
                <X size={14} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-2 sm:p-2.5 rounded-xl bg-sp-green/10 border border-sp-green/20 hover:bg-sp-green/20 text-sp-green transition-all active:scale-95 disabled:opacity-50"
                title="Save"
              >
                <Check size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="p-2 sm:p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/15 text-white/50 hover:text-white transition-all active:scale-95"
              title="Edit profile"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="mb-6">
        <h2 className="text-sm font-black text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
          <BarChart3 size={15} className="text-sp-green" />
          Listening Stats
        </h2>

        {loading ? (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 rounded-[24px] bg-white/[0.01] border border-white/[0.04] text-center"
              >
                <div className="w-5 h-5 rounded-full bg-white/[0.04] mx-auto mb-2.5 animate-pulse" />
                <div className="h-6 w-14 bg-white/[0.04] rounded-lg mx-auto mb-2 animate-pulse" />
                <div className="h-3 w-16 bg-white/[0.03] rounded mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        ) : statsError ? (
          <div className="p-6 rounded-[24px] bg-white/[0.01] border border-white/[0.04] text-center mb-8">
            <p className="text-white/20 text-xs">Failed to load listening stats</p>
            <button
              onClick={() => {
                setLoading(true);
                setStatsError(false);
                api
                  .getUserStats()
                  .then((d) => {
                    setStats(d);
                    setStatsError(false);
                  })
                  .catch(() => setStatsError(true))
                  .finally(() => setLoading(false));
              }}
              className="text-sp-green text-xs mt-2 hover:underline"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4, borderColor: "rgba(29,185,84,0.2)" }}
              className="p-6 rounded-[24px] bg-white/[0.01] border border-white/[0.04] transition-all duration-300 text-center"
            >
              <Music2 size={18} className="text-sp-green mx-auto mb-2.5" />
              <p className="text-2xl font-black text-white leading-none">
                {stats?.totalSongsPlayed ?? "—"}
              </p>
              <p className="text-[10px] text-white/35 font-bold uppercase tracking-wider mt-2.5">
                Songs Played
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              whileHover={{ y: -4, borderColor: "rgba(167,139,250,0.2)" }}
              className="p-6 rounded-[24px] bg-white/[0.01] border border-white/[0.04] transition-all duration-300 text-center"
            >
              <Clock size={18} className="text-purple-400 mx-auto mb-2.5" />
              <p className="text-2xl font-black text-white leading-none">
                {stats?.totalListeningTime
                  ? formatTime(stats.totalListeningTime)
                  : "—"}
              </p>
              <p className="text-[10px] text-white/35 font-bold uppercase tracking-wider mt-2.5">
                Listen Time
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -4, borderColor: "rgba(251,113,133,0.2)" }}
              className="p-6 rounded-[24px] bg-white/[0.01] border border-white/[0.04] transition-all duration-300 text-center"
            >
              <Heart size={18} className="text-red-400 mx-auto mb-2.5" />
              <p className="text-2xl font-black text-white leading-none">
                {Object.keys(likedSongs).length}
              </p>
              <p className="text-[10px] text-white/35 font-bold uppercase tracking-wider mt-2.5">
                Liked Songs
              </p>
            </motion.div>
          </div>
        )}
      </div>

      {/* SoulSync Wrapped (Dynamic, premium story-teller and dashboard widget) */}
      <SoulSyncWrapped stats={stats} user={user} loading={loading} />

      {/* Preferences Section */}
      <div className="mb-8">
        <h3 className="text-sm font-black text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Settings size={14} className="text-white/40" /> Preferences
        </h3>
        <div className="p-6 rounded-[28px] bg-white/[0.01] border border-white/[0.04] space-y-6">
          {/* Languages */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/30 font-bold mb-3">Languages</p>
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
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all duration-200 border ${
                        active
                          ? "bg-sp-green/20 text-sp-green border-sp-green/30"
                          : "bg-white/[0.03] text-white/30 border-white/[0.05] hover:text-white/50 hover:border-white/10"
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
                    className="px-3 py-1 rounded-full bg-sp-green/10 text-sp-green text-xs font-bold capitalize border border-sp-green/15"
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
            <p className="text-[11px] uppercase tracking-wider text-white/30 font-bold mb-3">Moods</p>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {ALL_MOODS.map((m) => {
                  const active = editMoods.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggleTag(editMoods, setEditMoods, m)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all duration-200 border ${
                        active
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : "bg-white/[0.03] text-white/30 border-white/[0.05] hover:text-white/50 hover:border-white/10"
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
                    className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs font-bold capitalize border border-purple-500/15"
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



      {/* Send Feedback Button */}
      <button
        onClick={() => setIsFeedbackOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 mb-3.5 rounded-[20px] bg-white/[0.03] hover:bg-white/[0.06] text-white/80 hover:text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 border border-white/[0.05] hover:border-white/10 active:scale-[0.99]"
      >
        <MessageSquare size={14} /> Send Feedback
      </button>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-[20px] bg-red-500/10 hover:bg-red-500/15 text-red-400 text-xs font-bold uppercase tracking-wider transition-all duration-300 border border-red-500/10 hover:border-red-500/20 active:scale-[0.99]"
      >
        <LogOut size={14} /> Sign Out
      </button>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
