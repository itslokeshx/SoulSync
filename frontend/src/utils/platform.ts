import { Capacitor } from "@capacitor/core";

/** True when running inside a Capacitor native shell (Android / iOS) */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** True only on Android native */
export const isAndroid = (): boolean => Capacitor.getPlatform() === "android";

/** True when running in a regular browser */
export const isWeb = (): boolean => Capacitor.getPlatform() === "web";

/** True on small viewports OR inside the native shell */
export const isMobileView = (): boolean =>
  window.innerWidth < 768 || isNative();

/** Returns 'android' | 'ios' | 'web' */
export const getPlatform = () => Capacitor.getPlatform();
