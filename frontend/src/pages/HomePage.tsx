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
  Globe,
  Compass,
  Music,
  Wand2,
  Users,
  Download,
  Layers,
  Flame,
  Zap,
  Coffee,
  Moon,
  CloudRain,
  Radio,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { useDashboard } from "../hooks/useDashboard";
import { Skeleton } from "../components/ui/Skeleton";
import { bestImg, getArtists, fmt, onImgErr } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { useUIStore } from "../store/uiStore";
import { useAuthGate } from "../hooks/useAuthGate";
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
  size = "md",
}: {
  song: any;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  showAlbum?: boolean;
  size?: "md" | "lg";
}) => {
  const [hov, setHov] = useState(false);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const img = bestImg(song.image, size === "lg" ? "80x80" : "50x50") || FALLBACK_IMG;

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, song);
  };

  const isLg = size === "lg";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, song);
      }}
      onClick={onPlay}
      className={`flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-300 group/row ${
        isLg ? "px-4 py-3.5" : "px-3 py-2.5"
      } ${
        isCurrent
          ? "bg-sp-green/[0.08] border border-sp-green/10"
          : "hover:bg-white/[0.04] border border-transparent"
      }`}
    >
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        {isCurrent && isPlaying ? (
          <EqBarsInline />
        ) : hov ? (
          <Play size={isLg ? 15 : 13} className="text-white fill-white" />
        ) : (
          <span
            className={`${isLg ? "text-sm" : "text-xs"} tabular-nums ${
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
        className={`${
          isLg ? "w-14 h-14 rounded-xl" : "w-11 h-11 rounded-lg"
        } object-cover flex-shrink-0 group-hover/row:scale-105 transition-transform duration-200 shadow-sm`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`${
            isLg ? "text-base" : "text-sm"
          } font-semibold truncate ${
            isCurrent ? "text-sp-green" : "text-white"
          }`}
        >
          {song.name}
        </p>
        <p className={`${isLg ? "text-sm" : "text-xs"} text-sp-sub/70 truncate`}>
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
        <MoreHorizontal size={isLg ? 16 : 14} />
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
        <SectionHeader
          title={title}
          subtitle={subtitle}
        />
      )}

      <div
        className={`flex overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4 ${
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
  const showContextMenu = useUIStore((s) => s.showContextMenu);

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
                        <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm rounded-full p-1 border border-sp-green/20">
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showContextMenu(e.clientX, e.clientY, s);
                        }}
                        className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-full p-1 border border-white/10 active:scale-90 transition-transform"
                      >
                        <MoreHorizontal size={10} />
                      </button>
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
   GUEST GLOBAL DASHBOARD DATA & HELPERS
   ===================================================================== */
const TOP_ARTISTS = [
  { id: "702776", name: "Arijit Singh", role: "Top Artist", image: "https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg" },
  { id: "3799917", name: "Taylor Swift", role: "Top Artist", image: "https://c.saavncdn.com/artists/Taylor_Swift_500x500.jpg" },
  { id: "1433699", name: "The Weeknd", role: "Top Artist", image: "https://c.saavncdn.com/artists/The_Weeknd_500x500.jpg" },
  { id: "596989", name: "Anirudh Ravichander", role: "Composer", image: "https://c.saavncdn.com/artists/Anirudh_Ravichander_500x500.jpg" },
  { id: "17063328", name: "Drake", role: "Top Artist", image: "https://c.saavncdn.com/artists/Drake_500x500.jpg" },
  { id: "929381", name: "Ed Sheeran", role: "Top Artist", image: "https://c.saavncdn.com/artists/Ed_Sheeran_500x500.jpg" },
  { id: "16568113", name: "Shreya Ghoshal", role: "Playback Singer", image: "https://c.saavncdn.com/artists/Shreya_Ghoshal_500x500.jpg" },
];

const EDITORIAL_PICKS = [
  { title: "Chill & Unwind", desc: "Acoustic, lofi & relaxing beats", icon: Coffee, gradient: "from-blue-600/20 to-purple-600/20", query: "chill lofi acoustic" },
  { title: "Workout Energy", desc: "High-BPM EDM & hip-hop motivators", icon: Zap, gradient: "from-red-600/20 to-amber-600/20", query: "workout edm gym" },
  { title: "Focus & Code", desc: "Ambient & instrumental study tunes", icon: Flame, gradient: "from-emerald-600/20 to-teal-600/20", query: "focus ambient instrumental" },
  { title: "Party Hits", desc: "Top dance floor bangers & anthems", icon: Music, gradient: "from-pink-600/20 to-rose-600/20", query: "party dance hits" },
  { title: "Sad Hour", desc: "Deep acoustic ballads & emotional tracks", icon: CloudRain, gradient: "from-indigo-600/20 to-slate-800/20", query: "sad acoustic emotional" },
  { title: "Late Night Vibes", desc: "Smooth R&B & night drive synthwave", icon: Moon, gradient: "from-amber-600/20 to-orange-600/20", query: "late night synthwave" },
];

const FEATURE_SHOWCASE = [
  {
    key: "ai",
    title: "AI Playlist Generator",
    desc: "Describe any prompt, mood or vibe for a custom 25-song AI mix.",
    icon: Wand2,
    badge: "AI Magic",
    actionText: "Try Generator",
    requiresAuth: true,
    authReason: "Sign in to generate AI playlists",
    route: "/search",
    gradient: "from-purple-600/20 via-purple-900/10 to-transparent border-purple-500/30",
  },
  {
    key: "soullink",
    title: "SoulLink Live Sync",
    desc: "Listen together with friends with live chat & synchronized audio.",
    icon: Users,
    badge: "Duo Sync",
    actionText: "Join Room",
    requiresAuth: true,
    authReason: "Sign in to use SoulLink shared listening",
    route: "/soullink",
    gradient: "from-sp-green/20 via-emerald-950/10 to-transparent border-sp-green/30",
  },
  {
    key: "offline",
    title: "Offline Downloads",
    desc: "High-quality audio downloads for zero-data offline playback.",
    icon: Download,
    badge: "Offline Mode",
    actionText: "Manage Downloads",
    requiresAuth: false,
    route: "/downloads",
    gradient: "from-blue-600/20 via-cyan-950/10 to-transparent border-blue-500/30",
  },
  {
    key: "import",
    title: "Instant Library Import",
    desc: "Transfer playlists seamlessly from Spotify, YouTube, or Apple Music.",
    icon: Layers,
    badge: "Import Tools",
    actionText: "Import Library",
    requiresAuth: true,
    authReason: "Sign in to import your music library",
    route: "/import",
    gradient: "from-amber-600/20 via-orange-950/10 to-transparent border-amber-500/30",
  },
];

/* =====================================================================
   HOME PAGE
   ===================================================================== */
export const HomePage = () => {
  const navigate = useNavigate();
  const { currentSong, isPlaying, playSong: onPlay } = useApp();
  const { gate } = useAuthGate();
  const openAIPlaylist = useUIStore((s) => s.openAIPlaylist);
  const [aiPrompt, setAiPrompt] = useState("");

  const handleFeatureClick = (feat: (typeof FEATURE_SHOWCASE)[0]) => {
    const action = () => {
      if (feat.key === "ai") {
        openAIPlaylist();
      } else {
        navigate(feat.route);
      }
    };

    if (feat.requiresAuth) {
      gate(action, feat.authReason);
    } else {
      action();
    }
  };

  const {
    loading: dashboardLoading,
    authLoading,
    mixesLoading,
    error,
    dashboard,
    suggestionsSongs,
    normalizedRecentlyPlayed,
    guestNewReleases,
    normalizedNewReleases,
    madeForYouSongs,
    localGreeting,
    localSubtitle,
    handleHomeSongClick,
    mixSet,
    user,
    refetch,
  } = useDashboard(onPlay);

  const quickPicks = useMemo(() => {
    if (!user) return [];
    const list: any[] = [];
    const seen = new Set<string>();
    const addToList = (s: any) => {
      if (!s || !s.id || seen.has(s.id)) return;
      seen.add(s.id);
      list.push(s);
    };
    for (const s of normalizedRecentlyPlayed) addToList(s);
    for (const s of suggestionsSongs) addToList(s);
    return list.slice(0, 18);
  }, [user, normalizedRecentlyPlayed, suggestionsSongs]);

  const guestSections = useMemo(() => {
    if (
      guestNewReleases &&
      guestNewReleases.length > 0 &&
      guestNewReleases.some((s: any) => s.songs && s.songs.length > 0)
    ) {
      const list = guestNewReleases.filter((s: any) => s.songs && s.songs.length > 0);
      const getPriority = (title: string) => {
        const t = (title || "").toLowerCase();
        if (t.includes("global")) return 1;
        if (t.includes("english") || t.includes("pop")) return 2;
        if (t.includes("tamil")) return 3;
        if (t.includes("hindi")) return 4;
        return 5;
      };
      return [...list].sort((a: any, b: any) => getPriority(a.title) - getPriority(b.title));
    }
    if (normalizedNewReleases && normalizedNewReleases.length > 0) {
      return [{ title: "Global New Releases", songs: normalizedNewReleases }];
    }
    return [];
  }, [guestNewReleases, normalizedNewReleases]);


  const newReleasesList = normalizedNewReleases.slice(0, 24);
  const isLoading = authLoading || dashboardLoading;

  const handleShuffle = () => {
    if (!quickPicks.length) return;
    const shuffled = [...quickPicks].sort(() => Math.random() - 0.5);
    handleHomeSongClick(shuffled[0], shuffled);
  };

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    navigate(`/search?q=${encodeURIComponent(aiPrompt.trim())}&ai=true`);
  };

  const handleVibeClick = (vibeText: string) => {
    navigate(`/search?q=${encodeURIComponent(vibeText)}&ai=true`);
  };

  return (
    <div className="animate-fadeIn pb-8">
      {/* ── LOADING SKELETON STATE ── */}
      {isLoading ? (
        <div className="space-y-8">
          <div className="mb-7">
            <Skeleton className="h-9 w-72 rounded-lg mb-2" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[210px] w-[140px] rounded-2xl flex-shrink-0" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-7 w-48 rounded-lg" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[210px] w-[140px] rounded-2xl flex-shrink-0" />
              ))}
            </div>
          </div>
        </div>
      ) : user ? (
        /* ═════════════════════════════════════════════════════════════════
           LOGGED-IN USER DASHBOARD (Continue Listening + Made For You + New Releases)
           ═════════════════════════════════════════════════════════════════ */
        <>
          {/* Greeting */}
          <div className="mb-7">
            <h1 className="text-[28px] md:text-[32px] font-black text-white tracking-tight leading-tight">
              {localGreeting}
            </h1>
            <p className="text-white/40 text-sm mt-1.5">{localSubtitle}</p>
          </div>

          {/* ── 1. CONTINUE LISTENING ── */}
          {quickPicks.length > 0 && (
            <div className="mb-10">
              <SectionHeader
                title="Continue Listening"
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
              />
              <QuickPicksList
                songs={quickPicks}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={(s) => handleHomeSongClick(s, quickPicks)}
              />
            </div>
          )}

          {/* ── 2. MADE FOR YOU ── */}
          {madeForYouSongs && madeForYouSongs.length > 0 && (
            <div className="mb-10">
              <HSectionInline
                title="Made For You"
                subtitle="Recommended songs based on your likes, playlists & listening history"
                songs={madeForYouSongs.slice(0, 8)}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={handleHomeSongClick}
                cardSize="md"
              />
              {madeForYouSongs.length > 8 && (
                <div className="-mt-8">
                  <HSectionInline
                    title=""
                    hideHeader={true}
                    songs={madeForYouSongs.slice(8, 16)}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    onPlay={handleHomeSongClick}
                    cardSize="md"
                  />
                </div>
              )}
              {madeForYouSongs.length > 16 && (
                <div className="-mt-8">
                  <HSectionInline
                    title=""
                    hideHeader={true}
                    songs={madeForYouSongs.slice(16, 24)}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    onPlay={handleHomeSongClick}
                    cardSize="md"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── 3. NEW RELEASES ── */}
          {newReleasesList.length > 0 && (
            <div className="mb-10">
              <HSectionInline
                title="New Releases"
                subtitle="Fresh from your preferred languages"
                songs={newReleasesList.slice(0, 8)}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={handleHomeSongClick}
                cardSize="md"
              />
              {newReleasesList.length > 8 && (
                <div className="-mt-8">
                  <HSectionInline
                    title=""
                    hideHeader={true}
                    songs={newReleasesList.slice(8, 16)}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    onPlay={handleHomeSongClick}
                    cardSize="md"
                  />
                </div>
              )}
              {newReleasesList.length > 16 && (
                <div className="-mt-8">
                  <HSectionInline
                    title=""
                    hideHeader={true}
                    songs={newReleasesList.slice(16, 24)}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    onPlay={handleHomeSongClick}
                    cardSize="md"
                  />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* ═════════════════════════════════════════════════════════════════
           NON-LOGGED-IN GLOBAL GUEST DASHBOARD (Rich Unauthenticated Hub)
           ═════════════════════════════════════════════════════════════════ */
        <div className="space-y-12">



          {/* ── DISCOVERY ROWS (NEW RELEASES & GLOBAL SECTIONS) ── */}
          {guestSections.length > 0 && (
            <div className="space-y-10">
              {guestSections.map((sec: any) => (
                <HSectionInline
                  key={sec.title}
                  title={sec.title}
                  subtitle="Popular music loved around the globe"
                  songs={sec.songs}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  onPlay={(song) => handleHomeSongClick(song, sec.songs)}
                  cardSize="md"
                />
              ))}
            </div>
          )}

          {/* ── TOP ARTISTS THIS WEEK ── */}
          <div>
            <SectionHeader
              title="Top Artists This Week"
              subtitle="Global chart-topping performers"
            />
            <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-2 -mx-4 px-4">
              {TOP_ARTISTS.map((artist) => (
                <div
                  key={artist.name}
                  onClick={() =>
                    artist.id
                      ? navigate(`/artist/${artist.id}`)
                      : navigate(`/search?q=${encodeURIComponent(artist.name)}`)
                  }
                  className="flex-shrink-0 w-32 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/[0.06] transition-all cursor-pointer text-center group"
                >
                  <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-2.5 shadow-lg group-hover:scale-105 transition-transform border border-white/10">
                    <img
                      src={artist.image}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-xs font-bold text-white truncate group-hover:text-sp-green transition-colors">
                    {artist.name}
                  </p>
                  <p className="text-[10px] text-white/40 truncate mt-0.5">
                    {artist.role}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── EDITORIAL & STAFF PICKS ── */}
          <div>
            <SectionHeader
              title="Editorial & Staff Picks"
              subtitle="Hand-curated mood and activity playlists"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {EDITORIAL_PICKS.map((pick) => {
                const IconComponent = pick.icon;
                return (
                  <div
                    key={pick.title}
                    onClick={() => handleVibeClick(pick.query)}
                    className={`p-4 rounded-2xl bg-gradient-to-b ${pick.gradient} border border-white/[0.06] hover:border-white/20 transition-all cursor-pointer group flex flex-col justify-between h-36`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-black/40 backdrop-blur-md flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                      <IconComponent size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-sp-green transition-colors">
                        {pick.title}
                      </h4>
                      <p className="text-[11px] text-white/50 truncate mt-0.5">
                        {pick.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── FEATURE SHOWCASE CARDS (COMPACT & CLEAN) ── */}
          <div>
            <SectionHeader
              title="Experience SoulSync Features"
              subtitle="Everything available to explore"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {FEATURE_SHOWCASE.map((feat) => {
                const IconComponent = feat.icon;
                return (
                  <div
                    key={feat.title}
                    onClick={() => handleFeatureClick(feat)}
                    className={`p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r ${feat.gradient} border backdrop-blur-md cursor-pointer group hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between gap-3`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center text-white border border-white/10 group-hover:scale-110 transition-transform">
                        <IconComponent size={16} />
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-[10px] font-bold border border-white/10">
                        {feat.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-sp-green transition-colors truncate">
                        {feat.title}
                      </h3>
                      <p className="text-[11px] text-white/50 mt-0.5 line-clamp-2 leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-sp-green pt-0.5">
                      <span>{feat.actionText}</span>
                      <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Error fallback ── */}
      {error && !dashboard && (
        <div className="text-center py-16">
          <p className="text-white/40 text-sm">Couldn't load global music.</p>
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
