import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMixes } from "./useMixes";
import { getDashboard, getGuestDashboard, startRadio } from "../api/backend";
import { normalizeSongs } from "../utils/normalizeSong";
import { getRecentlyPlayedFromStorage } from "../utils/recentHistory";
import { filterByPreferredLanguages } from "../utils/languageFilter";

const CACHE_TTL = 30_000; // 30 seconds
const REFETCH_COOLDOWN = 15_000; // 15 seconds

export function useDashboard(onPlay: (song: any, queue?: any[]) => void) {
  const { user, isLoading: authLoading } = useAuth();
  const { data: mixSet, isLoading: mixesLoading } = useMixes();

  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [localRecents, setLocalRecents] = useState<any[]>(() =>
    getRecentlyPlayedFromStorage()
  );

  const fetched = useRef(false);
  const fetchingRef = useRef(false);
  const lastFetchedAt = useRef(0);

  const userId = user?._id;
  const langsKey = (user?.preferences?.languages || []).sort().join(",");
  const cacheKey = `ss_dashboard_${userId || "guest"}_${langsKey || "default"}`;

  const fetchDashboard = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      // Check session cache for guest users only (auth users get fresh recs on every refresh)
      try {
        if (!userId) {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.generatedAt < CACHE_TTL) {
              setDashboard(parsed);
              setLoading(false);
              return;
            }
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
    const handleRecentsUpdated = () => {
      setLocalRecents(getRecentlyPlayedFromStorage());
      try { sessionStorage.clear(); } catch {}
      if (userId) {
        fetched.current = false;
        fetchDashboard();
      }
    };
    window.addEventListener("soulsync:recently_played_updated", handleRecentsUpdated);
    window.addEventListener("soulsync:taste_updated", handleRecentsUpdated);
    return () => {
      window.removeEventListener("soulsync:recently_played_updated", handleRecentsUpdated);
      window.removeEventListener("soulsync:taste_updated", handleRecentsUpdated);
    };
  }, [userId, fetchDashboard]);

  useEffect(() => {
    fetched.current = false;
  }, [userId, langsKey]);

  useEffect(() => {
    // If a web token is stored, wait for auth check to finish to avoid double fetches.
    // If no token exists, we fetch the guest dashboard immediately.
    const hasWebToken = typeof window !== "undefined" && !!localStorage.getItem("auth_token_web");
    if (authLoading && hasWebToken) return;

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
  }, [cacheKey, fetchDashboard]);

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
  const handleHomeSongClick = useCallback(async (song: any, overrideQueue?: any[]) => {
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
  }, [onPlay]);

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

  // Data processing / transformations — 100% DB/Cloud driven for authenticated users
  const rawRecentlyPlayed = user
    ? (dashboard?.recentlyPlayed || [])
    : localRecents;
  const normalizedRecentlyPlayed = normalizeSongs(rawRecentlyPlayed);
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

  // Name-based deduplication helper
  const cleanNameForDedup = (name: string) =>
    (name || "").toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\s*-\s*(from|feat|ft).*$/i, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  // Gather Saved Songs (Recently Played + Liked + Custom Playlists) — deduplicated by name
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

  for (const s of normalizedRecentlyPlayed) addSaved(s);
  for (const s of normalizedLikedSongs) addSaved(s);
  for (const s of normalizedPlaylistSongs) addSaved(s);

  // Gather Recommended Songs — deduplicated by name AND against saved
  const recommendedSongs: any[] = [];
  const recSeenIds = new Set<string>();

  for (const s of normalizedMadeForYou) {
    if (baseExcludeIds.has(s.id) || savedSeenIds.has(s.id) || recSeenIds.has(s.id)) continue;
    const cleanName = cleanNameForDedup(s.name);
    if (cleanName && savedSeenNames.has(cleanName)) continue;
    recSeenIds.add(s.id);
    if (cleanName) savedSeenNames.add(cleanName);
    recommendedSongs.push(s);
  }

  const row1 = recommendedSongs.slice(0, 10);
  const row2 = recommendedSongs.slice(10, 20);
  const row3 = recommendedSongs.slice(20, 30);

  const extraSaved = [...savedSongs];
  while (row1.length < 10 && extraSaved.length > 0) {
    row1.push(extraSaved.shift()!);
  }
  while (row2.length < 10 && extraSaved.length > 0) {
    row2.push(extraSaved.shift()!);
  }
  while (row3.length < 10 && extraSaved.length > 0) {
    row3.push(extraSaved.shift()!);
  }

  const suggestionsSongs = [...row1, ...row2, ...row3];

  // Compile list of songs for mobile 3x3 grids (Recently Played + Liked + Playlists + Made For You) to fill exactly 18 slots (2 pages)
  const allHomeSongs: any[] = [];
  const homeSeenIds = new Set<string>();
  const homeSeenNames = new Set<string>();

  const addHomeSong = (s: any) => {
    if (homeSeenIds.has(s.id)) return;
    const cleanName = cleanNameForDedup(s.name);
    if (cleanName && homeSeenNames.has(cleanName)) return;
    homeSeenIds.add(s.id);
    if (cleanName) homeSeenNames.add(cleanName);
    allHomeSongs.push(s);
  };

  for (const s of normalizedRecentlyPlayed) addHomeSong(s);
  for (const s of normalizedLikedSongs) addHomeSong(s);
  for (const s of normalizedPlaylistSongs) addHomeSong(s);
  for (const s of normalizedMadeForYou) addHomeSong(s);
  for (const s of suggestionsSongs) addHomeSong(s);

  const mobileGridSongs = allHomeSongs.slice(0, 18);

  const mobileSavedPages: any[][] = [];
  for (let i = 0; i < mobileGridSongs.length; i += 9) {
    mobileSavedPages.push(mobileGridSongs.slice(i, i + 9));
  }

  // Made For You: Recommended songs dynamically generated from Liked Songs, Playlist Songs, Listening History, and Recs
  const madeForYouSongs = (() => {
    const list: any[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    const cleanName = (name: string) =>
      (name || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "").trim();

    const userLangs = user?.preferences?.languages || [];

    const addSong = (s: any) => {
      if (!s || !s.id || seenIds.has(s.id)) return;
      const cn = cleanName(s.name);
      if (cn && seenNames.has(cn)) return;

      // Check language inline so filtering never reduces the total count below 24
      if (userLangs.length > 0) {
        const filtered = filterByPreferredLanguages([s], userLangs);
        if (filtered.length === 0) return;
      }

      seenIds.add(s.id);
      if (cn) seenNames.add(cn);
      list.push(s);
    };

    // 1. Backend personalized recommendation engine outputs (pure, filtered high-affinity recs)
    for (const s of normalizedMadeForYou) {
      addSong(s);
      if (list.length >= 24) break;
    }

    // 2. Backfill with user's explicitly liked songs if needed to complete 3 full 8-song rows (24 songs)
    if (list.length < 24) {
      for (const s of normalizedLikedSongs) {
        addSong(s);
        if (list.length >= 24) break;
      }
    }

    // 3. Backfill with user's recently played history if still needed for 24 songs
    if (list.length < 24) {
      for (const s of normalizedRecentlyPlayed) {
        addSong(s);
        if (list.length >= 24) break;
      }
    }

    // 4. Backfill with playlist songs if still needed for 24 songs
    if (list.length < 24) {
      for (const s of normalizedPlaylistSongs) {
        addSong(s);
        if (list.length >= 24) break;
      }
    }

    // 5. Backfill with suggestions if still needed for 24 songs
    if (list.length < 24) {
      for (const s of suggestionsSongs) {
        addSong(s);
        if (list.length >= 24) break;
      }
    }

    return list.slice(0, 24);
  })();

  return {
    loading,
    authLoading,
    mixesLoading,
    error,
    dashboard,
    row1,
    row2,
    row3,
    suggestionsSongs,
    mobileGridSongs,
    mobileSavedPages,
    normalizedRecentlyPlayed,
    normalizedLikedSongs,
    normalizedPlaylistSongs,
    normalizedMadeForYou,
    madeForYouSongs,
    guestNewReleases,
    normalizedNewReleases,
    podcasts: dashboard?.podcasts || [],
    localGreeting,
    localSubtitle,
    handleHomeSongClick,
    mixSet,
    user,
    refetch: fetchDashboard,
  };
}
