import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  X,
  TrendingUp,
  Sparkles,
  Loader2,
  Music,
  Disc3,
  Mic2,
  ArrowUpRight,
  ArrowLeft,
  Clock,
  Trash2,
  Play,
  User,
  SearchX,
} from "lucide-react";
import {
  useSearch,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
} from "../hooks/useSearch";
import type { Suggestion } from "../hooks/useSearch";
import { useSearchStore } from "../store/searchStore";
import { bestImg, getArtists, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { useApp } from "../context/AppContext";

// ─── Browse categories for idle state ───────────────────────────────────────
const BROWSE_CATEGORIES = [
  {
    label: "Trending",
    emoji: "🔥",
    bar: "bg-orange-400",
    bg: "bg-orange-400/[0.07]",
    query: "trending songs 2024",
  },
  {
    label: "Bollywood",
    emoji: "🎬",
    bar: "bg-pink-400",
    bg: "bg-pink-400/[0.07]",
    query: "bollywood hits",
  },
  {
    label: "Punjabi",
    emoji: "💛",
    bar: "bg-yellow-400",
    bg: "bg-yellow-400/[0.07]",
    query: "punjabi songs",
  },
  {
    label: "Tamil",
    emoji: "🌺",
    bar: "bg-emerald-400",
    bg: "bg-emerald-400/[0.07]",
    query: "tamil hits",
  },
  {
    label: "Sad Hits",
    emoji: "💔",
    bar: "bg-indigo-400",
    bg: "bg-indigo-400/[0.07]",
    query: "sad songs",
  },
  {
    label: "Party",
    emoji: "🎉",
    bar: "bg-violet-400",
    bg: "bg-violet-400/[0.07]",
    query: "party songs",
  },
  {
    label: "Chill",
    emoji: "🌙",
    bar: "bg-cyan-400",
    bg: "bg-cyan-400/[0.07]",
    query: "chill lofi songs",
  },
  {
    label: "Workout",
    emoji: "💪",
    bar: "bg-red-400",
    bg: "bg-red-400/[0.07]",
    query: "gym workout songs",
  },
  {
    label: "Romantic",
    emoji: "🌹",
    bar: "bg-rose-400",
    bg: "bg-rose-400/[0.07]",
    query: "romantic songs",
  },
  {
    label: "International",
    emoji: "🌍",
    bar: "bg-blue-400",
    bg: "bg-blue-400/[0.07]",
    query: "english hits 2024",
  },
  {
    label: "Telugu",
    emoji: "⭐",
    bar: "bg-amber-400",
    bg: "bg-amber-400/[0.07]",
    query: "telugu songs",
  },
  {
    label: "Devotional",
    emoji: "🙏",
    bar: "bg-orange-300",
    bg: "bg-orange-300/[0.07]",
    query: "devotional songs",
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function SongRow({
  song,
  index,
  onPlay,
  isCurrent,
  isPlaying,
}: {
  song: any;
  index: number;
  onPlay: (s: any) => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
}) {
  const img = bestImg(song.image) || FALLBACK_IMG;
  const artist = getArtists(song);
  const duration = fmt(song.duration);
  return (
    <button
      onClick={() => onPlay(song)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.09] active:bg-white/[0.13] active:scale-[0.99] transition-all group text-left cursor-pointer"
    >
      <span className="w-5 text-center text-[12px] text-white/20 group-hover:hidden flex-shrink-0 font-mono select-none">
        {isCurrent && isPlaying ? (
          <span className="text-sp-green text-[10px]">▶</span>
        ) : (
          index + 1
        )}
      </span>
      <div className="relative flex-shrink-0 hidden group-hover:block w-5">
        <Play size={12} className="text-white fill-white" />
      </div>
      <div className="relative flex-shrink-0">
        <img
          src={img}
          alt={song.name}
          className="w-11 h-11 rounded-lg object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        {isCurrent && isPlaying && (
          <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center">
            <div className="flex gap-0.5 items-end h-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-0.5 bg-sp-green rounded-full animate-pulse"
                  style={{
                    height: `${8 + i * 3}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[14px] font-medium truncate transition-colors ${isCurrent ? "text-sp-green" : "text-white group-hover:text-sp-green"}`}
        >
          {song.name}
        </p>
        <p className="text-white/45 text-[12px] truncate">{artist}</p>
      </div>
      {duration && (
        <span className="text-white/30 text-[11px] flex-shrink-0">
          {duration}
        </span>
      )}
    </button>
  );
}

function TopResultHero({
  item,
  onPlay,
}: {
  item: any;
  onPlay: (s: any) => void;
}) {
  const navigate = useNavigate();
  const isArtist = item.type === "artist" || item.description === "Artist";
  const isAlbum =
    item.type === "album" || item.description?.toLowerCase().includes("album");
  const img = bestImg(item.image) || FALLBACK_IMG;
  const name = item.name || item.title || "Unknown";
  const subtitle = isArtist
    ? "Artist"
    : isAlbum
      ? item.description || "Album"
      : getArtists(item);

  const handleClick = () => {
    if (isArtist) navigate(`/artist/${item.id}`);
    else if (isAlbum) navigate(`/album/${item.id}`);
    else onPlay(item);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={handleClick}
      className="relative group cursor-pointer p-4 sm:p-5 rounded-2xl overflow-hidden h-full min-h-[140px]"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Blurred bg */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <img
          src={img}
          className="w-full h-full object-cover blur-2xl scale-110"
          alt=""
        />
      </div>
      <div className="relative z-10 flex flex-col gap-3">
        <img
          src={img}
          alt={name}
          className={`w-16 h-16 sm:w-20 sm:h-20 object-cover shadow-2xl flex-shrink-0 ${isArtist ? "rounded-full" : "rounded-xl"}`}
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="min-w-0">
          <p className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight truncate">
            {name}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-white/40 px-2 py-0.5 rounded-full bg-white/[0.07] font-bold uppercase tracking-wide">
              Top Result
            </span>
            <span className="text-[12px] text-white/50 truncate">
              {subtitle}
            </span>
          </div>
        </div>
      </div>
      {!isArtist && !isAlbum && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(item);
          }}
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-sp-green flex items-center justify-center opacity-90 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-200 shadow-xl"
          style={{ boxShadow: "0 8px 24px rgba(29,185,84,0.5)" }}
        >
          <Play size={18} className="text-black fill-black ml-0.5" />
        </button>
      )}
    </motion.div>
  );
}

function ArtistCircle({ artist }: { artist: any }) {
  const navigate = useNavigate();
  const img = bestImg(artist.image) || FALLBACK_IMG;
  return (
    <button
      onClick={() => artist.id && navigate(`/artist/${artist.id}`)}
      className="flex flex-col items-center gap-2 w-20 flex-shrink-0 group cursor-pointer"
    >
      <div className="relative">
        <img
          src={img}
          alt={artist.name}
          className="w-16 h-16 rounded-full object-cover border border-white/10 group-hover:border-sp-green/50 group-hover:scale-105 transition-all duration-200"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Play size={16} className="text-white fill-white ml-0.5" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-white/70 text-[11px] font-medium truncate w-20 group-hover:text-white transition-colors leading-tight">
          {artist.name}
        </p>
        <p className="text-white/30 text-[10px]">Artist</p>
      </div>
    </button>
  );
}

function AlbumCard({ album }: { album: any }) {
  const navigate = useNavigate();
  const img = bestImg(album.image) || FALLBACK_IMG;
  return (
    <button
      onClick={() => album.id && navigate(`/album/${album.id}`)}
      className="flex flex-col gap-2 w-32 sm:w-36 flex-shrink-0 group cursor-pointer text-left"
    >
      <div className="relative overflow-hidden rounded-xl">
        <img
          src={img}
          alt={album.name}
          className="w-32 h-32 sm:w-36 sm:h-36 object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-10 h-10 rounded-full bg-sp-green flex items-center justify-center shadow-xl">
            <Play size={16} className="text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>
      <div>
        <p className="text-white/80 text-[12px] font-medium truncate group-hover:text-white transition-colors">
          {album.name}
        </p>
        <p className="text-white/35 text-[11px] truncate">
          {album.primaryArtists || album.year || "Album"}
        </p>
      </div>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="w-5 h-3 bg-white/[0.04] rounded flex-shrink-0" />
      <div className="w-11 h-11 rounded-lg bg-white/[0.06] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/[0.06] rounded w-3/4" />
        <div className="h-3 bg-white/[0.04] rounded w-1/2" />
      </div>
      <div className="w-8 h-3 bg-white/[0.03] rounded" />
    </div>
  );
}

function SuggestionDropdown({
  suggestions,
  onSelect,
  onHover,
}: {
  suggestions: Suggestion[];
  onSelect: (s: Suggestion) => void;
  onHover: (q: string) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.12 }}
      className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl overflow-hidden border border-white/[0.08]"
      style={{
        background: "rgba(12,12,12,0.98)",
        backdropFilter: "blur(24px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      {suggestions.map((s, i) => (
        <button
          key={i}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(s);
          }}
          onMouseEnter={() => onHover(s.query || s.text)}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left group"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.04] overflow-hidden">
            {s.image ? (
              <img
                src={s.image}
                className="w-full h-full object-cover"
                alt=""
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : s.type === "artist" ? (
              <User size={13} className="text-sp-green" />
            ) : s.type === "song" ? (
              <Music size={13} className="text-white/40" />
            ) : (
              <Search size={13} className="text-white/30" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white font-medium truncate">
              {s.text}
            </p>
            {s.subtext && (
              <p className="text-[11px] text-white/35 truncate">{s.subtext}</p>
            )}
          </div>
          {s.type !== "query" && (
            <span className="text-[9px] font-bold text-white/25 uppercase tracking-wider flex-shrink-0 capitalize">
              {s.type}
            </span>
          )}
          <ArrowUpRight
            size={13}
            className="text-white/0 group-hover:text-white/35 transition-colors flex-shrink-0"
          />
        </button>
      ))}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SearchPage() {
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const { playSong, currentSong, isPlaying } = useApp();
  const { addRecentSearch, clearRecentSearches } = useSearchStore();
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches(),
  );
  const [inputFocused, setInputFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prefetchRef = useRef<string | null>(null);

  const {
    query,
    setQuery,
    state,
    displayResult,
    isFirstSearch,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    loadMore,
  } = useSearch();

  const result = displayResult;
  const isRefreshing = state === "loading" && !isFirstSearch;

  // Init from URL and focus
  useEffect(() => {
    const urlQ = urlParams.get("q") || "";
    if (urlQ) setQuery(urlQ);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSuggestions) setShowSuggestions(false);
        else navigate(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, showSuggestions, setShowSuggestions]);

  const handleChange = useCallback(
    (v: string) => {
      setQuery(v);
      setUrlParams(v.trim() ? { q: v } : {}, { replace: true });
      setShowSuggestions(true);
    },
    [setQuery, setUrlParams, setShowSuggestions],
  );

  const handleSuggestionSelect = useCallback(
    (s: Suggestion) => {
      const q = s.query || s.text;
      setQuery(q);
      setUrlParams({ q }, { replace: true });
      setShowSuggestions(false);
      saveRecentSearch(q);
      setRecentSearches(getRecentSearches());
      addRecentSearch(q);
    },
    [setQuery, setUrlParams, setShowSuggestions, addRecentSearch],
  );

  const handleSuggestionHover = useCallback((q: string) => {
    if (prefetchRef.current === q) return;
    prefetchRef.current = q;
    const API = (
      import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"
    ).replace(/\/$/, "");
    fetch(`${API}/api/search?q=${encodeURIComponent(q)}&limit=20`, {
      credentials: "include",
    }).catch(() => {});
  }, []);

  const handleEnter = useCallback(() => {
    if (query.trim() && state === "results") {
      saveRecentSearch(query.trim());
      setRecentSearches(getRecentSearches());
      addRecentSearch(query.trim());
    }
    setShowSuggestions(false);
  }, [query, state, addRecentSearch, setShowSuggestions]);

  // Infinite scroll
  useEffect(() => {
    if (!bottomRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const handlePlay = useCallback(
    (song: any) => {
      playSong(song, result?.songs || []);
      if (query.trim()) {
        saveRecentSearch(query.trim());
        setRecentSearches(getRecentSearches());
        addRecentSearch(query.trim());
      }
    },
    [playSong, result, query, addRecentSearch],
  );

  const handleChipClick = useCallback(
    (q: string) => {
      setQuery(q);
      setUrlParams({ q }, { replace: true });
      saveRecentSearch(q);
      setRecentSearches(getRecentSearches());
      addRecentSearch(q);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [setQuery, setUrlParams, addRecentSearch, setShowSuggestions],
  );

  const handleRemoveRecent = useCallback((q: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(q);
    setRecentSearches(getRecentSearches());
  }, []);

  const handleClearRecents = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, [clearRecentSearches]);

  const clearInput = useCallback(() => {
    handleChange("");
    inputRef.current?.focus();
  }, [handleChange]);

  const splitAt = result?.topResult ? 4 : 5;
  const firstSectionSongs = result?.songs.slice(0, splitAt) || [];
  const remainingSongs = result?.songs.slice(splitAt) || [];
  const hasMoreSongs = (result?.songs.length || 0) > splitAt;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#050505]">
      {/* ── Search bar ── */}
      <div
        className="flex-shrink-0 px-3 md:px-5 pt-3 pb-2.5 border-b border-white/[0.06]"
        style={{ background: "rgba(5,5,5,0.98)" }}
      >
        <div className="flex items-center gap-2 max-w-2xl">
          {/* Back (mobile) */}
          <button
            onClick={() => navigate(-1)}
            className="md:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] active:scale-90 transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Input pill + suggestions dropdown */}
          <div className="flex-1 relative">
            <div
              className={`flex items-center gap-2.5 h-12 px-4 rounded-2xl border transition-all duration-200 ${
                inputFocused
                  ? "border-sp-green/50 bg-white/[0.09] shadow-[0_0_24px_rgba(29,185,84,0.07)]"
                  : "border-white/[0.08] bg-white/[0.06] hover:border-white/[0.12]"
              }`}
            >
              {state === "loading" && isFirstSearch ? (
                <Loader2
                  size={16}
                  className="text-sp-green flex-shrink-0 animate-spin"
                />
              ) : (
                <Search
                  size={16}
                  className={`flex-shrink-0 transition-colors ${inputFocused ? "text-sp-green" : "text-white/35"}`}
                />
              )}

              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => {
                  setInputFocused(true);
                  setShowSuggestions(true);
                }}
                onBlur={() => {
                  setInputFocused(false);
                  setTimeout(() => setShowSuggestions(false), 160);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEnter();
                }}
                placeholder="Songs, artists, moods, movies…"
                className="flex-1 bg-transparent text-white text-[16px] placeholder-white/20 outline-none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />

              {isRefreshing && (
                <div className="w-1.5 h-1.5 rounded-full bg-sp-green/60 animate-pulse flex-shrink-0" />
              )}

              <AnimatePresence>
                {query && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    onClick={clearInput}
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/[0.1] text-white/40 hover:bg-white/[0.18] hover:text-white transition-all active:scale-90"
                    aria-label="Clear"
                  >
                    <X size={10} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <SuggestionDropdown
                  suggestions={suggestions}
                  onSelect={handleSuggestionSelect}
                  onHover={handleSuggestionHover}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Cancel (desktop) */}
          <button
            onClick={() => navigate(-1)}
            className="hidden md:block flex-shrink-0 text-white/45 hover:text-white text-[13px] font-medium px-3 py-1.5 rounded-xl hover:bg-white/[0.05] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ── Scrollable results ── */}
      <div className="flex-1 overflow-y-auto thin-scrollbar px-3 md:px-5 pb-28">
        {/* ── IDLE STATE — browse grid ── */}
        {state === "idle" && (
          <div className="py-5 space-y-6 max-w-2xl">
            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] flex items-center gap-2">
                    <Clock size={12} /> Recent
                  </h3>
                  <button
                    onClick={handleClearRecents}
                    className="text-white/25 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/[0.04]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.slice(0, 8).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleChipClick(r)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.07] text-white/65 text-[12px] font-medium hover:bg-white/[0.09] hover:text-white transition-all group"
                    >
                      <Clock size={11} className="text-white/30" />
                      {r}
                      <X
                        size={10}
                        className="text-white/0 group-hover:text-white/40 ml-0.5 transition-colors"
                        onClick={(e) => handleRemoveRecent(r, e)}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending when no recents */}
            {recentSearches.length === 0 && (
              <div>
                <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                  <TrendingUp size={12} /> Trending
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Arijit Singh",
                    "Anirudh Ravichander",
                    "Diljit Dosanjh",
                    "Taylor Swift",
                    "Trending 2024",
                    "Sad songs",
                  ].map((t) => (
                    <button
                      key={t}
                      onClick={() => handleChipClick(t)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.07] text-white/60 text-[12px] hover:bg-white/[0.09] hover:text-white transition-all"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Browse grid */}
            <div>
              <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <Sparkles size={11} /> Browse All
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {BROWSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => handleChipClick(cat.query)}
                    className={`relative flex items-center gap-2.5 h-[46px] rounded-xl px-3 ${cat.bg} border border-white/[0.05] hover:border-white/[0.11] hover:brightness-110 active:scale-[0.97] transition-all overflow-hidden group text-left`}
                  >
                    {/* Left accent bar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-[3px] ${cat.bar} rounded-l-xl opacity-70 group-hover:opacity-100 transition-opacity`}
                    />
                    <span className="text-base leading-none opacity-75 pl-1 flex-shrink-0">
                      {cat.emoji}
                    </span>
                    <span className="text-[12px] font-semibold text-white/75 group-hover:text-white transition-colors truncate">
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SKELETON (first search only) ── */}
        {isFirstSearch && (
          <div className="py-4 max-w-2xl">
            <div className="h-px bg-gradient-to-r from-transparent via-sp-green to-transparent mb-5 rounded-full animate-pulse" />
            <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.03] mb-5 animate-pulse">
              <div className="w-20 h-20 rounded-xl bg-white/[0.06] flex-shrink-0" />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-3 w-16 bg-white/[0.04] rounded" />
                <div className="h-5 w-48 bg-white/[0.06] rounded" />
                <div className="h-3 w-32 bg-white/[0.04] rounded" />
              </div>
            </div>
            <div className="space-y-0.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {(state === "results" || (state === "loading" && !isFirstSearch)) &&
          result && (
            <div className="py-4 space-y-7 max-w-2xl">
              {result.parsedIntent?.displayContext && (
                <div className="flex items-center gap-2 px-1">
                  <Sparkles size={12} className="text-sp-green flex-shrink-0" />
                  <span className="text-[12px] text-white/40 font-medium">
                    {result.parsedIntent.displayContext}
                  </span>
                  {isRefreshing && (
                    <div className="w-1 h-1 rounded-full bg-sp-green/50 animate-pulse ml-1" />
                  )}
                </div>
              )}

              {/* Desktop 2-col: Top Result + Songs */}
              <div className="hidden md:grid md:grid-cols-[280px_1fr] gap-5">
                {result.topResult && (
                  <div>
                    <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5">
                      Top Result
                    </h3>
                    <TopResultHero
                      item={result.topResult}
                      onPlay={handlePlay}
                    />
                  </div>
                )}
                <div>
                  <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5">
                    Songs
                  </h3>
                  <div className="space-y-0.5">
                    {firstSectionSongs.map((song, i) => (
                      <SongRow
                        key={song.id}
                        song={song}
                        index={i}
                        onPlay={handlePlay}
                        isCurrent={currentSong?.id === song.id}
                        isPlaying={isPlaying}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile: stacked */}
              <div className="md:hidden flex flex-col gap-3">
                {result.topResult && (
                  <div>
                    <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-2">
                      Top Result
                    </h3>
                    <TopResultHero
                      item={result.topResult}
                      onPlay={handlePlay}
                    />
                  </div>
                )}
                <div className="space-y-0.5">
                  {firstSectionSongs.map((song, i) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      index={i}
                      onPlay={handlePlay}
                      isCurrent={currentSong?.id === song.id}
                      isPlaying={isPlaying}
                    />
                  ))}
                </div>
              </div>

              {/* Artists */}
              {result.artists?.length > 0 && (
                <div>
                  <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                    <Mic2 size={11} /> Artists
                  </h3>
                  <div className="flex gap-5 overflow-x-auto pb-1 thin-scrollbar">
                    {result.artists.slice(0, 8).map((a: any) => (
                      <ArtistCircle key={a.id || a.name} artist={a} />
                    ))}
                  </div>
                </div>
              )}

              {/* Albums */}
              {result.albums?.length > 0 && (
                <div>
                  <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                    <Disc3 size={11} /> Albums
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-1 thin-scrollbar">
                    {result.albums.slice(0, 10).map((a: any) => (
                      <AlbumCard key={a.id || a.name} album={a} />
                    ))}
                  </div>
                </div>
              )}

              {/* Remaining songs — always visible */}
              {hasMoreSongs && (
                <div>
                  <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5 flex items-center gap-2">
                    <Music size={11} /> More Songs
                    <span className="text-white/20 font-normal normal-case tracking-normal">
                      {result.songs.length}
                    </span>
                  </h3>
                  <div className="space-y-0.5">
                    {remainingSongs.map((song, i) => (
                      <SongRow
                        key={song.id}
                        song={song}
                        index={splitAt + i}
                        onPlay={handlePlay}
                        isCurrent={currentSong?.id === song.id}
                        isPlaying={isPlaying}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Related searches */}
              {(result.relatedSearches?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5">
                    Related
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.relatedSearches?.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleChipClick(s)}
                        className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.07] text-white/55 text-[12px] hover:bg-white/[0.09] hover:text-white hover:border-white/[0.12] transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} className="py-2" />
            </div>
          )}

        {/* ── NO RESULTS ── */}
        {state === "no-results" && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-5">
              <SearchX size={28} className="text-white/20" />
            </div>
            <p className="text-white font-bold text-lg">
              No results for "{query}"
            </p>
            <p className="text-white/30 text-sm mt-2 mb-7 max-w-xs mx-auto leading-relaxed">
              Try different keywords, check spelling, or search in English/Hindi
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
              {[
                "Trending songs",
                "New Bollywood",
                "Party hits",
                "Sad songs",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => handleChipClick(s.toLowerCase())}
                  className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-white/[0.05] text-white/50 hover:bg-white/[0.08] hover:text-white border border-white/[0.06] transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-24 text-center px-4">
            <p className="text-white/40 text-sm">
              Search failed. Check your connection.
            </p>
            <button
              onClick={() => setQuery(query.trim() + " ")}
              className="mt-4 text-sp-green text-[13px] hover:text-sp-green/80 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
