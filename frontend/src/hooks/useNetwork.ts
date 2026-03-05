import { useEffect, useState, useCallback } from "react";
import {
  getNetworkStatus,
  onNetworkChange,
  type NetworkInfo,
} from "../capacitor/network";
import { useOfflineStore } from "../store/offlineStore";
import toast from "react-hot-toast";

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState("unknown");
  const enterOffline = useOfflineStore((s) => s.enterOfflineMode);
  const exitOffline = useOfflineStore((s) => s.exitOfflineMode);
  const isManualOffline = useOfflineStore((s) => s.isOfflineMode);

  // Track whether offline was auto-entered (network drop) vs manual
  const [autoOffline, setAutoOffline] = useState(false);

  useEffect(() => {
    // Get initial status
    getNetworkStatus().then((info) => {
      setIsOnline(info.connected);
      setConnectionType(info.connectionType);
      if (!info.connected && !isManualOffline) {
        enterOffline();
        setAutoOffline(true);
      }
    });

    // Listen for changes
    const cleanup = onNetworkChange((info: NetworkInfo) => {
      setIsOnline(info.connected);
      setConnectionType(info.connectionType);

      if (!info.connected) {
        enterOffline();
        setAutoOffline(true);
        toast("Connection lost — switched to offline mode", { icon: "📶" });
      } else if (info.connected && autoOffline) {
        // Only auto-exit if it was auto-entered (not manually toggled)
        exitOffline();
        setAutoOffline(false);
        toast.success("Back online 📶");
      }
    });

    return cleanup;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOfflineMode = useCallback(() => {
    if (isManualOffline) {
      exitOffline();
      setAutoOffline(false);
    } else {
      enterOffline();
      setAutoOffline(false); // manual = don't auto-exit
    }
  }, [isManualOffline, enterOffline, exitOffline]);

  return {
    isOnline,
    connectionType,
    isOfflineMode: isManualOffline || !isOnline,
    toggleOfflineMode,
  };
}
