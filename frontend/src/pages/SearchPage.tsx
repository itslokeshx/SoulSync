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
  ArrowLeft,
  Clock,
  Trash2,
  Play,
  SearchX,
  Zap,
  Moon,
  Activity,
  Heart,
  CloudRain,
  Flame,
  Coffee,
  Radio,
  Headphones,
} from "lucide-react";
import {
  useSearch,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
} from "../hooks/useSearch";
import { useSearchStore } from "../store/searchStore";
import { bestImg, getArtists, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { useApp } from "../context/AppContext";

// ─── Browse categories — universal moods & vibes ────────────────────────────
// NOTE: queries are carefully chosen to return good results from JioSaavn's
// literal-match search. Avoid generic "sad songs" (matches "Sadhli" etc.).
// Instead use specific well-known titles, playlist names, or descriptive terms.
const BROWSE_CATEGORIES = [
  {
    label: "Trending",
    icon: TrendingUp,
    iconColor: "text-orange-400",
    bg: "bg-orange-400/[0.07]",
    query: "top hits 2026",
  },
  {
    label: "Party",
    icon: Zap,
    iconColor: "text-violet-400",
    bg: "bg-violet-400/[0.07]",
    query: "dance party hits",
  },
  {
    label: "Chill",
    icon: Moon,
    iconColor: "text-cyan-400",
    bg: "bg-cyan-400/[0.07]",
    query: "chill vibes lofi",
  },
  {
    label: "Sad",
    icon: CloudRain,
    iconColor: "text-indigo-400",
    bg: "bg-indigo-400/[0.07]",
    query: "heartbreak emotional hits",
  },
  {
    label: "Romantic",
    icon: Heart,
    iconColor: "text-rose-400",
    bg: "bg-rose-400/[0.07]",
    query: "love romantic hits",
  },
  {
    label: "Workout",
    icon: Activity,
    iconColor: "text-red-400",
    bg: "bg-red-400/[0.07]",
    query: "high energy workout pump",
  },
  {
    label: "New Releases",
    icon: Flame,
    iconColor: "text-amber-400",
    bg: "bg-amber-400/[0.07]",
    query: "latest new releases 2026",
  },
  {
    label: "Focus",
    icon: Coffee,
    iconColor: "text-emerald-400",
    bg: "bg-emerald-400/[0.07]",
    query: "instrumental focus study",
  },
  {
    label: "Podcasts",
    icon: Radio,
    iconColor: "text-blue-400",
    bg: "bg-blue-400/[0.07]",
    query: "popular podcasts",
  },
  {
    label: "Acoustic",
    icon: Headphones,
    iconColor: "text-teal-400",
    bg: "bg-teal-400/[0.07]",
    query: "unplugged acoustic live",
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
      <div className="relative z-10 flex flex-row sm:flex-col gap-3 items-center sm:items-start">
        <img
          src={img}
          alt={name}
          className={`w-14 h-14 sm:w-20 sm:h-20 object-cover shadow-2xl flex-shrink-0 ${isArtist ? "rounded-full" : "rounded-xl"}`}
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-base sm:text-2xl font-black text-white tracking-tight leading-tight line-clamp-2">
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

  const { query, setQuery, state, result, loadMore } = useSearch();

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
      if (e.key === "Escape") navigate(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const handleChange = useCallback(
    (v: string) => {
      setQuery(v);
      setUrlParams(v.trim() ? { q: v } : {}, { replace: true });
    },
    [setQuery, setUrlParams],
  );

  const handleEnter = useCallback(() => {
    if (query.trim() && state === "results") {
      saveRecentSearch(query.trim());
      setRecentSearches(getRecentSearches());
      addRecentSearch(query.trim());
    }
  }, [query, state, addRecentSearch]);

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
      inputRef.current?.focus();
    },
    [setQuery, setUrlParams, addRecentSearch],
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
              {state === "loading" ? (
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
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
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
                    "Top hits 2026",
                    "Chill vibes",
                    "Workout beats",
                    "New releases",
                    "Sad songs",
                    "Party mix",
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

            {/* Browse */}
            <div>
              <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <Sparkles size={11} /> Browse
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {BROWSE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.label}
                      onClick={() => handleChipClick(cat.query)}
                      className={`flex items-center gap-2.5 h-[48px] rounded-xl px-3.5 ${cat.bg} border border-white/[0.05] hover:border-white/[0.12] active:scale-[0.97] transition-all group text-left`}
                    >
                      <Icon
                        size={16}
                        className={`flex-shrink-0 ${cat.iconColor} opacity-80 group-hover:opacity-100 transition-opacity`}
                      />
                      <span className="text-[13px] font-semibold text-white/70 group-hover:text-white transition-colors truncate">
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SKELETON — show while any search is loading ── */}
        {state === "loading" && (
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
        {state === "results" && result && (
          <div className="py-4 space-y-7 max-w-2xl">
            {result.parsedIntent?.displayContext && (
              <div className="flex items-center gap-2 px-1">
                <Sparkles size={12} className="text-sp-green flex-shrink-0" />
                <span className="text-[12px] text-white/40 font-medium">
                  {result.parsedIntent.displayContext}
                </span>
              </div>
            )}

            {/* Desktop 2-col: Top Result + Songs */}
            <div className="hidden md:grid md:grid-cols-[280px_1fr] gap-5">
              {result.topResult && (
                <div>
                  <h3 className="text-white/35 text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5">
                    Top Result
                  </h3>
                  <TopResultHero item={result.topResult} onPlay={handlePlay} />
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
                  <TopResultHero item={result.topResult} onPlay={handlePlay} />
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
              Try different keywords or check the spelling
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm mx-auto">
              {[
                "Trending 2026",
                "New releases",
                "Party hits",
                "Chill vibes",
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
