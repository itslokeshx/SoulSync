import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Play, Sparkles, Music, Disc3 } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";
import { SongRow } from "../components/cards/SongRow";
import { ArtistCard } from "../components/cards/ArtistCard";
import { AlbumCard } from "../components/cards/AlbumCard";
import { BrowsePage } from "./BrowsePage";
import { bestImg, getArtists, onImgErr } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { useApp } from "../context/AppContext";
import { useSearchStore } from "../store/searchStore";
import { smartSearch } from "../api/backend";

const TABS = ["All", "Songs", "Artists", "Albums"] as const;

interface ParsedIntent {
  intent: string;
  displayContext: string;
  entities: {
    artist: string | null;
    movie: string | null;
    mood: string | null;
    language: string | null;
    format: string | null;
  };
}

export const SearchPage = () => {
  const navigate = useNavigate();
  const query = useSearchStore((s) => s.query);
  const addRecent = useSearchStore((s) => s.addRecentSearch);
  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
    likedSongs,
    handleLike: onLike,
  } = useApp();

  const onArtistClick = (a: any) => navigate(`/artist/${a.id}`);
  const onAlbumClick = (al: any) => navigate(`/album/${al.id}`);
  const onSearch = (q: string) => {
    setSearchQuery(q);
    navigate("/search");
  };

  const [results, setResults] = useState<{
    songs: any[];
    artists: any[];
    albums: any[];
    topResult: any;
    displayContext: string;
    parsedIntent: ParsedIntent | null;
  }>({
    songs: [],
    artists: [],
    albums: [],
    topResult: null,
    displayContext: "",
    parsedIntent: null,
  });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<string>("All");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setTab("All");
    if (!query.trim()) return;

    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setResults({
      songs: [],
      artists: [],
      albums: [],
      topResult: null,
      displayContext: "",
      parsedIntent: null,
    });

    (async () => {
      try {
        const data: any = await smartSearch(query, "all", 25);
        if (ctrl.signal.aborted) return;

        addRecent(query);

        setResults({
          songs: data?.songs || [],
          artists: (data?.artists as any)?.results || data?.artists || [],
          albums: (data?.albums as any)?.results || data?.albums || [],
          topResult: data?.topResult || null,
          displayContext: data?.displayContext || "",
          parsedIntent: data?.parsedIntent || null,
        });
      } catch {
        if (!ctrl.signal.aborted) {
          setResults({
            songs: [],
            artists: [],
            albums: [],
            topResult: null,
            displayContext: "",
            parsedIntent: null,
          });
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [query]); // eslint-disable-line

  if (!query.trim()) return <BrowsePage onSearch={onSearch} />;

  /* ── Loading skeleton ── */
  if (loading)
    return (
      <div className="space-y-6 animate-fadeIn">
        <Skeleton className="h-6 w-60 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-52 rounded-2xl" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="flex gap-5 pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="w-24 h-24 rounded-full flex-shrink-0"
            />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );

  const none =
    !results.songs.length && !results.artists.length && !results.albums.length;

  /* ── Empty state ── */
  if (none)
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-5 animate-fadeIn text-center">
        <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
          <Search size={24} className="text-sp-muted" />
        </div>
        <div>
          <p className="text-white font-bold text-lg">No results found</p>
          <p className="text-white/30 text-sm mt-1.5">
            for &ldquo;{query}&rdquo;
          </p>
          <p className="text-white/20 text-xs mt-2">
            Try different keywords or check spelling
          </p>
        </div>
      </div>
    );

  const top = results.topResult || results.songs[0];
  const showS = (tab === "All" || tab === "Songs") && results.songs.length > 0;
  const showAr =
    (tab === "All" || tab === "Artists") && results.artists.length > 0;
  const showAl =
    (tab === "All" || tab === "Albums") && results.albums.length > 0;

  /* ── Intent badge ── */
  const intentIcons: Record<string, any> = {
    artist_songs: <Music size={12} />,
    specific_song: <Disc3 size={12} />,
    mood_playlist: <Sparkles size={12} />,
    bgm_search: <Music size={12} />,
  };

  return (
    <div className="animate-fadeIn space-y-8">
      {/* Smart context banner */}
      {results.displayContext &&
        results.displayContext !== `Results for "${query}"` && (
          <div className="flex items-center gap-2 text-sm text-white/50">
            {results.parsedIntent &&
              intentIcons[results.parsedIntent.intent] && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sp-green/10 text-sp-green text-xs font-medium">
                  {intentIcons[results.parsedIntent.intent]}
                  {results.parsedIntent.intent.replace(/_/g, " ")}
                </span>
              )}
            <span>{results.displayContext}</span>
          </div>
        )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-300 border ${
              tab === t
                ? "bg-white text-black border-white shadow-lg shadow-white/10"
                : "bg-white/[0.04] text-white/70 border-white/[0.06] hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Top result + first 4 songs (All tab) */}
      {tab === "All" && top && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Top Result</h2>
            <div
              onClick={() => onPlay(top, results.songs)}
              className="p-6 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-all duration-300 group relative overflow-hidden border border-white/[0.04] hover:border-white/[0.08]"
            >
              <img
                src={bestImg(top.image) || FALLBACK_IMG}
                onError={onImgErr}
                className="w-24 h-24 rounded-2xl object-cover mb-5 group-hover:scale-[1.04] transition-transform duration-300"
                style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}
              />
              <p className="text-2xl font-black text-white truncate">
                {top.name}
              </p>
              <p className="text-[13px] text-white/40 mt-2 truncate">
                {getArtists(top)} · Song
                {top.album?.name ? ` · ${top.album.name}` : ""}
                {top.year ? ` · ${top.year}` : ""}
              </p>
              {/* match reasons */}
              {top.matchReasons && top.matchReasons.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {top.matchReasons.slice(0, 3).map((r: string) => (
                    <span
                      key={r}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sp-green/10 text-sp-green"
                    >
                      {r.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-sp-green flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-300"
                style={{ boxShadow: "0 6px 24px rgba(29,185,84,0.5)" }}
              >
                <Play size={17} className="text-black fill-black ml-0.5" />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Songs</h2>
            <div className="space-y-1">
              {results.songs.slice(0, 4).map((s, i) => (
                <SongRow
                  key={s.id}
                  song={s}
                  index={i}
                  isCurrent={currentSong?.id === s.id}
                  isPlaying={isPlaying}
                  onPlay={() => onPlay(s, results.songs)}
                  liked={!!likedSongs?.[s.id]}
                  onLike={onLike}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Artists */}
      {showAr && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Artists</h2>
          <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-2">
            {results.artists.map((a: any) => (
              <ArtistCard
                key={a.id}
                artist={a}
                onClick={() => onArtistClick(a)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Songs list (Songs tab or overflow from All) */}
      {showS && tab === "Songs" && (
        <div>
          <h2 className="text-xl font-bold text-white mb-3">Songs</h2>
          <div className="space-y-1">
            {results.songs.map((s, i) => (
              <SongRow
                key={s.id}
                song={s}
                index={i}
                isCurrent={currentSong?.id === s.id}
                isPlaying={isPlaying}
                onPlay={() => onPlay(s, results.songs)}
                liked={!!likedSongs?.[s.id]}
                onLike={onLike}
              />
            ))}
          </div>
        </div>
      )}
      {showS && tab === "All" && results.songs.length > 4 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-3">More Songs</h2>
          <div className="space-y-1">
            {results.songs.slice(4).map((s, i) => (
              <SongRow
                key={s.id}
                song={s}
                index={i + 4}
                isCurrent={currentSong?.id === s.id}
                isPlaying={isPlaying}
                onPlay={() => onPlay(s, results.songs)}
                liked={!!likedSongs?.[s.id]}
                onLike={onLike}
              />
            ))}
          </div>
        </div>
      )}

      {/* Albums */}
      {showAl && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Albums</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
            {results.albums.map((al: any) => (
              <AlbumCard
                key={al.id}
                album={al}
                onClick={() => onAlbumClick(al)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
