// Force HMR refresh
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePlayerStore } from "../store/playerStore";
import { useQueueStore } from "../store/queueStore";
import { logHistory, getAutoplaySongs, smartSearch, api } from "../api/backend";
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
import { registerAudioElement } from "../utils/audioUnlock";

import toast from "react-hot-toast";

const SILENT_MP3 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV";

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
  const ytPlayerRef = useRef<any>(null);
  const ytPlayerReadyRef = useRef<boolean>(false);
  const loadedYtVideoIdRef = useRef<string | null>(null);
  // Stable ref for handleEnded so the YT.Player [] init effect doesn't capture a stale closure
  const handleEndedRef = useRef<() => void>(() => {});
  // Queue a pending action when YT.Player isn't ready yet — flushed in onReady
  const pendingYtActionRef = useRef<(() => void) | null>(null);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const autoplay = usePlayerStore((s) => s.autoplay);
  const isVideoMode = usePlayerStore((s) => s.isVideoMode);
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
  // Flag to suppress DOM pause/play events when pause/play were called programmatically
  const isProgrammaticActionRef = useRef(false);



  // ── Safe Foreground Resume Listener ──────────────────────────────
  useEffect(() => {
    const handleForeground = () => {
      isAppBackgroundedRef.current = false;
      const s = usePlayerStore.getState();
      const isYT = s.currentSong && !s.currentSong._isOffline && !s.currentSong.id?.startsWith("local_");
      if (s.isPlaying && isYT && s.isVideoMode && s.isPlayerExpanded && ytPlayerRef.current && ytPlayerReadyRef.current) {
        try {
          if (ytPlayerRef.current.getPlayerState() !== 1) {
            ytPlayerRef.current.playVideo();
          }
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.debug("[PlayerProvider] Background resume suppressed:", err);
          }
        }
      }
    };

    const handleVis = () => { if (!document.hidden) handleForeground(); };
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
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.autoplay = false;
      audioRef.current = audio;
    }
    registerAudioElement(audioRef.current);
    return () => {
      registerAudioElement(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.src = "";
      }
    };
  }, []);

  // ── Position Syncing Ticker (Syncs audioRef to ytPlayerRef only when drift > 1.0s) ──
  useEffect(() => {
    if (!isPlaying || !currentSong || document.hidden) return;
    const isYouTube = !currentSong._isOffline && !currentSong.id.startsWith("local_");
    if (!isYouTube || !isVideoMode || !isPlayerExpanded) return;

    const interval = setInterval(() => {
      const ytTime = ytPlayerRef.current?.getCurrentTime?.();
      const audioTime = audioRef.current?.currentTime;
      if (ytTime != null && audioTime != null && isFinite(ytTime) && isFinite(audioTime)) {
        if (Math.abs(ytTime - audioTime) > 1.0) {
          audioRef.current!.currentTime = ytTime;
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, currentSong?.id, isVideoMode, isPlayerExpanded]);

  // ── Pre-Warmed Engine Switching Guard & Handler ─────────────────
  const isSwitchingEngineRef = useRef(false);
  const isIntentionalIframePauseRef = useRef(false);

  const syncEnginePlayback = useCallback(async (toBackground: boolean) => {
    console.log(`[DIAG ${Date.now()}] syncEnginePlayback entry toBackground=${toBackground} switching=${isSwitchingEngineRef.current} song=${currentSong?.id}`);
    if (isSwitchingEngineRef.current || !currentSong) return;
    if (currentSong._isOffline || currentSong.id?.startsWith("local_")) return;

    isSwitchingEngineRef.current = true;
    try {
      const state = usePlayerStore.getState();

      if (toBackground) {
        // ── Backgrounding: Pause YT Iframe, Unmute Pre-Warmed <audio> ──
        console.log(`[DIAG ${Date.now()}] syncEnginePlayback BRANCH=toBackground isPlaying=${state.isPlaying} video=${state.isVideoMode} expanded=${state.isPlayerExpanded} audio.paused=${audioRef.current?.paused} audio.muted=${audioRef.current?.muted}`);
        // Set intentional pause suppression flag so onStateChange ignores this pause event
        isIntentionalIframePauseRef.current = true;
        try { ytPlayerRef.current?.pauseVideo?.(); } catch {}

        if (audioRef.current) {
          console.log(`[DIAG ${Date.now()}] BEFORE unmute: muted=${audioRef.current.muted} volume=${audioRef.current.volume} paused=${audioRef.current.paused}`);
          audioRef.current.muted = false;
          audioRef.current.volume = 1;
          console.log(`[DIAG ${Date.now()}] AFTER unmute: muted=${audioRef.current.muted} volume=${audioRef.current.volume} paused=${audioRef.current.paused}`);
        }

        // Post-background probes: is audio still alive at t+1s / t+5s?
        setTimeout(() => {
          console.log(`[DIAG ${Date.now()}] t+1s after background: audio.paused=${audioRef.current?.paused} muted=${audioRef.current?.muted} vol=${audioRef.current?.volume} isPlaying=${usePlayerStore.getState().isPlaying}`);
        }, 1000);
        setTimeout(() => {
          console.log(`[DIAG ${Date.now()}] t+5s after background: audio.paused=${audioRef.current?.paused} muted=${audioRef.current?.muted} vol=${audioRef.current?.volume} isPlaying=${usePlayerStore.getState().isPlaying}`);
        }, 5000);

        setTimeout(() => {
          isIntentionalIframePauseRef.current = false;
        }, 500);
      } else {
        // ── Foreground Return: Mute <audio>, Resume YT Iframe ──
        console.log(`[DIAG ${Date.now()}] syncEnginePlayback BRANCH=toForeground isPlaying=${state.isPlaying} video=${state.isVideoMode} expanded=${state.isPlayerExpanded}`);
        if (state.isPlaying && state.isVideoMode && state.isPlayerExpanded) {
          const curTime = audioRef.current?.currentTime || state.currentTime;

          if (audioRef.current) {
            console.log(`[DIAG ${Date.now()}] BEFORE remute: muted=${audioRef.current.muted} volume=${audioRef.current.volume} paused=${audioRef.current.paused} curTime=${curTime}`);
            audioRef.current.muted = true;
            audioRef.current.volume = 0;
            console.log(`[DIAG ${Date.now()}] AFTER remute: muted=${audioRef.current.muted} volume=${audioRef.current.volume} paused=${audioRef.current.paused}`);
          }

          if (ytPlayerRef.current && ytPlayerReadyRef.current) {
            try {
              ytPlayerRef.current.seekTo(curTime, true);
              ytPlayerRef.current.playVideo();
            } catch {}
          }
        }
      }
    } finally {
      setTimeout(() => {
        isSwitchingEngineRef.current = false;
      }, 300);
    }
  }, [currentSong]);

  // ── Visibilitychange & AppState Listeners ───────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log(`[DIAG ${Date.now()}] visibilitychange document.hidden=${document.hidden}`);
      if (document.hidden) {
        syncEnginePlayback(true);
      } else {
        syncEnginePlayback(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [syncEnginePlayback]);

  // ── Seek handler: updates BOTH YT player AND audio element ──────────────
  const handleSeek = useCallback(
    (time: number) => {
      const isYouTube = currentSong && !currentSong._isOffline && !currentSong.id.startsWith("local_");
      if (isYouTube && ytPlayerRef.current && ytPlayerReadyRef.current) {
        try {
          ytPlayerRef.current.seekTo(time, true);
        } catch {}
      }
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
      seekTo(time);
      duo.syncSeek(time);
    },
    [seekTo, duo, currentSong?.id],
  );

  useEffect(() => {
    handleSeekRemoteRef.current = (time: number) => {
      const isYouTube = currentSong && !currentSong._isOffline && !currentSong.id.startsWith("local_");
      if (isYouTube && ytPlayerRef.current && ytPlayerReadyRef.current) {
        try {
          ytPlayerRef.current.seekTo(time, true);
        } catch {}
      }
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
      seekTo(time);
    };
  }, [currentSong?.id, seekTo]);

  // ── Consolidated Audio & Source Control (Pre-Warmed Activation) ──────
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;

    let isCancelled = false;

    const resolveAndHandle = async () => {
      let targetSrc = "";
      const isYouTube = !currentSong._isOffline && !currentSong.id?.startsWith("local_");
      const isVisibleVideo = !document.hidden && isVideoMode && isPlayerExpanded;

      if (isYouTube) {
        targetSrc = currentSong.streamUrl || `${api.defaults.baseURL}/api/search/stream?id=${currentSong.id}`;
        audioRef.current!.loop = false;

        if (isVisibleVideo) {
          audioRef.current!.muted = true;
          audioRef.current!.volume = 0;
        } else {
          audioRef.current!.muted = isMuted;
          audioRef.current!.volume = isMuted ? 0 : volume;
        }
      } else {
        audioRef.current!.loop = false;
        audioRef.current!.muted = isMuted;
        audioRef.current!.volume = isMuted ? 0 : volume;
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

        if (audioRef.current!.src !== targetSrc) {
          srcJustChangedRef.current = true;
          if (srcChangedTimerRef.current) clearTimeout(srcChangedTimerRef.current);
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
          audioRef.current!.load();
        } else {
          srcJustChangedRef.current = false;
          if (srcChangedTimerRef.current) {
            clearTimeout(srcChangedTimerRef.current);
            srcChangedTimerRef.current = null;
          }
        }

        const currentState = usePlayerStore.getState();
        const isVisibleVideoNow = !document.hidden && currentState.isVideoMode && currentState.isPlayerExpanded;

        if (currentState.isPlaying && !isVisibleVideoNow && currentState.currentSong?.id === currentSong.id) {
          isProgrammaticActionRef.current = true;
          audioRef.current!.play().catch((err) => {
            if (process.env.NODE_ENV !== "production") {
              console.debug("[AudioEngine] Play error:", err);
            }
          }).finally(() => {
            setTimeout(() => { isProgrammaticActionRef.current = false; }, 150);
          });
        } else {
          isProgrammaticActionRef.current = true;
          audioRef.current!.pause();
          setTimeout(() => { isProgrammaticActionRef.current = false; }, 150);
        }
      } else {
        isProgrammaticActionRef.current = true;
        audioRef.current!.pause();
        setTimeout(() => { isProgrammaticActionRef.current = false; }, 150);
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
  }, [currentSong?.id, isPlaying, isVideoMode, isPlayerExpanded, isMuted, volume]);

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
    const isVisibleVideo = !document.hidden && isVideoMode && isPlayerExpanded;

    if (audioRef.current) {
      if (isVisibleVideo) {
        audioRef.current.volume = 0;
        audioRef.current.muted = true;
      } else {
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.muted = isMuted;
      }
    }

    const isYouTube = currentSong && !currentSong._isOffline && !currentSong.id.startsWith("local_");
    if (isYouTube && ytPlayerRef.current && ytPlayerReadyRef.current) {
      try {
        ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
        if (isMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
        }
      } catch {}
    }
  }, [volume, isMuted, currentSong?.id, isVideoMode, isPlayerExpanded]);

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

  // ── YouTube Video Player Management (Mounts cleanly in Video Slot) ──
  useEffect(() => {
    if (!currentSong) return;
    const isYouTube = !currentSong._isOffline && !currentSong.id?.startsWith("local_");
    if (!isYouTube) return;

    const isVisibleVideo = isPlaying && isVideoMode && isPlayerExpanded && !document.hidden;

    if (isVideoMode && isPlayerExpanded && !document.hidden) {
      // Pause <audio> element so YouTube player has sole control over sound & video
      if (audioRef.current && !audioRef.current.paused) {
        isProgrammaticActionRef.current = true;
        audioRef.current.pause();
        audioRef.current.muted = true;
        audioRef.current.volume = 0;
        setTimeout(() => { isProgrammaticActionRef.current = false; }, 150);
      }

      const slotEl = document.getElementById("youtube-video-player");
      if (!slotEl) return;

      if (!window.YT || !window.YT.Player) {
        loadYoutubeApi();
        return;
      }

      // Instantiate YT.Player if not created or if element detached
      const currentContainerId = ytPlayerRef.current?.a?.id;
      if (!ytPlayerRef.current || currentContainerId !== "youtube-video-player") {
        try {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
            try { ytPlayerRef.current.destroy(); } catch {}
          }
          ytPlayerReadyRef.current = false;
          loadedYtVideoIdRef.current = null;

          ytPlayerRef.current = new (window as any).YT.Player("youtube-video-player", {
            height: "100%",
            width: "100%",
            videoId: currentSong.id,
            playerVars: {
              controls: 0,
              rel: 0,
              modestbranding: 1,
              iv_load_policy: 3,
              fs: 0,
              disablekb: 1,
              cc_load_policy: 0,
              autoplay: 1,
              playsinline: 1,
              origin: window.location.origin,
              start: Math.floor(usePlayerStore.getState().currentTime || 0),
            },
            events: {
              onReady: (event: any) => {
                ytPlayerReadyRef.current = true;
                (window as any)._ytPlayerInstance = ytPlayerRef.current;
                try {
                  event.target.setVolume(isMuted ? 0 : volume * 100);
                  if (usePlayerStore.getState().isPlaying) {
                    event.target.playVideo();
                  } else {
                    event.target.pauseVideo();
                  }
                } catch {}
              },
              onStateChange: (event: any) => {
                const state = event.data;
                const s = usePlayerStore.getState();
                const isYT = s.currentSong && !s.currentSong._isOffline && !s.currentSong.id.startsWith("local_");
                if (!isYT || !s.isVideoMode || !s.isPlayerExpanded) return;

                if (state === 1) { // playing
                  if (!s.isPlaying) usePlayerStore.getState().setIsPlaying(true);
                } else if (state === 2) { // paused
                  if (isIntentionalIframePauseRef.current || isProgrammaticActionRef.current) return;
                  if (s.isPlaying) usePlayerStore.getState().setIsPlaying(false);
                } else if (state === 0) { // ended
                  if (s.isPlaying) usePlayerStore.getState().setIsPlaying(false);
                  handleEndedRef.current();
                }
              },
              onError: async (event: any) => {
                const errCode = event.data;
                console.error("[YTPlayer] error code:", errCode);
                const s = usePlayerStore.getState();
                const failedSong = s.currentSong;
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
                        const updatedSong = {
                          ...failedSong,
                          id: playableSong.id,
                          url: playableSong.url || `https://music.youtube.com/watch?v=${playableSong.id}`,
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
                        return;
                      }
                    } catch (err) {
                      console.error("Fallback error:", err);
                    }
                  }
                }
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
          loadedYtVideoIdRef.current = currentSong.id;
        } catch (err) {
          console.error("Failed to initialize YT.Player on video slot:", err);
        }
      } else if (ytPlayerReadyRef.current) {
        const player = ytPlayerRef.current;
        try {
          if (loadedYtVideoIdRef.current !== currentSong.id) {
            loadedYtVideoIdRef.current = currentSong.id;
            const startSec = Math.floor(usePlayerStore.getState().currentTime || 0);
            player.loadVideoById({ videoId: currentSong.id, startSeconds: startSec });
          } else {
            if (isVisibleVideo) {
              if (player.getPlayerState() !== 1) {
                isProgrammaticActionRef.current = true;
                player.playVideo();
                setTimeout(() => { isProgrammaticActionRef.current = false; }, 150);
              }
            } else {
              if (player.getPlayerState() === 1 || player.getPlayerState() === 3) {
                isProgrammaticActionRef.current = true;
                player.pauseVideo();
                setTimeout(() => { isProgrammaticActionRef.current = false; }, 150);
              }
            }
          }
        } catch {}
      }
    } else {
      // Audio Mode or minimized: pause YouTube Player
      if (ytPlayerRef.current && ytPlayerReadyRef.current) {
        try {
          const ps = ytPlayerRef.current.getPlayerState();
          if (ps === 1 || ps === 3) {
            isProgrammaticActionRef.current = true;
            ytPlayerRef.current.pauseVideo();
            setTimeout(() => { isProgrammaticActionRef.current = false; }, 150);
          }
        } catch {}
      }
    }
  }, [isPlaying, currentSong?.id, isVideoMode, isPlayerExpanded, volume, isMuted]);

  // ── Polling ticker for background YouTube playback ──
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    if (!isVideoMode || !isPlayerExpanded) return;

    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player || !ytPlayerReadyRef.current) return;
      try {
        if (player.getPlayerState() === 1) {
          const time = player.getCurrentTime();
          const dur = player.getDuration();
          if (typeof time === "number" && !isNaN(time) && isFinite(time)) {
            setCurrentTime(time);
          }
          if (typeof dur === "number" && !isNaN(dur) && dur > 0 && isFinite(dur)) {
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
    if (!currentSong) return;
    const state = usePlayerStore.getState();
    if (state.isVideoMode && state.isPlayerExpanded) return;
    if (audioRef.current && isFinite(audioRef.current.currentTime)) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (!currentSong) return;
    srcJustChangedRef.current = false;
    if (srcChangedTimerRef.current) {
      clearTimeout(srcChangedTimerRef.current);
      srcChangedTimerRef.current = null;
    }
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (dur && isFinite(dur) && dur > 0) {
        setDuration(dur);
      }
    }
  };

  const handleEnded = () => {
    if (!currentSong) return;
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

  const handlePause = () => {
    if (!currentSong) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (srcJustChangedRef.current) return;
    if (isProgrammaticActionRef.current) return;

    const state = usePlayerStore.getState();
    if (!state.isPlaying) return;
    if (state.isVideoMode && state.isPlayerExpanded) return;

    if (!audio.seeking && !audio.ended) {
      setIsPlaying(false);
    }
  };

  const handlePlay = () => {
    if (!currentSong) return;
    if (isProgrammaticActionRef.current) return;

    const state = usePlayerStore.getState();
    if (state.isPlaying) return;
    if (state.isVideoMode && state.isPlayerExpanded) return;

    setIsPlaying(true);
  };

  const handleError = () => {
    if (!currentSong) return;
    const state = usePlayerStore.getState();
    if (state.isVideoMode && state.isPlayerExpanded) return;
    console.error("[AudioEngine] Playback error for:", currentSong?.name);

    setIsPlaying(false);
    toast.error(`"${currentSong.name}" unavailable, skipping...`, { id: "song-error" });
    setTimeout(() => {
      if (repeatMode !== "one") {
        const n = next(repeatMode);
        if (n) playSong(n);
      }
    }, 1000);
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
        ref={(el) => {
          audioRef.current = el;
          registerAudioElement(el);
        }}
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
