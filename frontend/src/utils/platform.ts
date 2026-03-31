import { Capacitor } from "@capacitor/core";

/** True when running inside an Electron desktop shell */
export const isElectron = (): boolean =>
  !!(window as any).electronAPI?.isElectron;

/** True when running inside a Capacitor native shell (Android / iOS) */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** True only on Android native */
export const isAndroid = (): boolean => Capacitor.getPlatform() === "android";

/** True when running in a regular browser (not native, not Electron) */
export const isWeb = (): boolean =>
  Capacitor.getPlatform() === "web" && !isElectron();

/** True on small viewports OR inside the native shell */
export const isMobileView = (): boolean =>
  window.innerWidth < 768 || (isNative() && !isElectron());

/** Returns 'android' | 'ios' | 'web' | 'electron' */
export const getPlatform = () =>
  isElectron() ? "electron" : Capacitor.getPlatform();
