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
  "https://soulsync-backend-a5fs.onrender.com";

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

  const createSession = useCallback(
    async (hostName: string) => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (isNative()) {
          const tk = getNativeToken();
          if (tk) headers["Authorization"] = `Bearer ${tk}`;
        }
        const res = await fetch(`${BACKEND_URL}/api/session/create`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ hostName }),
        });
        const data = await res.json();
        if (data.error) {
          addToast(data.error, "error");
          return null;
        }

        console.log("[Duo] Session created, code:", data.code);

        store.getState().startSession({
          role: "host",
          roomCode: data.code,
          myName: hostName,
        });

        // Connect + join room (waitForConnection ensures socket is live)
        try {
          const socket = await waitForConnection();
          console.log("[Duo] Socket ready, emitting duo:join as host");
          socket.emit("duo:join", {
            code: data.code,
            name: hostName,
            role: "host",
          });

          const cs = currentSongRef?.current;
          if (cs) {
            const q = queueRef?.current;
            socket.emit("duo:sync-song-change", {
              song: cs,
              queue: q?.length ? q : [cs],
              queueIndex: q?.length
                ? Math.max(
                    q.findIndex((s) => s.id === cs.id),
                    0,
                  )
                : 0,
            });
          }
        } catch (sockErr) {
          console.warn("[Duo] Socket connection failed:", sockErr);
          addToast("Socket connection failed — try again", "error");
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

  const joinSession = useCallback(
    async (code: string, guestName: string) => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (isNative()) {
          const tk = getNativeToken();
          if (tk) headers["Authorization"] = `Bearer ${tk}`;
        }
        const res = await fetch(`${BACKEND_URL}/api/session/join`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ code, guestName }),
        });
        const data = await res.json();
        if (data.error) {
          addToast(data.error, "error");
          return false;
        }

        console.log("[Duo] Joining session, code:", code.toUpperCase());

        store.getState().startSession({
          role: "guest",
          roomCode: code.toUpperCase(),
          myName: guestName,
        });

        try {
          const socket = await waitForConnection();
          console.log("[Duo] Socket ready, emitting duo:join as guest");
          socket.emit("duo:join", {
            code: code.toUpperCase(),
            name: guestName,
            role: "guest",
          });
        } catch (sockErr) {
          console.warn("[Duo] Socket connection failed:", sockErr);
          addToast("Socket connection failed — try again", "error");
        }

        addToast("Joined SoulLink session! 🎧", "success");
        return true;
      } catch {
        addToast("Failed to join SoulLink session", "error");
        return false;
      }
    },
    [addToast],
  );

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

  const endSession = useCallback(() => {
    if (!store.getState().active) return;
    getSocket().emit("duo:end-session");
    store.getState().endSession();
    disconnectSocket();
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    addToast("SoulLink session ended", "info");
  }, [addToast]);

  // Auto-rejoin after page reload — just connect, the connect handler below handles the join
  useEffect(() => {
    const saved = getPersistedSession();
    if (saved?.roomCode && saved?.myName && saved?.role) {
      console.log("[Duo] Found persisted session, reconnecting…", saved.roomCode);
      connectSocket();
    }
  }, []); // eslint-disable-line

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();

    // Rejoin room on every connect (initial + reconnect)
    const onReconnect = () => {
      const saved = getPersistedSession();
      if (saved?.roomCode && saved?.myName && saved?.role) {
        console.log("[Duo] Socket connected/reconnected → joining room", saved.roomCode);
        socket.emit("duo:join", {
          code: saved.roomCode,
          name: saved.myName,
          role: saved.role,
        });
        addToast("Reconnected to SoulLink!", "success");
      }
    };

    const onPartnerJoined = ({ name, role: _role, room }: any) => {
      console.log("[Duo] ✅ Partner joined:", name, "room:", room);
      store.getState().partnerJoined({ name });
      store.getState().setSessionState(room);
      addToast(`${name} joined SoulLink! 🎉`, "success");

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
          }, 500);
        }
      }
    };

    const onPartnerActive = () => {
      store.getState().updateHeartbeat();
    };

    const onSessionState = ({ room }: any) => {
      console.log("[Duo] Session state received:", {
        hostConnected: room?.host?.connected,
        guestConnected: room?.guest?.connected,
        hostName: room?.host?.name,
        guestName: room?.guest?.name,
      });
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

    const onReceiveSongChange = ({ song, queue, queueIndex: _qi }: any) => {
      if (song) playSongRef.current?.(song, queue || [song], true);
    };

    const onReceiveMessage = ({ text, from, fromName, at }: any) => {
      store.getState().addMessage({ text, from, fromName, at });
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

  // Heartbeat
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
