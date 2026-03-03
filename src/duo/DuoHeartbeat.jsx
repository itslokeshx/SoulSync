// ─────────────────────────────────────────────────────────────────────────────
// DuoHeartbeat — Subtle pulsing indicator showing partner is connected
// ─────────────────────────────────────────────────────────────────────────────
import { useDuoStore } from "./duoStore.js";

export function DuoHeartbeat() {
  const { active, partnerConnected, partnerName } = useDuoStore();

  if (!active) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.04]">
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
            partnerConnected
              ? "bg-sp-green animate-ping"
              : "bg-amber-400 animate-pulse"
          }`}
          style={{ animationDuration: "2s" }}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            partnerConnected ? "bg-sp-green" : "bg-amber-400"
          }`}
        />
      </span>
      <span className="text-[10px] text-sp-sub/60 font-medium">
        {partnerConnected ? partnerName || "Partner" : "Waiting…"}
      </span>
    </div>
  );
}
