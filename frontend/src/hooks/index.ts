import { useState, useCallback, useEffect } from "react";
import type { Toast } from "../components/ui/Toasts";
import * as api from "../api/backend";

let _tid = 0;

export const useToasts = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback(
    (message: string, type: Toast["type"] = "info", ms = 3000) => {
      const id = ++_tid;
      setToasts((p) => [...p, { id, message, type }]);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), ms);
    },
    [],
  );

  const dismiss = useCallback((id: number) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  return { toasts, add, dismiss };
};

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

  // Sync from cloud once auth is confirmed (avoids race with loadNativeToken)
  useEffect(() => {
    if (!isAuthenticated) return; // wait until token is ready
    let cancelled = false;
    api
      .getLikedSongs()
      .then((cloudLiked: any[]) => {
        if (cancelled || !cloudLiked?.length) return;
        setLiked((prev) => {
          const merged = { ...prev };
          for (const s of cloudLiked) {
            const id = s.songId || s.id;
            if (!id) continue;
            if (!merged[id]) {
              merged[id] = {
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
          }
          localStorage.setItem("ss_liked", JSON.stringify(merged));
          return merged;
        });
      })
      .catch(() => {}); // silently fail if not logged in
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]); // refetch when user logs in

  const toggle = useCallback((song: any) => {
    setLiked((prev) => {
      const next = { ...prev };
      if (next[song.id]) {
        delete next[song.id];
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

export const useRecentlyPlayed = (): [any[], (song: any) => void] => {
  const [recent, setRecent] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ss_recent") || "[]");
    } catch {
      return [];
    }
  });

  const add = useCallback((song: any) => {
    setRecent((prev) => {
      const next = [song, ...prev.filter((s) => s.id !== song.id)].slice(0, 20);
      localStorage.setItem("ss_recent", JSON.stringify(next));
      return next;
    });
  }, []);

  return [recent, add];
};
