// ─────────────────────────────────────────────────────────────────────────────
// DuoButton — Premium eye-catching button to activate Duo Live Sync
// ─────────────────────────────────────────────────────────────────────────────
import { useDuoStore } from "./duoStore.js";

export function DuoButton() {
  const { active, partnerConnected, partnerName, setModalOpen, setPanelOpen } =
    useDuoStore();

  if (active) {
    return (
      <button
        onClick={() => setPanelOpen(true)}
        className="relative flex items-center gap-2.5 px-4 py-2 rounded-2xl transition-all duration-500 group overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.18), rgba(16,185,129,0.08))",
          border: "1px solid rgba(29,185,84,0.4)",
          boxShadow:
            "0 0 24px rgba(29,185,84,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        title="Open Duo Panel"
      >
        {/* Animated gradient sweep */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(29,185,84,0.3) 50%, transparent 100%)",
            animation: "shimmer 2.5s ease-in-out infinite",
          }}
        />
        {/* Live pulse */}
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
              partnerConnected
                ? "bg-sp-green animate-ping"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              partnerConnected ? "bg-sp-green" : "bg-amber-400"
            }`}
          />
        </span>
        {/* Headphone icon */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          className="text-sp-green flex-shrink-0"
        >
          <path
            d="M3 18v-6a9 9 0 0 1 18 0v6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z"
            fill="currentColor"
            opacity="0.6"
          />
        </svg>
        <div className="flex flex-col items-start leading-none relative z-10">
          <span className="text-[11px] font-bold text-sp-green tracking-wide">
            DUO LIVE
          </span>
          <span className="text-[9px] text-sp-green/50 font-medium">
            {partnerConnected ? partnerName : "Waiting…"}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => setModalOpen(true)}
      className="relative flex items-center gap-2.5 px-4 py-2 rounded-2xl transition-all duration-300 group overflow-hidden hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(29,185,84,0.06))",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}
      title="Start Duo listening session"
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.12), rgba(16,185,129,0.06))",
          boxShadow: "inset 0 0 20px rgba(29,185,84,0.08)",
        }}
      />
      {/* Headphone icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="text-sp-sub group-hover:text-sp-green transition-colors duration-300 flex-shrink-0 relative z-10"
      >
        <path
          d="M3 18v-6a9 9 0 0 1 18 0v6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z"
          fill="currentColor"
          opacity="0.4"
        />
      </svg>
      <div className="flex flex-col items-start leading-none relative z-10">
        <span className="text-[11px] font-bold text-sp-sub group-hover:text-white transition-colors duration-300 tracking-wide">
          START DUO
        </span>
        <span className="text-[9px] text-sp-sub/40 group-hover:text-sp-green/60 transition-colors duration-300 font-medium">
          Listen together
        </span>
      </div>
    </button>
  );
}
