/**
 * Lock-screen / notification media controls wrapper.
 * Uses the browser MediaSession API on web, and
 * @capacitor/local-notifications on native as a basic implementation.
 */
import { isNative } from "../utils/platform";
import { bestImg, getArtists } from "../lib/helpers";

interface MediaCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

let _callbacks: MediaCallbacks | null = null;

/**
 * Register playback action handlers (call once from AppLayout).
 */
export function registerMediaControls(callbacks: MediaCallbacks) {
  _callbacks = callbacks;

  if (!isNative() && "mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", callbacks.onPlay);
    navigator.mediaSession.setActionHandler("pause", callbacks.onPause);
    navigator.mediaSession.setActionHandler("nexttrack", callbacks.onNext);
    navigator.mediaSession.setActionHandler("previoustrack", callbacks.onPrev);
  }
}

/**
 * Update the now-playing metadata shown on the lock screen / notification.
 */
export function updateMediaMetadata(song: any, isPlaying: boolean) {
  if (!song) return;

  // Web MediaSession
  if (!isNative() && "mediaSession" in navigator) {
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
 * Clear media session metadata.
 */
export function clearMediaMetadata() {
  if (!isNative() && "mediaSession" in navigator) {
    navigator.mediaSession.metadata = null;
  }
}
