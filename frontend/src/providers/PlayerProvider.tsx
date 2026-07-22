// Force HMR refresh
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { usePlayerStore } from "../store/playerStore";
import { useQueueStore } from "../store/queueStore";
import { getAutoplaySongs, smartSearch, api } from "../api/backend";
import { getArtists } from "../lib/helpers";
import {
  registerMediaControls,
  updateMediaMetadata,
  clearMediaMetadata,
  updatePositionState,
} from "../capacitor/musicControls";
import { normalizeSongs } from "../utils/normalizeSong";
import {
  initBackgroundAudio,
  registerPlayerGetters,
} from "../capacitor/lifecycle";
import { isNative } from "../utils/platform";
import { useDuo } from "../duo/useDuo";
import { useDuoStore } from "../duo/duoStore";
import { getOfflineBlob } from "../utils/offlineDB";
import { resolveClientStream } from "../utils/resolveClientStream";

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

const PositionStateUpdater: React.FC = () => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    if (currentSong && isPlaying) {
      updatePositionState(currentTime, duration);
    }
  }, [currentSong?.id, isPlaying, currentTime, duration]);

  return null;
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const autoplay = usePlayerStore((s) => s.autoplay);
  const isPlayerExpanded = usePlayerStore((s) => s.isPlayerExpanded);

  // Stable actions from store state
  const setCurrentTime = usePlayerStore.getState().setCurrentTime;
  const setDuration = usePlayerStore.getState().setDuration;
  const togglePlay = usePlayerStore.getState().togglePlay;
  const playSong = usePlayerStore.getState().playSong;
  const pause = usePlayerStore.getState().pause;
  const resume = usePlayerStore.getState().resume;
  const seekTo = usePlayerStore.getState().seekTo;
  const setIsPlaying = usePlayerStore.getState().setIsPlaying;

  const { next, prev, queue, queueIndex, addLast } = useQueueStore();

  // ── Refs & Synchronization Flags ──────────────────────────────────
  const isAppBackgroundedRef = useRef(false);
  const isRemoteActionRef = useRef(false);
  // Tracks src transitions — browser fires spurious 'pause' events when src changes.
  // We must ignore those to avoid consuming isRemoteActionRef and falsely setting isPlaying=false.
  const srcJustChangedRef = useRef(false);
  // Safety timer: clear srcJustChangedRef after a timeout so pause isn't blocked forever
  const srcChangedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Separate flag for remote song changes so the song-sync effect doesn't echo them back.
  const isRemoteSongChangeRef = useRef(false);

  // ── Safe Foreground Resume Listener ──────────────────────────────
  // The <audio> element is the sole audio source and keeps playing across tab/app
  // switches. This is a safety net: if the OS/WebView suspended it on background,
  // resume it on return when the store believes playback is active.
  useEffect(() => {
    const handleForeground = () => {
      isAppBackgroundedRef.current = false;
      const s = usePlayerStore.getState();
      const audio = audioRef.current;
      if (s.isPlaying && audio && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    const handleVis = () => {
      if (!document.hidden) handleForeground();
    };
    document.addEventListener("visibilitychange", handleVis);

    let appListenerHandle: { remove: () => void } | null = null;
    if (isNative()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appStateChange", ({ isActive }) => {
          isAppBackgroundedRef.current = !isActive;
          if (isActive) handleForeground();
        }).then((h) => {
          appListenerHandle = h;
        });
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVis);
      appListenerHandle?.remove();
    };
  }, []);

  // Stable actions for useDuo to call
  const playSongRef = useRef<
    ((song: any, queue: any[], fromDuo?: boolean) => void) | null
  >(null);
  useEffect(() => {
    playSongRef.current = (song, duoQueue, fromDuo) => {
      if (fromDuo && Array.isArray(duoQueue) && duoQueue.length > 0) {
        const idx = Math.max(
          duoQueue.findIndex((s: any) => s.id === song.id),
          0,
        );
        useQueueStore.getState().setQueue(duoQueue, idx);
      }
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

  const handleSeekRemoteRef = useRef<((time: number) => void) | null>(null);

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
    handleSeekRemoteRef,
  });

  // Centralized play/pause syncing over Duo
  useEffect(() => {
    const isDuoActive = useDuoStore.getState().active;
    if (!isDuoActive || !currentSong) return;

    if (isRemoteActionRef.current) {
      isRemoteActionRef.current = false;
      return;
    }

    const currentSec = usePlayerStore.getState().currentTime;
    if (isPlaying) {
      duo.syncPlay(currentSec, currentSong.id);
    } else {
      duo.syncPause(currentSec);
    }
  }, [isPlaying, currentSong?.id, duo]);

  // ── Flag: has the very first audio source been loaded yet? ────────
  const hasEverLoadedRef = useRef(false);

  // ── Persistent Audio Element Initialization (ONCE on mount) ──────
  // The <audio> element is the sole audio source for every mode
  // (foreground, background, video, offline). YouTube audio is fed by the
  // backend /api/search/stream proxy URL (CORS-clean, range-supported).
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.autoplay = false;
      audioRef.current = audio;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.volume = 1;
        audioRef.current.src = "";
      }
    };
  }, []);

  // ── Seek handler: the <audio> element is the single source of truth ──────────────
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

  useEffect(() => {
    handleSeekRemoteRef.current = (time: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
      seekTo(time);
    };
  }, [seekTo]);

  // ── Consolidated Audio & Source Control ──────
  // 1. Song Source Resolution — runs ONLY when currentSong changes
  const lastLoadedSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    if (lastLoadedSongIdRef.current === currentSong.id) return;
    lastLoadedSongIdRef.current = currentSong.id;

    let isCancelled = false;

    const resolveAndHandle = async () => {
      let targetSrc = "";
      const isYouTube =
        !currentSong._isOffline && !currentSong.id?.startsWith("local_");

      if (isYouTube) {
        targetSrc =
          currentSong.streamUrl ||
          `${api.defaults.baseURL}/api/search/stream?id=${currentSong.id}`;
      } else {
        const blob = await getOfflineBlob(currentSong.id);
        if (blob) {
          targetSrc = URL.createObjectURL(blob);
        } else {
          targetSrc = currentSong.downloadUrl?.[0]?.url || "";
        }
      }

      if (isCancelled) return;

      if (targetSrc) {
        if (targetSrc.includes("&amp;")) {
          targetSrc = targetSrc.replace(/&amp;/g, "&");
        }

        srcJustChangedRef.current = true;
        if (srcChangedTimerRef.current)
          clearTimeout(srcChangedTimerRef.current);
        srcChangedTimerRef.current = setTimeout(() => {
          srcJustChangedRef.current = false;
          srcChangedTimerRef.current = null;
        }, 3000);

        if (
          targetSrc.startsWith("blob:") ||
          targetSrc.startsWith("file:") ||
          targetSrc.startsWith("ms-appdata:") ||
          targetSrc.includes("_capacitor_file_") ||
          targetSrc.startsWith("data:")
        ) {
          audioRef.current!.removeAttribute("crossOrigin");
        } else {
          audioRef.current!.crossOrigin = "anonymous";
        }

        audioRef.current!.src = targetSrc;

        const currentState = usePlayerStore.getState();
        if (currentState.isPlaying) {
          audioRef.current!.play().catch(() => {});
        } else {
          audioRef.current!.pause();
        }
      } else {
        audioRef.current!.pause();
        if (
          audioRef.current!.src !== "" &&
          audioRef.current!.src !== window.location.href
        ) {
          audioRef.current!.src = "";
        }
      }

      hasEverLoadedRef.current = true;
    };

    resolveAndHandle();

    return () => {
      isCancelled = true;
    };
  }, [currentSong?.id]);

  // 2. Play/Pause State Sync — runs when isPlaying changes without re-setting src
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      if (audio.paused && audio.src) {
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, currentSong?.id]);

  // ── Consolidated SoulLink Sync ────────────────────────────────────

  // 1. Sync Song/Queue changes — only for locally-initiated changes
  const lastSyncedSongIdRef = useRef<string | null>(null);
  useEffect(() => {
    const isDuoActive = useDuoStore.getState().active;
    if (!isDuoActive) return;

    if (isRemoteSongChangeRef.current) {
      isRemoteSongChangeRef.current = false;
      lastSyncedSongIdRef.current = currentSong?.id || null;
      return;
    }

    if (currentSong && currentSong.id !== lastSyncedSongIdRef.current) {
      lastSyncedSongIdRef.current = currentSong.id;
      const q = useQueueStore.getState().queue;
      const fullQueue = q.length ? q : [currentSong];
      const idx = Math.max(
        fullQueue.findIndex((s) => s.id === currentSong.id),
        0,
      );
      duo.syncSongChange(currentSong, fullQueue, idx);
    }
  }, [currentSong?.id, duo]);

  // ── Volume ──────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    registerMediaControls({
      onPlay: resume,
      onPause: pause,
      onNext: () => {
        const n = next(repeatMode);
        if (n) playSong(n);
      },
      onPrev: () => {
        const p = prev();
        if (p) playSong(p);
      },
      onSeek: handleSeek,
    });
  }, [resume, pause, next, prev, repeatMode, playSong, handleSeek]);

  useEffect(() => {
    if (currentSong) {
      updateMediaMetadata(currentSong, isPlaying);
    } else {
      clearMediaMetadata();
    }
  }, [currentSong?.id, isPlaying]);

  useEffect(() => {
    if (!isNative()) return;
    registerPlayerGetters(
      () => usePlayerStore.getState().currentSong,
      () => usePlayerStore.getState().isPlaying,
    );
    initBackgroundAudio();
  }, []);

  // ── Sleep Timer Ticker ──
  const sleepTimerActive = usePlayerStore((s) => s.sleepTimerActive);
  useEffect(() => {
    if (!sleepTimerActive || !isPlaying) return;

    const interval = setInterval(() => {
      const state = usePlayerStore.getState();
      if (!state.isPlaying || !state.sleepTimerActive) {
        clearInterval(interval);
        return;
      }

      if (state.sleepTimerSecondsLeft !== null) {
        if (state.sleepTimerSecondsLeft <= 1) {
          clearInterval(interval);
          usePlayerStore.setState({
            sleepTimerActive: false,
            sleepTimerSecondsLeft: null,
            sleepTimerEndOnTrack: false,
          });
          if (audioRef.current) {
            audioRef.current.pause();
          }
          usePlayerStore.getState().pause();
          toast("Sleep timer finished. Sweet dreams! 😴", { icon: "🌙" });
        } else {
          usePlayerStore.setState({
            sleepTimerSecondsLeft: state.sleepTimerSecondsLeft - 1,
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, sleepTimerActive]);

  // Pre-fetch autoplay suggestions when approaching the end of the queue (before the last 2 songs played)
  const lastAutoplayFetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoplay || !currentSong) return;
    if (currentSong._isOffline || currentSong.id?.startsWith("local_")) return;

    const remaining = queue.length - queueIndex - 1;
    if (remaining <= 1 && queue.length > 0) {
      const lastSong = queue[queue.length - 1];
      if (!lastSong || lastSong._isOffline || lastSong.id?.startsWith("local_"))
        return;

      if (lastAutoplayFetchedRef.current === lastSong.id) return;
      lastAutoplayFetchedRef.current = lastSong.id;

      const fetchWithRetry = (retriesLeft = 1) => {
        getAutoplaySongs(lastSong.id)
          .then((data) => {
            const songs: any[] = data?.songs ?? [];
            if (!songs.length) return;
            const normalized = normalizeSongs(songs);
            if (!normalized.length) return;
            // Filter out duplicates already in the queue
            const queueIds = new Set(queue.map((s) => s.id));
            const newSongs = normalized.filter(
              (s) => s.id && !queueIds.has(s.id),
            );
            newSongs.forEach((s) => addLast(s));
          })
          .catch((err) => {
            if (retriesLeft > 0) {
              console.warn(
                "[Player] Autoplay pre-fetch failed, retrying in 2.5s...",
                err,
              );
              setTimeout(() => fetchWithRetry(retriesLeft - 1), 2500);
            } else {
              console.warn(
                "[Player] Autoplay pre-fetch failed after retry:",
                err,
              );
            }
          });
      };

      fetchWithRetry();
    }
  }, [autoplay, currentSong?.id, queue, queueIndex, addLast]);

  // ── Audio Element Handlers ──────────────────────────────────────
  // The <audio> element drives the store for every song type (YouTube + offline).
  const handleTimeUpdate = () => {
    if (!currentSong || !audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!currentSong || !audioRef.current) return;
    // New src is now loaded — any future pause events are real user actions.
    srcJustChangedRef.current = false;
    if (srcChangedTimerRef.current) {
      clearTimeout(srcChangedTimerRef.current);
      srcChangedTimerRef.current = null;
    }
    const dur = audioRef.current.duration;
    const currentDuration = usePlayerStore.getState().duration;
    if (
      dur &&
      isFinite(dur) &&
      (!currentDuration || Math.abs(currentDuration - dur) > 5)
    ) {
      setDuration(dur);
    }
  };

  const handleEnded = () => {
    if (!currentSong) return;
    const { sleepTimerActive, sleepTimerEndOnTrack } =
      usePlayerStore.getState();
    if (sleepTimerActive && sleepTimerEndOnTrack) {
      usePlayerStore.setState({
        sleepTimerActive: false,
        sleepTimerSecondsLeft: null,
        sleepTimerEndOnTrack: false,
      });
      pause();
      toast("Sleep timer finished. Sweet dreams! 😴", { icon: "🌙" });
      return;
    }

    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } else {
        playSong(currentSong);
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
                if (!songs.length) {
                  pause();
                  return;
                }
                const normalized = normalizeSongs(songs);
                if (!normalized.length) {
                  pause();
                  return;
                }
                normalized.forEach((s) => addLast(s));
                // Advance past the now-extended queue
                const nextSong = useQueueStore.getState().next(repeatMode);
                if (nextSong) playSong(nextSong);
                else pause();
              })
              .catch((err) => {
                if (retriesLeft > 0) {
                  console.warn(
                    "[Player] Queue exhausted autoplay fetch failed, retrying in 2.5s...",
                    err,
                  );
                  setTimeout(() => fetchWithRetry(retriesLeft - 1), 2500);
                } else {
                  console.error(
                    "[Player] Queue exhausted autoplay fetch failed after retry:",
                    err,
                  );
                  toast.error(
                    "Couldn't load more songs — check your connection",
                  );
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

  const handlePause = () => {
    if (!currentSong) return;
    const audio = audioRef.current;
    if (!audio) return;
    // Skip entirely during src transitions
    if (srcJustChangedRef.current) return;

    // Only update state if the pause was intentional (not buffering/seeking)
    if (!audio.seeking && !audio.ended) {
      setIsPlaying(false);
    }
  };

  const handlePlay = () => {
    if (!currentSong) return;
    setIsPlaying(true);
  };

  const handleError = async (e?: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    if (!currentSong) return;
    const mediaError = audioRef.current?.error;
    console.error("[AudioEngine] Playback error for:", currentSong?.name, {
      code: mediaError?.code,
      message: mediaError?.message,
      error: mediaError,
      event: e,
    });

    const failedSong = usePlayerStore.getState().currentSong;
    // For YouTube songs, try to find an alternative playable version before skipping.
    if (
      failedSong &&
      !failedSong._isOffline &&
      !failedSong.id?.startsWith("local_")
    ) {
      // Step 1: Attempt direct client stream resolution (Piped/mirrors)
      const clientAttempted =
        (window as any)._attemptedClientStreams || new Set<string>();
      (window as any)._attemptedClientStreams = clientAttempted;

      if (!clientAttempted.has(failedSong.id)) {
        clientAttempted.add(failedSong.id);
        console.log(`[AudioEngine] Attempting direct client stream failover for: ${failedSong.id}`);
        try {
          const directUrl = await resolveClientStream(failedSong.id);
          if (directUrl && audioRef.current) {
            console.log(`[AudioEngine] Direct client stream resolved for ${failedSong.id}: ${directUrl}`);
            srcJustChangedRef.current = true;
            if (srcChangedTimerRef.current) clearTimeout(srcChangedTimerRef.current);
            srcChangedTimerRef.current = setTimeout(() => {
              srcJustChangedRef.current = false;
              srcChangedTimerRef.current = null;
            }, 3000);
            audioRef.current.src = directUrl;
            usePlayerStore.getState().setIsPlaying(true);
            try {
              await audioRef.current.play();
            } catch (playErr: any) {
              if (playErr.name !== "AbortError") {
                console.error("[AudioEngine] Direct stream autoplay failed:", playErr);
              }
            }
            return;
          }
        } catch (err) {
          console.warn("[AudioEngine] Direct client stream resolution failed:", err);
        }
      }

      // Step 2: Search for alternative song version if direct stream failover failed
      const attempted =
        (window as any)._attemptedFallbacks || new Set<string>();
      (window as any)._attemptedFallbacks = attempted;

      if (!attempted.has(failedSong.id)) {
        attempted.add(failedSong.id);
        toast("Resolving playable audio version... 🎧", { icon: "🔄" });

        smartSearch(`${failedSong.name} ${getArtists(failedSong)}`, "songs", 5)
          .then((searchRes: any) => {
            const songs = searchRes?.songs || [];
            const playableSong = songs.find(
              (song: any) => song.id && !attempted.has(song.id),
            );

            if (playableSong) {
              console.log(
                `[Player] Fallback found: from ${failedSong.id} to ${playableSong.id}`,
              );
              const updatedSong = {
                ...failedSong,
                id: playableSong.id,
                url:
                  playableSong.url ||
                  `https://music.youtube.com/watch?v=${playableSong.id}`,
                streamUrl: playableSong.streamUrl,
              };

              const q = useQueueStore.getState().queue;
              const qIdx = useQueueStore.getState().queueIndex;
              if (q[qIdx] && q[qIdx].id === failedSong.id) {
                const newQueue = [...q];
                newQueue[qIdx] = updatedSong;
                useQueueStore.getState().setQueue(newQueue, qIdx);
              }

              usePlayerStore.getState().playSong(updatedSong);
            } else {
              setIsPlaying(false);
              skipToNextOnFailure();
            }
          })
          .catch((err) => {
            console.error("Failed to find fallback for unplayable video:", err);
            setIsPlaying(false);
            skipToNextOnFailure();
          });
        return;
      }
    }

    setIsPlaying(false);
    toast.error(`"${currentSong.name}" unavailable, skipping...`, {
      id: "song-error",
    });
    setTimeout(() => {
      if (repeatMode !== "one") {
        const n = next(repeatMode);
        if (n) playSong(n);
      }
    }, 1000);
  };

  const skipToNextOnFailure = () => {
    setTimeout(() => {
      const state = usePlayerStore.getState();
      if (state.currentSong) {
        const n = useQueueStore.getState().next(state.repeatMode);
        if (n) usePlayerStore.getState().playSong(n);
        else usePlayerStore.getState().pause();
      }
    }, 1500);
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
      <PositionStateUpdater />
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
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
