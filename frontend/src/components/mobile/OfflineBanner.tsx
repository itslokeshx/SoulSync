import { WifiOff, Signal } from "lucide-react";
import { useNetwork } from "../../hooks/useNetwork";

/**
 * Amber banner shown at the top of the app when offline.
 * Renders nothing when online.
 */
export function OfflineBanner() {
  const { isOfflineMode, isOnline } = useNetwork();

  if (!isOfflineMode) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 text-[12px] font-semibold select-none flex-shrink-0"
      style={{
        background: "linear-gradient(90deg, #78350f 0%, #451a03 100%)",
        borderBottom: "1px solid rgba(245,158,11,0.25)",
      }}
    >
      {isOnline ? (
        <Signal size={13} className="text-amber-400 flex-shrink-0" />
      ) : (
        <WifiOff size={13} className="text-amber-400 flex-shrink-0" />
      )}
      <span className="text-amber-200/90">
        {isOnline
          ? "Offline mode — only downloaded songs available"
          : "No internet — playing downloaded songs"}
      </span>
    </div>
  );
}
