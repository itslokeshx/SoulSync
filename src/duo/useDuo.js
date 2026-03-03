// ─────────────────────────────────────────────────────────────────────────────
// useDuo Hook — Socket.io event wiring for Duo Live Sync
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from "react";
import { connectSocket, disconnectSocket, getSocket } from "./socket.js";
import { useDuoStore } from "./duoStore.js";

const BACKEND_URL = import.meta.env.VITE_DUO_BACKEND || "http://localhost:4000";

/**
 * useDuo — call once in App component.
 * Returns actions that playback controls can invoke to sync with partner.
 *
 * @param {Object} opts
 * @param {React.RefObject} opts.playSongRef — ref to playSong function (avoids circular deps)
 * @param {React.RefObject} opts.audioRef
 * @param {Function} opts.setIsPlaying
 * @param {Function} opts.setCurrentTime
 * @param {Function} opts.addToast
 */
export function useDuo({
  playSongRef,
  audioRef,
  setIsPlaying,
  setCurrentTime,
  addToast,
}) {
  const heartbeatRef = useRef(null);
  const store = useDuoStore;

  // ── Create Session (REST + Socket) ──
  const createSession = useCallback(
    async (hostName) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/session/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostName }),
        });
        const data = await res.json();
        if (data.error) {
          addToast(data.error, "error");
          return null;
        }

        const socket = connectSocket();
        socket.emit("duo:join", {
          code: data.code,
          name: hostName,
          role: "host",
        });

        store.getState().startSession({
          role: "host",
          roomCode: data.code,
          myName: hostName,
        });

        addToast(`Duo room created! Code: ${data.code}`, "success", 5000);
        return data.code;
      } catch (err) {
        addToast("Failed to create Duo session", "error");
        return null;
      }
    },
    [addToast],
  );

  // ── Join Session (REST + Socket) ──
  const joinSession = useCallback(
    async (code, guestName) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/session/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, guestName }),
        });
        const data = await res.json();
        if (data.error) {
          addToast(data.error, "error");
          return false;
        }

        const socket = connectSocket();
        socket.emit("duo:join", {
          code: code.toUpperCase(),
          name: guestName,
          role: "guest",
        });

        store.getState().startSession({
          role: "guest",
          roomCode: code.toUpperCase(),
          myName: guestName,
        });

        addToast("Joined Duo session! 🎧", "success");
        return true;
      } catch (err) {
        addToast("Failed to join Duo session", "error");
        return false;
      }
    },
    [addToast],
  );

  // ── Sync actions (called by playback controls) ──
  const syncPlay = useCallback((currentTime, songId) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:sync-play", { currentTime, songId });
  }, []);

  const syncPause = useCallback((currentTime) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:sync-pause", { currentTime });
  }, []);

  const syncSeek = useCallback((currentTime) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:sync-seek", { currentTime });
  }, []);

  const syncSongChange = useCallback((song, queue, queueIndex) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:sync-song-change", { song, queue, queueIndex });
  }, []);

  const sendReaction = useCallback((emoji) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:reaction", { emoji });
  }, []);

  const sendNote = useCallback((text) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:note", { text });
  }, []);

  const sendMoodMode = useCallback((mood) => {
    if (!store.getState().active) return;
    getSocket().emit("duo:mood-mode", { mood });
    store.getState().setMoodMode(mood);
  }, []);

  const endSession = useCallback(() => {
    if (!store.getState().active) return;
    getSocket().emit("duo:end-session");
    store.getState().endSession();
    disconnectSocket();
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    addToast("Duo session ended", "info");
  }, [addToast]);

  // ── Socket event listeners ──
  useEffect(() => {
    const socket = getSocket();

    const onPartnerJoined = ({ name, role, room }) => {
      store.getState().partnerJoined({ name });
      store.getState().setSessionState(room);
      addToast(`${name} joined the Duo! 🎉`, "success");
    };

    const onPartnerDisconnected = ({ who }) => {
      store.getState().partnerDisconnected();
      addToast("Your Duo partner disconnected", "info");
    };

    const onPartnerActive = ({ timestamp }) => {
      store.getState().updateHeartbeat();
    };

    const onSessionState = ({ room }) => {
      store.getState().setSessionState(room);
      // If there's a current song playing in the room, sync to it
      if (room.currentSong) {
        playSongRef.current?.(room.currentSong, [room.currentSong]);
      }
    };

    const onReceivePlay = ({ currentTime: ct }) => {
      const audio = audioRef.current;
      if (audio) {
        // Sync time if drift > 2 seconds
        if (Math.abs(audio.currentTime - ct) > 2) {
          audio.currentTime = ct;
        }
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      }
    };

    const onReceivePause = ({ currentTime: ct }) => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = ct;
        setCurrentTime(ct);
        setIsPlaying(false);
      }
    };

    const onReceiveSeek = ({ currentTime: ct }) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = ct;
        setCurrentTime(ct);
      }
    };

    const onReceiveSongChange = ({ song, queue, queueIndex }) => {
      if (song) {
        playSongRef.current?.(song, queue || [song]);
      }
    };

    const onReceiveReaction = ({ emoji, from }) => {
      store.getState().addReaction({ emoji, from, at: Date.now() });
    };

    const onReceiveNote = ({ text, from, at }) => {
      store.getState().addNote({ text, from, at });
      addToast(`💬 ${text}`, "info", 4000);
    };

    const onReceiveMoodMode = ({ mood }) => {
      store.getState().setMoodMode(mood);
      if (mood) addToast(`Mood switched to ${mood} 🎵`, "info");
    };

    const onSessionEnded = ({ songHistory }) => {
      store.getState().endSession(songHistory);
      disconnectSocket();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      addToast("Duo session ended by partner", "info");
    };

    const onError = ({ message }) => {
      addToast(message || "Duo error", "error");
    };

    socket.on("duo:partner-joined", onPartnerJoined);
    socket.on("duo:partner-disconnected", onPartnerDisconnected);
    socket.on("duo:partner-active", onPartnerActive);
    socket.on("duo:session-state", onSessionState);
    socket.on("duo:receive-play", onReceivePlay);
    socket.on("duo:receive-pause", onReceivePause);
    socket.on("duo:receive-seek", onReceiveSeek);
    socket.on("duo:receive-song-change", onReceiveSongChange);
    socket.on("duo:receive-reaction", onReceiveReaction);
    socket.on("duo:receive-note", onReceiveNote);
    socket.on("duo:receive-mood-mode", onReceiveMoodMode);
    socket.on("duo:session-ended", onSessionEnded);
    socket.on("duo:error", onError);

    return () => {
      socket.off("duo:partner-joined", onPartnerJoined);
      socket.off("duo:partner-disconnected", onPartnerDisconnected);
      socket.off("duo:partner-active", onPartnerActive);
      socket.off("duo:session-state", onSessionState);
      socket.off("duo:receive-play", onReceivePlay);
      socket.off("duo:receive-pause", onReceivePause);
      socket.off("duo:receive-seek", onReceiveSeek);
      socket.off("duo:receive-song-change", onReceiveSongChange);
      socket.off("duo:receive-reaction", onReceiveReaction);
      socket.off("duo:receive-note", onReceiveNote);
      socket.off("duo:receive-mood-mode", onReceiveMoodMode);
      socket.off("duo:session-ended", onSessionEnded);
      socket.off("duo:error", onError);
    };
  }, [playSongRef, audioRef, setIsPlaying, setCurrentTime, addToast]);

  // ── Heartbeat ──
  useEffect(() => {
    const unsub = store.subscribe((state, prev) => {
      if (state.active && !prev.active) {
        heartbeatRef.current = setInterval(() => {
          getSocket().emit("duo:heartbeat");
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
    sendReaction,
    sendNote,
    sendMoodMode,
    endSession,
  };
}
