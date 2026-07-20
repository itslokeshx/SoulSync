import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { usePlayerStore } from "../store/playerStore";
import { useQueueStore } from "../store/queueStore";
import { logHistory, getAutoplaySongs, smartSearch } from "../api/backend";
import { bestImg, getArtists } from "../lib/helpers";
import {
  registerMediaControls,
  updateMediaMetadata,
  clearMediaMetadata,
  updatePositionState,
} from "../capacitor/musicControls";
import { getBestAudioUrl, getBestImageUrl } from "../utils/getBestAudioUrl";
import { normalizeSongs } from "../utils/normalizeSong";
import {
  initBackgroundAudio,
  registerPlayerGetters,
} from "../capacitor/lifecycle";
import { isNative } from "../utils/platform";
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

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

let apiLoadingPromise: Promise<void> | null = null;

function loadYoutubeApi(): Promise<void> {
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (apiLoadingPromise) {
    return apiLoadingPromise;
  }
  apiLoadingPromise = new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousCallback) {
        try {
          previousCallback();
        } catch (e) {
          console.error(e);
        }
      }
      resolve();
    };
  });
  return apiLoadingPromise;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytPlayerReadyRef = useRef<boolean>(false);
  const loadedYtVideoIdRef = useRef<string | null>(null);
  // Stable ref for handleEnded so the YT.Player [] init effect doesn't capture a stale closure
  const handleEndedRef = useRef<() => void>(() => {});
  // Queue a pending action when YT.Player isn't ready yet — flushed in onReady
  const pendingYtActionRef = useRef<(() => void) | null>(null);
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
    isVideoMode,
    isPlayerExpanded,
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
    playSongRef.current = (song, duoQueue, fromDuo) => {
      if (fromDuo && Array.isArray(duoQueue) && duoQueue.length > 0) {
        const idx = Math.max(duoQueue.findIndex((s: any) => s.id === song.id), 0);
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
      artistId: (Array.isArray(currentSong.artists)
        ? currentSong.artists[0]?.id
        : currentSong.artists?.primary?.[0]?.id) || currentSong.artist_map?.primary_artists?.[0]?.id || "",
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
      const isYouTube = currentSong && !currentSong._isOffline && !currentSong.id.startsWith("local_");
      if (isYouTube && ytPlayerRef.current && ytPlayerReadyRef.current) {
        try {
          ytPlayerRef.current.seekTo(time, true);
        } catch {}
      } else if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
      seekTo(time);
      duo.syncSeek(time);
    },
    [seekTo, duo, currentSong?.id],
  );

  // ── consolidated Audio & Source Control ─────────────────────────
  // Fixes the "image only changed" race condition by ensuring play()
  // is only called after src is set and ready.
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;

    let isCancelled = false;

    const resolveAndHandle = async () => {
      let targetSrc = "";
      const isYouTube = !currentSong._isOffline && !currentSong.id?.startsWith("local_");

      if (isYouTube) {
        // Online YouTube songs are played via the client-side YouTube iframe player.
        // We bypass HTML5 audio element entirely.
        targetSrc = "";
      } else {
        // For downloaded/local songs, try to load the blob from IndexedDB first
        const blob = await getOfflineBlob(currentSong.id);
        if (blob) {
          targetSrc = URL.createObjectURL(blob);
        } else {
          // Fallback to the known URL if fetching the blob failed
          targetSrc = currentSong.downloadUrl?.[0]?.url || "";
        }
      }

      if (isCancelled) return;

      if (targetSrc) {
        // Safety net: decode any remaining HTML entities
        if (targetSrc.includes("&amp;")) {
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
          currentState.currentSong?.id === currentSong.id &&
          (!currentState.isVideoMode || !currentState.isPlayerExpanded)
        ) {
          // We use catch() to handle "interrupted by new request" errors gracefully
          audioRef.current!.play().catch(() => {});
        } else {
          audioRef.current!.pause();
        }
      } else {
        // For YouTube playback: ensure HTML5 audio is paused and source cleared
        audioRef.current!.pause();
        if (audioRef.current!.src !== "" && audioRef.current!.src !== window.location.href) {
          audioRef.current!.src = "";
        }
      }

      hasEverLoadedRef.current = true;
    };

    resolveAndHandle();

    return () => {
      isCancelled = true;
    };
  }, [currentSong?.id, isPlaying, isVideoMode, isPlayerExpanded]);

  // Sync audio currentTime with store currentTime when exiting video mode or when player is minimized
  const lastVideoModeRef = useRef(isVideoMode);
  const lastExpandedRef = useRef(isPlayerExpanded);
  useEffect(() => {
    const wasVideoAndExpanded = lastVideoModeRef.current && lastExpandedRef.current;
    const isNowAudioOrMinimized = !isVideoMode || !isPlayerExpanded;

    if (wasVideoAndExpanded && isNowAudioOrMinimized) {
      const storeTime = usePlayerStore.getState().currentTime;
      if (audioRef.current && isFinite(storeTime)) {
        audioRef.current.currentTime = storeTime;
      }
    }
    lastVideoModeRef.current = isVideoMode;
    lastExpandedRef.current = isPlayerExpanded;
  }, [isVideoMode, isPlayerExpanded]);

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

  // 2. Sync video mode changes
  useEffect(() => {
    const isDuoActive = useDuoStore.getState().active;
    if (!isDuoActive || !hasEverLoadedRef.current) return;
    duo.syncVideoMode?.(isVideoMode);
  }, [isVideoMode, duo]);

  // ── Volume & Media Controls ──────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;

    const isYouTube = currentSong && !currentSong._isOffline && !currentSong.id.startsWith("local_");
    if (isYouTube && ytPlayerRef.current && ytPlayerReadyRef.current) {
      try {
        ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
      } catch {}
    }
  }, [volume, isMuted, currentSong?.id]);

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

  // ── Local playback time ticker for Video Mode (since audio is paused) ────
  useEffect(() => {
    if (!isPlaying || !isVideoMode || !currentSong) return;

    const interval = setInterval(() => {
      const state = usePlayerStore.getState();
      const nextTime = state.currentTime + 0.25;
      if (state.duration && nextTime <= state.duration) {
        setCurrentTime(nextTime);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isPlaying, isVideoMode, currentSong?.id, setCurrentTime]);

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

  // Load YT API once
  useEffect(() => {
    loadYoutubeApi();
  }, []);

  // Initialize YT.Player instance once
  useEffect(() => {
    let cancelled = false;

    const initPlayer = async () => {
      await loadYoutubeApi();
      if (cancelled) return;

      // Wait for the container div to appear in the DOM
      for (let i = 0; i < 20; i++) {
        if (document.getElementById("youtube-audio-player")) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled) return;

      try {
        ytPlayerRef.current = new (window as any).YT.Player("youtube-audio-player", {
          height: "1",
          width: "1",
          videoId: "",
          playerVars: {
            controls: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            fs: 0,
            disablekb: 1,
            cc_load_policy: 0,
            autoplay: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              ytPlayerReadyRef.current = true;
              // Flush any action that was queued while the player was loading
              if (pendingYtActionRef.current) {
                try { pendingYtActionRef.current(); } catch {}
                pendingYtActionRef.current = null;
              }
            },
            onStateChange: (event: any) => {
              const state = event.data;
              const s = usePlayerStore.getState();
              const isYT = s.currentSong && !s.currentSong._isOffline && !s.currentSong.id.startsWith("local_");
              if (!isYT || (s.isVideoMode && s.isPlayerExpanded)) return;

              if (state === 1) { // playing
                usePlayerStore.getState().setIsPlaying(true);
              } else if (state === 2) { // paused
                usePlayerStore.getState().setIsPlaying(false);
              } else if (state === 0) { // ended
                usePlayerStore.getState().setIsPlaying(false);
                handleEndedRef.current();
              }
            },
            onError: async (event: any) => {
              const errCode = event.data;
              console.error("[YTPlayer] error code:", errCode);

              const s = usePlayerStore.getState();
              const failedSong = s.currentSong;

              // Error code 101/150 = embedding disabled, 100 = video deleted/not found, 5 = HTML5 player error
              if (failedSong && (errCode === 101 || errCode === 150 || errCode === 100 || errCode === 5)) {
                const attempted = (window as any)._attemptedFallbacks || new Set<string>();
                (window as any)._attemptedFallbacks = attempted;

                if (!attempted.has(failedSong.id)) {
                  attempted.add(failedSong.id);
                  toast("Resolving playable audio version... 🎧", { icon: "🔄" });

                  try {
                    const query = `${failedSong.name} ${getArtists(failedSong)}`;
                    const searchRes: any = await smartSearch(query, "songs", 5);
                    const songs = searchRes?.songs || [];
                    const playableSong = songs.find((song: any) => song.id && song.id !== failedSong.id);

                    if (playableSong) {
                      console.log(`[Player] Fallback found: from ${failedSong.id} to ${playableSong.id}`);
                      const updatedSong = {
                        ...failedSong,
                        id: playableSong.id,
                        url: playableSong.url || `https://music.youtube.com/watch?v=${playableSong.id}`,
                        streamUrl: playableSong.streamUrl,
                      };

                      // Update queue
                      const q = useQueueStore.getState().queue;
                      const qIdx = useQueueStore.getState().queueIndex;
                      if (q[qIdx] && q[qIdx].id === failedSong.id) {
                        const newQueue = [...q];
                        newQueue[qIdx] = updatedSong;
                        useQueueStore.getState().setQueue(newQueue, qIdx);
                      }

                      usePlayerStore.getState().playSong(updatedSong);
                      return;
                    }
                  } catch (err) {
                    console.error("Failed to find fallback for unplayable video:", err);
                  }
                }
              }

              // Auto-skip to next song on player error after a short delay
              setTimeout(() => {
                const state = usePlayerStore.getState();
                if (state.currentSong) {
                  const n = useQueueStore.getState().next(state.repeatMode);
                  if (n) usePlayerStore.getState().playSong(n);
                  else usePlayerStore.getState().pause();
                }
              }, 1500);
            },
          },
        });
      } catch (err) {
        console.error("Failed to initialize YT.Player:", err);
      }
    };

    initPlayer();

    return () => { cancelled = true; };
  }, []);

  // ── YouTube Background Player Command Sender ──
  // Runs on every relevant state change; queues the action if the player isn't ready yet.
  useEffect(() => {
    if (!currentSong) return;
    const isYouTube = !currentSong._isOffline && !currentSong.id.startsWith("local_");
    if (!isYouTube) return;

    const playYTBackground = isPlaying && (!isVideoMode || !isPlayerExpanded);

    const executeCommand = () => {
      const player = ytPlayerRef.current;
      if (!player || typeof player.getPlayerState !== "function") return;

      if (playYTBackground) {
        if (loadedYtVideoIdRef.current !== currentSong.id) {
          const startSec = Math.floor(usePlayerStore.getState().currentTime);
          loadedYtVideoIdRef.current = currentSong.id;
          try {
            player.loadVideoById({ videoId: currentSong.id, startSeconds: startSec || 0 });
          } catch (err) {
            console.error("[YTPlayer] loadVideoById failed:", err);
          }
        } else {
          try {
            if (player.getPlayerState() !== 1) player.playVideo();
          } catch {}
        }
      } else {
        try {
          const ps = player.getPlayerState();
          if (ps === 1 || ps === 3) player.pauseVideo();
        } catch {}
      }
    };

    if (ytPlayerReadyRef.current) {
      executeCommand();
    } else {
      // Player not ready yet — queue this action to be flushed in onReady
      pendingYtActionRef.current = executeCommand;
    }
  }, [isPlaying, currentSong?.id, isVideoMode, isPlayerExpanded]);

  // ── Polling ticker for background YouTube playback ──
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    const isYouTube = !currentSong._isOffline && !currentSong.id.startsWith("local_");
    if (!isYouTube) return;
    if (isVideoMode && isPlayerExpanded) return;

    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player || !ytPlayerReadyRef.current) return;
      try {
        if (player.getPlayerState() === 1) {
          const time = player.getCurrentTime();
          const dur = player.getDuration();
          if (typeof time === "number" && !isNaN(time)) {
            setCurrentTime(time);
          }
          if (typeof dur === "number" && !isNaN(dur) && dur > 0) {
            const currentDuration = usePlayerStore.getState().duration;
            if (!currentDuration || Math.abs(currentDuration - dur) > 2) {
              setDuration(dur);
            }
          }
        }
      } catch {}
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, isVideoMode, isPlayerExpanded, currentSong?.id, setCurrentTime, setDuration]);

  // Pre-fetch autoplay suggestions when approaching the end of the queue (before the last 2 songs played)
  const lastAutoplayFetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!autoplay || !currentSong) return;
    if (currentSong._isOffline || currentSong.id?.startsWith("local_")) return;

    const remaining = queue.length - queueIndex - 1;
    if (remaining <= 1 && queue.length > 0) {
      const lastSong = queue[queue.length - 1];
      if (!lastSong || lastSong._isOffline || lastSong.id?.startsWith("local_")) return;

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
            const newSongs = normalized.filter((s) => s.id && !queueIds.has(s.id));
            newSongs.forEach((s) => addLast(s));
          })
          .catch((err) => {
            if (retriesLeft > 0) {
              console.warn("[Player] Autoplay pre-fetch failed, retrying in 2.5s...", err);
              setTimeout(() => fetchWithRetry(retriesLeft - 1), 2500);
            } else {
              console.warn("[Player] Autoplay pre-fetch failed after retry:", err);
            }
          });
      };

      fetchWithRetry();
    }
  }, [autoplay, currentSong?.id, queue, queueIndex, addLast]);

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
      const currentDuration = usePlayerStore.getState().duration;
      if (dur && isFinite(dur) && (!currentDuration || Math.abs(currentDuration - dur) > 5)) {
        setDuration(dur);
      }
    }
  };

  const handleEnded = () => {
    const { sleepTimerActive, sleepTimerEndOnTrack } = usePlayerStore.getState();
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
                const normalized = normalizeSongs(songs);
                if (!normalized.length) { pause(); return; }
                normalized.forEach((s) => addLast(s));
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
  // Keep ref in sync so the YT.Player's onStateChange (captured in a [] effect) always calls the latest version
  handleEndedRef.current = handleEnded;

  // ── FIX: prevent random pauses from buffering/browser events ──────
  const handlePause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Skip entirely during src transitions
    if (srcJustChangedRef.current) return;

    // Skip if we are in video mode and player is expanded,
    // because the audio element is paused intentionally to let the video play.
    const state = usePlayerStore.getState();
    if (state.isVideoMode && state.isPlayerExpanded) return;

    // Only update state if the pause was intentional (not buffering/seeking)
    if (!audio.seeking && !audio.ended) {
      setIsPlaying(false);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handleError = () => {
    console.error("[AudioEngine] Playback error for:", currentSong?.name);
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

          // Skip if we are in video mode and player is expanded,
          // because the audio element is paused intentionally to let the video play.
          const state = usePlayerStore.getState();
          if (state.isVideoMode && state.isPlayerExpanded) return;

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
      <div
        style={{
          position: "fixed",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
          bottom: "-999px",
          right: "-999px",
        }}
      >
        <div id="youtube-audio-player" />
      </div>
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
};
