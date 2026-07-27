import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { usePlayerStore } from "../store/playerStore";
import { useQueueStore } from "../store/queueStore";
import { logHistory, getAutoplaySongs } from "../api/backend";
import { bestImg, getArtists } from "../lib/helpers";
import { normalizeSongs } from "../utils/normalizeSong";
import {
  registerMediaControls,
  updateMediaMetadata,
  clearMediaMetadata,
  updatePositionState,
} from "../capacitor/musicControls";
import { getBestAudioUrl, getBestImageUrl } from "../utils/getBestAudioUrl";
import {
  initBackgroundAudio,
  registerPlayerGetters,
} from "../capacitor/lifecycle";
import { Capacitor } from "@capacitor/core";
import { isNative } from "../utils/platform";
import { analytics } from "../services/analytics";
import { useDuo } from "../duo/useDuo";
import { useDuoStore } from "../duo/duoStore";
import { getOfflineBlob } from "../utils/offlineDB";
import toast from "react-hot-toast";

interface PlayerContextType {
  audioRef: React.RefObject<HTMLAudioElement>;
  handleSeek: (time: number) => void;
  duo: {
    createSession: (name: string) => Promise<string | null>;
    joinSession: (code: string, name: string) => Promise<boolean>;
    endSession: () => void;
    sendMessage: (text: string) => void;
  };
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    repeatMode,
    autoplay,
    currentTime,
    duration,
    setCurrentTime,
    setDuration,
    togglePlay,
    playSong,
    pause,
    resume,
    seekTo,
    setIsPlaying,
    sleepTimerActive,
    sleepTimerSecondsLeft,
    sleepTimerEndOnTrack,
    setSleepTimer,
  } = usePlayerStore();

  const { next, prev, queue, queueIndex, addLast } = useQueueStore();

  // ── Refs & Synchronization Flags ──────────────────────────────────
  const isRemoteActionRef = useRef(false);
  // Tracks src transitions — browser fires spurious 'pause' events when src changes.
  // We must ignore those to avoid consuming isRemoteActionRef and falsely setting isPlaying=false.
  const srcJustChangedRef = useRef(false);
  // Safety timer: clear srcJustChangedRef after a timeout so pause isn't blocked forever
  const srcChangedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate flag for remote song changes so the song-sync effect doesn't echo them back.
  const isRemoteSongChangeRef = useRef(false);

  // Stable actions for useDuo to call
  const playSongRef = useRef<
    ((song: any, queue: any[], fromDuo?: boolean) => void) | null
  >(null);
  useEffect(() => {
    playSongRef.current = (song) => {
      playSong(song);
    };
  }, [playSong]);

  const currentSongRef = useRef(currentSong);
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const addToast = useCallback((msg: string, type: string = "info") => {
    if (type === "success") toast.success(msg);
    else if (type === "error") toast.error(msg);
    else toast(msg);
  }, []);

  const duo = useDuo({
    playSongRef,
    audioRef: audioRef as React.RefObject<HTMLAudioElement>,
    currentSongRef,
    queueRef,
    setIsPlaying,
    setCurrentTime,
    addToast,
    isRemoteActionRef,
    isPlayingRef,
    isRemoteSongChangeRef,
  });

  // ── Flag: has the very first audio source been loaded yet? ────────
  // This prevents syncing the initial empty/null state to partner.
  const hasEverLoadedRef = useRef(false);

  // ── Log play history + bust dashboard cache on every new song ────────
  const loggedSongRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSong) return;
    if (loggedSongRef.current === currentSong.id) return; // already logged this song
    if (currentSong._isOffline || currentSong.id?.startsWith("local_")) return;
    loggedSongRef.current = currentSong.id;

    // Log to backend — invalidates Redis dashboard cache server-side
    logHistory({
      songId: currentSong.id,
      title: currentSong.name || "",
      artist: getArtists(currentSong),
      artistId: (currentSong.artists as any)?.primary?.[0]?.id || currentSong.artist_map?.primary_artists?.[0]?.id || "",
      albumArt: bestImg(currentSong.image) || "",
      duration: Number(currentSong.duration) || 0,
      source: "player",
      language: currentSong.language || "",
    }).catch(() => {});

    // Bust frontend sessionStorage dashboard cache so HomePage re-fetches
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("ss_dashboard")) sessionStorage.removeItem(key);
      }
    } catch {}
  }, [currentSong?.id]);

  // ── Seek handler: updates BOTH audio element AND state ──────────────
  const handleSeek = useCallback(
    (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
      seekTo(time);
      duo.syncSeek(time);
    },
    [seekTo, duo],
  );

  // ── consolidated Audio & Source Control ─────────────────────────
  // Fixes the "image only changed" race condition by ensuring play()
  // is only called after src is set and ready.
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;

    let isCancelled = false;

    const resolveAndHandle = async () => {
      let targetSrc = "";
      if (currentSong._isOffline || currentSong.id?.startsWith("local_")) {
        // For downloaded/local songs, try to load the blob from IndexedDB first
        const blob = await getOfflineBlob(currentSong.id);
        if (blob) {
          targetSrc = URL.createObjectURL(blob);
        } else {
          // Fallback to the known URL if fetching the blob failed
          const rawUrl = currentSong.downloadUrl?.[0]?.url || "";
          if (rawUrl && (rawUrl.startsWith("file://") || rawUrl.startsWith("content://") || rawUrl.startsWith("/"))) {
            targetSrc = Capacitor.convertFileSrc(rawUrl);
          } else {
            targetSrc = rawUrl;
          }
        }
      } else {
        const audioSourceSetting = localStorage.getItem("ss_audio_source") || "default";
        if (audioSourceSetting === "lossless" && currentSong.name) {
          try {
            const BACKEND = (import.meta.env.VITE_BACKEND_URL || "http://localhost:4000").replace(/\/$/, "");
            const title = currentSong.name || "";
            const artist = getArtists(currentSong);
            const resp = await fetch(`${BACKEND}/api/lossless/stream?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`, { credentials: "include" });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.streamUrl) {
                targetSrc = data.streamUrl;
              }
            }
          } catch (e) {}
        }

        if (!targetSrc) {
          const url = getBestAudioUrl(currentSong.downloadUrl);
          targetSrc = url || "";
        }

        // Fallback: if no URL available (expired or missing), re-fetch from API
        if (
          !targetSrc &&
          currentSong.id &&
          !currentSong.id.startsWith("local_")
        ) {
          try {
            const BACKEND = (
              import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"
            ).replace(/\/$/, "");
            const resp = await fetch(
              `${BACKEND}/api/search/stream-url?id=${currentSong.id}`,
              {
                credentials: "include",
              },
            );
            if (resp.ok) {
              const data = await resp.json();
              if (data.streamUrl) {
                targetSrc = data.streamUrl.replace(/&amp;/g, "&");
              }
              // Update the store with fresh downloadUrl for future plays
              if (data.downloadUrl?.length) {
                // Do not return here, let it fall through to actually play targetSrc!
                // The effect won't re-fire because currentSong.id hasn't changed.
                playSong({ ...currentSong, downloadUrl: data.downloadUrl });
              }
            }
          } catch (e) {
            console.warn("[Player] Stream URL re-fetch failed:", e);
          }
        }
      }

      if (isCancelled) return;

      // Safety net: decode any remaining HTML entities
      if (targetSrc && targetSrc.includes("&amp;")) {
        targetSrc = targetSrc.replace(/&amp;/g, "&");
      }

      // Only update src if it's actually different (avoid unnecessary reloads)
      if (audioRef.current!.src !== targetSrc) {
        // Mark that we're swapping src — the browser will fire a spurious
        // 'pause' event that must NOT update isPlaying or consume isRemoteActionRef.
        srcJustChangedRef.current = true;
        // Safety net: clear the flag after 3s in case loadedmetadata never fires
        if (srcChangedTimerRef.current)
          clearTimeout(srcChangedTimerRef.current);
        srcChangedTimerRef.current = setTimeout(() => {
          srcJustChangedRef.current = false;
          srcChangedTimerRef.current = null;
        }, 3000);

        // IMPORTANT: Must set crossOrigin BEFORE setting src, otherwise the browser will abort playback.
        if (
          targetSrc.startsWith("blob:") ||
          targetSrc.startsWith("file:") ||
          targetSrc.startsWith("ms-appdata:") ||
          targetSrc.includes("_capacitor_file_")
        ) {
          audioRef.current!.removeAttribute("crossOrigin");
        } else {
          audioRef.current!.crossOrigin = "anonymous";
        }
        audioRef.current!.src = targetSrc;
      } else {
        // Src didn't change — any pause() below is intentional, not spurious.
        // Clear the flag so onPause can properly sync the pause event.
        srcJustChangedRef.current = false;
        if (srcChangedTimerRef.current) {
          clearTimeout(srcChangedTimerRef.current);
          srcChangedTimerRef.current = null;
        }
      }

      // Check fresh store state to avoid closure staleness on rapid clicks
      const currentState = usePlayerStore.getState();
      if (
        currentState.isPlaying &&
        currentState.currentSong?.id === currentSong.id
      ) {
        // We use catch() to handle "interrupted by new request" errors gracefully
        audioRef.current!.play().catch(() => {});
      } else {
        audioRef.current!.pause();
      }

      hasEverLoadedRef.current = true;
    };

    resolveAndHandle();

    return () => {
      isCancelled = true;
    };
  }, [currentSong?.id, isPlaying]);

  // ── Consolidated SoulLink Sync ────────────────────────────────────
  // Prevents infinite loops by checking isRemoteActionRef.

  // 1. DEDUPLICATED: Sync Play/Pause state is now handled natively via the <audio> element's onPlay/onPause events (bottom of file)
  // to avoid React state race conditions.

  // 2. Sync Song/Queue changes — only for locally-initiated changes
  useEffect(() => {
    const isDuoActive = useDuoStore.getState().active;
    if (!isDuoActive) return;

    // If this song change was triggered by the partner (remote), skip the echo.
    if (isRemoteSongChangeRef.current) {
      isRemoteSongChangeRef.current = false;
      return;
    }

    if (currentSong) {
      const q = queue.length ? queue : [currentSong];
      const idx = Math.max(
        q.findIndex((s) => s.id === currentSong.id),
        0,
      );
      duo.syncSongChange(currentSong, q, idx);
    }
  }, [currentSong?.id, queue, duo]);

  // ── Volume & Media Controls ──────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    registerMediaControls({
      onPlay: resume,
      onPause: pause,
      onNext: () => {
        const n = next(repeatMode);
        if (n) {
          analytics.track("song_skip", { direction: "next", from_song_id: currentSong?.id, to_song_id: n.id });
          playSong(n);
        }
      },
      onPrev: () => {
        const p = prev();
        if (p) {
          analytics.track("song_skip", { direction: "prev", from_song_id: currentSong?.id, to_song_id: p.id });
          playSong(p);
        }
      },
      onSeek: (v) => {
        if (audioRef.current) audioRef.current.currentTime = v;
        seekTo(v);
      },
    });
  }, [resume, pause, next, prev, repeatMode, playSong, seekTo, currentSong?.id]);

  useEffect(() => {
    if (currentSong) {
      updateMediaMetadata(currentSong, isPlaying);
      updatePositionState(currentTime, duration);
    } else {
      clearMediaMetadata();
    }
  }, [currentSong?.id, isPlaying, currentTime, duration]);

  useEffect(() => {
    if (!isNative()) return;
    registerPlayerGetters(
      () => usePlayerStore.getState().currentSong,
      () => usePlayerStore.getState().isPlaying,
    );
    initBackgroundAudio();
  }, []);

  // Pre-fetch autoplay suggestions when approaching the end of the queue (remaining <= 4)
  const lastAutoplayFetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoplay || !currentSong) return;
    if (currentSong._isOffline || currentSong.id?.startsWith("local_")) return;

    const remaining = queue.length - queueIndex - 1;
    if (remaining <= 4 && queue.length > 0) {
      const targetAnchorSong = queue[queue.length - 1] || currentSong;
      if (!targetAnchorSong || targetAnchorSong._isOffline || targetAnchorSong.id?.startsWith("local_")) return;

      const fetchKey = `${targetAnchorSong.id}_${queue.length}`;
      if (lastAutoplayFetchedRef.current === fetchKey) return;
      lastAutoplayFetchedRef.current = fetchKey;

      const queueIds = queue.map((s: any) => s.id).filter(Boolean);

      const fetchWithRetry = (retriesLeft = 1) => {
        getAutoplaySongs(targetAnchorSong.id, "similar", queueIds)
          .then((data) => {
            const songs: any[] = data?.songs ?? [];
            if (!songs.length) {
              lastAutoplayFetchedRef.current = null;
              return;
            }
            const normalized = normalizeSongs(songs);
            const existingIds = new Set(useQueueStore.getState().queue.map((s: any) => s.id));
            const newSongs = normalized.filter((s: any) => s.id && !existingIds.has(s.id));
            newSongs.forEach((s: any) => addLast(s));
          })
          .catch((err) => {
            lastAutoplayFetchedRef.current = null;
            if (retriesLeft > 0) {
              console.warn("[Player] Autoplay pre-fetch failed, retrying in 2s...", err);
              setTimeout(() => fetchWithRetry(retriesLeft - 1), 2000);
            } else {
              console.warn("[Player] Autoplay pre-fetch failed after retry:", err);
            }
          });
      };

      fetchWithRetry();
    }
  }, [autoplay, currentSong?.id, queue, queueIndex, addLast]);

  // ── Sleep Timer Countdown Logic ────────────────────────────────────
  useEffect(() => {
    if (!sleepTimerActive || sleepTimerEndOnTrack || sleepTimerSecondsLeft === null) {
      return;
    }

    const timer = setInterval(() => {
      const {
        sleepTimerActive: active,
        sleepTimerSecondsLeft: seconds,
        sleepTimerEndOnTrack: endOnTrack,
        setSleepTimer: updateTimer,
        pause: pausePlayer,
      } = usePlayerStore.getState();

      if (!active || endOnTrack || seconds === null) return;

      if (seconds <= 1) {
        pausePlayer();
        updateTimer(null);
        toast("Sleep timer finished — playback stopped 🌙");
      } else {
        updateTimer(seconds - 1, false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [sleepTimerActive, sleepTimerEndOnTrack, sleepTimerSecondsLeft === null]);

  // ── Audio Element Handlers ──────────────────────────────────────
  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    // New src is now loaded — any future pause events are real user actions.
    srcJustChangedRef.current = false;
    if (srcChangedTimerRef.current) {
      clearTimeout(srcChangedTimerRef.current);
      srcChangedTimerRef.current = null;
    }
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (dur && isFinite(dur)) setDuration(dur);
    }
  };

  const handleEnded = () => {
    if (currentSong) {
      analytics.track("song_complete", {
        song_id: currentSong.id,
        song_title: currentSong.name,
        artist: getArtists(currentSong),
      });
    }

    const {
      sleepTimerActive: timerActive,
      sleepTimerEndOnTrack: endTrack,
      setSleepTimer: updateTimer,
    } = usePlayerStore.getState();

    if (timerActive && endTrack) {
      pause();
      updateTimer(null);
      toast("Sleep timer finished — playback stopped 🌙");
      return;
    }

    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      const n = next(repeatMode);
      if (n) {
        playSong(n);
      } else {
        // Queue exhausted — fetch autoplay suggestions if enabled
        const { autoplay: ap, currentSong: song } = usePlayerStore.getState();
        if (ap && song && !song._isOffline && !song.id?.startsWith("local_")) {
          toast("Finding similar songs...");
          const fetchWithRetry = (retriesLeft = 1) => {
            getAutoplaySongs(song.id)
              .then((data) => {
                const songs: any[] = data?.songs ?? [];
                if (!songs.length) { pause(); return; }
                songs.forEach((s) => addLast(s));
                // Advance past the now-extended queue
                const nextSong = useQueueStore.getState().next(repeatMode);
                if (nextSong) playSong(nextSong);
                else pause();
              })
              .catch((err) => {
                if (retriesLeft > 0) {
                  console.warn("[Player] Queue exhausted autoplay fetch failed, retrying in 2.5s...", err);
                  setTimeout(() => fetchWithRetry(retriesLeft - 1), 2500);
                } else {
                  console.error("[Player] Queue exhausted autoplay fetch failed after retry:", err);
                  toast.error("Couldn't load more songs — check your connection");
                  pause();
                }
              });
          };

          fetchWithRetry();
        } else {
          pause();
        }
      }
    }
  };

  // ── FIX: prevent random pauses from buffering/browser events ──────
  const handlePause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (srcJustChangedRef.current) return;
    if (!audio.seeking && !audio.ended) {
      setIsPlaying(false);
      if (currentSong) {
        analytics.track("song_pause", {
          song_id: currentSong.id,
          song_title: currentSong.name,
          current_time: currentTime,
        });
      }
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    if (currentSong) {
      analytics.track("song_play", {
        song_id: currentSong.id,
        song_title: currentSong.name,
        artist: getArtists(currentSong),
        duration: currentSong.duration,
      });
    }
  };

  const handleError = () => {
    console.error("[AudioEngine] Playback error for:", currentSong?.name);
    analytics.logError(`Playback error for ${currentSong?.name || "Unknown"}`, false, {
      song_id: currentSong?.id,
    });
    setIsPlaying(false);
    // Auto-skip on error after 2s delay
    setTimeout(() => {
      if (repeatMode !== "one") {
        const n = next(repeatMode);
        if (n) playSong(n);
      }
    }, 2000);
  };

  return (
    <PlayerContext.Provider
      value={{
        audioRef: audioRef as React.RefObject<HTMLAudioElement>,
        handleSeek,
        duo: {
          createSession: duo.createSession,
          joinSession: duo.joinSession,
          endSession: duo.endSession,
          sendMessage: duo.sendMessage,
        },
      }}
    >
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={(e) => {
          handlePlay();
          const isDuoActive = useDuoStore.getState().active;
          if (isDuoActive) {
            if (isRemoteActionRef.current) {
              isRemoteActionRef.current = false; // Consume the remote action
            } else {
              duo.syncPlay(e.currentTarget.currentTime, currentSong?.id || "");
            }
          }
        }}
        onPause={(e) => {
          // Skip spurious pause events fired by the browser during src changes
          if (srcJustChangedRef.current) return;
          handlePause();
          const isDuoActive = useDuoStore.getState().active;
          if (isDuoActive) {
            if (isRemoteActionRef.current) {
              isRemoteActionRef.current = false; // Consume the remote action
            } else {
              duo.syncPause(e.currentTarget.currentTime);
            }
          }
        }}
        className="hidden"
        crossOrigin="anonymous"
        preload="auto"
        onError={handleError}
      />
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
};
