import { useNavigate } from "react-router-dom";
import { useSearchStore } from "../store/searchStore";
import { GENRE_CATEGORIES } from "../lib/constants";

interface BrowsePageProps {
  onSearch?: (q: string) => void;
}

export const BrowsePage = ({ onSearch: onSearchProp }: BrowsePageProps) => {
  const navigate = useNavigate();
  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const onSearch =
    onSearchProp ||
    ((q: string) => {
      setSearchQuery(q);
      navigate("/search");
    });

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-1 tracking-tight">
          Browse
        </h1>
        <p className="text-white/35 text-sm">Pick a vibe</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {GENRE_CATEGORIES.map(({ label, q, color }, idx) => (
          <button
            key={label}
            onClick={() => onSearch(q)}
            className={`relative h-24 rounded-2xl overflow-hidden text-left px-4 py-3.5 font-bold text-white text-[13px] hover:scale-[1.04] active:scale-100 transition-all duration-250 group animate-slideUp stagger-${Math.min(idx + 1, 8)}`}
            style={{
              background: `linear-gradient(145deg,${color}dd 0%,${color}44 100%)`,
            }}
          >
            <span className="relative z-10 drop-shadow font-bold leading-snug">
              {label}
            </span>
            {/* Decorative circle */}
            <div
              className="absolute -right-5 -bottom-5 w-20 h-20 rounded-full opacity-25 group-hover:opacity-40 group-hover:scale-110 transition-all duration-500"
              style={{ background: color }}
            />
            {/* Dark overlay at bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </button>
        ))}
      </div>
    </div>
  );
};
