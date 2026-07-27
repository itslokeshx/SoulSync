import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  X,
  TrendingUp,
  Loader2,
  Play,
  Pause,
  SearchX,
  Heart,
  MoreVertical,
  Clock,
  Trash2,
  Sparkles,
  ChevronRight,
  Disc3,
  User,
  Music,
} from "lucide-react";
import {
  useSearch,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearAllRecentSearches,
} from "../hooks/useSearch";
import { useUIStore } from "../store/uiStore";
import { bestImg, getArtists, fmt, onImgErr } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { ArtistLinks } from "../components/ui/ArtistLinks";
import { useAuth } from "../auth/AuthContext";
import { useApp } from "../context/AppContext";
import { analytics } from "../services/analytics";

type TabType = "all" | "songs" | "albums" | "artists";

const POPULAR_BY_LANG: Record<string, string[]> = {
  tamil: [
    "Anirudh Ravichander", "A.R. Rahman", "Sid Sriram", "Yuvan Shankar Raja",
    "Sai Abhyankkar", "Hukum", "Katchi Sera", "Coolie Soundtrack", "Paal Dabba"
  ],
  hindi: [
    "Arijit Singh", "Pritam", "Shreya Ghoshal", "Jubin Nautiyal",
    "Atif Aslam", "Kesariya", "Tum Hi Ho", "Badshah"
  ],
  telugu: [
    "Devi Sri Prasad", "S. Thaman", "M.M. Keeravani", "Sid Sriram",
    "Pushpa 2", "Devara", "Anirudh Ravichander"
  ],
  punjabi: [
    "Diljit Dosanjh", "Karan Aujla", "Sidhu Moose Wala", "AP Dhillon", "B Praak"
  ],
  malayalam: [
    "Sushin Shyam", "Jakes Bejoy", "Illuminati", "Aavesham OST", "Vineeth Sreenivasan"
  ],
  kannada: [
    "Arjun Janya", "V. Harikrishna", "B. Ajaneesh Loknath", "Ravi Basrur"
  ],
  english: [
    "Taylor Swift", "The Weeknd", "Drake", "Ed Sheeran", "Billie Eilish", "Olivia Rodrigo"
  ]
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SongRow({
  song,
  index,
  onPlay,
  isCurrent,
  isPlaying,
  liked,
  onLike,
}: {
  song: any;
  index: number;
  onPlay: (s: any, queue?: any[]) => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
  liked?: boolean;
  onLike?: (s: any) => void;
}) {
  const img = bestImg(song.image) || FALLBACK_IMG;
  const artist = getArtists(song);
  const duration = fmt(song.duration);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  return (
    <div
      onClick={() => {
        analytics.track("search_result_click", { item_id: song.id, item_type: "song", title: song.name });
        onPlay(song, [song]);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onPlay(song, [song])}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.08] active:bg-white/[0.12] active:scale-[0.99] transition-all group text-left cursor-pointer border border-transparent ${
        isCurrent ? "bg-white/[0.06] border-white/10" : ""
      }`}
    >
      <span className="w-5 text-center text-xs font-medium text-white/30 group-hover:hidden flex-shrink-0 font-mono select-none">
        {isCurrent && isPlaying ? (
          <span className="text-sp-green text-xs animate-pulse">▶</span>
        ) : (
          index + 1
        )}
      </span>
      <div className="relative flex-shrink-0 hidden group-hover:block w-5">
        {isCurrent && isPlaying ? (
          <Pause size={13} className="text-sp-green fill-sp-green" />
        ) : (
          <Play size={13} className="text-white fill-white" />
        )}
      </div>

      <div className="relative flex-shrink-0">
        <img
          src={img}
          alt={song.name}
          className="w-11 h-11 rounded-lg object-cover shadow-sm bg-neutral-900"
          onError={onImgErr}
        />
        {isCurrent && isPlaying && (
          <div className="absolute inset-0 rounded-lg bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex gap-0.5 items-end h-3.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-0.5 bg-sp-green rounded-full animate-bounce"
                  style={{
                    height: `${6 + i * 3}px`,
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
          className={`text-sm font-semibold truncate ${
            isCurrent ? "text-sp-green" : "text-white group-hover:text-white"
          }`}
        >
          {song.name}
        </p>
        <p className="text-xs text-white/50 truncate group-hover:text-white/70 transition-colors mt-0.5">
          <ArtistLinks song={song} />
        </p>
      </div>

      {song.album && (
        <p className="hidden md:block text-xs text-white/40 truncate max-w-[180px]">
          {typeof song.album === "string" ? song.album : song.album.name || ""}
        </p>
      )}

      {song.playCount > 1000000 && (
        <span className="hidden lg:inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 border border-white/5">
          {(song.playCount / 1000000).toFixed(1)}M plays
        </span>
      )}

      {onLike && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(song);
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-sp-green transition-all"
        >
          <Heart
            size={15}
            className={liked ? "fill-sp-green text-sp-green opacity-100" : ""}
          />
        </button>
      )}

      <span className="text-xs text-white/40 font-mono flex-shrink-0">
        {duration}
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          showContextMenu(e.clientX, e.clientY, song);
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all flex-shrink-0"
      >
        <MoreVertical size={15} />
      </button>
    </div>
  );
}

function AlbumCard({
  album,
  onClick,
}: {
  album: any;
  onClick: (id: string) => void;
}) {
  const img = bestImg(album.image) || FALLBACK_IMG;
  const artist =
    album.primaryArtists ||
    album.artist ||
    (typeof album.artists === "string" ? album.artists : "");

  return (
    <div
      onClick={() => {
        analytics.track("search_result_click", { item_id: album.id, item_type: "album", title: album.name });
        onClick(album.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(album.id)}
      className="group relative bg-white/[0.03] hover:bg-white/[0.08] p-3.5 rounded-2xl transition-all duration-200 cursor-pointer border border-white/5 hover:border-white/10 hover:scale-[1.02] flex flex-col"
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-neutral-900 shadow-md">
        <img
          src={img}
          alt={album.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={onImgErr}
        />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-sp-green text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <Play size={18} className="fill-black ml-0.5" />
          </div>
        </div>
      </div>
      <h3 className="text-sm font-bold text-white truncate group-hover:text-sp-green transition-colors">
        {album.name}
      </h3>
      <p className="text-xs text-white/50 truncate mt-1">{artist || "Album"}</p>
      <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-white/40">
        <span>{album.year || "Release"}</span>
        <span className="flex items-center gap-1">
          <Disc3 size={11} /> Album
        </span>
      </div>
    </div>
  );
}

function ArtistCard({
  artist,
  onClick,
}: {
  artist: any;
  onClick: (id: string) => void;
}) {
  const img = bestImg(artist.image) || FALLBACK_IMG;
  const followers =
    artist.follower_count || artist.followers
      ? `${(parseInt(artist.follower_count || artist.followers, 10) / 1000000).toFixed(1)}M followers`
      : "Artist";

  return (
    <div
      onClick={() => {
        analytics.track("search_result_click", { item_id: artist.id, item_type: "artist", title: artist.name });
        onClick(artist.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(artist.id)}
      className="group relative bg-white/[0.03] hover:bg-white/[0.08] p-4 rounded-2xl transition-all duration-200 cursor-pointer border border-white/5 hover:border-white/10 hover:scale-[1.02] flex flex-col items-center text-center"
    >
      <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden mb-3 bg-neutral-900 shadow-md ring-2 ring-white/10 group-hover:ring-sp-green/50 transition-all">
        <img
          src={img}
          alt={artist.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={onImgErr}
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-sp-green text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
            <User size={18} className="fill-black" />
          </div>
        </div>
      </div>
      <h3 className="text-sm font-bold text-white truncate max-w-full group-hover:text-sp-green transition-colors">
        {artist.name}
      </h3>
      <p className="text-xs text-white/50 truncate mt-1">{followers}</p>
      <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/70">
        Artist
      </span>
    </div>
  );
}

// ─── Main SearchPage ─────────────────────────────────────────────────────────

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";

  const {
    query,
    setQuery,
    state,
    result,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    reset,
  } = useSearch();

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [songLimit, setSongLimit] = useState(50);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
    likedSongs,
    handleLike: onLike,
  } = useApp();

  const { user } = useAuth();
  const userLangs = user?.preferences?.languages || [];

  const popularSearches = React.useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    for (const lang of userLangs) {
      const items = POPULAR_BY_LANG[lang.toLowerCase()] || [];
      for (const item of items) {
        if (!seen.has(item)) {
          seen.add(item);
          list.push(item);
        }
      }
    }

    // Default fallback order if list is short
    const fallbackLangs = ["tamil", "hindi", "english"];
    for (const lang of fallbackLangs) {
      const items = POPULAR_BY_LANG[lang] || [];
      for (const item of items) {
        if (!seen.has(item)) {
          seen.add(item);
          list.push(item);
        }
      }
    }

    return list.slice(0, 12);
  }, [userLangs]);

  // Load recent searches from localStorage
  const refreshRecentSearches = useCallback(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    refreshRecentSearches();
  }, [refreshRecentSearches]);

  // Sync state with URL params
  useEffect(() => {
    if (queryParam && queryParam !== query) {
      setQuery(queryParam);
    }
  }, [queryParam, setQuery]);

  // Auto-focus search input smoothly on mount or navigation
  useEffect(() => {
    const focusInput = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };
    focusInput();
    const timer = setTimeout(focusInput, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSearchSubmit = (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    saveRecentSearch(searchTerm);
    refreshRecentSearches();
    setSearchParams({ q: searchTerm });
    setShowSuggestions(false);
    setSelectedIndex(-1);
    analytics.track("search", {
      query: searchTerm,
      result_count: (result?.songs?.length || 0) + (result?.albums?.length || 0) + (result?.artists?.length || 0),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") handleSearchSubmit(query);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        const item = suggestions[selectedIndex];
        setQuery(item.query || item.text);
        handleSearchSubmit(item.query || item.text);
      } else {
        handleSearchSubmit(query);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  const handleClear = () => {
    reset();
    setSearchParams({});
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleRemoveRecent = (e: React.MouseEvent, s: string) => {
    e.stopPropagation();
    removeRecentSearch(s);
    refreshRecentSearches();
  };

  const handleClearAllRecent = () => {
    clearAllRecentSearches();
    refreshRecentSearches();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setShowSuggestions]);

  const songs = result?.songs || [];
  const albums = result?.albums || [];
  const artists = result?.artists || [];

  const hasSongs = songs.length > 0;
  const hasAlbums = albums.length > 0;
  const hasArtists = artists.length > 0;
  const hasAnyResults = hasSongs || hasAlbums || hasArtists;

  return (
    <div className="min-h-screen pb-32 pt-2 px-4 md:px-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* ── Search Bar & Header ────────────────────────────────────────── */}
      <div className="relative" ref={searchContainerRef}>
        <div
          className="relative flex items-center cursor-text"
          onClick={() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus();
            }
          }}
        >
          <Search
            size={20}
            className="absolute left-4 text-white/40 pointer-events-none transition-colors"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search songs, albums, artists..."
            className="w-full bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12] text-white placeholder-white/40 text-base font-medium rounded-full pl-12 pr-12 py-3.5 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-sp-green/60 transition-all duration-200 shadow-inner"
            aria-label="Search music, albums, and artists"
          />
          {state === "loading" ? (
            <Loader2
              size={18}
              className="absolute right-4 text-sp-green animate-spin"
            />
          ) : query ? (
            <button
              onClick={handleClear}
              className="absolute right-4 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Clear search query"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        {/* ── Dynamic Instant Suggestions Overlay (ONLY when typing) ────────────────── */}
        <AnimatePresence>
          {showSuggestions && query.trim().length > 0 && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
              className="absolute z-[100] left-0 right-0 top-full mt-2 bg-black/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden max-h-[60vh] md:max-h-[420px] overflow-y-auto overscroll-contain"
            >
              <div className="p-2 space-y-0.5">
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setQuery(item.query || item.text);
                      handleSearchSubmit(item.query || item.text);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl cursor-pointer text-sm transition-all duration-150 active:scale-[0.99] ${
                      selectedIndex === idx
                        ? "bg-white/15 text-white font-medium"
                        : "text-white/80 hover:bg-white/10 active:bg-white/15 hover:text-white"
                    }`}
                  >
                    {item.type === "artist" ? (
                      <User size={16} className="text-sp-green flex-shrink-0" />
                    ) : item.type === "album" ? (
                      <Disc3 size={16} className="text-blue-400 flex-shrink-0" />
                    ) : (
                      <Search size={16} className="text-white/40 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{item.text}</p>
                      {item.subtext && (
                        <p className="text-xs text-white/40 truncate">
                          {item.subtext}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Filter Chips (Shown ONLY during search) ────────────────────── */}
      {query.trim() !== "" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar animate-fadeIn">
          {(["all", "songs", "albums", "artists"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all duration-200 flex-shrink-0 ${
                  isActive
                    ? "bg-white text-black shadow-md scale-[1.02]"
                    : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                }`}
              >
                {tab === "all" ? "All" : tab}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Main Results View ────────────────────────────────────────── */}

      {/* 1. IDLE / STATIC LANDING STATE (Recent Searches & Trending) */}
      {state === "idle" && !query.trim() && (
        <div className="space-y-8 animate-fadeIn pt-2">
          {recentSearches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock size={16} className="text-white/60" />
                  Recent Searches
                </h3>
                <button
                  onClick={handleClearAllRecent}
                  className="text-xs font-semibold text-white/40 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {recentSearches.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setQuery(s);
                      handleSearchSubmit(s);
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.16] border border-white/10 text-white text-xs font-medium cursor-pointer transition-all active:scale-95 group shadow-sm"
                  >
                    <Search size={12} className="text-white/40 group-hover:text-white transition-colors" />
                    <span>{s}</span>
                    <button
                      onClick={(e) => handleRemoveRecent(e, s)}
                      className="text-white/30 hover:text-white p-0.5 rounded-full hover:bg-white/20 transition-colors -mr-1"
                      aria-label="Remove search"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentSearches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 text-white/30">
              <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/40 mb-1">
                <Search size={32} strokeWidth={1.5} />
              </div>
              <h2 className="text-base font-bold text-white/80">Search SoulSync</h2>
              <p className="text-xs text-white/40 max-w-xs leading-relaxed">
                Find your favorite songs, artists, soundtracks, and albums.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. NO RESULTS STATE */}
      {state === "no-results" && (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-white/[0.02] border border-white/5 rounded-3xl p-8">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/40 mb-2">
            <SearchX size={32} />
          </div>
          <h2 className="text-xl font-bold text-white">
            No results found for &quot;{query}&quot;
          </h2>
          <p className="text-xs text-white/50 max-w-sm">
            Please check your spelling or try searching for a different song,
            artist, or album name.
          </p>
          <div className="pt-2 text-left bg-white/5 p-4 rounded-2xl max-w-xs w-full text-xs text-white/60 space-y-2">
            <p className="font-semibold text-white">Search Tips:</p>
            <ul className="list-disc list-inside space-y-1 text-white/50">
              <li>Try searching by artist (e.g. &quot;Anirudh&quot;)</li>
              <li>Try searching by album or movie name</li>
              <li>Simplify query terms</li>
            </ul>
          </div>
        </div>
      )}

      {/* 3. HAS RESULTS STATE */}
      {state === "results" && hasAnyResults && (
        <div className="space-y-8 animate-fadeIn">
          {/* ── ALL TAB ───────────────────────────────────────────────── */}
          {activeTab === "all" && (
            <div className="space-y-8">
              {/* Section 1: Songs */}
              {hasSongs && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                      <Music size={18} className="text-sp-green" /> Songs
                    </h2>
                    <button
                      onClick={() => setActiveTab("songs")}
                      className="text-xs font-bold text-sp-green hover:underline flex items-center gap-1"
                    >
                      Show all <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {songs.slice(0, 5).map((song, i) => (
                      <SongRow
                        key={song.id}
                        song={song}
                        index={i}
                        isCurrent={currentSong?.id === song.id}
                        isPlaying={isPlaying}
                        onPlay={() => onPlay(song, [song])}
                        liked={!!likedSongs?.[song.id]}
                        onLike={onLike}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Section 2: Albums */}
              {hasAlbums && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                      <Disc3 size={18} className="text-blue-400" /> Albums
                    </h2>
                    <button
                      onClick={() => setActiveTab("albums")}
                      className="text-xs font-bold text-sp-green hover:underline flex items-center gap-1"
                    >
                      Show all <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {albums.slice(0, 5).map((album) => (
                      <AlbumCard
                        key={album.id}
                        album={album}
                        onClick={(id) => navigate(`/album/${id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Section 3: Artists */}
              {hasArtists && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                      <User size={18} className="text-purple-400" /> Artists
                    </h2>
                    <button
                      onClick={() => setActiveTab("artists")}
                      className="text-xs font-bold text-sp-green hover:underline flex items-center gap-1"
                    >
                      Show all <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {artists.slice(0, 5).map((artist) => (
                      <ArtistCard
                        key={artist.id}
                        artist={artist}
                        onClick={(id) => navigate(`/artist/${id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ── SONGS TAB ─────────────────────────────────────────────── */}
          {activeTab === "songs" && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-white">
                All Song Results
              </h2>
              {hasSongs ? (
                <div className="space-y-1">
                  {songs.slice(0, songLimit).map((song, i) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      index={i}
                      isCurrent={currentSong?.id === song.id}
                      isPlaying={isPlaying}
                      onPlay={() => onPlay(song, [song])}
                      liked={!!likedSongs?.[song.id]}
                      onLike={onLike}
                    />
                  ))}
                  {songs.length > songLimit && (
                    <div className="pt-4 text-center">
                      <button
                        onClick={() => setSongLimit((prev) => prev + 50)}
                        className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all shadow-md"
                      >
                        Load More Songs ({songs.length - songLimit} remaining)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-white/50 py-8 text-center">
                  No song matches found.
                </p>
              )}
            </div>
          )}

          {/* ── ALBUMS TAB ────────────────────────────────────────────── */}
          {activeTab === "albums" && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-white">
                All Album Results
              </h2>
              {hasAlbums ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {albums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onClick={(id) => navigate(`/album/${id}`)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/50 py-8 text-center">
                  No album matches found.
                </p>
              )}
            </div>
          )}

          {/* ── ARTISTS TAB ───────────────────────────────────────────── */}
          {activeTab === "artists" && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-white">
                All Artist Results
              </h2>
              {hasArtists ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {artists.map((artist) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      onClick={(id) => navigate(`/artist/${id}`)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/50 py-8 text-center">
                  No artist matches found.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
