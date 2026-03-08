import { useNavigate } from "react-router-dom";
import { useDuoStore } from "./duoStore";
import { useAuthGate } from "../hooks/useAuthGate";
import toast from "react-hot-toast";

const HeadphoneIcon = ({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) => (
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

interface DuoButtonProps {
  variant?: "auto" | "sidebar" | "mobile-nav";
}

export function DuoButton({ variant = "auto" }: DuoButtonProps) {
  const navigate = useNavigate();
  const { active, partnerConnected, partnerName, setModalOpen, setPanelOpen } =
    useDuoStore();
  const { gate } = useAuthGate();

  if (active) {
    return (
      <button
        onClick={() => navigate("/soullink")}
        className={`relative flex items-center gap-2 md:gap-3 rounded-xl transition-all duration-500 group overflow-hidden ${variant === "sidebar"
          ? "w-full px-4 py-3"
          : variant === "mobile-nav"
            ? "flex-col gap-0.5 py-2 px-3"
            : "w-auto px-3 py-2 md:w-full md:px-4 md:py-3"
          }`}
        style={{
          background:
            variant === "mobile-nav"
              ? "transparent"
              : "linear-gradient(135deg, rgba(29,185,84,0.14), rgba(16,185,129,0.06))",
          border:
            variant === "mobile-nav"
              ? "none"
              : "1px solid rgba(29,185,84,0.35)",
          boxShadow:
            variant === "mobile-nav"
              ? "none"
              : "0 0 30px rgba(29,185,84,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
        title="Open SoulLink"
      >
        {variant !== "mobile-nav" && (
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(29,185,84,0.25) 50%, transparent 100%)",
              animation: "shimmer 3s ease-in-out infinite",
            }}
          />
        )}

        {variant === "mobile-nav" ? (
          <>
            <div
              className="relative w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(145deg, #1db954 0%, #15803d 100%)",
                boxShadow:
                  "0 0 20px rgba(29,185,84,0.5), 0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              <HeadphoneIcon size={19} className="text-black" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${partnerConnected ? "bg-white animate-ping" : "bg-amber-300 animate-pulse"}`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${partnerConnected ? "bg-white" : "bg-amber-300"}`}
                />
              </span>
            </div>
            <span className="text-[9px] font-black text-sp-green tracking-wider uppercase">
              SoulLink
            </span>
          </>
        ) : (
          <>
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-sp-green/20 flex items-center justify-center relative z-10">
                <HeadphoneIcon
                  size={16}
                  className="text-sp-green md:w-[18px] md:h-[18px]"
                />
              </div>
              <div
                className={`absolute -inset-1 rounded-xl opacity-50 ${partnerConnected ? "animate-pulse" : ""}`}
                style={{
                  background: partnerConnected
                    ? "radial-gradient(circle, rgba(29,185,84,0.3) 0%, transparent 70%)"
                    : "radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)",
                }}
              />
            </div>
            <div className="hidden md:block flex-1 min-w-0 text-left relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-sp-green tracking-wide">
                  SoulLink
                </span>
                <span className="relative flex h-2 w-2">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${partnerConnected ? "bg-sp-green animate-ping" : "bg-amber-400 animate-pulse"}`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${partnerConnected ? "bg-sp-green" : "bg-amber-400"}`}
                  />
                </span>
              </div>
              <p className="text-[10px] text-sp-green/50 font-medium truncate mt-0.5">
                {partnerConnected
                  ? `Listening with ${partnerName}`
                  : "Waiting for partner…"}
              </p>
            </div>
            <div className="md:hidden relative z-10 flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-sp-green">LIVE</span>
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${partnerConnected ? "bg-sp-green animate-ping" : "bg-amber-400 animate-pulse"}`}
                />
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${partnerConnected ? "bg-sp-green" : "bg-amber-400"}`}
                />
              </span>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-sp-green/40 group-hover:text-sp-green group-hover:translate-x-0.5 transition-all flex-shrink-0 relative z-10 hidden md:block"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        gate(() => {
          navigate("/soullink");
        }, "Sign in to experience real-time listening sessions with friends in Duo Mode");
      }}
      className={`relative flex items-center transition-all duration-300 group overflow-hidden active:scale-[0.97] ${variant === "sidebar"
        ? "w-full gap-3 px-4 py-3 rounded-xl hover:scale-[1.01]"
        : variant === "mobile-nav"
          ? "flex-col gap-0.5 py-2 px-3"
          : "w-auto gap-2 px-3 py-2 rounded-xl md:w-full md:gap-3 md:px-4 md:py-3 md:hover:scale-[1.01]"
        }`}
      style={
        variant === "mobile-nav"
          ? {}
          : {
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(29,185,84,0.04))",
            border: "1px solid rgba(255,255,255,0.06)",
          }
      }
      title="Listen together with a friend or partner"
    >
      {variant !== "mobile-nav" && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(29,185,84,0.10), rgba(16,185,129,0.04))",
            boxShadow: "0 0 20px rgba(29,185,84,0.08)",
          }}
        />
      )}

      {variant === "mobile-nav" ? (
        <>
          <div
            className="relative w-10 h-10 rounded-full flex items-center justify-center border border-sp-green/30 group-active:border-sp-green/60 transition-all"
            style={{
              background:
                "linear-gradient(145deg, rgba(29,185,84,0.14) 0%, rgba(16,185,129,0.06) 100%)",
              boxShadow:
                "0 0 14px rgba(29,185,84,0.20), 0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            <HeadphoneIcon
              size={19}
              className="text-sp-green/75 group-active:text-sp-green transition-colors"
            />
          </div>
          <span className="text-[9px] font-bold text-sp-green/60 group-active:text-sp-green tracking-wider transition-colors">
            SoulLink
          </span>
        </>
      ) : (
        <>
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-white/[0.04] group-hover:bg-sp-green/15 flex items-center justify-center flex-shrink-0 transition-all duration-300 relative z-10">
            <HeadphoneIcon
              size={16}
              className="text-sp-sub/60 group-hover:text-sp-green transition-colors duration-300 md:w-[18px] md:h-[18px]"
            />
          </div>
          <div className="hidden md:block flex-1 min-w-0 text-left relative z-10">
            <span className="text-[12px] font-bold text-sp-sub group-hover:text-white transition-colors duration-300 tracking-wide">
              SoulLink
            </span>
            <p className="text-[10px] text-sp-sub/40 group-hover:text-sp-green/50 transition-colors duration-300 font-medium mt-0.5">
              Listen with a friend or partner
            </p>
          </div>
          <span className="md:hidden text-[11px] font-semibold text-sp-sub/60 group-hover:text-white relative z-10 transition-colors">
            SoulLink
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/10 group-hover:text-sp-green/50 group-hover:translate-x-0.5 transition-all flex-shrink-0 relative z-10 hidden md:block"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </>
      )}
    </button>
  );
}
