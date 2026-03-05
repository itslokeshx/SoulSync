import { useEffect, useRef, useCallback } from "react";
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  waitForConnection,
} from "./socket";
import { useDuoStore, getPersistedSession } from "./duoStore";
import { getNativeToken } from "../api/backend";
import { isNative } from "../utils/platform";

const BACKEND_URL =
  import.meta.env.VITE_DUO_BACKEND ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:4000";

/** Fetch helper that includes auth for both web (cookies) and native (Bearer token) */
function duoFetch(path: string, body: Record<string, unknown>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (isNative()) {
    const token = getNativeToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });
}

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
  const createSession = useCallback(
    async (hostName: string): Promise<string | null> => {
      try {
        const res = await duoFetch("/api/session/create", { hostName });
        const data = await res.json();
        if (!res.ok || data.error) {
          addToast(data.error || "Failed to create session", "error");
          return null;
        }

        // Set store FIRST so role is ready for socket event handlers
        store.getState().startSession({
          role: "host",
          roomCode: data.code,
          myName: hostName,
        });

        // Wait for socket to actually connect before emitting
        console.log("[Duo] Connecting socket for host…");
        const socket = await waitForConnection();
        console.log("[Duo] Socket connected, emitting duo:join as host");

        socket.emit("duo:join", {
          code: data.code,
          name: hostName,
          role: "host",
        });

        // Sync current song to the room so guest gets it on join
        const cs = currentSongRef?.current;
        if (cs) {
          const q = queueRef?.current;
          socket.emit("duo:sync-song-change", {
            song: cs,
            queue: q?.length ? q : [cs],
            queueIndex: q?.length
              ? Math.max(
                  q.findIndex((s: any) => s.id === cs.id),
                  0,
                )
              : 0,
          });
        }

        addToast(`SoulLink room created! Code: ${data.code}`, "success", 5000);
        return data.code;
      } catch {
        addToast("Failed to create SoulLink session", "error");
        return null;
      }
    },
    [addToast, currentSongRef, queueRef],
  );

  // ═══ JOIN SESSION ══════════════════════════════════════════════════
  const joinSession = useCallback(
    async (code: string, guestName: string): Promise<boolean> => {
      try {
        const res = await duoFetch("/api/session/join", {
          code,
          guestName,
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          addToast(data.error || "Failed to join session", "error");
          return false;
        }

        // Set store FIRST so role is ready for socket event handlers
        store.getState().startSession({
          role: "guest",
          roomCode: code.toUpperCase(),
          myName: guestName,
        });

        // Extract host name from HTTP response and mark partner connected
        const hostName = data.session?.host?.name;
        if (hostName) {
          store.getState().partnerJoined({ name: hostName });
        }

        // Wait for socket to actually connect before emitting
        console.log("[Duo] Connecting socket for guest…");
        const socket = await waitForConnection();
        console.log("[Duo] Socket connected, emitting duo:join as guest");

        socket.emit("duo:join", {
          code: code.toUpperCase(),
          name: guestName,
          role: "guest",
        });

        addToast("Joined SoulLink session! 🎧", "success");
        return true;
      } catch {
        addToast("Failed to join SoulLink session", "error");
        return false;
      }
    },
    [addToast],
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
    disconnectSocket();
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    addToast("SoulLink session ended", "info");
  }, [addToast]);

  // ═══ AUTO-REJOIN ON PAGE RELOAD ═══════════════════════════════════
  useEffect(() => {
    const saved = getPersistedSession();
    if (saved?.roomCode && saved?.myName && saved?.role) {
      console.log("[Duo] Persisted session found, rejoining…", saved.roomCode);
      addToast("Reconnecting to SoulLink…", "info");
      waitForConnection()
        .then((socket) => {
          console.log("[Duo] Reconnected, emitting duo:join");
          socket.emit("duo:join", {
            code: saved.roomCode,
            name: saved.myName,
            role: saved.role,
          });
        })
        .catch(() => {
          console.warn("[Duo] Rejoin failed — clearing stale session");
          store.getState().fullReset();
        });
    }
  }, []); // eslint-disable-line

  // ═══ SOCKET EVENT LISTENERS ═══════════════════════════════════════
  useEffect(() => {
    const socket = getSocket();

    // Auto-rejoin room on socket reconnect (network drop / server restart)
    const onReconnect = () => {
      const saved = getPersistedSession();
      if (saved?.roomCode && saved?.myName && saved?.role) {
        console.log("[Duo] Socket reconnected, rejoining room", saved.roomCode);
        socket.emit("duo:join", {
          code: saved.roomCode,
          name: saved.myName,
          role: saved.role,
        });
        addToast("Reconnected to SoulLink!", "success");
      }
    };

    const onPartnerJoined = ({ name, room }: any) => {
      store.getState().partnerJoined({ name });
      if (room) store.getState().setSessionState(room);
      addToast(`${name} joined SoulLink! 🎉`, "success");

      // If we're host, resync the current song
      if (store.getState().role === "host") {
        const cs = currentSongRef?.current;
        if (cs) {
          const q = queueRef?.current;
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
            const audio = audioRef.current;
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
      addToast("Your partner disconnected — they can rejoin", "info");
    };

    const onPartnerReconnected = ({ name }: any) => {
      store.getState().partnerReconnected({ name });
      addToast(`${name} reconnected! 🎉`, "success");

      // If we're host, resync the current song
      if (store.getState().role === "host") {
        const cs = currentSongRef?.current;
        if (cs) {
          const q = queueRef?.current;
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
            const audio = audioRef.current;
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

    const onSessionState = ({ room }: any) => {
      store.getState().setSessionState(room);
      if (room.currentSong) {
        playSongRef.current?.(room.currentSong, [room.currentSong], true);
      }
    };

    const onReceivePlay = ({ currentTime: ct }: any) => {
      const audio = audioRef.current;
      if (audio) {
        if (Math.abs(audio.currentTime - ct) > 2) audio.currentTime = ct;
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    };

    const onReceivePause = ({ currentTime: ct }: any) => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = ct;
        setCurrentTime(ct);
        setIsPlaying(false);
      }
    };

    const onReceiveSeek = ({ currentTime: ct }: any) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = ct;
        setCurrentTime(ct);
      }
    };

    const onReceiveSongChange = ({ song, queue }: any) => {
      if (song) playSongRef.current?.(song, queue || [song], true);
    };

    const onReceiveMessage = (msg: any) => {
      store.getState().addMessage(msg);
    };

    const onSessionEnded = ({ songHistory }: any) => {
      store.getState().endSession(songHistory);
      disconnectSocket();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      addToast("SoulLink ended by partner", "info");
    };

    const onError = ({ message }: any) => {
      addToast(message || "SoulLink error", "error");
    };

    socket.on("connect", onReconnect);
    socket.on("duo:partner-joined", onPartnerJoined);
    socket.on("duo:partner-disconnected", onPartnerDisconnected);
    socket.on("duo:partner-reconnected", onPartnerReconnected);
    socket.on("duo:partner-active", onPartnerActive);
    socket.on("duo:session-state", onSessionState);
    socket.on("duo:receive-play", onReceivePlay);
    socket.on("duo:receive-pause", onReceivePause);
    socket.on("duo:receive-seek", onReceiveSeek);
    socket.on("duo:receive-song-change", onReceiveSongChange);
    socket.on("duo:receive-message", onReceiveMessage);
    socket.on("duo:session-ended", onSessionEnded);
    socket.on("duo:error", onError);

    return () => {
      socket.off("connect", onReconnect);
      socket.off("duo:partner-joined", onPartnerJoined);
      socket.off("duo:partner-disconnected", onPartnerDisconnected);
      socket.off("duo:partner-reconnected", onPartnerReconnected);
      socket.off("duo:partner-active", onPartnerActive);
      socket.off("duo:session-state", onSessionState);
      socket.off("duo:receive-play", onReceivePlay);
      socket.off("duo:receive-pause", onReceivePause);
      socket.off("duo:receive-seek", onReceiveSeek);
      socket.off("duo:receive-song-change", onReceiveSongChange);
      socket.off("duo:receive-message", onReceiveMessage);
      socket.off("duo:session-ended", onSessionEnded);
      socket.off("duo:error", onError);
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
          const code = useDuoStore.getState().roomCode;
          if (code) getSocket().emit("duo:heartbeat", { code });
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
