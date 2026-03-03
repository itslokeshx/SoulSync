// ─────────────────────────────────────────────────────────────────────────────
// DuoButton — Premium full-width card for sidebar / inline for mobile
// ─────────────────────────────────────────────────────────────────────────────
import { useDuoStore } from "./duoStore.js";

const HeadphoneIcon = ({ size = 18, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
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
      opacity="0.5"
    />
  </svg>
);

export function DuoButton() {
  const { active, partnerConnected, partnerName, setModalOpen, setPanelOpen } =
    useDuoStore();

  if (active) {
    return (
      <button
        onClick={() => setPanelOpen(true)}
        className="relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 group overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.14), rgba(16,185,129,0.06))",
          border: "1px solid rgba(29,185,84,0.35)",
          boxShadow:
            "0 0 30px rgba(29,185,84,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
        title="Open Duo Panel"
      >
        {/* Animated shimmer sweep */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(29,185,84,0.25) 50%, transparent 100%)",
            animation: "shimmer 3s ease-in-out infinite",
          }}
        />

        {/* Icon container with pulse ring */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-sp-green/20 flex items-center justify-center relative z-10">
            <HeadphoneIcon size={18} className="text-sp-green" />
          </div>
          {/* Outer glow ring */}
          <div
            className={`absolute -inset-1 rounded-xl opacity-50 ${
              partnerConnected ? "animate-pulse" : ""
            }`}
            style={{
              background: partnerConnected
                ? "radial-gradient(circle, rgba(29,185,84,0.3) 0%, transparent 70%)"
                : "radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 text-left relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-sp-green tracking-wide">
              DUO LIVE
            </span>
            <span className="relative flex h-2 w-2">
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
          </div>
          <p className="text-[10px] text-sp-green/50 font-medium truncate mt-0.5">
            {partnerConnected
              ? `Listening with ${partnerName}`
              : "Waiting for partner…"}
          </p>
        </div>

        {/* Arrow hint */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-sp-green/40 group-hover:text-sp-green group-hover:translate-x-0.5 transition-all flex-shrink-0 relative z-10"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={() => setModalOpen(true)}
      className="relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group overflow-hidden hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(29,185,84,0.04))",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      title="Start Duo listening session"
    >
      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.10), rgba(16,185,129,0.04))",
          border: "1px solid rgba(29,185,84,0.25)",
          boxShadow: "0 0 20px rgba(29,185,84,0.08)",
        }}
      />

      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-white/[0.04] group-hover:bg-sp-green/15 flex items-center justify-center flex-shrink-0 transition-all duration-300 relative z-10">
        <HeadphoneIcon
          size={18}
          className="text-sp-sub/60 group-hover:text-sp-green transition-colors duration-300"
        />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 text-left relative z-10">
        <span className="text-[12px] font-bold text-sp-sub group-hover:text-white transition-colors duration-300 tracking-wide">
          START DUO
        </span>
        <p className="text-[10px] text-sp-sub/40 group-hover:text-sp-green/50 transition-colors duration-300 font-medium mt-0.5">
          Listen together in sync
        </p>
      </div>

      {/* Arrow */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/10 group-hover:text-sp-green/50 group-hover:translate-x-0.5 transition-all flex-shrink-0 relative z-10"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}
