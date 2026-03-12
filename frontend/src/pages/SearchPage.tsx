import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  ChevronDown,
  ArrowLeft,
  Clock,
  Trash2,
} from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import { useSearchStore } from "../store/searchStore";
import { bestImg, getArtists, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { useApp } from "../context/AppContext";

const TRENDING = [
  "Arijit Singh latest hits",
  "lofi chill beats",
  "90s Bollywood classics",
  "Diljit Dosanjh",
  "workout pump songs",
  "AP Dhillon",
];

const MOOD_CHIPS = [
  { label: "Chill 🌙", q: "chill relaxing songs" },
  { label: "Party 🎉", q: "party hits" },
  { label: "Sad 💔", q: "sad heartbreak songs" },
  { label: "Focus 🧠", q: "study focus music" },
  { label: "Workout 💪", q: "gym workout songs" },
  { label: "Romance 💕", q: "romantic love songs" },
];

// ─── Sub-components ───────────────────────────────────────────────────

function SongRow({ song, onPlay }: { song: any; onPlay: (s: any) => void }) {
  const img = bestImg(song.image) || FALLBACK_IMG;
  const artist = getArtists(song);
  const duration = fmt(song.duration);
  return (
    <button
      onClick={() => onPlay(song)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.09] active:bg-white/[0.13] active:scale-[0.99] transition-all group text-left cursor-pointer"
    >
      <div className="relative flex-shrink-0">
        <img
          src={img}
          alt={song.name}
          className="w-11 h-11 rounded-lg object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[8px] border-transparent border-l-white ml-0.5" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-[14px] font-medium truncate group-hover:text-sp-green transition-colors">
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

function TopResultCard({
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
      ? "Album • " + (item.description || "")
      : getArtists(item);

  const handleClick = () => {
    if (isArtist) navigate(`/artist/${item.id}`);
    else if (isAlbum) navigate(`/album/${item.id}`);
    else onPlay(item);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full h-full flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0 p-3 sm:p-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.08] hover:border-sp-green/30 active:scale-[0.97] transition-all group cursor-pointer text-left"
    >
      <div className="relative flex-shrink-0 sm:mb-3">
        <img
          src={img}
          alt={name}
          className={`w-14 h-14 sm:w-20 sm:h-20 object-cover ${isArtist ? "rounded-full" : "rounded-xl"}`}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-sp-green flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          {isArtist || isAlbum ? (
            <ArrowUpRight size={12} className="text-black" />
          ) : (
            <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[7px] border-transparent border-l-black ml-0.5" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 sm:w-full">
        <p className="text-white text-[14px] font-bold truncate">{name}</p>
        <p className="text-white/40 text-[11px] truncate mt-0.5">{subtitle}</p>
        <span className="mt-1.5 sm:mt-2 inline-flex px-2 py-0.5 rounded-full bg-sp-green/15 text-sp-green text-[10px] font-bold uppercase tracking-wide">
          Top Results
        </span>
      </div>
    </button>
  );
}

function ArtistChip({ artist }: { artist: any }) {
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
          className="w-16 h-16 rounded-full object-cover border border-white/10 group-hover:border-sp-green/50 transition-all group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[8px] border-transparent border-l-white ml-0.5" />
        </div>
      </div>
      <p className="text-white/60 text-[11px] text-center font-medium truncate w-full group-hover:text-white transition-colors">
        {artist.name}
      </p>
    </button>
  );
}

function AlbumCard({ album }: { album: any }) {
  const navigate = useNavigate();
  const img = bestImg(album.image) || FALLBACK_IMG;
  return (
    <button
      onClick={() => album.id && navigate(`/album/${album.id}`)}
      className="flex flex-col gap-2 w-32 flex-shrink-0 group cursor-pointer text-left"
    >
      <div className="relative">
        <img
          src={img}
          alt={album.name}
          className="w-32 h-32 rounded-xl object-cover group-hover:opacity-80 transition-opacity"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
        />
        <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[10px] border-transparent border-l-white ml-0.5" />
        </div>
      </div>
      <div>
        <p className="text-white/80 text-[12px] font-medium truncate group-hover:text-white transition-colors">
          {album.name}
        </p>
        <p className="text-white/35 text-[11px] truncate">
          {album.primaryArtists || ""}
        </p>
      </div>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="w-11 h-11 rounded-lg bg-white/[0.06] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-white/[0.06] rounded w-3/4" />
        <div className="h-3 bg-white/[0.04] rounded w-1/2" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export function SearchPage() {
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const { playSong } = useApp();
  const { recentSearches, addRecentSearch, clearRecentSearches } =
    useSearchStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { query, setQuery, state, result, loadingMore, loadMore } = useSearch();

  // Init from URL and focus
  useEffect(() => {
    const urlQ = urlParams.get("q") || "";
    if (urlQ) setQuery(urlQ);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape → back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // Live: update query + URL on every keystroke
  const handleChange = useCallback(
    (v: string) => {
      setQuery(v);
      setUrlParams(v.trim() ? { q: v } : {}, { replace: true });
    },
    [setQuery, setUrlParams],
  );

  // Save to recent on Enter or blur with a result
  const handleEnter = useCallback(() => {
    if (query.trim() && state === "results") addRecentSearch(query.trim());
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
      if (query.trim()) addRecentSearch(query.trim());
    },
    [playSong, result, query, addRecentSearch],
  );

  const handleChipClick = useCallback(
    (q: string) => {
      setQuery(q);
      setUrlParams({ q }, { replace: true });
      addRecentSearch(q);
      inputRef.current?.focus();
    },
    [setQuery, setUrlParams, addRecentSearch],
  );

  const clearInput = useCallback(() => {
    handleChange("");
    inputRef.current?.focus();
  }, [handleChange]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#050505]">
      {/* ── Top bar: always at top, no sticky needed ── */}
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

          {/* Input pill */}
          <div className="flex-1 flex items-center gap-2.5 h-12 px-4 rounded-2xl bg-white/[0.08] border border-white/[0.09] focus-within:border-sp-green/60 focus-within:bg-white/[0.11] transition-all duration-150">
            {/* Icon: spinner while loading fresh, dot while refreshing stale */}
            {state === "loading" ? (
              <Loader2
                size={16}
                className="text-sp-green flex-shrink-0 animate-spin"
              />
            ) : (
              <Search size={16} className="text-white/35 flex-shrink-0" />
            )}

            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEnter();
              }}
              placeholder="Search songs, artists, albums..."
              className="flex-1 bg-transparent text-white text-[16px] placeholder-white/20 outline-none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
            />

            {query && (
              <button
                onClick={clearInput}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white/[0.08] text-white/40 hover:bg-white/[0.15] hover:text-white transition-all active:scale-90"
                aria-label="Clear"
              >
                <X size={12} />
              </button>
            )}
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
        {/* IDLE */}
        {state === "idle" && (
          <div className="py-5 space-y-7 max-w-2xl">
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] flex items-center gap-2">
                    <Clock size={12} /> Recent
                  </h3>
                  <button
                    onClick={clearRecentSearches}
                    className="text-white/25 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/[0.04]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {recentSearches.slice(0, 6).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleChipClick(r)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Clock
                          size={13}
                          className="text-white/20 group-hover:text-white/40 transition-colors"
                        />
                        <span className="text-white/65 text-[14px]">{r}</span>
                      </div>
                      <ArrowUpRight
                        size={13}
                        className="text-white/15 group-hover:text-sp-green/60 transition-colors"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <TrendingUp size={12} /> Trending
              </h3>
              <div className="space-y-0.5">
                {TRENDING.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleChipClick(t)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Search
                        size={13}
                        className="text-white/20 group-hover:text-white/40 transition-colors"
                      />
                      <span className="text-white/65 text-[14px]">{t}</span>
                    </div>
                    <ArrowUpRight
                      size={13}
                      className="text-white/15 group-hover:text-sp-green/60 transition-colors"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <Sparkles size={12} /> Browse by mood
              </h3>
              <div className="flex flex-wrap gap-2">
                {MOOD_CHIPS.map(({ label, q }) => (
                  <button
                    key={label}
                    onClick={() => handleChipClick(q)}
                    className="px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/60 text-[13px] font-medium hover:bg-white/[0.1] hover:text-white hover:border-white/[0.15] active:scale-[0.97] transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LOADING (no cache) */}
        {state === "loading" && (
          <div className="py-4 max-w-2xl">
            <div className="h-px bg-gradient-to-r from-transparent via-sp-green to-transparent mb-4 rounded-full animate-pulse" />
            <div className="space-y-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </div>
        )}

        {/* RESULTS (including stale-hint preview) */}
        {state === "results" && result && (
          <div className="py-4 space-y-7 max-w-2xl">
            {result.parsedIntent?.displayContext && (
              <span className="inline-flex px-3 py-1 rounded-full bg-sp-green/10 border border-sp-green/20 text-sp-green text-[11px] font-semibold">
                {result.parsedIntent.displayContext}
              </span>
            )}

            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
              {result.topResult && (
                <div className="w-full sm:w-44 sm:flex-shrink-0">
                  <TopResultCard item={result.topResult} onPlay={handlePlay} />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-0.5">
                {result.songs.slice(0, result.topResult ? 4 : 6).map((song) => (
                  <SongRow key={song.id} song={song} onPlay={handlePlay} />
                ))}
              </div>
            </div>

            {result.artists?.length > 0 && (
              <div>
                <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                  <Mic2 size={12} /> Artists
                </h3>
                <div className="flex gap-5 overflow-x-auto pb-1 thin-scrollbar">
                  {result.artists.slice(0, 8).map((a: any) => (
                    <ArtistChip key={a.id || a.name} artist={a} />
                  ))}
                </div>
              </div>
            )}

            {result.albums?.length > 0 && (
              <div>
                <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                  <Disc3 size={12} /> Albums
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-1 thin-scrollbar">
                  {result.albums.slice(0, 10).map((a: any) => (
                    <AlbumCard key={a.id || a.name} album={a} />
                  ))}
                </div>
              </div>
            )}

            {result.songs.length > (result.topResult ? 4 : 6) && (
              <div>
                <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                  <Music size={12} /> Songs
                  <span className="ml-auto text-white/20 font-normal normal-case tracking-normal">
                    {result.songs.length}
                  </span>
                </h3>
                <div className="space-y-0.5">
                  {result.songs.slice(result.topResult ? 4 : 6).map((song) => (
                    <SongRow key={song.id} song={song} onPlay={handlePlay} />
                  ))}
                </div>
              </div>
            )}

            {(result.relatedSearches?.length ?? 0) > 0 && (
              <div>
                <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-[0.15em] mb-2">
                  Related
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.relatedSearches?.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleChipClick(s)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.07] text-white/50 text-[12px] hover:bg-white/[0.09] hover:text-white transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} className="py-3 flex justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-white/30 text-[12px]">
                  <Loader2 size={14} className="animate-spin" /> Loading more...
                </div>
              )}
              {result.hasMore && !loadingMore && (
                <button
                  onClick={loadMore}
                  className="flex items-center gap-1.5 text-white/30 hover:text-sp-green text-[12px] transition-colors"
                >
                  <ChevronDown size={14} /> Show more
                </button>
              )}
            </div>
          </div>
        )}

        {/* NO RESULTS */}
        {state === "no-results" && (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
              <Search size={28} className="text-white/15" />
            </div>
            <p className="text-white/50 font-semibold text-base">
              No results for "{query}"
            </p>
            <p className="text-white/25 text-sm mt-2">
              Try different words or a mood
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {MOOD_CHIPS.slice(0, 3).map(({ label, q }) => (
                <button
                  key={label}
                  onClick={() => handleChipClick(q)}
                  className="px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/40 text-[12px] hover:bg-white/[0.09] hover:text-white transition-all"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ERROR */}
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
