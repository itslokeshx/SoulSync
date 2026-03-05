/**
 * Lock-screen / notification media controls wrapper.
 * Uses the browser MediaSession API on web, and
 * @capacitor/local-notifications on native as a basic implementation.
 */
import { bestImg, getArtists } from "../lib/helpers";

interface MediaCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek?: (time: number) => void;
}

let _callbacks: MediaCallbacks | null = null;

/**
 * Register playback action handlers (call once from AppLayout).
 */
export function registerMediaControls(callbacks: MediaCallbacks) {
  _callbacks = callbacks;

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", callbacks.onPlay);
    navigator.mediaSession.setActionHandler("pause", callbacks.onPause);
    navigator.mediaSession.setActionHandler("nexttrack", callbacks.onNext);
    navigator.mediaSession.setActionHandler("previoustrack", callbacks.onPrev);

    // Seek controls for notification / lock screen
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
}

/**
 * Update the now-playing metadata shown on the lock screen / notification.
 */
export function updateMediaMetadata(song: any, isPlaying: boolean) {
  if (!song) return;

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
}

/**
 * Clear media session metadata.
 */
export function clearMediaMetadata() {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = null;
    try {
      navigator.mediaSession.setPositionState();
    } catch {}
  }
}
