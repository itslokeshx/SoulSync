import { useState, useEffect, useRef, useCallback } from "react";
import { HSection } from "../components/cards/HSection";
import { SongCard } from "../components/cards/SongCard";
import { useApp } from "../context/AppContext";
import { useAuth } from "../auth/AuthContext";
import { getDashboard, getGuestDashboard, getMoreRecommendations, startRadio } from "../api/backend";
import { Skeleton } from "../components/ui/Skeleton";
import { normalizeSongs } from "../utils/normalizeSong";

const CACHE_TTL = 5 * 60_000; // 5 minutes

export const HomePage = () => {
  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
  } = useApp();
  const { user, isLoading: authLoading } = useAuth();

  const [dashboard, setDashboard] = useState<any>(null);
  const [madeForYouSongs, setMadeForYouSongs] = useState<any[]>([]);
  const [hasMoreMadeForYou, setHasMoreMadeForYou] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetched = useRef(false);
  const fetchingRef = useRef(false);
  const lastFetchedAt = useRef(0);
  const REFETCH_COOLDOWN = 2 * 60_000; // 2 minutes

  const cacheKey = `ss_dashboard_${(user?.preferences?.languages || []).sort().join(",") || "guest"}`;

  const fetchDashboard = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      // Check session cache
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.generatedAt < CACHE_TTL) {
            setDashboard(parsed);
            setMadeForYouSongs(parsed?.madeForYou?.songs || []);
            setHasMoreMadeForYou(parsed?.madeForYou?.hasMore || false);
            setLoading(false);
            return;
          }
        }
      } catch {}

      try {
        const data = user ? await getDashboard() : await getGuestDashboard();
        setDashboard(data);
        setMadeForYouSongs(data?.madeForYou?.songs || []);
        setHasMoreMadeForYou(data?.madeForYou?.hasMore || false);
        setError(false);
        lastFetchedAt.current = Date.now();
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (err) {
        console.error("Dashboard load error:", err);
        if (user) {
          try {
            const guestData = await getGuestDashboard();
            setDashboard(guestData);
            setMadeForYouSongs(guestData?.madeForYou?.songs || []);
            setHasMoreMadeForYou(guestData?.madeForYou?.hasMore || false);
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

  useEffect(() => {
    fetched.current = false;
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (fetched.current) return;
    fetched.current = true;
    fetchDashboard();
  }, [fetchDashboard, cacheKey, authLoading]);

  // Tab focus re-fetch
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
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

  // Online status re-fetch
  useEffect(() => {
    const onOnline = () => {
      try {
        sessionStorage.removeItem(cacheKey);
      } catch {}
      fetched.current = false;
      fetchDashboard();
    };
    window.addEventListener("soulsync:online", onOnline);
    return () => window.removeEventListener("soulsync:online", onOnline);
  }, [cacheKey, fetchDashboard]);

  // Endless Autoplay on Click
  const handleHomeSongClick = async (song: any) => {
    try {
      const res = await startRadio(song.id);
      if (res.songs && res.songs.length > 0) {
        const normalized = normalizeSongs(res.songs);
        onPlay(normalized[0], normalized);
      } else {
        onPlay(song);
      }
    } catch (err) {
      console.error("Failed to start radio:", err);
      onPlay(song);
    }
  };

  // Infinite Scroll fetch logic
  const fetchMoreMadeForYou = useCallback(async () => {
    if (loadingMore || !hasMoreMadeForYou) return;
    setLoadingMore(true);
    try {
      const excludeIds = new Set<string>();
      if (dashboard?.recentlyPlayed) {
        dashboard.recentlyPlayed.forEach((s: any) => excludeIds.add(s.id));
      }
      if (dashboard?.newReleases?.songs) {
        dashboard.newReleases.songs.forEach((s: any) => excludeIds.add(s.id));
      }
      if (dashboard?.becauseYouLiked) {
        dashboard.becauseYouLiked.forEach((shelf: any) => {
          shelf.songs.forEach((s: any) => excludeIds.add(s.id));
        });
      }
      madeForYouSongs.forEach((s: any) => excludeIds.add(s.id));

      const res = await getMoreRecommendations(Array.from(excludeIds), 20);
      if (res.songs && res.songs.length > 0) {
        setMadeForYouSongs((prev) => {
          const combined = [...prev, ...res.songs];
          if (combined.length >= 500) {
            setHasMoreMadeForYou(false);
            return combined.slice(0, 500);
          }
          return combined;
        });
        setHasMoreMadeForYou(res.hasMore && madeForYouSongs.length + res.songs.length < 500);
      } else {
        setHasMoreMadeForYou(false);
      }
    } catch (err) {
      console.error("Failed to fetch more recommendations:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [dashboard, madeForYouSongs, loadingMore, hasMoreMadeForYou]);

  // Observer element Ref
  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!observerRef.current || !hasMoreMadeForYou || loadingMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMoreMadeForYou();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(observerRef.current);
    return () => obs.disconnect();
  }, [observerRef.current, hasMoreMadeForYou, loadingMore, fetchMoreMadeForYou]);

  // Localized Greetings
  const firstName = user?.name?.split(" ")[0] || "there";
  const { localGreeting, localSubtitle } = (() => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) {
      return {
        localGreeting: `Good morning, ${firstName}`,
        localSubtitle: "Start your day with great music",
      };
    }
    if (hr >= 12 && hr < 17) {
      return {
        localGreeting: `Good afternoon, ${firstName}`,
        localSubtitle: "Perfect tunes for the afternoon",
      };
    }
    if (hr >= 17 && hr < 21) {
      return {
        localGreeting: `Good evening, ${firstName}`,
        localSubtitle: "Wind down with your favourites",
      };
    }
    return {
      localGreeting: `Good night, ${firstName}`,
      localSubtitle: "Late night vibes, just for you",
    };
  })();

  // Loading Skeletons
  if (loading || authLoading) {
    return (
      <div className="animate-fadeIn space-y-10">
        <div>
          <Skeleton className="h-8 w-64 rounded-lg mb-2" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
        <div>
          <Skeleton className="h-4 w-32 rounded-md mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
        {[1, 2].map((i) => (
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

  const normalizedRecentlyPlayed = normalizeSongs(dashboard?.recentlyPlayed || []);
  const normalizedNewReleases = normalizeSongs(dashboard?.newReleases?.songs || []);
  const normalizedMadeForYou = normalizeSongs(madeForYouSongs);

  return (
    <div className="animate-fadeIn space-y-12">
      {/* Greetings Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          {localGreeting}
        </h1>
        <p className="text-white/30 text-sm mt-1">{localSubtitle}</p>
      </div>

      {/* A. Recently Played */}
      {user && normalizedRecentlyPlayed.length > 0 && (
        <HSection
          title="Recently Played"
          songs={normalizedRecentlyPlayed}
          loading={false}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlay={(song) => handleHomeSongClick(song)}
        />
      )}

      {/* B. New Releases For You */}
      {normalizedNewReleases.length > 0 && (
        <HSection
          title={dashboard?.newReleases?.title || "New Releases For You"}
          songs={normalizedNewReleases}
          loading={false}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlay={(song) => handleHomeSongClick(song)}
        />
      )}

      {/* C. Made For You */}
      {normalizedMadeForYou.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-white leading-tight">
              {dashboard?.madeForYou?.title || "Made For You"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {normalizedMadeForYou.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                isCurrent={currentSong?.id === song.id}
                isPlaying={isPlaying}
                onPlay={() => handleHomeSongClick(song)}
              />
            ))}
          </div>
          {hasMoreMadeForYou && (
            <div ref={observerRef} className="h-20 w-full flex items-center justify-center mt-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sp-green" />
            </div>
          )}
        </div>
      )}

      {/* D. Because You Liked ___ */}
      {user && dashboard?.becauseYouLiked?.map((shelf: any) => {
        const normalizedShelfSongs = normalizeSongs(shelf.songs);
        return (
          <HSection
            key={shelf.seedSongId}
            title={`Because you liked "${shelf.seedSongTitle}"`}
            songs={normalizedShelfSongs}
            loading={false}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlay={(song) => handleHomeSongClick(song)}
          />
        );
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
