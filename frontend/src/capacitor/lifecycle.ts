/**
 * Background audio lifecycle — keeps music playing when the app is minimised.
 * The native MediaPlaybackService foreground service handles the persistent
 * notification with controls. This module just ensures the notification
 * state is fresh when switching between foreground/background.
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
 * The MediaPlaybackService is started/stopped from musicControls.ts
 * (updateMediaMetadata / clearMediaMetadata), so this just ensures
 * the notification is refreshed on app state changes.
 */
export async function initBackgroundAudio() {
  if (!isNative()) return;

  const { App } = await import("@capacitor/app");

  App.addListener("appStateChange", async ({ isActive }) => {
    const song = _currentSongGetter?.();
    const playing = _isPlayingGetter?.() ?? false;

    if (!isActive && song && playing) {
      // App went to background — the foreground service notification
      // is already running from musicControls.updateMediaMetadata().
      // Nothing extra needed; the service keeps music alive.
    } else if (isActive && !playing && !song) {
      // App came back and nothing is playing — dismiss notification
      try {
        const { clearMediaMetadata } = await import("./musicControls");
        clearMediaMetadata();
      } catch {}
    }
  });
}
