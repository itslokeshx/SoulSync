import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MoreHorizontal, Sparkles } from "lucide-react";
import { HSection } from "../components/cards/HSection";
import { SongCard } from "../components/cards/SongCard";
import { bestImg, onImgErr } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { useApp } from "../context/AppContext";
import { useAuth } from "../auth/AuthContext";
import { useUIStore } from "../store/uiStore";
import { getDashboard, getGuestDashboard } from "../api/backend";
import { Skeleton } from "../components/ui/Skeleton";

interface DashboardSection {
  id: string;
  title: string;
  subtitle?: string;
  type:
    | "quick_grid"
    | "horizontal"
    | "artist_spotlight"
    | "mood_grid"
    | "continue";
  songs: any[];
  meta?: Record<string, any>;
}

interface DashboardData {
  greeting: string;
  subtitle: string;
  sections: DashboardSection[];
  generatedAt: number;
}

const CACHE_TTL = 30 * 60_000; // 30 minutes

const MOOD_COLORS: Record<string, string> = {
  "😊 Happy Vibes": "from-yellow-500/20 to-transparent",
  "💔 Heartbreak": "from-rose-500/20 to-transparent",
  "🎉 Party Mode": "from-purple-500/20 to-transparent",
  "🧘 Chill & Relax": "from-teal-500/20 to-transparent",
  "💪 Workout": "from-red-500/20 to-transparent",
  "🌧️ Rainy Day": "from-blue-500/20 to-transparent",
};

export const HomePage = () => {
  const navigate = useNavigate();
  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
    recentlyPlayed,
    likedSongs,
    handleLike,
  } = useApp();
  const { user } = useAuth();
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetched = useRef(false);

  // Cache key includes user language prefs so dashboard refreshes on pref change
  const cacheKey = `ss_dashboard_${(user?.preferences?.languages || []).sort().join(",") || "guest"}`;

  const fetchDashboard = useCallback(async () => {
    // Check local cache first
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed: DashboardData = JSON.parse(cached);
        if (Date.now() - parsed.generatedAt < CACHE_TTL) {
          setDashboard(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {}

    try {
      const data: any = user ? await getDashboard() : await getGuestDashboard();
      setDashboard(data);
      setError(false);
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // If authenticated dashboard fails (401 etc), fall back to guest dashboard
      if (user) {
        try {
          const guestData: any = await getGuestDashboard();
          setDashboard(guestData);
          setError(false);
          return;
        } catch {}
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user, cacheKey]);

  // Re-fetch when user changes (login/logout)
  useEffect(() => {
    fetched.current = false;
  }, [user]);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetchDashboard();
  }, [fetchDashboard]);

  const firstName = user?.name?.split(" ")[0] || "there";

  // ── Client-side greeting (server runs in UTC, so we override with local time)
  const localGreeting = (() => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return `Good morning, ${firstName}`;
    if (hr >= 12 && hr < 17) return `Good afternoon, ${firstName}`;
    if (hr >= 17 && hr < 21) return `Good evening, ${firstName}`;
    return `Good night, ${firstName}`;
  })();

  // ── Mood click handler
  const onMoodClick = (mood: string) => {
    const q =
      mood
        .replace(/[^\w\s]/g, "")
        .trim()
        .toLowerCase() + " songs";
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // ── Loading state
  if (loading) {
    return (
      <div className="animate-fadeIn space-y-10">
        <div>
          <Skeleton className="h-8 w-64 rounded-lg mb-2" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
        {/* Recently played skeleton */}
        <div>
          <Skeleton className="h-4 w-32 rounded-md mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
        {/* Section skeletons */}
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="h-5 w-40 rounded-md mb-4" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 7 }).map((_, j) => (
                <div
                  key={j}
                  className="flex-shrink-0 w-44 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <Skeleton className="w-full aspect-square mb-3 rounded-xl" />
                  <Skeleton className="h-3 w-4/5 mb-2 rounded-md" />
                  <Skeleton className="h-2.5 w-1/2 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          {localGreeting}
        </h1>
        <p className="text-white/30 text-sm mt-1">
          {dashboard?.subtitle || "Your music, your way"}
        </p>
      </div>

      {/* Recently played — always from local state */}
      {recentlyPlayed.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">
            Recently Played
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {recentlyPlayed.slice(0, 8).map((s) => {
              const img = bestImg(s.image, "50x50") || FALLBACK_IMG;
              const isCur = currentSong?.id === s.id;
              const isLiked = !!likedSongs[s.id];
              return (
                <div
                  key={s.id}
                  onClick={() => onPlay(s, recentlyPlayed)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    showContextMenu(e.clientX, e.clientY, s);
                  }}
                  className="flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.07] rounded-lg overflow-hidden transition-colors h-14 group cursor-pointer relative"
                >
                  <img
                    src={img}
                    onError={onImgErr}
                    className="w-14 h-14 object-cover flex-shrink-0"
                  />
                  <span
                    className={`flex-1 text-[13px] font-medium text-left truncate ${isCur ? "text-sp-green" : "text-white"}`}
                  >
                    {s.name}
                  </span>
                  <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(s);
                      }}
                      className="p-1.5 rounded-full hover:bg-white/10 transition-all"
                    >
                      <Heart
                        size={12}
                        className={
                          isLiked
                            ? "text-sp-green fill-sp-green"
                            : "text-white/40"
                        }
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showContextMenu(e.clientX, e.clientY, s);
                      }}
                      className="p-1.5 rounded-full hover:bg-white/10 transition-all"
                    >
                      <MoreHorizontal size={12} className="text-white/40" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard sections from API */}
      {dashboard?.sections?.map((section) => {
        // ── Mood Grid ──
        if (section.type === "mood_grid" && section.meta?.moods) {
          return (
            <div key={section.id} className="mb-10">
              <h2 className="text-lg font-bold text-white mb-1">
                {section.title}
              </h2>
              {section.subtitle && (
                <p className="text-white/30 text-xs mb-4">{section.subtitle}</p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {section.meta.moods.map((mood: string) => (
                  <button
                    key={mood}
                    onClick={() => onMoodClick(mood)}
                    className={`p-4 rounded-xl bg-gradient-to-br ${MOOD_COLORS[mood] || "from-white/[0.06] to-transparent"} border border-white/[0.06] hover:border-white/[0.12] text-left transition-all duration-200 hover:scale-[1.02]`}
                  >
                    <span className="text-lg">{mood.split(" ")[0]}</span>
                    <p className="text-sm font-medium text-white mt-1">
                      {mood.replace(/^[^\s]+\s/, "")}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        }

        // ── Continue Listening ──
        if (section.type === "continue" && section.songs.length > 0) {
          return (
            <div key={section.id} className="mb-10">
              <h2 className="text-lg font-bold text-white mb-1">
                {section.title}
              </h2>
              {section.subtitle && (
                <p className="text-white/30 text-xs mb-4">{section.subtitle}</p>
              )}
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-3 -mx-1 px-1">
                {section.songs.map((s) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    isCurrent={currentSong?.id === s.id}
                    isPlaying={isPlaying}
                    onPlay={() => onPlay(s, section.songs)}
                  />
                ))}
              </div>
            </div>
          );
        }

        // ── Artist Spotlight ──
        if (section.type === "artist_spotlight" && section.songs.length > 0) {
          return (
            <div key={section.id} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                {section.meta?.artistImage && (
                  <img
                    src={section.meta.artistImage}
                    onError={onImgErr}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                  />
                )}
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {section.title}
                    <Sparkles size={14} className="text-sp-green" />
                  </h2>
                  {section.subtitle && (
                    <p className="text-white/30 text-xs">{section.subtitle}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-3 -mx-1 px-1">
                {section.songs.map((s) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    isCurrent={currentSong?.id === s.id}
                    isPlaying={isPlaying}
                    onPlay={() => onPlay(s, section.songs)}
                  />
                ))}
              </div>
            </div>
          );
        }

        // ── Default: Horizontal scroll (trending, language, etc.) ──
        if (section.songs.length > 0) {
          return (
            <div key={section.id} className="mb-10">
              <HSection
                title={section.title}
                songs={section.songs}
                loading={false}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={(song: any, queue: any[]) =>
                  onPlay(song, queue.length ? queue : section.songs)
                }
                onAlbumClick={(al: any) => navigate(`/album/${al.id}`)}
              />
            </div>
          );
        }

        return null;
      })}

      {/* Error fallback */}
      {error && !dashboard && (
        <div className="text-center py-16">
          <p className="text-white/40 text-sm">Couldn't load your dashboard.</p>
          <button
            onClick={() => {
              setError(false);
              setLoading(true);
              fetched.current = false;
              fetchDashboard();
            }}
            className="mt-3 px-4 py-2 rounded-full text-sm bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
