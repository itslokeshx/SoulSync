import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Pause } from "lucide-react";
import { HSection } from "../components/cards/HSection";
import { SongCard } from "../components/cards/SongCard";
import { useApp } from "../context/AppContext";
import { useAuth } from "../auth/AuthContext";
import { getDashboard, getGuestDashboard, startRadio } from "../api/backend";
import { Skeleton } from "../components/ui/Skeleton";
import { normalizeSongs } from "../utils/normalizeSong";
import { bestImg, getArtists } from "../lib/helpers";

const CACHE_TTL = import.meta.env.DEV ? 0 : 5 * 60_000; // 5 minutes (disabled in dev)

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
  const cacheKey = `ss_dashboard_${userId || "guest"}_${langsKey || "default"}`;

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
  const guestNewReleases = (dashboard?.guestNewReleases || []).map((section: any) => ({
    title: section.title,
    songs: normalizeSongs(section.songs || []),
  }));

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

  // Exclude new releases from Made For You (recently played are kept — they're the user's favorites)
  const baseExcludeIds = new Set<string>();
  normalizedNewReleases.forEach((s) => baseExcludeIds.add(s.id));

  // ── Aggressive name-based deduplication helper ──
  const cleanNameForDedup = (name: string) =>
    (name || "").toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\s*-\s*(from|feat|ft).*$/i, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  // 1. Gather Saved Songs (Recently Played + Liked + Custom Playlists) — deduplicated by name
  const savedSongs: any[] = [];
  const savedSeenIds = new Set<string>();
  const savedSeenNames = new Set<string>();

  const addSaved = (s: any) => {
    if (baseExcludeIds.has(s.id) || savedSeenIds.has(s.id)) return;
    const cleanName = cleanNameForDedup(s.name);
    if (cleanName && savedSeenNames.has(cleanName)) return;
    savedSeenIds.add(s.id);
    if (cleanName) savedSeenNames.add(cleanName);
    savedSongs.push(s);
  };

  // Add recently played first (user's top songs)
  for (const s of normalizedRecentlyPlayed) addSaved(s);
  // Then liked songs
  for (const s of normalizedLikedSongs) addSaved(s);
  // Then playlist songs
  for (const s of normalizedPlaylistSongs) addSaved(s);

  // 2. Gather Recommended Songs — deduplicated by name AND against saved
  const recommendedSongs: any[] = [];
  const recSeenIds = new Set<string>();

  for (const s of normalizedMadeForYou) {
    if (baseExcludeIds.has(s.id) || savedSeenIds.has(s.id) || recSeenIds.has(s.id)) continue;
    const cleanName = cleanNameForDedup(s.name);
    if (cleanName && savedSeenNames.has(cleanName)) continue;
    recSeenIds.add(s.id);
    if (cleanName) savedSeenNames.add(cleanName); // prevent future dupes too
    recommendedSongs.push(s);
  }

  // 3. Select 70% (21 songs) from saved, 30% (9 songs) from recommended
  const maxSavedCount = 21;
  const maxRecCount = 9;

  const selectedSaved = savedSongs.slice(0, maxSavedCount);
  const selectedRec = recommendedSongs.slice(0, maxRecCount);

  // 4. Layout: Top row = saved (top songs), Middle row = recommendations, Bottom row = more saved
  //    This puts user's favorites at the top and discovery in the middle
  const topSaved = selectedSaved.slice(0, 10);    // Row 1: user's top saved songs
  const middleRec = selectedRec.slice(0, 10);      // Row 2: recommendations
  const bottomSaved = selectedSaved.slice(10, 21); // Row 3: more saved songs

  // Fill gaps if any row is short
  const extraSaved = savedSongs.slice(maxSavedCount);
  const extraRec = recommendedSongs.slice(maxRecCount);

  // If middle row (recs) is short, fill from extra saved
  while (middleRec.length < 10 && extraSaved.length > 0) {
    middleRec.push(extraSaved.shift()!);
  }
  // If bottom row is short, fill from extra recs
  while (bottomSaved.length < 10 && extraRec.length > 0) {
    bottomSaved.push(extraRec.shift()!);
  }

  const suggestionsSongs = [...topSaved, ...middleRec, ...bottomSaved];

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
        <>
          {/* Desktop Version */}
          <div className="hidden md:block">
            <HSection
              title="Recently Played"
              songs={normalizedRecentlyPlayed}
              loading={false}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={(song) => handleHomeSongClick(song)}
            />
          </div>

          {/* Mobile 3x3 Grid Version */}
          <div className="block md:hidden mb-12">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-lg w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04]">
                  🕒
                </span>
                <h2 className="text-lg font-bold text-white leading-tight">
                  Recently Played
                </h2>
              </div>
            </div>
            
            {/* 3x3 Grid of square cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {normalizedRecentlyPlayed.slice(0, 9).map((song) => {
                const isCurrent = currentSong?.id === song.id;
                const img = bestImg(song.image) || "";
                return (
                  <div
                    key={song.id}
                    onClick={() => handleHomeSongClick(song, normalizedRecentlyPlayed)}
                    className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group border active:scale-95 transition-all duration-200 ${
                      isCurrent
                        ? "border-sp-green ring-1 ring-sp-green/30"
                        : "border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    {/* Background Album Art */}
                    <img
                      src={img}
                      alt={song.name}
                      className={`w-full h-full object-cover transition-transform duration-500 ${
                        isCurrent && isPlaying ? "scale-105" : "group-hover:scale-105"
                      }`}
                    />
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent flex flex-col justify-end p-2">
                      
                      {/* Active Playing Equalizer or Icon overlay */}
                      {isCurrent && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1 border border-sp-green/20">
                          {isPlaying ? (
                            <div className="flex gap-[2px] items-end h-2.5 px-0.5">
                              <div className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-2.5" />
                              <div className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-1.5" style={{ animationDelay: "150ms" }} />
                              <div className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-2.5" style={{ animationDelay: "300ms" }} />
                            </div>
                          ) : (
                            <Pause size={8} className="text-sp-green fill-sp-green" />
                          )}
                        </div>
                      )}

                      {/* Song Title and Artist inside the card */}
                      <div className="w-full text-center">
                        <p className={`text-[10px] font-bold truncate tracking-tight leading-snug ${
                          isCurrent ? "text-sp-green" : "text-white"
                        }`}>
                          {song.name}
                        </p>
                        <p className="text-[8px] text-white/50 truncate tracking-tight mt-0.5">
                          {getArtists(song)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* B. New Releases (Second - generic industry releases, not personalized) */}
      {!user && guestNewReleases.length > 0 ? (
        guestNewReleases.map((section: any) => (
          <HSection
            key={section.title}
            title={section.title}
            songs={section.songs}
            loading={false}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlay={(song) => handleHomeSongClick(song, section.songs)}
          />
        ))
      ) : (
        normalizedNewReleases.length > 0 && (
          <HSection
            title={dashboard?.newReleases?.title || "New Releases"}
            songs={normalizedNewReleases}
            loading={false}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlay={(song) => handleHomeSongClick(song)}
          />
        )
      )}

      {/* C. Suggestions / Made For You (3 Rows, Combined) */}
      {user && suggestionsSongs.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold text-white leading-tight">
              Made For You
            </h2>
          </div>
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
