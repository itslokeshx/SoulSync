import { useEffect, useRef, useCallback } from "react";
import {
  getSocket,
  emitAsync,
  disconnectSocket,
  ensureConnected,
} from "./socket";
import { useDuoStore, getPersistedSession } from "./duoStore";

interface UseDuoOpts {
  playSongRef: React.MutableRefObject<
    ((song: any, queue: any[], fromDuo?: boolean) => void) | null
  >;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentSongRef: React.MutableRefObject<any>;
  queueRef: React.MutableRefObject<any[]>;
  setIsPlaying: (v: boolean) => void;
  setCurrentTime: (v: number) => void;
  addToast: (
    msg: string,
    type?: "info" | "success" | "error",
    ms?: number,
  ) => void;
}

export function useDuo({
  playSongRef,
  audioRef,
  currentSongRef,
  queueRef,
  setIsPlaying,
  setCurrentTime,
  addToast,
}: UseDuoOpts) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const store = useDuoStore;

  // ═══ CREATE SESSION ════════════════════════════════════════════════
  // 1. Connect to server
  // 2. Server creates room, returns code via ack
  // 3. Update store
  // 4. Sync current song if any
  const createSession = useCallback(
    async (hostName: string): Promise<string | null> => {
      try {
        const res = await emitAsync<{
          ok: boolean;
          code?: string;
          error?: string;
        }>("duo:create-room", { name: hostName.trim() });

        if (!res.ok || !res.code) {
          addToast(res.error || "Failed to create room", "error");
          return null;
        }

        store.getState().startSession({
          role: "host",
          roomCode: res.code,
          myName: hostName.trim(),
        });

        // Sync current song to the room so guest gets it on join
        const cs = currentSongRef?.current;
        if (cs) {
          const q = queueRef?.current;
          const audio = audioRef.current;
          getSocket().emit("duo:sync-song-change", {
            song: cs,
            queue: q?.length ? q : [cs],
            queueIndex: q?.length
              ? Math.max(
                  q.findIndex((s: any) => s.id === cs.id),
                  0,
                )
              : 0,
          });
          if (audio && !audio.paused) {
            getSocket().emit("duo:sync-play", {
              currentTime: audio.currentTime,
              songId: cs.id,
            });
          }
        }

        addToast(`SoulLink room created! Code: ${res.code}`, "success", 5000);
        return res.code;
      } catch (err: any) {
        addToast(err.message || "Failed to create room", "error");
        return null;
      }
    },
    [addToast, currentSongRef, queueRef, audioRef],
  );

  // ═══ JOIN SESSION ══════════════════════════════════════════════════
  // 1. Connect to server
  // 2. Server adds guest to room, notifies host, returns room state via ack
  // 3. Update store
  // 4. If host has a song playing, start playing it
  const joinSession = useCallback(
    async (code: string, guestName: string): Promise<boolean> => {
      try {
        const res = await emitAsync<{
          ok: boolean;
          room?: any;
          error?: string;
        }>("duo:join-room", {
          code: code.toUpperCase().trim(),
          name: guestName.trim(),
        });

        if (!res.ok || !res.room) {
          addToast(res.error || "Failed to join room", "error");
          return false;
        }

        store.getState().startSession({
          role: "guest",
          roomCode: res.room.code,
          myName: guestName.trim(),
        });

        // Host exists → mark partner connected
        if (res.room.host?.name) {
          store.getState().partnerJoined({ name: res.room.host.name });
        }

        // If host was playing a song, start playing it
        if (res.room.currentSong) {
          playSongRef.current?.(
            res.room.currentSong,
            [res.room.currentSong],
            true,
          );

          // Sync playback position
          if (res.room.isPlaying) {
            setTimeout(() => {
              const audio = audioRef.current;
              if (audio) {
                audio.currentTime = (res.room.currentTime || 0) + 0.5;
                audio
                  .play()
                  .then(() => setIsPlaying(true))
                  .catch(() => {});
              }
            }, 400);
          }
        }

        addToast("Joined SoulLink! 🎧", "success");
        return true;
      } catch (err: any) {
        addToast(err.message || "Failed to join room", "error");
        return false;
      }
    },
    [addToast, playSongRef, audioRef, setIsPlaying],
  );

  // ═══ SYNC CONTROLS ════════════════════════════════════════════════
  const syncPlay = useCallback((currentTime: number, songId: string) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:sync-play", { currentTime, songId });
  }, []);

  const syncPause = useCallback((currentTime: number) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:sync-pause", { currentTime });
  }, []);

  const syncSeek = useCallback((currentTime: number) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:sync-seek", { currentTime });
  }, []);

  const syncSongChange = useCallback(
    (song: any, queue: any[], queueIndex: number) => {
      if (!store.getState().active) return;
      getSocket().emit("duo:sync-song-change", { song, queue, queueIndex });
    },
    [],
  );

  // ═══ MESSAGES ═════════════════════════════════════════════════════
  const sendMessage = useCallback((text: string) => {
    if (!store.getState().active) return;
    const msg = {
      text,
      from: store.getState().role!,
      fromName: store.getState().myName,
      at: Date.now(),
    };
    store.getState().addMessage(msg);
    getSocket().emit("duo:message", { text });
  }, []);

  // ═══ END SESSION ══════════════════════════════════════════════════
  const endSession = useCallback(() => {
    if (!store.getState().active) return;
    getSocket().emit("duo:end-session");
    store.getState().endSession();
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    // Small delay so the end-session event reaches the server before disconnect
    setTimeout(() => disconnectSocket(), 300);
    addToast("SoulLink session ended", "info");
  }, [addToast]);

  // ═══ AUTO-REJOIN ON PAGE RELOAD ═══════════════════════════════════
  // If sessionStorage has a persisted session, try to rejoin the room.
  // If the room no longer exists on the server, clear the stale session.
  useEffect(() => {
    let cancelled = false; // guard against React strict-mode double-mount
    const saved = getPersistedSession();
    if (!saved?.roomCode || !saved?.myName || !saved?.role) return;

    console.log("[Duo] Persisted session found, attempting rejoin…");

    (async () => {
      try {
        const res = await emitAsync<{
          ok: boolean;
          room?: any;
          error?: string;
        }>("duo:rejoin-room", {
          code: saved.roomCode,
          name: saved.myName,
          role: saved.role,
        });

        if (cancelled) return;

        if (res.ok && res.room) {
          console.log("[Duo] Rejoin successful");
          store.getState().setSessionState(res.room);
        } else {
          console.log("[Duo] Rejoin failed:", res.error);
          store.getState().fullReset();
          disconnectSocket(); // clean up so socket is fresh for next attempt
        }
      } catch {
        if (cancelled) return;
        console.log("[Duo] Rejoin timed out, clearing stale session");
        store.getState().fullReset();
        disconnectSocket(); // clean up so socket is fresh for next attempt
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line

  // ═══ SOCKET EVENT LISTENERS ═══════════════════════════════════════
  useEffect(() => {
    const socket = getSocket();

    // On reconnect → rejoin room automatically
    const onReconnect = () => {
      // Only rejoin if we have an active session
      if (!store.getState().active) return;
      const saved = getPersistedSession();
      if (!saved?.roomCode || !saved?.myName || !saved?.role) return;

      console.log("[Duo] Socket reconnected → rejoining", saved.roomCode);
      socket.emit(
        "duo:rejoin-room",
        { code: saved.roomCode, name: saved.myName, role: saved.role },
        (res: any) => {
          if (res?.ok) {
            addToast("Reconnected to SoulLink!", "success");
            store.getState().setSessionState(res.room);
          }
        },
      );
    };

    // Host receives this when guest joins
    const onPartnerJoined = ({ name, room }: any) => {
      console.log("[Duo] ✅ Partner joined:", name);
      store.getState().partnerJoined({ name });
      addToast(`${name} joined SoulLink! 🎉`, "success");

      // Re-sync current song to the new partner
      if (store.getState().role === "host") {
        const cs = currentSongRef?.current;
        if (cs) {
          const q = queueRef?.current;
          const audio = audioRef.current;
          setTimeout(() => {
            getSocket().emit("duo:sync-song-change", {
              song: cs,
              queue: q?.length ? q : [cs],
              queueIndex: q?.length
                ? Math.max(
                    q.findIndex((s: any) => s.id === cs.id),
                    0,
                  )
                : 0,
            });
            if (audio && !audio.paused) {
              getSocket().emit("duo:sync-play", {
                currentTime: audio.currentTime,
                songId: cs.id,
              });
            }
          }, 500);
        }
      }
    };

    const onPartnerDisconnected = () => {
      store.getState().partnerDisconnected();
      addToast("Partner disconnected — they can rejoin", "info");
    };

    const onPartnerReconnected = ({ name }: any) => {
      store.getState().partnerReconnected({ name });
      addToast(`${name} reconnected! 🎉`, "success");

      // Re-sync song on reconnection
      if (store.getState().role === "host") {
        const cs = currentSongRef?.current;
        if (cs) {
          const q = queueRef?.current;
          const audio = audioRef.current;
          setTimeout(() => {
            getSocket().emit("duo:sync-song-change", {
              song: cs,
              queue: q?.length ? q : [cs],
              queueIndex: q?.length
                ? Math.max(
                    q.findIndex((s: any) => s.id === cs.id),
                    0,
                  )
                : 0,
            });
            if (audio && !audio.paused) {
              getSocket().emit("duo:sync-play", {
                currentTime: audio.currentTime,
                songId: cs.id,
              });
            }
          }, 500);
        }
      }
    };

    const onPartnerActive = () => {
      store.getState().updateHeartbeat();
    };

    const onReceivePlay = ({ currentTime: ct }: any) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (Math.abs(audio.currentTime - ct) > 2) audio.currentTime = ct;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    };

    const onReceivePause = ({ currentTime: ct }: any) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = ct;
      setCurrentTime(ct);
      setIsPlaying(false);
    };

    const onReceiveSeek = ({ currentTime: ct }: any) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = ct;
      setCurrentTime(ct);
    };

    const onReceiveSongChange = ({ song, queue }: any) => {
      if (song) playSongRef.current?.(song, queue || [song], true);
    };

    const onReceiveMessage = (msg: any) => {
      store.getState().addMessage(msg);
    };

    const onSessionEnded = ({ songHistory }: any) => {
      store.getState().endSession(songHistory);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      setTimeout(() => disconnectSocket(), 300);
      addToast("SoulLink ended by partner", "info");
    };

    socket.on("connect", onReconnect);
    socket.on("duo:partner-joined", onPartnerJoined);
    socket.on("duo:partner-disconnected", onPartnerDisconnected);
    socket.on("duo:partner-reconnected", onPartnerReconnected);
    socket.on("duo:partner-active", onPartnerActive);
    socket.on("duo:receive-play", onReceivePlay);
    socket.on("duo:receive-pause", onReceivePause);
    socket.on("duo:receive-seek", onReceiveSeek);
    socket.on("duo:receive-song-change", onReceiveSongChange);
    socket.on("duo:receive-message", onReceiveMessage);
    socket.on("duo:session-ended", onSessionEnded);

    return () => {
      socket.off("connect", onReconnect);
      socket.off("duo:partner-joined", onPartnerJoined);
      socket.off("duo:partner-disconnected", onPartnerDisconnected);
      socket.off("duo:partner-reconnected", onPartnerReconnected);
      socket.off("duo:partner-active", onPartnerActive);
      socket.off("duo:receive-play", onReceivePlay);
      socket.off("duo:receive-pause", onReceivePause);
      socket.off("duo:receive-seek", onReceiveSeek);
      socket.off("duo:receive-song-change", onReceiveSongChange);
      socket.off("duo:receive-message", onReceiveMessage);
      socket.off("duo:session-ended", onSessionEnded);
    };
  }, [
    playSongRef,
    audioRef,
    setIsPlaying,
    setCurrentTime,
    addToast,
    currentSongRef,
    queueRef,
  ]);

  // ═══ HEARTBEAT ════════════════════════════════════════════════════
  useEffect(() => {
    const unsub = store.subscribe((state, prev) => {
      if (state.active && !prev.active) {
        heartbeatRef.current = setInterval(() => {
          if (useDuoStore.getState().active) {
            getSocket().emit("duo:heartbeat");
          }
        }, 5000);
      }
      if (!state.active && prev.active && heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    });
    return unsub;
  }, []);

  return {
    createSession,
    joinSession,
    syncPlay,
    syncPause,
    syncSeek,
    syncSongChange,
    sendMessage,
    endSession,
  };
}
