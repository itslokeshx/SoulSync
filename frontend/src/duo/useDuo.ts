/* @refresh reset */
import { useEffect, useRef, useCallback } from "react";
import {
  disconnectSocket,
  getSocket,
  waitForConnection,
  registerDuoCallback,
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
          hasConnectedOnceRef.current = false;
        });
    }
  }, []); // eslint-disable-line

  // ═══ SOCKET EVENT LISTENERS (callback bridge) ═════════════════════
  // Instead of attaching listeners to a socket instance (which breaks
  // when the singleton is recreated by HMR or disconnectSocket), we
  // register a single callback in socket.ts that forwards ALL events.
  // The callback uses callbackRefs for fresh closure values.
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
    const handleEvent = (event: string, data?: any) => {
      switch (event) {
        // ── Socket connected (first connect or reconnect) ──────
        case "connect": {
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
            getSocket().emit("duo:join", {
              code: saved.roomCode,
              name: saved.myName,
              role: saved.role,
            });
            if (isReconnect) {
              callbackRefs.current.addToast(
                "Reconnected to SoulLink!",
                "success",
              );
            }
          }
          break;
        }

        // ── Partner joined ─────────────────────────────────────
        case "duo:partner-joined": {
          const { name, role: eventRole, room } = data || {};
          const state = store.getState();
          if (eventRole && eventRole === state.role) {
            console.log(
              `[Duo] duo:partner-joined for own role (${eventRole}), ignoring`,
            );
            break;
          }
          console.log(
            "[Duo] ✅ duo:partner-joined received:",
            name,
            "role:",
            eventRole,
          );

          const wasConnected =
            state.partnerConnected && state.partnerName === name;
          if (room) store.getState().setSessionState(room);
          store.getState().partnerJoined({ name });

          if (!wasConnected) {
            callbackRefs.current.addToast(
              `${name} joined SoulLink! 🎉`,
              "success",
            );
          }

          // If host, resync current song to partner
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
          break;
        }

        // ── Partner disconnected ───────────────────────────────
        case "duo:partner-disconnected": {
          store.getState().partnerDisconnected();
          callbackRefs.current.addToast(
            "Your partner disconnected — they can rejoin",
            "info",
          );
          break;
        }

        // ── Partner reconnected ────────────────────────────────
        case "duo:partner-reconnected": {
          const { name, role: eventRole } = data || {};
          const state = store.getState();
          if (eventRole && eventRole === state.role) break;

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
          break;
        }

        // ── Heartbeat ──────────────────────────────────────────
        case "duo:partner-active": {
          store.getState().updateHeartbeat();
          break;
        }

        // ── Session state (room snapshot) ──────────────────────
        case "duo:session-state": {
          const { room } = data || {};
          console.log(
            "[Duo] duo:session-state received → host:",
            room?.host?.name,
            "guest:",
            room?.guest?.name,
            "guestConnected:",
            room?.guest?.connected,
          );
          store.getState().setSessionState(room);

          // Safety net
          const state = store.getState();
          const isHost = state.role === "host";
          const partnerInRoom = isHost ? room?.guest : room?.host;
          if (
            partnerInRoom?.connected &&
            partnerInRoom?.name &&
            !state.partnerConnected
          ) {
            console.log(
              "[Duo] Safety-net: partner connected but store missed it →",
              partnerInRoom.name,
            );
            store.getState().partnerJoined({ name: partnerInRoom.name });
          }

          if (room?.currentSong) {
            callbackRefs.current.playSongRef.current?.(
              room.currentSong,
              [room.currentSong],
              true,
            );
          }
          break;
        }

        // ── Playback sync ──────────────────────────────────────
        case "duo:receive-play": {
          const audio = callbackRefs.current.audioRef.current;
          if (audio) {
            const ct = data?.currentTime;
            if (ct != null && Math.abs(audio.currentTime - ct) > 2)
              audio.currentTime = ct;
            audio
              .play()
              .then(() => callbackRefs.current.setIsPlaying(true))
              .catch(() => {});
          }
          break;
        }
        case "duo:receive-pause": {
          const audio = callbackRefs.current.audioRef.current;
          if (audio) {
            const ct = data?.currentTime;
            audio.pause();
            if (ct != null) {
              audio.currentTime = ct;
              callbackRefs.current.setCurrentTime(ct);
            }
            callbackRefs.current.setIsPlaying(false);
          }
          break;
        }
        case "duo:receive-seek": {
          const audio = callbackRefs.current.audioRef.current;
          if (audio && data?.currentTime != null) {
            audio.currentTime = data.currentTime;
            callbackRefs.current.setCurrentTime(data.currentTime);
          }
          break;
        }
        case "duo:receive-song-change": {
          if (data?.song) {
            callbackRefs.current.playSongRef.current?.(
              data.song,
              data.queue || [data.song],
              true,
            );
          }
          break;
        }

        // ── Messages ───────────────────────────────────────────
        case "duo:receive-message": {
          if (data) store.getState().addMessage(data);
          break;
        }

        // ── Session ended by partner ───────────────────────────
        case "duo:session-ended": {
          store.getState().endSession(data?.songHistory);
          disconnectSocket();
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
          hasConnectedOnceRef.current = false;
          callbackRefs.current.addToast("SoulLink ended by partner", "info");
          break;
        }

        // ── Errors ─────────────────────────────────────────────
        case "duo:error": {
          callbackRefs.current.addToast(
            data?.message || "SoulLink error",
            "error",
          );
          break;
        }
      }
    };

    console.log("[Duo] Registering duo event callback");
    registerDuoCallback(handleEvent);
    return () => registerDuoCallback(null);
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
