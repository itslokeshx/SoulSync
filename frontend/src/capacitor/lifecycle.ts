/**
 * Background audio lifecycle — keeps music playing when the app is minimised.
 * Shows a persistent "Now Playing" notification while in the background.
 */
import { isNative } from "../utils/platform";

let _currentSongGetter: (() => any) | null = null;
let _isPlayingGetter: (() => boolean) | null = null;

/**
 * Register getters so the lifecycle module can read the current player state
 * without circular-importing the player store.
 */
export function registerPlayerGetters(
  getCurrentSong: () => any,
  getIsPlaying: () => boolean,
) {
  _currentSongGetter = getCurrentSong;
  _isPlayingGetter = getIsPlaying;
}

/**
 * Call once from AppLayout after the audio element is wired up.
 */
export async function initBackgroundAudio() {
  if (!isNative()) return;

  const { App } = await import("@capacitor/app");
  const { showNowPlayingNotification, dismissNowPlayingNotification } =
    await import("./notifications");

  App.addListener("appStateChange", async ({ isActive }) => {
    const song = _currentSongGetter?.();
    const playing = _isPlayingGetter?.() ?? false;

    if (!isActive && song && playing) {
      // App went to background — show persistent notification
      await showNowPlayingNotification(song, playing);
    } else if (isActive) {
      // App came to foreground — dismiss notification
      await dismissNowPlayingNotification();
    }
  });
}
