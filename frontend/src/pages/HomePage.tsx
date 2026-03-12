import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  MoreHorizontal,
  Sparkles,
  Play,
  MoreVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { HSection } from "../components/cards/HSection";
import { SongCard } from "../components/cards/SongCard";
import { bestImg, onImgErr } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { useApp } from "../context/AppContext";
import { useAuth } from "../auth/AuthContext";
import { useUIStore } from "../store/uiStore";
import { getDashboard, getGuestDashboard } from "../api/backend";
import { Skeleton } from "../components/ui/Skeleton";
import { normalizeSong, normalizeSongs } from "../utils/normalizeSong";

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

const CACHE_TTL = 5 * 60_000; // 5 minutes — keeps Continue Listening fresh

const MOOD_COLORS: Record<string, string> = {
  "😊 Happy Vibes": "from-yellow-500/20 to-transparent",
  "💔 Heartbreak": "from-rose-500/20 to-transparent",
  "🎉 Party Mode": "from-purple-500/20 to-transparent",
  "🧘 Chill & Relax": "from-teal-500/20 to-transparent",
  "💪 Workout": "from-red-500/20 to-transparent",
  "🌧️ Rainy Day": "from-blue-500/20 to-transparent",
};

function formatPlayCount(n: number | string | undefined): string {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M plays`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K plays`;
  return num > 0 ? `${num} plays` : "";
}

// ── SpeedDial card — album art fills card, title overlaid at bottom ──
function SpeedDialCard({
  song,
  isCurrent,
  isPlaying,
  onPlay,
}: {
  song: any;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const img =
    bestImg(song.image, "500x500") ||
    bestImg(song.image, "150x150") ||
    FALLBACK_IMG;
  return (
    <div
      onClick={onPlay}
      className="relative aspect-square overflow-hidden cursor-pointer group"
    >
      <img
        src={img}
        onError={onImgErr}
        className="w-full h-full object-cover transition-transform duration-300 group-active:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-bold text-white leading-tight line-clamp-2 drop-shadow-sm">
        {song.name}
      </p>
      {isCurrent && isPlaying && (
        <div className="absolute top-1.5 right-1.5 flex gap-[2px] items-end h-3">
          {[1, 2, 3].map((k) => (
            <motion.div
              key={k}
              className="w-[2px] bg-sp-green rounded-full"
              animate={{ height: ["30%", "100%", "30%"] }}
              transition={{ duration: 0.7, delay: k * 0.12, repeat: Infinity }}
            />
          ))}
        </div>
      )}
      {isCurrent && !isPlaying && (
        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-sp-green flex items-center justify-center">
          <div className="w-1 h-1 rounded-full bg-black" />
        </div>
      )}
    </div>
  );
}

// ── SpeedDial Section — 3×3 swipeable slides (mobile only) ──
function SpeedDialSection({
  songs,
  currentSong,
  isPlaying,
  onPlay,
  userName,
  userPhotoURL,
}: {
  songs: any[];
  currentSong: any;
  isPlaying: boolean;
  onPlay: (song: any, queue: any[]) => void;
  userName?: string;
  userPhotoURL?: string;
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const touchStartX = useRef(0);

  const slides: any[][] = [];
  for (let i = 0; i < Math.min(songs.length, 27); i += 9) {
    slides.push(songs.slice(i, i + 9));
  }
  if (slides.length === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      setSlideIndex((prev) =>
        Math.max(0, Math.min(slides.length - 1, prev + (dx < 0 ? 1 : -1))),
      );
    }
  };

  return (
    <div className="mb-4 md:hidden">
      {/* Header — stays within normal content padding */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-sp-green/20 flex-shrink-0 flex items-center justify-center ring-2 ring-sp-green/20">
          {userPhotoURL ? (
            <img
              src={userPhotoURL}
              className="w-full h-full object-cover"
              onError={onImgErr}
            />
          ) : (
            <span className="text-sm font-black text-sp-green">
              {userName?.[0]?.toUpperCase() || "Y"}
            </span>
          )}
        </div>
        <div>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.12em] leading-none">
            {userName || "You"}
          </p>
          <p className="text-[16px] font-black text-white leading-snug tracking-tight">
            Speed dial
          </p>
        </div>
      </div>

      {/* Grid — breaks out of px-4 container to go full-width */}
      <div
        className="-mx-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slideIndex}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid grid-cols-3 gap-[2px]"
          >
            {(slides[slideIndex] || []).map((song) => (
              <SpeedDialCard
                key={song.id}
                song={song}
                isCurrent={currentSong?.id === song.id}
                isPlaying={isPlaying}
                onPlay={() => onPlay(song, songs)}
              />
            ))}
            {Array.from({ length: 9 - (slides[slideIndex]?.length || 0) }).map(
              (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="aspect-square bg-white/[0.04] flex items-center justify-center"
                >
                  <div className="flex gap-1 items-center">
                    {[12, 18, 12].map((sz, k) => (
                      <div
                        key={k}
                        className="rounded-full bg-white/10"
                        style={{ width: sz, height: sz }}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Page dots */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-[5px] mt-3">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === slideIndex
                  ? "w-4 h-[5px] bg-white"
                  : "w-[5px] h-[5px] bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick Picks Section — YT Music style vertical list (mobile only) ──
function QuickPicksSection({
  songs,
  onPlay,
  currentSong,
  isPlaying,
}: {
  songs: any[];
  onPlay: (song: any, queue: any[]) => void;
  currentSong: any;
  isPlaying: boolean;
}) {
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  if (!songs.length) return null;
  return (
    <div className="md:hidden mb-6">
      <div className="flex items-center justify-between px-1 mb-3">
        <h2 className="text-[15px] font-black text-white">Quick picks</h2>
        <button
          onClick={() => onPlay(songs[0], songs)}
          className="text-[12px] text-white/50 font-semibold px-3 py-1 rounded-full border border-white/10 hover:border-white/20 hover:text-white/70 transition-all"
        >
          Play all
        </button>
      </div>
      <div className="space-y-0">
        {songs.slice(0, 8).map((song) => {
          const img = bestImg(song.image, "50x50") || FALLBACK_IMG;
          const isCur = currentSong?.id === song.id;
          return (
            <div
              key={song.id}
              onClick={() => onPlay(song, songs)}
              className="flex items-center gap-3 py-2.5 px-1 group cursor-pointer"
            >
              <div className="relative w-[52px] h-[52px] flex-shrink-0 rounded overflow-hidden">
                <img
                  src={img}
                  onError={onImgErr}
                  className="w-full h-full object-cover"
                />
                {isCur && isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="flex gap-[2px] items-end h-3">
                      {[1, 2, 3].map((i) => (
                        <motion.div
                          key={i}
                          className="w-[3px] bg-sp-green rounded-full"
                          animate={{ height: ["40%", "100%", "40%"] }}
                          transition={{
                            duration: 0.8,
                            delay: i * 0.15,
                            repeat: Infinity,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-[14px] font-semibold truncate ${isCur ? "text-sp-green" : "text-white"}`}
                >
                  {song.name}
                </p>
                <p className="text-[12px] text-white/40 truncate">
                  {song.primaryArtists || ""}
                  {song.playCount
                    ? ` • ${formatPlayCount(song.playCount)}`
                    : ""}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  showContextMenu(e.clientX, e.clientY, song);
                }}
                className="p-2 text-white/0 group-hover:text-white/40 transition-colors"
              >
                <MoreVertical size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  // In-flight guard — persists across React StrictMode unmount/remount so the
  // second effect pass returns immediately instead of firing a duplicate request.
  const fetchingRef = useRef(false);
  // Timestamp of the last actual HTTP fetch (not a cache hit) — used to debounce
  // visibility/online re-fetches so rapid tab switching doesn't cause 429s.
  const lastFetchedAt = useRef(0);
  const REFETCH_COOLDOWN = 2 * 60_000; // 2 minutes between visibility-triggered fetches

  // Cache key includes user language prefs so dashboard refreshes on pref change
  const cacheKey = `ss_dashboard_${(user?.preferences?.languages || []).sort().join(",") || "guest"}`;

  const fetchDashboard = useCallback(async () => {
    if (fetchingRef.current) return; // already in-flight — drop StrictMode duplicate
    fetchingRef.current = true;
    try {
      // Check local cache first
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed: DashboardData = JSON.parse(cached);
          if (Date.now() - parsed.generatedAt < CACHE_TTL) {
            setDashboard(parsed);
            setLoading(false);
            return; // outer finally resets fetchingRef
          }
        }
      } catch {}

      try {
        const data: any = user
          ? await getDashboard()
          : await getGuestDashboard();
        setDashboard(data);
        setError(false);
        lastFetchedAt.current = Date.now();
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
    } finally {
      fetchingRef.current = false;
    }
  }, [user, cacheKey]);

  // Re-fetch when user changes (login/logout)
  useEffect(() => {
    fetched.current = false;
  }, [user]);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    // Use the cached response when fresh (PlayerProvider busts the cache on every
    // new song play, visibilitychange busts it on tab-focus — no need to bust on
    // every mount, which would cause 429s if the user navigates rapidly).
    fetchDashboard();
  }, [fetchDashboard, cacheKey]);

  // Re-fetch whenever the tab/app comes back into focus so "Continue Listening"
  // always reflects songs played since the last visit.  Backend Redis is already
  // invalidated on every history write — we just need to bust the frontend cache.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Only re-fetch if enough time has passed since the last HTTP fetch;
      // otherwise the cached data is still fresh and we'd just waste requests.
      if (Date.now() - lastFetchedAt.current < REFETCH_COOLDOWN) return;
      try {
        sessionStorage.removeItem(cacheKey);
      } catch {}
      fetched.current = false;
      fetchDashboard();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [cacheKey, fetchDashboard, REFETCH_COOLDOWN]);

  // Re-fetch when the device comes back online after being offline
  useEffect(() => {
    const onOnline = () => {
      // Always re-fetch when coming back online — the device was offline so the
      // cache may be stale regardless of TTL.
      try {
        sessionStorage.removeItem(cacheKey);
      } catch {}
      fetched.current = false;
      fetchDashboard();
    };
    window.addEventListener("soulsync:online", onOnline);
    return () => window.removeEventListener("soulsync:online", onOnline);
  }, [cacheKey, fetchDashboard]);

  const firstName = user?.name?.split(" ")[0] || "there";

  // ── Client-side greeting + subtitle (server runs in UTC, so we override with local time)
  const { localGreeting, localSubtitle } = (() => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12)
      return {
        localGreeting: `Good morning, ${firstName}`,
        localSubtitle: "Start your day with great music",
      };
    if (hr >= 12 && hr < 17)
      return {
        localGreeting: `Good afternoon, ${firstName}`,
        localSubtitle: "Perfect tunes for the afternoon",
      };
    if (hr >= 17 && hr < 21)
      return {
        localGreeting: `Good evening, ${firstName}`,
        localSubtitle: "Wind down with your favourites",
      };
    return {
      localGreeting: `Good night, ${firstName}`,
      localSubtitle: "Late night vibes, just for you",
    };
  })();

  // ── Mood click handler ── navigates to search page with pre-filled query
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
      {/* MOBILE: Speed Dial at the very top */}
      {recentlyPlayed.length > 0 && (
        <SpeedDialSection
          songs={recentlyPlayed}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlay={onPlay}
          userName={user?.name?.split(" ")[0]}
          userPhotoURL={user?.photoURL}
        />
      )}

      {/* DESKTOP: Greeting */}
      <div className="hidden md:block mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          {localGreeting}
        </h1>
        <p className="text-white/30 text-sm mt-1">{localSubtitle}</p>
      </div>

      {/* DESKTOP: Recently played grid */}
      {recentlyPlayed.length > 0 && (
        <div className="hidden md:block mb-10">
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
                  className="flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.07] rounded-lg overflow-hidden transition-all h-16 group cursor-pointer relative hover:scale-[1.01]"
                >
                  <img
                    src={img}
                    onError={onImgErr}
                    className="w-16 h-16 object-cover flex-shrink-0"
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
                  {/* Play button overlay on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-0 pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-sp-green flex items-center justify-center">
                      <Play
                        size={12}
                        className="text-black fill-black ml-0.5"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MOBILE: Quick Picks from dashboard API first section */}
      {(dashboard?.sections?.[0]?.songs?.length ?? 0) > 0 && (
        <QuickPicksSection
          songs={dashboard!.sections[0].songs.filter(
            (s: any) =>
              !recentlyPlayed.some(
                (rp) => rp.id === s.id || rp.id === s.songId,
              ),
          )}
          onPlay={onPlay}
          currentSong={currentSong}
          isPlaying={isPlaying}
        />
      )}

      {/* Dashboard sections — both mobile and desktop */}
      {dashboard?.sections?.map((section) => {
        // Filter out songs that are already in recentlyPlayed
        const filteredSongs = section.songs.filter(
          (s) =>
            !recentlyPlayed.some((rp) => rp.id === s.id || rp.id === s.songId),
        );

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
                {filteredSongs.map((s) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    isCurrent={currentSong?.id === s.id}
                    isPlaying={isPlaying}
                    onPlay={() => onPlay(s, filteredSongs)}
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
                {filteredSongs.map((s) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    isCurrent={currentSong?.id === s.id}
                    isPlaying={isPlaying}
                    onPlay={() => onPlay(s, filteredSongs)}
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
                songs={filteredSongs}
                loading={false}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={(song: any, queue: any[]) =>
                  onPlay(song, queue.length ? queue : filteredSongs)
                }
                onAlbumClick={(al: any) => navigate(`/album/${al.id}`)}
                onSeeAll={
                  section.songs.length > 8
                    ? () =>
                        navigate(
                          `/search?q=${encodeURIComponent(section.title)}`,
                        )
                    : undefined
                }
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

export default HomePage;
