import { useNavigate } from "react-router-dom";
import { useSearchStore } from "../store/searchStore";
import { GENRE_CATEGORIES } from "../lib/constants";
import {
  Compass,
  TrendingUp,
  Flame,
  Clapperboard,
  Zap,
  Piano,
  Heart,
  Music,
  Play,
  Waves,
  Disc3,
  Mic,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

interface BrowsePageProps {
  onSearch?: (q: string) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Flame,
  Clapperboard,
  Zap,
  Piano,
  Heart,
  TrendingUp,
  Music,
  Play,
  Waves,
  Disc3,
  Mic,
  Repeat,
};

const QUICK_PICKS = [
  "Anirudh 2026",
  "Chill Vibes",
  "Party Mix",
  "AR Rahman Hits",
  "Trending Now",
  "Sad Songs",
];

export const BrowsePage = ({ onSearch: onSearchProp }: BrowsePageProps) => {
  const navigate = useNavigate();
  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const onSearch =
    onSearchProp ||
    ((q: string) => {
      setSearchQuery(q);
      navigate("/search");
    });

  return (
    <div className="animate-fadeIn space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] flex items-center justify-center border border-white/[0.06]">
            <Compass size={18} className="text-white/70" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Browse
            </h1>
            <p className="text-white/25 text-[11px] tracking-[0.2em] uppercase font-medium">
              Discover your next obsession
            </p>
          </div>
        </div>
      </div>

      {/* Quick search pills */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={13} className="text-white/20" />
          <span className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.25em]">
            Quick picks
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {QUICK_PICKS.map((pick) => (
            <button
              key={pick}
              onClick={() => onSearch(pick)}
              className="px-4 py-1.5 rounded-full text-[12px] font-medium text-white/50 bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12] transition-all duration-300"
            >
              {pick}
            </button>
          ))}
        </div>
      </div>

      {/* Thin divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Bento grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 auto-rows-[120px]">
        {GENRE_CATEGORIES.map(({ label, q, color, icon, size }, idx) => {
          const isLarge = size === "lg";
          const isHovered = hoveredIdx === idx;
          const IconComponent = ICON_MAP[icon];

          return (
            <button
              key={label}
              onClick={() => onSearch(q)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`relative rounded-2xl overflow-hidden text-left transition-all duration-500 group
                animate-slideUp stagger-${Math.min(idx + 1, 8)}
                ${isLarge ? "sm:col-span-1 md:row-span-2" : ""}
                hover:scale-[1.02] active:scale-[0.98]`}
              style={{
                background: `linear-gradient(160deg, ${color}10 0%, transparent 60%)`,
              }}
            >
              {/* Border */}
              <div
                className="absolute inset-0 rounded-2xl transition-all duration-500"
                style={{
                  border: `1px solid ${isHovered ? color + "30" : "rgba(255,255,255,0.04)"}`,
                }}
              />

              {/* Ambient glow on hover */}
              <div
                className="absolute -inset-4 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl -z-10"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${color}15, transparent 70%)`,
                }}
              />

              {/* Icon */}
              <div className="absolute top-4 right-4 transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-0.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-500"
                  style={{
                    background: `${color}10`,
                    boxShadow: isHovered ? `0 2px 16px ${color}20` : "none",
                  }}
                >
                  {IconComponent && (
                    <IconComponent
                      size={16}
                      style={{ color: `${color}cc` }}
                      strokeWidth={2}
                    />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white/90 font-semibold text-[13px] tracking-tight leading-tight">
                  {label}
                </p>
                <div
                  className="h-[1.5px] w-5 rounded-full mt-2.5 transition-all duration-500 group-hover:w-8 opacity-60 group-hover:opacity-100"
                  style={{ background: color }}
                />
              </div>

              {/* Subtle corner wash */}
              <div
                className="absolute -bottom-10 -right-10 w-28 h-28 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-all duration-700"
                style={{ background: color }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
