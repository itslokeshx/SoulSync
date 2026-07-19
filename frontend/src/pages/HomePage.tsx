/* ───────────────────────────────────────────────────────────────
   SoulSync — Premium Home (single-file drop-in)
   ───────────────────────────────────────────────────────────────
   Replace  frontend/src/pages/HomePage.tsx  with this file.
   Delete (or leave unused) the old HomePage imports of HSection /
   SongCard / SongRow from this page — they're inlined below.

   Required peer imports this file expects to exist in your project:
     - useApp from "../context/AppContext"           (currentSong, isPlaying, playSong, likedSongs, handleLike)
     - useDashboard from "../hooks/useDashboard"     (see return shape at the bottom of this file)
     - Skeleton from "../components/ui/Skeleton"
     - bestImg, getArtists, fmt, onImgErr from "../lib/helpers"
     - FALLBACK_IMG from "../lib/constants"
     - useUIStore from "../store/uiStore"            (showContextMenu)
     - ArtistLinks from "../components/ui/ArtistLinks"
     - EqBars from "../components/ui/EqBars"
     - lucide-react icons (Play, Pause, Heart, MoreHorizontal, ChevronRight, Shuffle, Sparkles)
   ─────────────────────────────────────────────────────────────── */

import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Pause,
  Heart,
  MoreHorizontal,
  ChevronRight,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useDashboard } from "../hooks/useDashboard";
import { Skeleton } from "../components/ui/Skeleton";
import { bestImg, getArtists, fmt, onImgErr } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { useUIStore } from "../store/uiStore";
import { ArtistLinks } from "../components/ui/ArtistLinks";
import { EqBars } from "../components/ui/EqBars";

/* =====================================================================
   EQ BARS
   ===================================================================== */
const EqBarsInline = ({ size = "sm" as "sm" | "lg" }) => {
  const anims = ["animate-eq1", "animate-eq2", "animate-eq3", "animate-eq4", "animate-eq5"];
  const heights = size === "sm" ? [6, 12, 4, 10, 7] : [8, 16, 5, 14, 9];
  return (
    <span
      className="flex items-end gap-[2px]"
      style={{ height: size === "sm" ? 16 : 22 }}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={`w-[3px] bg-sp-green rounded-sm ${anims[i]}`}
          style={{ height: h }}
        />
      ))}
    </span>
  );
};

/* =====================================================================
   SONG CARD (with size variant: "md" | "lg")
   ===================================================================== */
const SongCardInline = ({
  song,
  isCurrent,
  isPlaying,
  onPlay,
  size = "md",
}: {
  song: any;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  size?: "md" | "lg";
}) => {
  const [hov, setHov] = useState(false);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const { likedSongs, handleLike } = useApp();
  const img = bestImg(song.image) || FALLBACK_IMG;
  const isLiked = !!likedSongs[song.id];

  const isLg = size === "lg";
  const w = isLg ? "w-56" : "w-[10.5rem]";
  const p = isLg ? "p-3.5" : "p-3";
  const titleSize = isLg ? "text-[15px]" : "text-[13px]";
  const subSize = isLg ? "text-[12px]" : "text-[11px]";
  const playBtnSize = isLg ? "w-14 h-14" : "w-12 h-12";
  const playIconSize = isLg ? 19 : 17;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onPlay}
      onContextMenu={(e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, song);
      }}
      className={`${w} ${p} rounded-2xl cursor-pointer transition-all duration-300 group ${
        isCurrent
          ? "bg-sp-green/[0.06] border border-sp-green/20"
          : "bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06]"
      }`}
      style={{
        boxShadow: hov
          ? "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)"
          : isCurrent
            ? "0 4px 24px rgba(29,185,84,0.15)"
            : "none",
        transform: hov ? "translateY(-4px)" : "translateY(0)",
      }}
    >
      <div className="relative mb-3 rounded-xl overflow-hidden">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full aspect-square object-cover transition-all duration-500 ${
            hov ? "scale-110 brightness-[0.35]" : ""
          }`}
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${
            hov ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute top-1.5 right-1.5 flex gap-1 z-20 transition-opacity duration-200 ${
            hov ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLike(song);
            }}
            className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-all"
            aria-label="Like"
          >
            <Heart
              size={12}
              className={isLiked ? "text-sp-green fill-sp-green" : "text-white"}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showContextMenu(e.clientX, e.clientY, song);
            }}
            className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-all"
            aria-label="More"
          >
            <MoreHorizontal size={12} className="text-white" />
          </button>
        </div>
        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300 ${
            hov || (isCurrent && isPlaying) ? "opacity-100" : "opacity-0"
          }`}
        >
          {isCurrent && isPlaying && !hov ? (
            <EqBarsInline size="lg" />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              className={`${playBtnSize} rounded-full bg-sp-green flex items-center justify-center hover:scale-110 transition-all duration-200 pointer-events-auto`}
              style={{ boxShadow: "0 6px 24px rgba(29,185,84,0.5)" }}
              aria-label={isCurrent && isPlaying ? "Pause" : "Play"}
            >
              {isCurrent && isPlaying ? (
                <Pause size={playIconSize} className="text-black fill-black" />
              ) : (
                <Play
                  size={playIconSize}
                  className="text-black fill-black ml-0.5"
                />
              )}
            </button>
          )}
        </div>
      </div>
      <p
        className={`${titleSize} font-semibold truncate leading-tight ${
          isCurrent ? "text-sp-green" : "text-white"
        }`}
      >
        {song.name}
      </p>
      <p className={`${subSize} text-sp-sub/70 truncate mt-1`}>
        <ArtistLinks song={song} />
      </p>
      {song.reason && (
        <p className="text-[9px] text-sp-green/60 truncate mt-0.5 italic">
          {song.reason}
        </p>
      )}
    </div>
  );
};

/* =====================================================================
   SONG ROW (compact list item)
   ===================================================================== */
const SongRowInline = ({
  song,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  showAlbum = true,
}: {
  song: any;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  showAlbum?: boolean;
}) => {
  const [hov, setHov] = useState(false);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const img = bestImg(song.image, "50x50") || FALLBACK_IMG;

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, song);
  };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, song);
      }}
      onClick={onPlay}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-300 group/row ${
        isCurrent
          ? "bg-sp-green/[0.08] border border-sp-green/10"
          : "hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        {isCurrent && isPlaying ? (
          <EqBarsInline />
        ) : hov ? (
          <Play size={13} className="text-white fill-white" />
        ) : (
          <span
            className={`text-xs tabular-nums ${
              isCurrent ? "text-sp-green" : "text-sp-sub"
            }`}
          >
            {index}
          </span>
        )}
      </div>
      <img
        src={img}
        onError={onImgErr}
        loading="lazy"
        className="w-11 h-11 rounded-lg object-cover flex-shrink-0 group-hover/row:scale-105 transition-transform duration-200 shadow-sm"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate ${
            isCurrent ? "text-sp-green" : "text-white"
          }`}
        >
          {song.name}
        </p>
        <p className="text-xs text-sp-sub/70 truncate">
          <ArtistLinks song={song} />
        </p>
      </div>
      {showAlbum && (
        <p className="hidden lg:block text-xs text-sp-muted truncate w-40 text-center">
          {song.album?.name || ""}
        </p>
      )}
      <button
        onClick={handleMoreClick}
        className={`p-1.5 rounded-full transition-all duration-150 text-sp-sub hover:text-white flex-shrink-0 ${
          hov ? "opacity-100" : "opacity-0"
        }`}
        aria-label="More"
      >
        <MoreHorizontal size={14} />
      </button>
      <p className="text-xs text-sp-muted w-10 text-right flex-shrink-0 tabular-nums">
        {fmt(song.duration)}
      </p>
    </div>
  );
};

/* =====================================================================
   H SECTION (horizontal carousel)
   ===================================================================== */
const HSectionInline = ({
  title,
  subtitle,
  songs = [],
  albums = [],
  currentSong,
  isPlaying,
  onPlay,
  cardSize = "md",
  hideHeader = false,
}: {
  title: string;
  subtitle?: string;
  songs?: any[];
  albums?: any[];
  currentSong: any;
  isPlaying: boolean;
  onPlay: (song: any, queue: any[]) => void;
  cardSize?: "md" | "lg";
  hideHeader?: boolean;
}) => {
  const isLg = cardSize === "lg";
  const navigate = useNavigate();

  return (
    <div className="mb-10">
      {!hideHeader && title && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white leading-tight truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-white/40 mt-1 font-normal truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className={`flex overflow-x-auto hide-scrollbar pb-2 -mx-1 px-1 ${
          isLg ? "gap-4" : "gap-3"
        }`}
        style={{ scrollSnapType: "x proximity" }}
      >
        {songs.length > 0
          ? songs.map((s, idx) => (
              <div
                key={`${s.id}-${idx}`}
                style={{ scrollSnapAlign: "start" }}
                className={isLg ? "flex-shrink-0 w-56" : "flex-shrink-0"}
              >
                <SongCardInline
                  song={s}
                  isCurrent={currentSong?.id === s.id}
                  isPlaying={isPlaying}
                  onPlay={() => onPlay(s, songs)}
                  size={isLg ? "lg" : "md"}
                />
              </div>
            ))
          : albums.map((a, idx) => (
              <div
                key={`${a.id}-${idx}`}
                className="flex-shrink-0 w-44"
                style={{ scrollSnapAlign: "start" }}
              >
                <div
                  onClick={() => a.id && navigate(`/playlist/${a.id}`)}
                  className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] transition-colors cursor-pointer"
                >
                  <div className="w-full aspect-square rounded-xl bg-white/[0.06] mb-3 overflow-hidden">
                    {a.image && (
                      <img
                        src={a.image}
                        alt={a.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-white truncate">
                    {a.name}
                  </p>
                  {a.publisher && (
                    <p className="text-[11px] text-sp-sub/70 truncate mt-1">
                      {a.publisher}
                    </p>
                  )}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

/* =====================================================================
   SECTION HEADER (title + subtitle + actions)
   ===================================================================== */
const SectionHeader = ({
  title,
  subtitle,
  icon,
  onSeeAll,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onSeeAll?: () => void;
  action?: React.ReactNode;
}) => (
  <div className="flex items-end justify-between mb-5 px-1">
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <span className="text-base w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-[22px] font-bold text-white tracking-tight leading-none">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[13px] text-white/40 mt-1.5 leading-none">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {action}
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="text-[12px] font-semibold text-white/60 hover:text-white tracking-wide transition-colors flex items-center gap-0.5 px-2 py-1.5 rounded-full hover:bg-white/[0.05]"
        >
          See all
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  </div>
);

/* =====================================================================
   HERO FEATURED TILE
   ===================================================================== */
const HeroFeatured = ({
  song,
  isCurrent,
  isPlaying,
  onPlay,
}: {
  song: any;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) => {
  const img = bestImg(song.image, "500x500") || FALLBACK_IMG;
  const artist = getArtists(song);

  return (
    <div
      onClick={onPlay}
      className="group relative w-full overflow-hidden rounded-3xl cursor-pointer"
      style={{ aspectRatio: "16 / 9" }}
    >
      <img
        src={img}
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-50"
        alt=""
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/70 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      <div className="relative h-full flex items-end p-5 sm:p-8 gap-5">
        <div className="hidden sm:block w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 flex-shrink-0">
          <img
            src={img}
            alt={song.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={12} className="text-sp-green" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-sp-green uppercase">
              Featured Today
            </span>
          </div>
          <h3 className="text-white text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight truncate">
            {song.name}
          </h3>
          <p className="text-white/70 text-sm mt-1 truncate">{artist}</p>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              className="px-5 h-10 rounded-full bg-sp-green text-black font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform"
              style={{ boxShadow: "0 8px 24px rgba(29,185,84,0.45)" }}
            >
              {isCurrent && isPlaying ? (
                <Pause size={16} className="fill-black" />
              ) : (
                <Play size={16} className="fill-black ml-0.5" />
              )}
              {isCurrent && isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =====================================================================
   QUICK PICKS (desktop 2-col list / mobile 3x3 swipe)
   ===================================================================== */
const QuickPicksList = ({
  songs,
  currentSong,
  isPlaying,
  onPlay,
}: {
  songs: any[];
  currentSong: any;
  isPlaying: boolean;
  onPlay: (s: any) => void;
}) => {
  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const perPage = 9; // mobile: 3x3
    const out: any[][] = [];
    for (let i = 0; i < songs.length; i += perPage) {
      out.push(songs.slice(i, i + perPage));
    }
    return out;
  }, [songs]);

  return (
    <div>
      {/* Desktop: 2-column grid, no paging */}
      <div className="hidden md:grid md:grid-cols-2 gap-2">
        {songs.slice(0, 12).map((s, i) => (
          <SongRowInline
            key={`${s.id}-${i}`}
            song={s}
            index={i + 1}
            isCurrent={currentSong?.id === s.id}
            isPlaying={isPlaying}
            onPlay={() => onPlay(s)}
            showAlbum
          />
        ))}
      </div>

      {/* Mobile: swipeable 3x3 grid pages */}
      <div className="block md:hidden">
        <div
          ref={scrollRef}
          onScroll={() => {
            if (scrollRef.current) {
              const { scrollLeft, clientWidth } = scrollRef.current;
              setActivePage(Math.round(scrollLeft / clientWidth));
            }
          }}
          className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory -mx-4 px-4 gap-3 pb-1"
        >
          {pages.map((page, pi) => (
            <div
              key={pi}
              className="flex-shrink-0 w-[calc(100vw-32px)] snap-center grid grid-cols-3 gap-2.5"
            >
              {page.map((s, si) => {
                const isCurrent = currentSong?.id === s.id;
                const img = bestImg(s.image) || "";
                return (
                  <div
                    key={`${s.id}-${pi}-${si}`}
                    onClick={() => onPlay(s)}
                    className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer active:scale-95 transition-transform border ${
                      isCurrent
                        ? "border-sp-green ring-1 ring-sp-green/30"
                        : "border-white/[0.06]"
                    }`}
                  >
                    <img
                      src={img}
                      alt={s.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-2">
                      {isCurrent && (
                        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1 border border-sp-green/20">
                          {isPlaying ? (
                            <div className="flex gap-[2px] items-end h-2.5 px-0.5">
                              <div className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-2.5" />
                              <div
                                className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-1.5"
                                style={{ animationDelay: "150ms" }}
                              />
                              <div
                                className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-2.5"
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                          ) : (
                            <Pause size={8} className="text-sp-green fill-sp-green" />
                          )}
                        </div>
                      )}
                      <p
                        className={`text-[10px] font-bold truncate leading-snug text-center ${
                          isCurrent ? "text-sp-green" : "text-white"
                        }`}
                      >
                        {s.name}
                      </p>
                      <p className="text-[8px] text-white/50 truncate text-center mt-0.5">
                        {getArtists(s)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {pages.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {pages.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  activePage === i ? "bg-sp-green w-4" : "bg-white/20 w-1.5"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* =====================================================================
   HOME PAGE
   ===================================================================== */
export const HomePage = () => {
  const navigate = useNavigate();
  const { currentSong, isPlaying, playSong: onPlay } = useApp();

  const {
    loading: dashboardLoading,
    authLoading,
    mixesLoading,
    error,
    dashboard,
    suggestionsSongs,
    mobileGridSongs,
    normalizedRecentlyPlayed,
    guestNewReleases,
    normalizedNewReleases,
    podcasts,
    localGreeting,
    localSubtitle,
    handleHomeSongClick,
    mixSet,
    user,
    refetch,
  } = useDashboard(onPlay);


  const quickPicks = normalizedRecentlyPlayed.length
    ? normalizedRecentlyPlayed.slice(0, 12)
    : suggestionsSongs.slice(0, 12);

  const madeForYou = suggestionsSongs.slice(0, 12);
  const newReleasesList = normalizedNewReleases.slice(0, 8);

  const isLoading = authLoading || dashboardLoading;

  const handleShuffle = () => {
    if (!quickPicks.length) return;
    const shuffled = [...quickPicks].sort(() => Math.random() - 0.5);
    handleHomeSongClick(shuffled[0], shuffled);
  };

  return (
    <div className="animate-fadeIn pb-8">
      {/* Greeting */}
      <div className="mb-7">
        {authLoading ? (
          <>
            <Skeleton className="h-9 w-72 rounded-lg mb-2" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </>
        ) : (
          <>
            <h1 className="text-[28px] md:text-[32px] font-black text-white tracking-tight leading-tight">
              {localGreeting}
            </h1>
            <p className="text-white/40 text-sm mt-1.5">{localSubtitle}</p>
          </>
        )}
      </div>



      {/* ── QUICK PICKS ── */}
      {user && (
        <div className="mb-10">
          <SectionHeader
            title="Quick picks"
            subtitle="Jump back in"
            action={
              <button
                onClick={handleShuffle}
                className="hidden sm:flex h-8 w-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] items-center justify-center text-white/70 hover:text-white transition-colors"
                title="Shuffle play"
              >
                <Shuffle size={14} />
              </button>
            }
            onSeeAll={() => navigate("/library")}
          />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            quickPicks.length > 0 && (
              <QuickPicksList
                songs={quickPicks}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={(s) => handleHomeSongClick(s, mobileGridSongs || quickPicks)}
              />
            )
          )}
        </div>
      )}

      {/* ── WEEKLY MIXES ── */}
      {mixSet?.mixes && mixSet.mixes.length > 0 && (
        <div className="mb-10">
          {mixesLoading ? (
            <>
              <Skeleton className="h-7 w-48 rounded-md mb-5" />
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex-shrink-0 w-52">
                    <Skeleton className="w-full aspect-square rounded-2xl mb-3" />
                    <Skeleton className="h-4 w-3/4 rounded-md mb-2" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            mixSet.mixes
              .filter((m: any) => (m.songs || []).length > 0)
              .map((mix: any) => (
                <HSectionInline
                  key={mix.key}
                  title={mix.title}
                  subtitle={mix.description}
                  songs={mix.songs}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  onPlay={(song, queue) => onPlay(song, queue)}
                  cardSize="lg"
                />
              ))
          )}
        </div>
      )}

      {/* ── MADE FOR YOU ── */}
      {user && madeForYou.length > 0 && (
        <div className="mb-10">
          <SectionHeader
            title={dashboard?.madeForYou?.title || "Made for you"}
            subtitle="Tuned to your taste"
            onSeeAll={() => navigate("/search")}
          />
          {isLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex-shrink-0 w-44">
                  <Skeleton className="w-full aspect-square rounded-xl mb-3" />
                  <Skeleton className="h-3 w-3/4 rounded-md mb-1.5" />
                  <Skeleton className="h-2.5 w-1/2 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <HSectionInline
              title=""
              songs={madeForYou}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={(song, queue) => handleHomeSongClick(song, queue)}
              hideHeader
            />
          )}
        </div>
      )}

      {/* ── PODCASTS & SHOWS ── */}
      {podcasts && podcasts.length > 0 && (
        <div className="mb-10 animate-fadeIn">
          <SectionHeader
            title="Podcasts & Shows"
            subtitle="Popular podcasts to listen to"
          />
          {isLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex-shrink-0 w-44">
                  <Skeleton className="w-full aspect-square rounded-xl mb-3" />
                  <Skeleton className="h-3 w-3/4 rounded-md mb-1.5" />
                  <Skeleton className="h-2.5 w-1/2 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <HSectionInline
              title=""
              albums={podcasts}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={() => {}}
              hideHeader
            />
          )}
        </div>
      )}

      {/* ── NEW RELEASES ── */}
      <div className="mb-10">
        <SectionHeader
          title={dashboard?.newReleases?.title || "New releases"}
          subtitle="Fresh from your languages"
        />
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !user && guestNewReleases.length > 0 ? (
          <div className="space-y-8">
            {guestNewReleases.map((sec: any) => (
              <HSectionInline
                key={sec.title}
                title={sec.title}
                songs={sec.songs}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={(song) => handleHomeSongClick(song, sec.songs)}
              />
            ))}
          </div>
        ) : newReleasesList.length > 0 ? (
          <div className="hidden md:grid md:grid-cols-2 gap-2">
            {newReleasesList.map((s, i) => (
              <SongRowInline
                key={`${s.id}-${i}`}
                song={s}
                index={i + 1}
                isCurrent={currentSong?.id === s.id}
                isPlaying={isPlaying}
                onPlay={() => handleHomeSongClick(s, newReleasesList)}
              />
            ))}
          </div>
        ) : null}

        {/* mobile: horizontal cards */}
        {!isLoading && user && newReleasesList.length > 0 && (
          <div className="md:hidden">
            <HSectionInline
              title=""
              songs={newReleasesList}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={(song, queue) => handleHomeSongClick(song, queue)}
              hideHeader
            />
          </div>
        )}
      </div>

      {/* ── Error fallback ── */}
      {error && !dashboard && (
        <div className="text-center py-16">
          <p className="text-white/40 text-sm">Couldn't load your dashboard.</p>
          <button
            onClick={refetch}
            className="mt-3 px-4 py-2 rounded-full text-sm bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;

/* =====================================================================
   useDashboard return shape (for reference — DO NOT paste this hook,
   it's just so the destructuring above stays correct if the hook changes)
   =====================================================================
// return {
//   loading, authLoading, mixesLoading, error,
//   dashboard,                  // raw dashboard response
//   row1, row2, row3,           // legacy triple-row data
//   suggestionsSongs,           // mixed list, length ~30
//   mobileGridSongs,            // 18 songs, 2 pages of 9
//   mobileSavedPages,           // [page][song]
//   normalizedRecentlyPlayed,
//   guestNewReleases,           // [{ title, songs }]
//   normalizedNewReleases,
//   localGreeting, localSubtitle,
//   handleHomeSongClick,        // (song, queue?) => void
//   mixSet,                     // { mixes: [{ key, title, description, songs }] }
//   user,
//   refetch,
// };
// ===================================================================== */
