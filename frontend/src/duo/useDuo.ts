/* @refresh reset */
import { useEffect, useRef, useCallback } from "react";
import { disconnectSocket, getSocket, waitForConnection } from "./socket";
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
  const listenersAttachedRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
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

        // Start socket connection in background — don't block.
        // The onConnect handler emits duo:join when connected.
        console.log("[Duo] Starting socket connection for host…");
        waitForConnection()
          .then((sock) => {
            console.log("[Duo] Socket connected for host, id:", sock.id);
            // Emit duo:join directly as safety net
            sock.emit("duo:join", {
              code: data.code,
              name: hostName,
              role: "host",
            });
            // Sync current song to room so guest gets it on join
            const cs = currentSongRef?.current;
            if (cs) {
              const q = queueRef?.current;
              sock.emit("duo:sync-song-change", {
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
          })
          .catch((err) => {
            console.warn(
              "[Duo] Socket connection slow:",
              err.message,
              "— will auto-reconnect",
            );
          });

        addToast(`SoulLink room created! Code: ${data.code}`, "success", 5000);

        // Safety-net: poll room state a few times to catch missed partner-join events
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          pollCount++;
          const s = store.getState();
          if (s.partnerConnected || !s.active || pollCount >= 10) {
            clearInterval(pollInterval);
            return;
          }
          const pollSocket = getSocket();
          if (pollSocket.connected) {
            console.log(`[Duo] Polling room state (attempt ${pollCount})…`);
            pollSocket.emit("duo:request-state", { code: data.code });
          } else {
            console.log(
              `[Duo] Polling skipped (attempt ${pollCount}) — socket not connected`,
            );
          }
        }, 3000);

        return data.code;
      } catch (err) {
        console.error("[Duo] Create error:", err);
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

        // Start socket connection in background — don't block.
        // The onConnect handler emits duo:join when connected.
        console.log("[Duo] Starting socket connection for guest…");
        waitForConnection()
          .then((sock) => {
            console.log("[Duo] Socket connected for guest, id:", sock.id);
            // Emit duo:join directly as safety net
            sock.emit("duo:join", {
              code: code.toUpperCase(),
              name: guestName,
              role: "guest",
            });
          })
          .catch((err) => {
            console.warn(
              "[Duo] Socket connection slow:",
              err.message,
              "— will auto-reconnect",
            );
          });

        addToast("Joined SoulLink session! 🎧", "success");
        return true;
      } catch (err) {
        console.error("[Duo] Join error:", err);
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
    listenersAttachedRef.current = false;
    hasConnectedOnceRef.current = false;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    addToast("SoulLink session ended", "info");
  }, [addToast]);

  // ═══ AUTO-REJOIN ON PAGE RELOAD ═══════════════════════════════════
  // This must be idempotent — StrictMode will call it twice.
  const rejoinAttemptedRef = useRef(false);
  useEffect(() => {
    if (rejoinAttemptedRef.current) return; // already ran
    const saved = getPersistedSession();
    if (saved?.roomCode && saved?.myName && saved?.role) {
      rejoinAttemptedRef.current = true;
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
          // DON'T call disconnectSocket() here — it destroys the singleton
          // and its listeners, breaking any future session.
          // Just reset the ref so listeners re-attach for the next session.
          listenersAttachedRef.current = false;
          hasConnectedOnceRef.current = false;
        });
    }
  }, []); // eslint-disable-line

  // ═══ SOCKET EVENT LISTENERS ═══════════════════════════════════════
  // Attach listeners ONCE. Use a ref to guarantee idempotency across
  // React 18 StrictMode double-mount. Never remove them during the
  // component lifecycle — they must survive.
  //
  // We use refs for callbacks that need fresh closure values so the
  // listener wiring doesn't depend on any deps array.
  const callbackRefs = useRef({
    addToast,
    currentSongRef,
    queueRef,
    audioRef,
    playSongRef,
    setIsPlaying,
    setCurrentTime,
  });
  useEffect(() => {
    callbackRefs.current = {
      addToast,
      currentSongRef,
      queueRef,
      audioRef,
      playSongRef,
      setIsPlaying,
      setCurrentTime,
    };
  });

  useEffect(() => {
    // If listeners are already attached from a prior mount, skip.
    if (listenersAttachedRef.current) {
      console.log("[Duo] Listeners already attached, skipping re-attach");
      return;
    }
    listenersAttachedRef.current = true;

    const socket = getSocket();
    console.log("[Duo] Attaching socket event listeners (once)");

    // Join room on every socket connect (first connect & reconnects)
    const onConnect = () => {
      const saved = getPersistedSession();
      if (
        saved?.roomCode &&
        saved?.myName &&
        saved?.role &&
        store.getState().active
      ) {
        const isReconnect = hasConnectedOnceRef.current;
        hasConnectedOnceRef.current = true;
        console.log(
          `[Duo] Socket ${isReconnect ? "re" : ""}connected, joining room`,
          saved.roomCode,
        );
        socket.emit("duo:join", {
          code: saved.roomCode,
          name: saved.myName,
          role: saved.role,
        });
        if (isReconnect) {
          callbackRefs.current.addToast("Reconnected to SoulLink!", "success");
        }
      }
    };

    const onPartnerJoined = ({ name, role: eventRole, room }: any) => {
      const state = store.getState();
      // Ignore events about our own role (e.g. host told about host)
      if (eventRole && eventRole === state.role) {
        console.log(
          `[Duo] duo:partner-joined for own role (${eventRole}), ignoring`,
        );
        return;
      }
      console.log(
        "[Duo] ✅ duo:partner-joined received:",
        name,
        "role:",
        eventRole,
      );

      // Dedup: only toast if partner wasn't already connected with this name
      const wasConnected = state.partnerConnected && state.partnerName === name;

      // Apply room state first, then explicitly mark partner joined
      if (room) store.getState().setSessionState(room);
      store.getState().partnerJoined({ name });

      if (!wasConnected) {
        callbackRefs.current.addToast(`${name} joined SoulLink! 🎉`, "success");
      }

      // If we're host, resync the current song
      if (store.getState().role === "host") {
        const cs = callbackRefs.current.currentSongRef?.current;
        if (cs) {
          const q = callbackRefs.current.queueRef?.current;
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
            const audio = callbackRefs.current.audioRef.current;
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
      callbackRefs.current.addToast(
        "Your partner disconnected — they can rejoin",
        "info",
      );
    };

    const onPartnerReconnected = ({ name, role: eventRole }: any) => {
      const state = store.getState();
      if (eventRole && eventRole === state.role) return;

      store.getState().partnerReconnected({ name });

      if (!state.partnerConnected || state.partnerName !== name) {
        callbackRefs.current.addToast(`${name} reconnected! 🎉`, "success");
      }

      if (store.getState().role === "host") {
        const cs = callbackRefs.current.currentSongRef?.current;
        if (cs) {
          const q = callbackRefs.current.queueRef?.current;
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
            const audio = callbackRefs.current.audioRef.current;
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
      console.log(
        "[Duo] duo:session-state received → host:",
        room?.host?.name,
        "guest:",
        room?.guest?.name,
        "guestConnected:",
        room?.guest?.connected,
      );
      store.getState().setSessionState(room);

      // Safety net: if the room shows a connected partner but the store
      // doesn't reflect it, explicitly trigger partnerJoined
      const state = store.getState();
      const isHost = state.role === "host";
      const partnerInRoom = isHost ? room?.guest : room?.host;
      if (
        partnerInRoom?.connected &&
        partnerInRoom?.name &&
        !state.partnerConnected
      ) {
        console.log(
          "[Duo] Safety-net: partner is connected but store missed it →",
          partnerInRoom.name,
        );
        store.getState().partnerJoined({ name: partnerInRoom.name });
      }

      if (room.currentSong) {
        callbackRefs.current.playSongRef.current?.(
          room.currentSong,
          [room.currentSong],
          true,
        );
      }
    };

    const onReceivePlay = ({ currentTime: ct }: any) => {
      const audio = callbackRefs.current.audioRef.current;
      if (audio) {
        if (Math.abs(audio.currentTime - ct) > 2) audio.currentTime = ct;
        audio
          .play()
          .then(() => callbackRefs.current.setIsPlaying(true))
          .catch(() => {});
      }
    };

    const onReceivePause = ({ currentTime: ct }: any) => {
      const audio = callbackRefs.current.audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = ct;
        callbackRefs.current.setCurrentTime(ct);
        callbackRefs.current.setIsPlaying(false);
      }
    };

    const onReceiveSeek = ({ currentTime: ct }: any) => {
      const audio = callbackRefs.current.audioRef.current;
      if (audio) {
        audio.currentTime = ct;
        callbackRefs.current.setCurrentTime(ct);
      }
    };

    const onReceiveSongChange = ({ song, queue }: any) => {
      if (song)
        callbackRefs.current.playSongRef.current?.(song, queue || [song], true);
    };

    const onReceiveMessage = (msg: any) => {
      store.getState().addMessage(msg);
    };

    const onSessionEnded = ({ songHistory }: any) => {
      store.getState().endSession(songHistory);
      disconnectSocket();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      listenersAttachedRef.current = false;
      hasConnectedOnceRef.current = false;
      callbackRefs.current.addToast("SoulLink ended by partner", "info");
    };

    const onError = ({ message }: any) => {
      callbackRefs.current.addToast(message || "SoulLink error", "error");
    };

    socket.on("connect", onConnect);
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

    // NO CLEANUP — these listeners must survive StrictMode double-mount.
    // They are cleaned up by disconnectSocket() when the session ends.
  }, []); // eslint-disable-line

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
