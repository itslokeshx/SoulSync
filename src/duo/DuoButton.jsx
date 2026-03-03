// ─────────────────────────────────────────────────────────────────────────────
// DuoButton — Floating button in sidebar / player to activate Duo
// ─────────────────────────────────────────────────────────────────────────────
import { useDuoStore } from "./duoStore.js";

export function DuoButton() {
  const { active, partnerConnected, setModalOpen, setPanelOpen } =
    useDuoStore();

  if (active) {
    return (
      <button
        onClick={() => setPanelOpen(true)}
        className="relative flex items-center gap-2 px-3.5 py-2 rounded-full transition-all duration-300 group"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.15), rgba(29,185,84,0.05))",
          border: "1px solid rgba(29,185,84,0.3)",
          boxShadow: "0 0 20px rgba(29,185,84,0.1)",
        }}
        title="Duo Live Sync active"
      >
        {/* Pulse ring */}
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${partnerConnected ? "bg-sp-green animate-ping" : "bg-amber-400 animate-pulse"}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${partnerConnected ? "bg-sp-green" : "bg-amber-400"}`}
          />
        </span>
        <span className="text-[12px] font-semibold text-sp-green group-hover:text-sp-green-light transition-colors">
          Duo
        </span>
        {partnerConnected && (
          <span className="text-[10px] text-sp-green/60">Live</span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => setModalOpen(true)}
      className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-sp-green/30 transition-all duration-300 group"
      title="Start Duo listening session"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-sp-sub group-hover:text-sp-green transition-colors"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span className="text-[12px] font-semibold text-sp-sub group-hover:text-white transition-colors">
        Duo
      </span>
    </button>
  );
}
