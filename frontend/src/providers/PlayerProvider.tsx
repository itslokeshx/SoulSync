import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useQueueStore } from '../store/queueStore';
import {
    registerMediaControls,
    updateMediaMetadata,
    clearMediaMetadata,
    updatePositionState
} from '../capacitor/musicControls';
import {
    getBestAudioUrl,
    getBestImageUrl,
} from '../utils/getBestAudioUrl';
import {
    initBackgroundAudio,
    registerPlayerGetters
} from '../capacitor/lifecycle';
import { isNative } from '../utils/platform';
import { useDuo } from '../duo/useDuo';
import { useDuoStore } from '../duo/duoStore';
import { getOfflineBlob } from '../utils/offlineDB';
import toast from 'react-hot-toast';

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

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const {
        currentSong,
        isPlaying,
        volume,
        isMuted,
        repeatMode,
        currentTime,
        duration,
        setCurrentTime,
        setDuration,
        togglePlay,
        playSong,
        pause,
        resume,
        seekTo,
        setIsPlaying
    } = usePlayerStore();

    const { next, prev, queue } = useQueueStore();

    // ── Refs & Synchronization Flags ──────────────────────────────────
    const isFirstPlayRef = useRef(true);
    const isRemoteActionRef = useRef(false);

    // Stable actions for useDuo to call
    const playSongRef = useRef<((song: any, queue: any[], fromDuo?: boolean) => void) | null>(null);
    useEffect(() => {
        playSongRef.current = (song) => {
            playSong(song);
        };
    }, [playSong]);

    const currentSongRef = useRef(currentSong);
    useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);

    const queueRef = useRef(queue);
    useEffect(() => { queueRef.current = queue; }, [queue]);

    const isPlayingRef = useRef(isPlaying);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    const addToast = useCallback((msg: string, type: string = 'info') => {
        if (type === 'success') toast.success(msg);
        else if (type === 'error') toast.error(msg);
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
    });

    // ── Seek handler: updates BOTH audio element AND state ──────────────
    const handleSeek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
        seekTo(time);
        duo.syncSeek(time);
    }, [seekTo, duo]);

    // ── consolidated Audio & Source Control ─────────────────────────
    // Fixes the "image only changed" race condition by ensuring play() 
    // is only called after src is set and ready.
    useEffect(() => {
        if (!audioRef.current || !currentSong) return;

        let isCancelled = false;

        const resolveAndHandle = async () => {
            let targetSrc = "";
            if (currentSong._isOffline || currentSong.id?.startsWith('local_')) {
                const dlUrl = currentSong.downloadUrl?.[0]?.url || "";
                if (dlUrl.startsWith('blob:') || dlUrl.startsWith('ms-appdata:') || dlUrl.startsWith('file:')) {
                    targetSrc = dlUrl;
                } else {
                    const blob = await getOfflineBlob(currentSong.id);
                    if (blob) targetSrc = URL.createObjectURL(blob);
                    else if (dlUrl) targetSrc = dlUrl;
                }
            } else {
                // Use getBestAudioUrl to pick the highest quality and decode HTML entities
                const url = getBestAudioUrl(currentSong.downloadUrl);
                targetSrc = url || "";

                // Fallback: if no URL available (expired or missing), re-fetch from API
                if (!targetSrc && currentSong.id && !currentSong.id.startsWith('local_')) {
                    try {
                        const BACKEND = import.meta.env.VITE_BACKEND_URL || '';
                        const resp = await fetch(`${BACKEND}/api/search/stream-url?id=${currentSong.id}`, {
                            credentials: 'include',
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            if (data.streamUrl) {
                                targetSrc = data.streamUrl.replace(/&amp;/g, '&');
                            }
                            // Update the store with fresh downloadUrl for future plays
                            if (data.downloadUrl?.length) {
                                // Do not return here, let it fall through to actually play targetSrc!
                                // The effect won't re-fire because currentSong.id hasn't changed.
                                playSong({ ...currentSong, downloadUrl: data.downloadUrl });
                            }
                        }
                    } catch (e) {
                        console.warn('[Player] Stream URL re-fetch failed:', e);
                    }
                }
            }

            if (isCancelled) return;

            // Safety net: decode any remaining HTML entities
            if (targetSrc && targetSrc.includes('&amp;')) {
                targetSrc = targetSrc.replace(/&amp;/g, '&');
            }

            // Only update src if it's actually different (avoid unnecessary reloads)
            if (audioRef.current!.src !== targetSrc) {
                audioRef.current!.src = targetSrc;
            }

            // Check fresh store state to avoid closure staleness on rapid clicks
            const currentState = usePlayerStore.getState();
            if (currentState.isPlaying && currentState.currentSong?.id === currentSong.id) {
                // We use catch() to handle "interrupted by new request" errors gracefully
                audioRef.current!.play().catch(() => { });
            } else {
                audioRef.current!.pause();
            }

            isFirstPlayRef.current = false;
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

    // 2. Sync Song/Queue changes
    useEffect(() => {
        const isDuoActive = useDuoStore.getState().active;
        if (!isDuoActive || isFirstPlayRef.current) return;

        // Note: isRemoteActionRef is primarily consumed by the play/pause effect
        // If a song change came from remote, we still want to avoid echoing it back.
        // But since the play/pause effect resets it, we use a separate flag or just 
        // rely on the backend ignoring duplicate song sets. For safety, we only sync 
        // if we actually have a valid song.

        if (currentSong) {
            const q = queue.length ? queue : [currentSong];
            const idx = Math.max(q.findIndex(s => s.id === currentSong.id), 0);
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
                if (n) playSong(n);
            },
            onPrev: () => {
                const p = prev();
                if (p) playSong(p);
            },
            onSeek: (v) => {
                if (audioRef.current) audioRef.current.currentTime = v;
                seekTo(v);
            },
        });
    }, [resume, pause, next, prev, repeatMode, playSong, seekTo]);

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
            () => usePlayerStore.getState().isPlaying
        );
        initBackgroundAudio();
    }, []);

    // ── Audio Element Handlers ──────────────────────────────────────
    const handleTimeUpdate = () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            const dur = audioRef.current.duration;
            if (dur && isFinite(dur)) setDuration(dur);
        }
    };

    const handleEnded = () => {
        if (repeatMode === 'one') {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
            }
        } else {
            const n = next(repeatMode);
            if (n) playSong(n);
            else pause();
        }
    };

    // ── FIX: prevent random pauses from buffering/browser events ──────
    const handlePause = () => {
        const audio = audioRef.current;
        if (!audio) return;
        // Only update state if the pause was intentional (not buffering/seeking)
        if (!audio.seeking && !audio.ended) {
            setIsPlaying(false);
        }
    };

    const handlePlay = () => {
        setIsPlaying(true);
    };

    const handleError = () => {
        console.error('[AudioEngine] Playback error for:', currentSong?.name);
        setIsPlaying(false);
        // Auto-skip on error after 2s delay
        setTimeout(() => {
            if (repeatMode !== 'one') {
                const n = next(repeatMode);
                if (n) playSong(n);
            }
        }, 2000);
    };

    return (
        <PlayerContext.Provider value={{
            audioRef: audioRef as React.RefObject<HTMLAudioElement>,
            handleSeek,
            duo: {
                createSession: duo.createSession,
                joinSession: duo.joinSession,
                endSession: duo.endSession,
                sendMessage: duo.sendMessage
            }
        }}>
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
    if (!context) throw new Error('usePlayer must be used within PlayerProvider');
    return context;
};
