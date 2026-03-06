import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SearchTriggerProps {
  variant?: "sidebar" | "sidebar-collapsed" | "mobile";
}

export function SearchTrigger({ variant = "sidebar" }: SearchTriggerProps) {
  const navigate = useNavigate();
  const goSearch = () => navigate("/search");

  if (variant === "mobile") {
    return (
      <button
        onClick={goSearch}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:scale-90 transition-all text-white/60 hover:text-white"
        aria-label="Search"
      >
        <Search size={18} />
      </button>
    );
  }

  if (variant === "sidebar-collapsed") {
    return (
      <button
        onClick={goSearch}
        title="Search (Ctrl+K)"
        className="w-full flex items-center justify-center py-2 rounded-xl text-sp-sub hover:text-white hover:bg-white/[0.04] transition-all duration-200 active:scale-95"
      >
        <Search size={17} strokeWidth={2} />
      </button>
    );
  }

  return (
    <button
      onClick={goSearch}
      className="w-full flex items-center gap-3 h-10 px-3.5 rounded-xl bg-[#1c1c1c] hover:bg-[#222] border border-white/[0.06] hover:border-white/10 transition-all duration-200 active:scale-[0.98] group mb-1"
      aria-label="Search SoulSync"
    >
      <Search
        size={15}
        className="text-white/30 group-hover:text-sp-green transition-colors flex-shrink-0"
      />
      <span className="flex-1 text-left text-[13px] text-white/25 group-hover:text-white/40 transition-colors truncate">
        Search SoulSync...
      </span>
      <kbd className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/20 text-[10px] font-mono">
        ⌘K
      </kbd>
    </button>
  );
}
