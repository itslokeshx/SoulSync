import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { HSection } from "../components/cards/HSection";
import { SongCard } from "../components/cards/SongCard";
import { useApp } from "../context/AppContext";
import { useAuth } from "../auth/AuthContext";
import { getDashboard, getGuestDashboard, startRadio } from "../api/backend";
import { Skeleton } from "../components/ui/Skeleton";
import { normalizeSongs } from "../utils/normalizeSong";

const CACHE_TTL = 5 * 60_000; // 5 minutes

export const HomePage = () => {
  const navigate = useNavigate();
  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
  } = useApp();
  const { user, isLoading: authLoading } = useAuth();

  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetched = useRef(false);
  const fetchingRef = useRef(false);
  const lastFetchedAt = useRef(0);
  const REFETCH_COOLDOWN = 2 * 60_000; // 2 minutes

  const userId = user?._id;
  const langsKey = (user?.preferences?.languages || []).sort().join(",");
  const cacheKey = `ss_dashboard_${langsKey || "guest"}`;

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
            setLoading(false);
            return;
          }
        }
      } catch {}

      try {
        const data = userId ? await getDashboard() : await getGuestDashboard();
        setDashboard(data);
        setError(false);
        lastFetchedAt.current = Date.now();
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (err) {
        console.error("Dashboard load error:", err);
        if (userId) {
          try {
            const guestData = await getGuestDashboard();
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
  }, [userId, cacheKey]);

  useEffect(() => {
    fetched.current = false;
  }, [userId, langsKey]);

  useEffect(() => {
    if (authLoading) return;
    if (fetched.current) return;
    fetched.current = true;
    fetchDashboard();
  }, [fetchDashboard, authLoading]);

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
  const handleHomeSongClick = async (song: any, overrideQueue?: any[]) => {
    try {
      const res = await startRadio(song.id);
      if (res.songs && res.songs.length > 0) {
        const normalized = normalizeSongs(res.songs);
        onPlay(normalized[0], normalized);
      } else {
        onPlay(song, overrideQueue || [song]);
      }
    } catch (err) {
      console.error("Failed to start radio:", err);
      onPlay(song, overrideQueue || [song]);
    }
  };

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

  const normalizedRecentlyPlayed = normalizeSongs(dashboard?.recentlyPlayed || []);
  const normalizedNewReleases = normalizeSongs(dashboard?.newReleases?.songs || []);
  const normalizedLikedSongs = normalizeSongs(dashboard?.likedSongs || []);
  const normalizedMadeForYou = normalizeSongs(dashboard?.madeForYou?.songs || []);

  const playlistSongsRaw = (dashboard?.playlists || []).flatMap((p: any) =>
    (p.songs || []).map((s: any) => ({
      id: s.songId,
      name: s.title,
      primaryArtists: s.artist,
      image: s.albumArt,
      duration: s.duration,
      downloadUrl: s.downloadUrl,
    }))
  );
  const normalizedPlaylistSongs = normalizeSongs(playlistSongsRaw);

  // Combine and deduplicate songs (avoid showing recently played or new releases in suggestions)
  const seenIds = new Set<string>();
  normalizedRecentlyPlayed.forEach((s) => seenIds.add(s.id));
  normalizedNewReleases.forEach((s) => seenIds.add(s.id));

  const combinedSuggestions: any[] = [];

  // 1. Add Liked Songs
  for (const s of normalizedLikedSongs) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      combinedSuggestions.push(s);
    }
  }

  // 2. Add Playlist Songs
  for (const s of normalizedPlaylistSongs) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      combinedSuggestions.push(s);
    }
  }

  // 3. Add Made For You Auto Suggestions
  for (const s of normalizedMadeForYou) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      combinedSuggestions.push(s);
    }
  }

  const suggestionsSongs = combinedSuggestions.slice(0, 30);
  const row1 = suggestionsSongs.slice(0, 10);
  const row2 = suggestionsSongs.slice(10, 20);
  const row3 = suggestionsSongs.slice(20, 30);

  return (
    <div className="animate-fadeIn space-y-12">
      {/* Greetings Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          {localGreeting}
        </h1>
        <p className="text-white/30 text-sm mt-1">{localSubtitle}</p>
      </div>

      {/* A. Recently Played (First) */}
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

      {/* B. New Releases (Second - generic industry releases, not personalized) */}
      {normalizedNewReleases.length > 0 && (
        <HSection
          title={dashboard?.newReleases?.title || "New Releases"}
          songs={normalizedNewReleases}
          loading={false}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlay={(song) => handleHomeSongClick(song)}
        />
      )}

      {/* C. Suggestions / Made For You (3 Rows, Combined) */}
      {suggestionsSongs.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-bold text-white leading-tight">
              Made For You
            </h2>
          </div>
          <p className="text-white/30 text-xs mb-5">
            Your liked tracks, playlists, and personalized recommendations
          </p>
          <div className="space-y-4">
            {row1.length > 0 && (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
                {row1.map((s) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    isCurrent={currentSong?.id === s.id}
                    isPlaying={isPlaying}
                    onPlay={() => handleHomeSongClick(s, suggestionsSongs)}
                  />
                ))}
              </div>
            )}
            {row2.length > 0 && (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
                {row2.map((s) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    isCurrent={currentSong?.id === s.id}
                    isPlaying={isPlaying}
                    onPlay={() => handleHomeSongClick(s, suggestionsSongs)}
                  />
                ))}
              </div>
            )}
            {row3.length > 0 && (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
                {row3.map((s) => (
                  <SongCard
                    key={s.id}
                    song={s}
                    isCurrent={currentSong?.id === s.id}
                    isPlaying={isPlaying}
                    onPlay={() => handleHomeSongClick(s, suggestionsSongs)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
