import { useState, useCallback, useEffect } from "react";
import * as api from "../api/backend";
import { analytics } from "../services/analytics";


export const useLikedSongs = (
  isAuthenticated = false,
): [Record<string, any>, (song: any) => void, (all: any[]) => void] => {
  const [liked, setLiked] = useState<Record<string, any>>(() => {
    try {
      return JSON.parse(localStorage.getItem("ss_liked") || "{}");
    } catch {
      return {};
    }
  });

  // Sync from cloud once auth is confirmed — cloud is the authoritative source.
  // We replace (not merge) local state so that songs unliked on another device
  // don't persist, and old guest-session songs are cleared on login.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .getLikedSongs()
      .then((cloudLiked: any[]) => {
        if (cancelled) return;
        const cloudMap: Record<string, any> = {};
        for (const s of cloudLiked) {
          const id = s.songId || s.id;
          if (!id) continue;
          cloudMap[id] = {
            id,
            name: s.title || s.name || "",
            image: s.image?.length
              ? s.image
              : s.albumArt
                ? [
                    {
                      quality: "500x500",
                      url:
                        typeof s.albumArt === "string"
                          ? s.albumArt
                          : s.albumArt?.url || "",
                    },
                  ]
                : [],
            artists: s.artists,
            primaryArtists: s.artist || s.primaryArtists || "",
            duration: s.duration || 0,
            downloadUrl: s.downloadUrl || [],
            download_url: s.download_url || [],
            album: s.album || null,
            language: s.language || "",
            playCount: s.playCount || 0,
          };
        }
        localStorage.setItem("ss_liked", JSON.stringify(cloudMap));
        setLiked(cloudMap);
      })
      .catch(() => {}); // If API fails, keep local state as fallback
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]); // refetch when user logs in

  const toggle = useCallback((song: any) => {
    setLiked((prev) => {
      const next = { ...prev };
      if (next[song.id]) {
        delete next[song.id];
        analytics.track("unfavorite_song", { song_id: song.id, song_title: song.name });
      } else {
        next[song.id] = {
          id: song.id,
          name: song.name,
          image: song.image,
          artists: song.artists,
          primaryArtists: song.primaryArtists,
          duration: song.duration,
          downloadUrl: song.downloadUrl || [],
          download_url: song.download_url || [],
          album: song.album || null,
          language: song.language || "",
          playCount: song.playCount || 0,
        };
        analytics.track("favorite_song", {
          song_id: song.id,
          song_title: song.name,
          artist: song.primaryArtists || "",
        });
      }
      localStorage.setItem("ss_liked", JSON.stringify(next));
      return next;
    });
  }, []);

  const setAll = useCallback((songs: any[]) => {
    const next: Record<string, any> = {};
    for (const s of songs) {
      if (s.id) next[s.id] = s;
    }
    setLiked(next);
    localStorage.setItem("ss_liked", JSON.stringify(next));
  }, []);

  return [liked, toggle, setAll];
};

export { useDashboard } from "./useDashboard";


