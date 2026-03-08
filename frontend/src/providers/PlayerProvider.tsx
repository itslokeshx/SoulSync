import React, { createContext, useContext, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useQueueStore } from '../store/queueStore';
import {
    registerMediaControls,
    updateMediaMetadata,
    clearMediaMetadata,
    updatePositionState
} from '../capacitor/musicControls';
import { isNative } from '../utils/platform';
import {
    initBackgroundAudio,
    registerPlayerGetters
} from '../capacitor/lifecycle';
import { useDuo } from '../duo/useDuo';
import { useDuoStore } from '../duo/duoStore';
import { getOfflineBlob } from '../utils/offlineDB';
import toast from 'react-hot-toast';

interface PlayerContextType {
    audioRef: React.RefObject<HTMLAudioElement>;
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

    const addToast = (msg: string, type: string = 'info') => {
        if (type === 'success') toast.success(msg);
        else if (type === 'error') toast.error(msg);
        else toast(msg);
    };

    const duo = useDuo({
        playSongRef,
        audioRef: audioRef as React.RefObject<HTMLAudioElement>,
        currentSongRef,
        queueRef,
        setIsPlaying,
        setCurrentTime,
        addToast,
        isRemoteActionRef,
    });

    // ── consolidated Audio & Source Control ─────────────────────────
    // Fixes the "image only changed" race condition by ensuring play() 
    // is only called after src is set and ready.
    useEffect(() => {
        if (!audioRef.current || !currentSong) return;

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
                targetSrc = currentSong.downloadUrl?.[currentSong.downloadUrl.length - 1]?.url || "";
            }

            // Only update src if it's actually different (avoid unnecessary reloads)
            if (audioRef.current!.src !== targetSrc) {
                audioRef.current!.src = targetSrc;
            }

            // Execute play/pause state
            if (isPlaying) {
                // We use catch() to handle "interrupted by new request" errors gracefully
                audioRef.current!.play().catch(() => { });
            } else {
                audioRef.current!.pause();
            }

            isFirstPlayRef.current = false;
        };

        resolveAndHandle();
    }, [currentSong?.id, isPlaying]);

    // ── Consolidated SoulLink Sync ────────────────────────────────────
    // Prevents infinite loops by checking isRemoteActionRef.
    useEffect(() => {
        const isDuoActive = useDuoStore.getState().active;
        if (!isDuoActive || isFirstPlayRef.current) return;

        if (isRemoteActionRef.current) {
            // Signal received from partner, do not echo back.
            // We set it to false here since this is the primary effect that consumes it.
            isRemoteActionRef.current = false;
            return;
        }

        // Local change happened, broadcast to partner
        if (isPlaying) {
            duo.syncPlay(audioRef.current?.currentTime || 0, currentSong?.id || "");
        } else {
            duo.syncPause(audioRef.current?.currentTime || 0);
        }

        // Always sync song/queue on any relevant change if active
        if (currentSong) {
            const q = queue.length ? queue : [currentSong];
            const idx = Math.max(q.findIndex(s => s.id === currentSong.id), 0);
            duo.syncSongChange(currentSong, q, idx);
        }
    }, [isPlaying, currentSong?.id, duo]);

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
        if (audioRef.current) setDuration(audioRef.current.duration);
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

    return (
        <PlayerContext.Provider value={{
            audioRef: audioRef as React.RefObject<HTMLAudioElement>,
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
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />
        </PlayerContext.Provider>
    );
};

export const usePlayer = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error('usePlayer must be used within PlayerProvider');
    return context;
};
