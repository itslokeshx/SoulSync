/**
 * Capacitor bootstrap — call once from main.tsx on app start.
 * Initialises native plugins that need early setup.
 */
import { isNative } from "../utils/platform";

export async function initCapacitor() {
  if (!isNative()) return;

  // Lazy-import only on native to keep web bundle lean
  const [{ SplashScreen }, { StatusBar, Style }, { App }] = await Promise.all([
    import("@capacitor/splash-screen"),
    import("@capacitor/status-bar"),
    import("@capacitor/app"),
  ]);

  // ── Status bar ──────────────────────────────────────────────
  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#060606" });
  // Don't render the WebView under the status bar
  await StatusBar.setOverlaysWebView({ overlay: false });

  // ── Splash screen ───────────────────────────────────────────
  // Auto-hidden after 2 s (config), but we can hide earlier:
  SplashScreen.hide();

  // ── Notification permission (Android 13+ / API 33+) ────────
  // Ask immediately on first launch, like Spotify & YT Music.
  // This is needed for the media playback notification to appear.
  try {
    const { LocalNotifications } =
      await import("@capacitor/local-notifications");
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      await LocalNotifications.requestPermissions();
    }
  } catch {
    /* non-critical */
  }

  // ── Back-button behaviour ───────────────────────────────────
  App.addListener("backButton", ({ canGoBack }) => {
    if (!canGoBack) {
      App.minimizeApp(); // minimise instead of killing the app
    } else {
      window.history.back();
    }
  });
}

export { initBackgroundAudio } from "./lifecycle";
