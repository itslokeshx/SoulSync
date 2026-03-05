import { Wifi, WifiOff } from "lucide-react";
import { useNetwork } from "../../hooks/useNetwork";

interface OfflineToggleProps {
  collapsed?: boolean;
}

/**
 * Toggle button for the sidebar (desktop) that lets logged-in users
 * manually enter/exit offline mode.
 */
export function OfflineToggle({ collapsed = false }: OfflineToggleProps) {
  const { isOfflineMode, isOnline, toggleOfflineMode } = useNetwork();

  const isOffline = isOfflineMode;
  const Icon = isOffline ? WifiOff : Wifi;
  const label = isOffline ? "Offline" : "Online";
  const color = isOffline ? "text-amber-400" : "text-sp-green";
  const bg = isOffline ? "bg-amber-500/10" : "bg-sp-green/10";

  return (
    <button
      onClick={toggleOfflineMode}
      disabled={!isOnline && !isOfflineMode} // can't exit offline if truly disconnected
      title={
        isOffline
          ? "Switch to online mode"
          : "Switch to offline mode to save data"
      }
      className={`w-full flex items-center gap-3 rounded-xl text-[13px] font-semibold transition-all duration-200 disabled:opacity-40 ${
        collapsed ? "justify-center px-0 py-2.5" : "px-3.5 py-2.5"
      } ${color} ${bg} hover:brightness-110`}
    >
      <Icon size={17} />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
