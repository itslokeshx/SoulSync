/**
 * Haptic feedback helpers – wraps @capacitor/haptics
 * with no-ops on web so callers don't need platform checks.
 */
import { isNative } from "../utils/platform";

type ImpactWeight = "light" | "medium" | "heavy";
type NotifType = "success" | "warning" | "error";

async function getHaptics() {
  if (!isNative()) return null;
  const { Haptics } = await import("@capacitor/haptics");
  return Haptics;
}

/** Short vibration on taps / toggles */
export async function impactFeedback(style: ImpactWeight = "light") {
  const h = await getHaptics();
  if (!h) return;
  const { ImpactStyle } = await import("@capacitor/haptics");
  const map = {
    light: ImpactStyle.Light,
    medium: ImpactStyle.Medium,
    heavy: ImpactStyle.Heavy,
  };
  await h.impact({ style: map[style] });
}

/** Notification-style vibration (success / error) */
export async function notificationFeedback(type: NotifType = "success") {
  const h = await getHaptics();
  if (!h) return;
  const { NotificationType } = await import("@capacitor/haptics");
  const map = {
    success: NotificationType.Success,
    warning: NotificationType.Warning,
    error: NotificationType.Error,
  };
  await h.notification({ type: map[type] });
}

/** Selection tick (e.g. tab switch) */
export async function selectionFeedback() {
  const h = await getHaptics();
  if (!h) return;
  await h.selectionStart();
  await h.selectionEnd();
}
