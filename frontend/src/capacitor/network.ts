/**
 * Thin wrapper around @capacitor/network.
 * Exposes a simple { connected, type } observable that works on both
 * native and web via the same API surface.
 */
import { Network, ConnectionStatus } from "@capacitor/network";
import { isNative } from "../utils/platform";

export type NetworkInfo = {
  connected: boolean;
  connectionType: string;
};

/** Get the current network status (works on both native + web). */
export async function getNetworkStatus(): Promise<NetworkInfo> {
  if (isNative()) {
    const s = await Network.getStatus();
    return { connected: s.connected, connectionType: s.connectionType };
  }
  return {
    connected: navigator.onLine,
    connectionType: "unknown",
  };
}

/**
 * Register a listener for network changes.
 * Returns a cleanup function.
 */
export function onNetworkChange(cb: (info: NetworkInfo) => void): () => void {
  if (isNative()) {
    const handle = Network.addListener(
      "networkStatusChange",
      (s: ConnectionStatus) => {
        cb({ connected: s.connected, connectionType: s.connectionType });
      },
    );
    return () => {
      handle.then((h) => h.remove());
    };
  }

  // Web fallback
  const online = () => cb({ connected: true, connectionType: "unknown" });
  const offline = () => cb({ connected: false, connectionType: "unknown" });
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  return () => {
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}
