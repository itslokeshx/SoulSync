/**
 * Media controls — lock screen + notification bar.
 *
 * On native Android: uses the custom MusicControls Capacitor plugin which
 * runs a foreground MediaPlaybackService with proper MediaSession so the
 * notification appears with album art, play/pause/next/prev buttons,
 * seek bar, and shows on the lock screen.
 *
 * On web: uses the standard MediaSession API.
 */
import { bestImg, getArtists } from "../lib/helpers";
import { isNative } from "../utils/platform";
import { registerPlugin } from "@capacitor/core";

// ── Native plugin interface ─────────────────────────────────────────────

interface MusicControlsPluginType {
  updateNotification(opts: {
    title: string;
    artist: string;
    albumArt: string;
    isPlaying: boolean;
    duration: number;
    position: number;
  }): Promise<void>;
  dismissNotification(): Promise<void>;
  addListener(
    event: "controlsAction",
    handler: (data: { action: string; seekTime?: number }) => void,
  ): Promise<{ remove: () => void }>;
}

const NativeMusicControls =
  registerPlugin<MusicControlsPluginType>("MusicControls");

// ── Callbacks ───────────────────────────────────────────────────────────

interface MediaCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek?: (time: number) => void;
}

let _callbacks: MediaCallbacks | null = null;
let _nativeListenerRegistered = false;

/**
 * Register playback action handlers (call once from AppLayout).
 */
export function registerMediaControls(callbacks: MediaCallbacks) {
  _callbacks = callbacks;

  // ── Web: MediaSession API ──────────────────────────────────────────
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", callbacks.onPlay);
    navigator.mediaSession.setActionHandler("pause", callbacks.onPause);
    navigator.mediaSession.setActionHandler("nexttrack", callbacks.onNext);
    navigator.mediaSession.setActionHandler("previoustrack", callbacks.onPrev);

    try {
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null && callbacks.onSeek) {
          callbacks.onSeek(details.seekTime);
        }
      });
    } catch {
      /* seekto not supported */
    }

    try {
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const offset = details.seekOffset || 10;
        callbacks.onSeek?.(
          Math.max(
            0,
            (document.querySelector("audio") as HTMLAudioElement)?.currentTime -
              offset,
          ),
        );
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const offset = details.seekOffset || 10;
        const audio = document.querySelector("audio") as HTMLAudioElement;
        if (audio)
          callbacks.onSeek?.(
            Math.min(audio.duration || 0, audio.currentTime + offset),
          );
      });
    } catch {
      /* seekbackward/seekforward not supported */
    }
  }

  // ── Native: Register listener for service → JS events ──────────────
  if (isNative() && !_nativeListenerRegistered) {
    _nativeListenerRegistered = true;
    NativeMusicControls.addListener("controlsAction", (data) => {
      if (!_callbacks) return;
      switch (data.action) {
        case "play":
          _callbacks.onPlay();
          break;
        case "pause":
          _callbacks.onPause();
          break;
        case "next":
          _callbacks.onNext();
          break;
        case "prev":
          _callbacks.onPrev();
          break;
        case "seek":
          if (data.seekTime != null) _callbacks.onSeek?.(data.seekTime);
          break;
        case "stop":
          _callbacks.onPause();
          break;
      }
    });
  }
}

// ── Track current state for native position updates ─────────────────────

let _positionTimer: ReturnType<typeof setInterval> | null = null;
let _lastSong: any = null;
let _lastIsPlaying = false;

/**
 * Update the now-playing metadata shown on the lock screen / notification.
 */
export function updateMediaMetadata(song: any, isPlaying: boolean) {
  if (!song) return;

  _lastSong = song;
  _lastIsPlaying = isPlaying;

  // ── Web: MediaSession API ──
  if ("mediaSession" in navigator) {
    const artwork: MediaImage[] = [];
    const img150 = bestImg(song.image, "150x150");
    const img500 = bestImg(song.image, "500x500");
    if (img150)
      artwork.push({ src: img150, sizes: "150x150", type: "image/jpeg" });
    if (img500)
      artwork.push({ src: img500, sizes: "500x500", type: "image/jpeg" });

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name || "Unknown",
      artist: getArtists(song) || "Unknown",
      album: song.album?.name || "",
      artwork,
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }

  // ── Native: Update the foreground service notification ──
  if (isNative()) {
    const audio = document.querySelector("audio") as HTMLAudioElement;
    NativeMusicControls.updateNotification({
      title: song.name || "Unknown",
      artist: getArtists(song) || "Unknown",
      albumArt: bestImg(song.image, "500x500") || "",
      isPlaying,
      duration: audio?.duration || Number(song.duration) || 0,
      position: audio?.currentTime || 0,
    }).catch(() => {});
  }
}

/**
 * Update playback position state for the notification seek bar.
 * Call this on timeupdate / seek / play / pause.
 */
export function updatePositionState(
  position: number,
  duration: number,
  playbackRate = 1,
) {
  // ── Web ──
  if ("mediaSession" in navigator && navigator.mediaSession.setPositionState) {
    try {
      if (duration && isFinite(duration) && duration > 0) {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position: Math.min(position, duration),
        });
      }
    } catch {
      /* position state not supported */
    }
  }

  // ── Native: Throttled position updates to the notification ──
  if (isNative() && duration > 0 && !_positionTimer) {
    _positionTimer = setInterval(() => {
      if (!_lastSong) return;
      const audio = document.querySelector("audio") as HTMLAudioElement;
      if (!audio) return;
      NativeMusicControls.updateNotification({
        title: _lastSong.name || "Unknown",
        artist: getArtists(_lastSong) || "Unknown",
        albumArt: bestImg(_lastSong.image, "500x500") || "",
        isPlaying: _lastIsPlaying,
        duration: audio.duration || 0,
        position: audio.currentTime || 0,
      }).catch(() => {});
    }, 5000);
  }
}

/**
 * Clear media session metadata and dismiss native notification.
 */
export function clearMediaMetadata() {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = null;
    try {
      navigator.mediaSession.setPositionState();
    } catch {}
  }

  if (isNative()) {
    NativeMusicControls.dismissNotification().catch(() => {});
  }

  if (_positionTimer) {
    clearInterval(_positionTimer);
    _positionTimer = null;
  }

  _lastSong = null;
  _lastIsPlaying = false;
}
