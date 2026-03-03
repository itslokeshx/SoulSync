import { useState, useEffect, useRef, useCallback } from "react";
import {
  Home,
  Search,
  Library,
  Music2,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Heart,
  ChevronLeft,
  ChevronRight,
  ListMusic,
  X,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & API
// ─────────────────────────────────────────────────────────────────────────────
const API = "https://jiosaavn.rajputhemant.dev";
// NOTE: This API uses snake_case fields. image[].link, download_url[].link, artist_map.primary_artists

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23282828'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' font-size='64' fill='%23535353'%3E%E2%99%AA%3C/text%3E%3C/svg%3E";

const GENRE_CATEGORIES = [
  { label: "Trending", q: "trending tamil 2024", color: "#e13300" },
  { label: "Kollywood", q: "tamil movie songs 2024", color: "#8b5cf6" },
  { label: "Anirudh Hits", q: "anirudh ravichander hits", color: "#0d72ea" },
  { label: "AR Rahman", q: "ar rahman tamil hits", color: "#e91429" },
  { label: "Romance", q: "romantic tamil songs", color: "#e91e8c" },
  {
    label: "Reels Viral",
    q: "die with a smile 7 years old trending reels",
    color: "#f59b23",
  },
  {
    label: "International",
    q: "top international hits 2024 english",
    color: "#d97706",
  },
  { label: "Indie", q: "independent tamil music", color: "#148a08" },
  { label: "Pop Hits", q: "best english pop songs trending", color: "#dc2626" },
  { label: "Workout", q: "tamil workout motivation songs", color: "#1db954" },
  { label: "Melody", q: "tamil melody songs", color: "#56688a" },
  { label: "Classical", q: "carnatic music classical", color: "#7c3aed" },
];

const HOME_SECTIONS = [
  {
    key: "trending",
    title: "Trending in Tamil",
    icon: "🔥",
    query: "trending tamil 2024",
  },
  {
    key: "kollywood",
    title: "Kollywood Chartbusters",
    icon: "🎬",
    query: "tamil movie songs 2024",
  },
  {
    key: "anirudh",
    title: "Anirudh Universe",
    icon: "⚡",
    query: "anirudh ravichander hits",
  },
  {
    key: "melody",
    title: "Tamil Melodies",
    icon: "🎶",
    query: "tamil melody songs",
  },
  {
    key: "reels",
    title: "Reels Viral Hits",
    icon: "🔥",
    query: "die with a smile 7 years trending reels songs",
  },
  {
    key: "international",
    title: "International Trending",
    icon: "🌍",
    query: "top international hits 2024 english pop",
  },
];

const POPULAR_ARTISTS = [
  "Anirudh Ravichander",
  "AR Rahman",
  "Sid Sriram",
  "Yuvan Shankar Raja",
  "Ilaiyaraaja",
  "Harris Jayaraj",
  "D Imman",
  "SPB",
  "Shreya Ghoshal",
  "Chinmayi",
  "Dhanush",
  "GV Prakash",
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const bestUrl = (urls) => {
  if (!urls) return null;
  if (typeof urls === "string") return urls;
  if (!Array.isArray(urls) || !urls.length) return null;
  for (const q of ["320kbps", "160kbps", "96kbps", "48kbps", "12kbps"]) {
    const f = urls.find((u) => u.quality === q);
    if (f?.link) return f.link;
    if (f?.url) return f.url; // fallback camelCase
  }
  const last = urls[urls.length - 1];
  return last?.link || last?.url || null;
};

const bestImg = (images, prefer = "500x500") => {
  if (!images) return null;
  if (typeof images === "string") return images;
  if (!Array.isArray(images)) return images?.link || images?.url || null;
  if (!images.length) return null;
  for (const q of [prefer, "500x500", "150x150", "50x50"]) {
    const f = images.find((i) => i.quality === q);
    if (f?.link) return f.link;
    if (f?.url) return f.url;
  }
  const last = images[images.length - 1];
  return last?.link || last?.url || null;
};

const fmt = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const getArtists = (song) => {
  if (!song) return "—";
  // snake_case API: artist_map.primary_artists
  if (
    Array.isArray(song.artist_map?.primary_artists) &&
    song.artist_map.primary_artists.length
  )
    return song.artist_map.primary_artists.map((a) => a.name).join(", ");
  // camelCase fallback
  if (Array.isArray(song.artists?.primary) && song.artists.primary.length)
    return song.artists.primary.map((a) => a.name).join(", ");
  // music field (common in search results)
  if (song.music) return song.music;
  return song.primaryArtists || song.subtitle || "—";
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const onImgErr = (e) => {
  e.target.onerror = null;
  e.target.src = FALLBACK_IMG;
};

// ─────────────────────────────────────────────────────────────────────────────
// DYNAMIC COLOR EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  "#1a3a2a",
  "#1a2847",
  "#47251a",
  "#2d1a47",
  "#1a3d47",
  "#3a3a1a",
  "#471a2d",
  "#1a3347",
  "#3d2a1a",
  "#1a473d",
];
const hashColor = (id) => {
  let h = 0;
  for (const c of id || "") h = c.charCodeAt(0) + ((h << 5) - h);
  return PRESET_COLORS[Math.abs(h) % PRESET_COLORS.length];
};

const extractColor = (imgUrl) =>
  new Promise((resolve) => {
    if (!imgUrl) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = 20;
        cv.height = 20;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0, 20, 20);
        const d = ctx.getImageData(0, 0, 20, 20).data;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (lum < 20 || lum > 230) continue;
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
          n++;
        }
        if (!n) return resolve(null);
        const f = 0.42;
        resolve(
          `rgb(${Math.round((r / n) * f)},${Math.round((g / n) * f)},${Math.round((b / n) * f)})`,
        );
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM HOOKS
// ─────────────────────────────────────────────────────────────────────────────
const useLikedSongs = () => {
  const [liked, setLiked] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ss_liked") || "{}");
    } catch {
      return {};
    }
  });
  const toggle = useCallback((song) => {
    setLiked((prev) => {
      const next = { ...prev };
      if (next[song.id]) {
        delete next[song.id];
      } else {
        next[song.id] = {
          id: song.id,
          name: song.name,
          image: song.image,
          artists: song.artists,
          primaryArtists: song.primaryArtists,
          duration: song.duration,
        };
      }
      localStorage.setItem("ss_liked", JSON.stringify(next));
      return next;
    });
  }, []);
  return [liked, toggle];
};

const useRecentlyPlayed = () => {
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ss_recent") || "[]");
    } catch {
      return [];
    }
  });
  const add = useCallback((song) => {
    setRecent((prev) => {
      const next = [song, ...prev.filter((s) => s.id !== song.id)].slice(0, 20);
      localStorage.setItem("ss_recent", JSON.stringify(next));
      return next;
    });
  }, []);
  return [recent, add];
};

let _tid = 0;
const useToasts = () => {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = "info", ms = 3000) => {
    const id = ++_tid;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), ms);
  }, []);
  const dismiss = useCallback(
    (id) => setToasts((p) => p.filter((t) => t.id !== id)),
    [],
  );
  return { toasts, add, dismiss };
};

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────
const Sk = ({ className = "" }) => (
  <div
    className={`rounded-lg ${className}`}
    style={{
      background: "linear-gradient(90deg,#282828 25%,#333 50%,#282828 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.6s linear infinite",
    }}
  />
);

const EqBars = ({ size = "sm" }) => {
  const anims = [
    "animate-eq1",
    "animate-eq2",
    "animate-eq3",
    "animate-eq4",
    "animate-eq5",
  ];
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

const GreenBtn = ({ children, onClick, className = "", small = false }) => (
  <button
    onClick={onClick}
    className={`bg-sp-green hover:bg-sp-green-light text-black font-bold rounded-full flex items-center gap-2 transition-all duration-150 hover:scale-105 ${small ? "px-5 py-2 text-sm" : "px-7 py-3.5 text-sm"} ${className}`}
    style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.35)" }}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// TOAST CONTAINER
// ─────────────────────────────────────────────────────────────────────────────
const Toasts = ({ toasts, dismiss }) => (
  <div className="fixed bottom-28 right-5 z-[60] flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl text-sm font-medium animate-fadeIn backdrop-blur-md border border-white/10 ${
          t.type === "error"
            ? "bg-red-900/90 text-red-100"
            : t.type === "success"
              ? "bg-sp-green/90 text-black"
              : "bg-[#282828]/90 text-white"
        }`}
      >
        <span>
          {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
        </span>
        <span>{t.message}</span>
        <button
          onClick={() => dismiss(t.id)}
          className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X size={12} />
        </button>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
const Sidebar = ({
  view,
  setView,
  onGenreSearch,
  currentSong,
  recentlyPlayed,
  onSongPlay,
}) => (
  <aside className="fixed left-0 top-0 bottom-24 w-60 bg-sp-black flex flex-col z-30 select-none">
    <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sp-green/20">
        <Music2 size={17} className="text-black" strokeWidth={2.5} />
      </div>
      <span className="text-lg font-extrabold tracking-tight text-white">
        Soul<span className="text-sp-green">Sync</span>
      </span>
    </div>

    <nav className="px-3 space-y-0.5 mb-3">
      {[
        { id: "home", label: "Home", Icon: Home },
        { id: "search", label: "Search", Icon: Search },
        { id: "liked", label: "Liked Songs", Icon: Heart },
      ].map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => setView(id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
            view === id
              ? "bg-white/10 text-white"
              : "text-sp-sub hover:text-white hover:bg-white/5"
          }`}
        >
          <Icon size={18} className={view === id ? "text-sp-green" : ""} />
          <span className="flex-1 text-left">{label}</span>
          {view === id && (
            <span className="w-1.5 h-1.5 rounded-full bg-sp-green" />
          )}
        </button>
      ))}
    </nav>

    <div className="flex-1 overflow-y-auto hide-scrollbar px-3">
      <p className="text-[10px] font-bold tracking-[0.14em] text-sp-muted px-3 mb-2">
        BROWSE
      </p>
      {GENRE_CATEGORIES.slice(0, 8).map(({ label, q }) => (
        <button
          key={label}
          onClick={() => onGenreSearch(q)}
          className="w-full text-left px-3 py-2 text-sm text-sp-sub hover:text-white hover:bg-white/5 rounded-lg transition-all duration-150"
        >
          {label}
        </button>
      ))}

      {recentlyPlayed.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold tracking-[0.14em] text-sp-muted px-3 mb-2">
            RECENTLY PLAYED
          </p>
          {recentlyPlayed.slice(0, 5).map((s) => {
            const img = bestImg(s.image, "50x50") || FALLBACK_IMG;
            const isCur = currentSong?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSongPlay(s)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-all duration-150"
              >
                <img
                  src={img}
                  onError={onImgErr}
                  className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1 text-left">
                  <p
                    className={`text-xs font-semibold truncate ${isCur ? "text-sp-green" : "text-white"}`}
                  >
                    {s.name}
                  </p>
                  <p className="text-[10px] text-sp-muted truncate">
                    {getArtists(s)}
                  </p>
                </div>
                {isCur && <EqBars />}
              </button>
            );
          })}
        </div>
      )}
    </div>

    <div className="px-6 pb-4 pt-3 border-t border-white/5">
      <p className="text-[10px] text-sp-muted">Powered by JioSaavn</p>
      <p className="text-[10px] text-sp-muted/50 mt-0.5">
        SoulSync v3.0 — Tamil & National
      </p>
    </div>
  </aside>
);

// ─────────────────────────────────────────────────────────────────────────────
// SONG CARD
// ─────────────────────────────────────────────────────────────────────────────
const SongCard = ({ song, isCurrent, isPlaying, onPlay }) => {
  const [hov, setHov] = useState(false);
  const img = bestImg(song.image) || FALLBACK_IMG;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onPlay}
      className="flex-shrink-0 w-44 p-3 rounded-xl bg-sp-card hover:bg-sp-hover cursor-pointer transition-all duration-200"
      style={{ boxShadow: hov ? "0 8px 32px rgba(0,0,0,0.5)" : "none" }}
    >
      <div className="relative mb-3">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full aspect-square object-cover rounded-lg transition-all duration-300 ${hov ? "scale-[1.04] brightness-50" : ""}`}
        />
        <div
          className={`absolute inset-0 rounded-lg flex items-center justify-center transition-opacity duration-200 ${hov || (isCurrent && isPlaying) ? "opacity-100" : "opacity-0"}`}
        >
          {isCurrent && isPlaying && !hov ? (
            <EqBars size="lg" />
          ) : (
            <button
              className="w-12 h-12 rounded-full bg-sp-green flex items-center justify-center hover:bg-sp-green-light hover:scale-110 transition-all duration-150"
              style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.55)" }}
            >
              {isCurrent && isPlaying ? (
                <Pause size={18} className="text-black fill-black" />
              ) : (
                <Play size={18} className="text-black fill-black ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>
      <p
        className={`text-sm font-semibold truncate leading-tight ${isCurrent ? "text-sp-green" : "text-white"}`}
      >
        {song.name}
      </p>
      <p className="text-xs text-sp-sub truncate mt-0.5">{getArtists(song)}</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM CARD
// ─────────────────────────────────────────────────────────────────────────────
const AlbumCard = ({ album, onClick }) => {
  const [hov, setHov] = useState(false);
  const img = bestImg(album.image) || FALLBACK_IMG;
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      className="flex-shrink-0 w-44 p-3 rounded-xl bg-sp-card hover:bg-sp-hover transition-all duration-200 text-left"
      style={{ boxShadow: hov ? "0 8px 32px rgba(0,0,0,0.5)" : "none" }}
    >
      <div className="relative mb-3">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full aspect-square object-cover rounded-lg transition-all duration-300 ${hov ? "scale-[1.04] brightness-50" : ""}`}
        />
        <div
          className={`absolute inset-0 rounded-lg flex items-center justify-center transition-opacity duration-200 ${hov ? "opacity-100" : "opacity-0"}`}
        >
          <div
            className="w-12 h-12 rounded-full bg-sp-green flex items-center justify-center"
            style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.55)" }}
          >
            <Play size={18} className="text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-white truncate">{album.name}</p>
      <p className="text-xs text-sp-sub truncate mt-0.5">
        {album.description || album.year || ""}
      </p>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST CARD
// ─────────────────────────────────────────────────────────────────────────────
const ArtistCard = ({ artist, onClick }) => {
  const [hov, setHov] = useState(false);
  const img = bestImg(artist.image) || FALLBACK_IMG;
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-2 w-28 group"
    >
      <div className="relative w-24 h-24 rounded-full overflow-hidden">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full h-full object-cover transition-all duration-250 ${hov ? "brightness-60 scale-110" : ""}`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${hov ? "opacity-100" : "opacity-0"}`}
        >
          <Play size={24} className="text-white fill-white drop-shadow-lg" />
        </div>
      </div>
      <p className="text-xs font-semibold text-white truncate w-full text-center">
        {artist.name}
      </p>
      <p className="text-[10px] text-sp-muted -mt-1">Artist</p>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SONG ROW
// ─────────────────────────────────────────────────────────────────────────────
const SongRow = ({
  song,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  liked,
  onLike,
}) => {
  const [hov, setHov] = useState(false);
  const img = bestImg(song.image, "50x50") || FALLBACK_IMG;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onPlay}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
        isCurrent ? "bg-white/[0.07]" : "hover:bg-white/[0.05]"
      }`}
    >
      <div className="w-5 flex-shrink-0 flex items-center justify-center">
        {isCurrent && isPlaying ? (
          <EqBars />
        ) : hov ? (
          <Play size={13} className="text-white fill-white" />
        ) : (
          <span
            className={`text-xs tabular-nums ${isCurrent ? "text-sp-green" : "text-sp-sub"}`}
          >
            {index + 1}
          </span>
        )}
      </div>
      <img
        src={img}
        onError={onImgErr}
        loading="lazy"
        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate ${isCurrent ? "text-sp-green" : "text-white"}`}
        >
          {song.name}
        </p>
        <p className="text-xs text-sp-sub truncate">{getArtists(song)}</p>
      </div>
      <p className="hidden lg:block text-xs text-sp-muted truncate w-36 text-center">
        {song.album?.name || ""}
      </p>
      {onLike && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike(song);
          }}
          className={`p-1.5 rounded-full transition-all duration-150 ${
            liked
              ? "text-sp-green opacity-100"
              : `text-sp-sub hover:text-white ${hov ? "opacity-100" : "opacity-0"}`
          }`}
        >
          <Heart size={14} className={liked ? "fill-sp-green" : ""} />
        </button>
      )}
      <p className="text-xs text-sp-muted w-9 text-right flex-shrink-0 tabular-nums">
        {fmt(song.duration)}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HORIZONTAL SECTION
// ─────────────────────────────────────────────────────────────────────────────
const HSection = ({
  title,
  icon,
  songs = [],
  albums = [],
  loading,
  currentSong,
  isPlaying,
  onPlay,
  onAlbumClick,
  onSeeAll,
}) => (
  <div className="mb-8 animate-fadeIn">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
      </h2>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="text-[11px] font-bold text-sp-sub hover:text-white tracking-widest uppercase transition-colors"
        >
          See all
        </button>
      )}
    </div>
    <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
      {loading
        ? Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-44 p-3 rounded-xl bg-sp-card"
            >
              <Sk className="w-full aspect-square mb-3" />
              <Sk className="h-3 w-4/5 mb-2" />
              <Sk className="h-2.5 w-1/2" />
            </div>
          ))
        : songs.length > 0
          ? songs.map((s) => (
              <SongCard
                key={s.id}
                song={s}
                isCurrent={currentSong?.id === s.id}
                isPlaying={isPlaying}
                onPlay={() => onPlay(s, songs)}
              />
            ))
          : albums.map((a) => (
              <AlbumCard
                key={a.id}
                album={a}
                onClick={() => onAlbumClick?.(a)}
              />
            ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// BROWSE PAGE (shown when search bar focused, no query)
// ─────────────────────────────────────────────────────────────────────────────
const BrowsePage = ({ onSearch }) => (
  <div className="animate-fadeIn">
    <h1 className="text-2xl font-bold text-white mb-1">Browse</h1>
    <p className="text-sp-sub text-sm mb-6">
      Explore Tamil, Kollywood & Indian music
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-10">
      {GENRE_CATEGORIES.map(({ label, q, color }) => (
        <button
          key={label}
          onClick={() => onSearch(q)}
          className="relative h-24 rounded-xl overflow-hidden text-left px-4 py-3 font-bold text-white text-sm hover:scale-[1.02] active:scale-100 transition-transform duration-150"
          style={{
            background: `linear-gradient(135deg,${color} 0%,${color}55 100%)`,
          }}
        >
          {label}
        </button>
      ))}
    </div>
    <h2 className="text-xl font-bold text-white mb-4">Popular Artists</h2>
    <div className="flex flex-wrap gap-2">
      {POPULAR_ARTISTS.map((name) => (
        <button
          key={name}
          onClick={() => onSearch(name)}
          className="px-4 py-2 rounded-full bg-sp-hover hover:bg-sp-green hover:text-black text-white text-sm font-semibold transition-all duration-200"
        >
          {name}
        </button>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────
const HomePage = ({
  currentSong,
  isPlaying,
  onPlay,
  onSearch,
  recentlyPlayed,
  likedSongs,
  onLike,
}) => {
  const [sections, setSections] = useState({});
  const [loadings, setLoadings] = useState({});

  useEffect(() => {
    let cancelled = false;
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const fetchSequential = async () => {
      for (let i = 0; i < HOME_SECTIONS.length; i++) {
        if (cancelled) return;
        const { key, query } = HOME_SECTIONS[i];
        setLoadings((p) => ({ ...p, [key]: true }));
        try {
          if (i > 0) await delay(350);
          const r = await fetch(
            `${API}/search/songs?q=${encodeURIComponent(query)}&n=20&page=1`,
          );
          if (!r.ok && r.status === 429) {
            await delay(1000);
            const retry = await fetch(
              `${API}/search/songs?q=${encodeURIComponent(query)}&n=20&page=1`,
            );
            const rd = await retry.json();
            if (!cancelled)
              setSections((p) => ({ ...p, [key]: rd?.data?.results || [] }));
          } else {
            const d = await r.json();
            if (!cancelled)
              setSections((p) => ({ ...p, [key]: d?.data?.results || [] }));
          }
        } catch {
          if (!cancelled) setSections((p) => ({ ...p, [key]: [] }));
        } finally {
          if (!cancelled) setLoadings((p) => ({ ...p, [key]: false }));
        }
      }
    };
    fetchSequential();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="animate-fadeIn">
      <h1 className="text-3xl font-black text-white mb-1">{getGreeting()}</h1>
      <p className="text-sp-sub text-sm mb-6">
        Discover Tamil & Indian music curated for you
      </p>

      {recentlyPlayed.length > 0 && (
        <div className="mb-8 mt-5">
          <h2 className="text-xl font-bold text-white mb-4">Recently Played</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {recentlyPlayed.slice(0, 8).map((s) => {
              const img = bestImg(s.image, "50x50") || FALLBACK_IMG;
              const isCur = currentSong?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onPlay(s, recentlyPlayed)}
                  className="flex items-center gap-3 bg-sp-hover/60 hover:bg-sp-hover rounded-lg overflow-hidden transition-all duration-200 h-14"
                >
                  <img
                    src={img}
                    onError={onImgErr}
                    className="w-14 h-14 object-cover flex-shrink-0"
                  />
                  <span
                    className={`flex-1 text-sm font-semibold text-left truncate pr-3 leading-tight ${isCur ? "text-sp-green" : "text-white"}`}
                  >
                    {s.name}
                  </span>
                  {isCur && isPlaying && (
                    <span className="pr-2">
                      <EqBars />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {HOME_SECTIONS.map(({ key, title, icon, query }) => (
        <HSection
          key={key}
          title={title}
          icon={icon}
          songs={sections[key] || []}
          loading={loadings[key]}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlay={onPlay}
          onSeeAll={() => onSearch(query)}
        />
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PAGE
// ─────────────────────────────────────────────────────────────────────────────
const TABS = ["All", "Songs", "Artists", "Albums"];

const SearchPage = ({
  query,
  currentSong,
  isPlaying,
  onPlay,
  onArtistClick,
  onAlbumClick,
  onSearch,
  likedSongs,
  onLike,
}) => {
  const [results, setResults] = useState({
    songs: [],
    artists: [],
    albums: [],
  });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("All");
  const abort = useRef(null);

  useEffect(() => {
    setTab("All");
    if (!query.trim()) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setResults({ songs: [], artists: [], albums: [] });
    const sig = { signal: ctrl.signal };
    Promise.all([
      fetch(
        `${API}/search/songs?q=${encodeURIComponent(query)}&n=20&page=1`,
        sig,
      )
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${API}/search/artists?q=${encodeURIComponent(query)}&n=10`, sig)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${API}/search/albums?q=${encodeURIComponent(query)}&n=10`, sig)
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([s, ar, al]) => {
        if (ctrl.signal.aborted) return;
        setResults({
          songs: s?.data?.results || [],
          artists: ar?.data?.results || [],
          albums: al?.data?.results || [],
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [query]);

  if (!query.trim()) return <BrowsePage onSearch={onSearch} />;

  if (loading)
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex gap-5 pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="w-24 h-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Sk key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );

  const none =
    !results.songs.length && !results.artists.length && !results.albums.length;
  if (none)
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-4 animate-fadeIn text-center">
        <div className="w-16 h-16 rounded-full bg-sp-hover flex items-center justify-center">
          <Search size={28} className="text-sp-muted" />
        </div>
        <div>
          <p className="text-white font-bold text-lg">No results found</p>
          <p className="text-sp-sub text-sm mt-1">for &ldquo;{query}&rdquo;</p>
        </div>
      </div>
    );

  const top = results.songs[0];
  const showS = (tab === "All" || tab === "Songs") && results.songs.length > 0;
  const showAr =
    (tab === "All" || tab === "Artists") && results.artists.length > 0;
  const showAl =
    (tab === "All" || tab === "Albums") && results.albums.length > 0;

  return (
    <div className="animate-fadeIn space-y-8">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-150 ${
              tab === t
                ? "bg-white text-black"
                : "bg-sp-hover text-white hover:bg-white/20"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Top result */}
      {tab === "All" && top && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Top Result</h2>
            <div
              onClick={() => onPlay(top, results.songs)}
              className="p-6 rounded-xl bg-sp-card hover:bg-sp-hover cursor-pointer transition-all duration-200 group relative overflow-hidden"
            >
              <img
                src={bestImg(top.image) || FALLBACK_IMG}
                onError={onImgErr}
                className="w-20 h-20 rounded-xl object-cover shadow-xl mb-5 group-hover:scale-[1.03] transition-transform duration-200"
              />
              <p className="text-2xl font-black text-white truncate">
                {top.name}
              </p>
              <p className="text-sm text-sp-sub mt-1">
                {getArtists(top)} · Song
              </p>
              <div
                className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-sp-green flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
                style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.55)" }}
              >
                <Play size={20} className="text-black fill-black ml-0.5" />
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
            {results.artists.map((a) => (
              <ArtistCard
                key={a.id}
                artist={a}
                onClick={() => onArtistClick(a)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Songs list */}
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
            {results.albums.map((al) => (
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

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST PAGE
// ─────────────────────────────────────────────────────────────────────────────
const ArtistPage = ({
  artistId,
  currentSong,
  isPlaying,
  onPlay,
  onBack,
  likedSongs,
  onLike,
}) => {
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bgColor, setBgColor] = useState("#1a1a1a");

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    setArtist(null);
    setSongs([]);
    Promise.all([
      fetch(`${API}/artist?id=${artistId}`)
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${API}/artist/songs?id=${artistId}&n=20`)
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([a, s]) => {
        const data = a?.data || null;
        setArtist(data);
        // /artist/songs returns data.results or fall back to top_songs from /artist
        const songList =
          s?.data?.results ||
          (Array.isArray(s?.data) ? s.data : null) ||
          data?.top_songs ||
          [];
        setSongs(songList);
        if (data) {
          const img = bestImg(data.image);
          if (img) extractColor(img).then((c) => c && setBgColor(c));
        }
      })
      .finally(() => setLoading(false));
  }, [artistId]);

  if (loading)
    return (
      <div className="animate-fadeIn space-y-4">
        <Sk className="w-full h-72 rounded-2xl" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Sk key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  if (!artist)
    return (
      <div className="text-sp-sub p-10 text-center">Artist not found.</div>
    );

  const img = bestImg(artist.image) || FALLBACK_IMG;
  const followers =
    artist.follower_count || artist.followerCount
      ? parseInt(
          artist.follower_count || artist.followerCount,
          10,
        ).toLocaleString()
      : null;

  return (
    <div className="animate-fadeIn -mt-6 -mx-6">
      <div
        className="relative h-80 overflow-hidden"
        style={{
          background: `linear-gradient(to bottom,${bgColor} 0%,#121212 100%)`,
        }}
      >
        <img
          src={img}
          onError={onImgErr}
          className="absolute inset-0 w-full h-full object-cover object-top opacity-40"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom,transparent 30%,#121212 100%)",
          }}
        />
        <button
          onClick={onBack}
          className="absolute top-5 left-5 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="absolute bottom-6 left-6">
          <span className="text-xs font-bold bg-sp-green text-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            Verified Artist
          </span>
          <h1 className="text-5xl font-black text-white mt-2 leading-none">
            {artist.name}
          </h1>
          {followers && (
            <p className="text-sp-sub text-sm mt-2">{followers} followers</p>
          )}
        </div>
      </div>

      <div className="px-6 py-5 flex items-center gap-4 bg-gradient-to-b from-sp-dark to-transparent">
        <GreenBtn onClick={() => songs.length && onPlay(songs[0], songs)}>
          <Play size={18} className="fill-black" /> Play
        </GreenBtn>
        <button className="w-11 h-11 rounded-full border-2 border-white/30 flex items-center justify-center text-white hover:border-white transition-colors">
          <Shuffle size={17} />
        </button>
      </div>

      <div className="px-6">
        <h2 className="text-xl font-bold text-white mb-3">Popular</h2>
        <div className="space-y-1">
          {songs.slice(0, 20).map((s, i) => (
            <SongRow
              key={s.id}
              song={s}
              index={i}
              isCurrent={currentSong?.id === s.id}
              isPlaying={isPlaying}
              onPlay={() => onPlay(s, songs)}
              liked={!!likedSongs?.[s.id]}
              onLike={onLike}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ALBUM PAGE
// ─────────────────────────────────────────────────────────────────────────────
const AlbumPage = ({
  albumId,
  currentSong,
  isPlaying,
  onPlay,
  onBack,
  likedSongs,
  onLike,
}) => {
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bgColor, setBgColor] = useState("#1a1a1a");

  useEffect(() => {
    if (!albumId) return;
    setLoading(true);
    setAlbum(null);
    fetch(`${API}/album?id=${albumId}`)
      .then((r) => r.json())
      .then((d) => {
        const data = d?.data || null;
        setAlbum(data);
        if (data) {
          const img = bestImg(data.image);
          if (img) extractColor(img).then((c) => c && setBgColor(c));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [albumId]);

  if (loading)
    return (
      <div className="animate-fadeIn space-y-4">
        <div className="flex gap-6 flex-wrap">
          <Sk className="w-52 h-52 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Sk className="h-10 w-2/3" />
            <Sk className="h-4 w-1/2" />
            <Sk className="h-4 w-1/3" />
          </div>
        </div>
        <div className="space-y-2 mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Sk key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  if (!album)
    return <div className="text-sp-sub p-10 text-center">Album not found.</div>;

  const songs = album.songs || [];
  const img = bestImg(album.image) || FALLBACK_IMG;
  const artist = Array.isArray(album.artist_map?.primary_artists)
    ? album.artist_map.primary_artists.map((a) => a.name).join(", ")
    : Array.isArray(album.artists?.primary)
      ? album.artists.primary.map((a) => a.name).join(", ")
      : album.primaryArtists || album.subtitle || "";
  const totalDur = songs.reduce((acc, s) => acc + (s.duration || 0), 0);

  return (
    <div className="animate-fadeIn -mt-6 -mx-6">
      <div
        className="px-6 pt-6 pb-6"
        style={{
          background: `linear-gradient(to bottom,${bgColor} 0%,#121212 100%)`,
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sp-sub hover:text-white text-sm mb-6 transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex gap-6 flex-wrap items-end">
          <img
            src={img}
            onError={onImgErr}
            className="w-52 h-52 object-cover rounded-xl flex-shrink-0"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}
          />
          <div className="flex flex-col justify-end min-w-0 pb-2">
            <p className="text-xs font-bold text-sp-sub uppercase tracking-widest mb-2">
              Album
            </p>
            <h1 className="text-4xl font-black text-white mb-3 leading-tight">
              {album.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="font-bold text-white">{artist}</span>
              <span className="text-sp-muted">·</span>
              <span className="text-sp-sub">{album.year}</span>
              <span className="text-sp-muted">·</span>
              <span className="text-sp-sub">
                {songs.length} songs, {fmt(totalDur)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex items-center gap-4 bg-gradient-to-b from-sp-dark to-transparent">
        <GreenBtn onClick={() => songs.length && onPlay(songs[0], songs)}>
          <Play size={18} className="fill-black" /> Play All
        </GreenBtn>
        <button className="w-11 h-11 rounded-full border-2 border-white/30 flex items-center justify-center text-white hover:border-white transition-colors">
          <Shuffle size={17} />
        </button>
      </div>

      <div className="px-6">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/5 text-[10px] font-bold tracking-widest text-sp-muted uppercase mb-1">
          <span className="w-5 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="hidden lg:block w-36 text-center">Album</span>
          <span className="w-9 text-right">⏱</span>
        </div>
        <div className="space-y-0.5 pb-10">
          {songs.map((s, i) => (
            <SongRow
              key={s.id}
              song={s}
              index={i}
              isCurrent={currentSong?.id === s.id}
              isPlaying={isPlaying}
              onPlay={() => onPlay(s, songs)}
              liked={!!likedSongs?.[s.id]}
              onLike={onLike}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIKED SONGS PAGE
// ─────────────────────────────────────────────────────────────────────────────
const LikedPage = ({ likedSongs, currentSong, isPlaying, onPlay, onLike }) => {
  const songs = Object.values(likedSongs);
  return (
    <div className="animate-fadeIn">
      <div
        className="flex items-end gap-6 mb-8 p-7 rounded-2xl"
        style={{
          background: "linear-gradient(135deg,#450af5 0%,#c4efd9 100%)",
        }}
      >
        <div
          className="w-40 h-40 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#450af5,#c4efd9)" }}
        >
          <Heart size={64} className="text-white fill-white" />
        </div>
        <div className="pb-2">
          <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
            Playlist
          </p>
          <h1 className="text-4xl font-black text-white">Liked Songs</h1>
          <p className="text-white/70 text-sm mt-2">{songs.length} songs</p>
        </div>
      </div>
      {songs.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={52} className="mx-auto mb-4 text-sp-muted" />
          <p className="text-white font-bold text-lg">
            Songs you like will appear here
          </p>
          <p className="text-sp-sub text-sm mt-1">
            Click the ♥ icon next to any song
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {songs.map((s, i) => (
            <SongRow
              key={s.id}
              song={s}
              index={i}
              isCurrent={currentSong?.id === s.id}
              isPlaying={isPlaying}
              onPlay={() => onPlay(s, songs)}
              liked
              onLike={onLike}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE PANEL
// ─────────────────────────────────────────────────────────────────────────────
const QueuePanel = ({ queue, queueIndex, currentSong, onClose, onJump }) => (
  <div className="fixed right-0 top-0 bottom-24 w-72 bg-[#1a1a1a] border-l border-white/5 z-40 flex flex-col animate-slideInRight shadow-2xl">
    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
      <h3 className="font-bold text-white text-sm">Queue</h3>
      <button
        onClick={onClose}
        className="text-sp-sub hover:text-white transition-colors p-1"
      >
        <X size={17} />
      </button>
    </div>
    {currentSong && (
      <div className="px-5 py-3 border-b border-white/5">
        <p className="text-[10px] font-bold text-sp-green uppercase tracking-widest mb-2">
          Now Playing
        </p>
        <div className="flex items-center gap-3">
          <img
            src={bestImg(currentSong.image, "50x50") || FALLBACK_IMG}
            onError={onImgErr}
            className="w-10 h-10 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-sp-green truncate">
              {currentSong.name}
            </p>
            <p className="text-xs text-sp-sub truncate">
              {getArtists(currentSong)}
            </p>
          </div>
          <EqBars />
        </div>
      </div>
    )}
    <div className="flex-1 overflow-y-auto hide-scrollbar">
      <p className="text-[10px] font-bold text-sp-muted uppercase tracking-widest px-5 py-3">
        Next Up
      </p>
      {queue.slice(queueIndex + 1).length === 0 && (
        <p className="text-sp-muted text-sm px-5 py-4 text-center">
          Nothing in queue
        </p>
      )}
      {queue.slice(queueIndex + 1).map((s, i) => (
        <button
          key={`${s.id}-${i}`}
          onClick={() => onJump(queueIndex + 1 + i)}
          className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 transition-colors text-left"
        >
          <img
            src={bestImg(s.image, "50x50") || FALLBACK_IMG}
            onError={onImgErr}
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{s.name}</p>
            <p className="text-xs text-sp-sub truncate">{getArtists(s)}</p>
          </div>
          <span className="text-[10px] text-sp-muted tabular-nums">
            {fmt(s.duration)}
          </span>
        </button>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// NOW PLAYING FULLSCREEN
// ─────────────────────────────────────────────────────────────────────────────
const NowPlayingView = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  shuffle,
  repeat,
  liked,
  onClose,
  onPlayPause,
  onSeek,
  onVolume,
  onPrev,
  onNext,
  onShuffle,
  onRepeat,
  onLike,
}) => {
  const [bgColor, setBgColor] = useState("#121212");
  useEffect(() => {
    if (!currentSong) return;
    const img = bestImg(currentSong.image);
    if (img) extractColor(img).then((c) => c && setBgColor(c));
  }, [currentSong?.id]); // eslint-disable-line

  if (!currentSong) return null;
  const img = bestImg(currentSong.image) || FALLBACK_IMG;
  const artists = getArtists(currentSong);
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const volPct = Math.round(volume * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: `linear-gradient(to bottom,${bgColor} 0%,#121212 55%,#0a0a0a 100%)`,
      }}
    >
      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        <button
          onClick={onClose}
          className="text-white hover:text-sp-sub transition-colors p-1"
        >
          <ChevronDown size={26} />
        </button>
        <div className="text-center">
          <p className="text-white text-xs font-bold uppercase tracking-widest">
            Now Playing
          </p>
          <p className="text-sp-sub text-xs mt-0.5 truncate max-w-[220px]">
            {currentSong.album?.name || ""}
          </p>
        </div>
        <button className="text-sp-sub hover:text-white transition-colors p-1">
          <MoreHorizontal size={22} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-10 gap-8 min-h-0">
        <div
          className={`transition-all duration-500 ${isPlaying ? "scale-100" : "scale-90 opacity-80"}`}
          style={{ boxShadow: `0 32px 80px ${bgColor}99` }}
        >
          <img
            src={img}
            onError={onImgErr}
            className="w-72 h-72 rounded-2xl object-cover"
            style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}
          />
        </div>

        <div className="w-full max-w-sm">
          <div className="flex items-start justify-between mb-5">
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-black text-white truncate leading-tight">
                {currentSong.name}
              </p>
              <p className="text-sp-sub mt-0.5">{artists}</p>
            </div>
            <button
              onClick={() => onLike(currentSong)}
              className="mt-1 ml-4 flex-shrink-0 p-1"
            >
              <Heart
                size={22}
                className={
                  liked
                    ? "text-sp-green fill-sp-green"
                    : "text-sp-sub hover:text-white transition-colors"
                }
              />
            </button>
          </div>

          <div className="mb-5">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={(e) => onSeek(+e.target.value)}
              className="progress-bar w-full h-1 rounded-full cursor-pointer"
              style={{ "--progress": `${progress}%` }}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[11px] text-sp-sub tabular-nums">
                {fmt(currentTime)}
              </span>
              <span className="text-[11px] text-sp-sub tabular-nums">
                {fmt(duration)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onShuffle}
              className={`transition-colors ${shuffle ? "text-sp-green" : "text-sp-sub hover:text-white"}`}
            >
              <Shuffle size={20} />
            </button>
            <button
              onClick={onPrev}
              className="text-white hover:scale-110 transition-transform"
            >
              <SkipBack size={30} className="fill-current" />
            </button>
            <button
              onClick={onPlayPause}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform shadow-2xl"
            >
              {isPlaying ? (
                <Pause size={26} className="text-black fill-black" />
              ) : (
                <Play size={26} className="text-black fill-black ml-1" />
              )}
            </button>
            <button
              onClick={onNext}
              className="text-white hover:scale-110 transition-transform"
            >
              <SkipForward size={30} className="fill-current" />
            </button>
            <button
              onClick={onRepeat}
              className={`transition-colors ${repeat !== "off" ? "text-sp-green" : "text-sp-sub hover:text-white"}`}
            >
              {repeat === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onVolume(0)}
              className="text-sp-sub hover:text-white transition-colors flex-shrink-0"
            >
              <VolumeX size={16} />
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={volPct}
              onChange={(e) => onVolume(+e.target.value / 100)}
              className="volume-bar flex-1 h-1 rounded-full cursor-pointer"
              style={{ "--volume": `${volPct}%` }}
            />
            <button
              onClick={() => onVolume(1)}
              className="text-sp-sub hover:text-white transition-colors flex-shrink-0"
            >
              <Volume2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM PLAYER
// ─────────────────────────────────────────────────────────────────────────────
const Player = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  shuffle,
  repeat,
  likedSongs,
  onPlayPause,
  onSeek,
  onVolume,
  onPrev,
  onNext,
  onShuffle,
  onRepeat,
  onLike,
  onOpenFullscreen,
  onToggleQueue,
  queueOpen,
}) => {
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const volPct = Math.round(volume * 100);
  const img = currentSong
    ? bestImg(currentSong.image, "50x50") || FALLBACK_IMG
    : null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-24 z-40 flex items-center px-4 gap-3 select-none"
      style={{
        background: "linear-gradient(to top,#0a0a0a 0%,#181818 100%)",
        borderTop: "1px solid #282828",
      }}
    >
      {/* Left: song info */}
      <div className="flex items-center gap-3 w-[28%] min-w-0">
        {currentSong ? (
          <>
            <button onClick={onOpenFullscreen} className="flex-shrink-0 group">
              <img
                src={img}
                onError={onImgErr}
                className="w-14 h-14 rounded-lg object-cover shadow-md group-hover:brightness-75 transition-all"
              />
            </button>
            <div className="min-w-0 flex-1">
              <p
                onClick={onOpenFullscreen}
                className="text-sm font-semibold text-white truncate cursor-pointer hover:underline"
              >
                {currentSong.name}
              </p>
              <p className="text-xs text-sp-sub truncate">
                {getArtists(currentSong)}
              </p>
            </div>
            <button
              onClick={() => onLike(currentSong)}
              className="ml-1 p-1 flex-shrink-0"
            >
              <Heart
                size={16}
                className={
                  likedSongs?.[currentSong.id]
                    ? "text-sp-green fill-sp-green"
                    : "text-sp-sub hover:text-white transition-colors"
                }
              />
            </button>
          </>
        ) : (
          <p className="text-sp-muted text-sm">Select a song to play</p>
        )}
      </div>

      {/* Center: controls */}
      <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[44%]">
        <div className="flex items-center gap-4">
          <button
            onClick={onShuffle}
            title="Shuffle"
            className={`transition-colors ${shuffle ? "text-sp-green" : "text-sp-sub hover:text-white"}`}
          >
            <Shuffle size={16} />
          </button>
          <button
            onClick={onPrev}
            title="Previous (←)"
            className="text-white hover:scale-110 transition-transform"
          >
            <SkipBack size={21} className="fill-current" />
          </button>
          <button
            onClick={onPlayPause}
            disabled={!currentSong}
            title="Play/Pause (Space)"
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform shadow-md disabled:opacity-30"
          >
            {isPlaying ? (
              <Pause size={16} className="text-black fill-black" />
            ) : (
              <Play size={16} className="text-black fill-black ml-0.5" />
            )}
          </button>
          <button
            onClick={onNext}
            title="Next (→)"
            className="text-white hover:scale-110 transition-transform"
          >
            <SkipForward size={21} className="fill-current" />
          </button>
          <button
            onClick={onRepeat}
            title={`Repeat: ${repeat}`}
            className={`transition-colors ${repeat !== "off" ? "text-sp-green" : "text-sp-sub hover:text-white"}`}
          >
            {repeat === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>
        <div className="flex items-center gap-2 w-full">
          <span className="text-[10px] text-sp-sub w-8 text-right tabular-nums">
            {fmt(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={(e) => onSeek(+e.target.value)}
            disabled={!currentSong}
            className="progress-bar flex-1 h-1 rounded-full cursor-pointer disabled:cursor-default"
            style={{ "--progress": `${progress}%` }}
          />
          <span className="text-[10px] text-sp-sub w-8 tabular-nums">
            {fmt(duration)}
          </span>
        </div>
      </div>

      {/* Right: volume */}
      <div className="flex items-center gap-2 w-[28%] justify-end">
        <button
          onClick={onToggleQueue}
          title="Queue (Q)"
          className={`p-2 rounded-md transition-colors ${queueOpen ? "text-sp-green bg-sp-green/10" : "text-sp-sub hover:text-white"}`}
        >
          <ListMusic size={16} />
        </button>
        <button
          onClick={() => onVolume(volume > 0 ? 0 : 0.8)}
          title="Mute (M)"
          className="text-sp-sub hover:text-white transition-colors"
        >
          {volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volPct}
          onChange={(e) => onVolume(+e.target.value / 100)}
          className="volume-bar w-24 h-1 rounded-full cursor-pointer"
          style={{ "--volume": `${volPct}%` }}
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const audioRef = useRef(null);

  const [view, setView] = useState("home");
  const [liveQuery, setLiveQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [artistId, setArtistId] = useState(null);
  const [albumId, setAlbumId] = useState(null);
  const [navHistory, setNavHistory] = useState([]);

  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState("off"); // off | all | one

  const [queueOpen, setQueueOpen] = useState(false);
  const [npOpen, setNpOpen] = useState(false);
  const [bgColor, setBgColor] = useState("#121212");

  const { toasts, add: addToast, dismiss } = useToasts();
  const [likedSongs, toggleLike] = useLikedSongs();
  const [recentlyPlayed, addRecent] = useRecentlyPlayed();

  // Refs so audio callbacks always read latest values (avoids stale closures)
  const qRef = useRef([]);
  const qiRef = useRef(-1);
  const sfRef = useRef(false);
  const rpRef = useRef("off");
  const vlRef = useRef(0.8);
  const csRef = useRef(null);
  useEffect(() => {
    qRef.current = queue;
  }, [queue]);
  useEffect(() => {
    qiRef.current = queueIndex;
  }, [queueIndex]);
  useEffect(() => {
    sfRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    rpRef.current = repeat;
  }, [repeat]);
  useEffect(() => {
    vlRef.current = volume;
  }, [volume]);
  useEffect(() => {
    csRef.current = currentSong;
  }, [currentSong]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(liveQuery);
      if (liveQuery.trim()) setView("search");
    }, 400);
    return () => clearTimeout(t);
  }, [liveQuery]);

  // Dynamic background color from current song
  useEffect(() => {
    if (!currentSong) return;
    const img = bestImg(currentSong.image);
    if (img) extractColor(img).then((c) => c && setBgColor(c));
    else setBgColor(hashColor(currentSong.id));
  }, [currentSong?.id]); // eslint-disable-line

  // ── playSong ──
  const playSong = useCallback(
    async (song, newQueue = []) => {
      if (!song) return;
      const audio = audioRef.current;
      try {
        let target = song;
        // Fetch full details if download_url is missing (search results don't include it)
        if (!target.download_url?.length && !target.downloadUrl?.length) {
          const res = await fetch(`${API}/song?id=${song.id}`);
          const data = await res.json();
          // /song returns data.songs[] array
          target =
            data?.data?.songs?.[0] || data?.data?.[0] || data?.data || song;
        }
        const url = bestUrl(target.download_url || target.downloadUrl);
        if (!url) {
          addToast("No playable URL for this song.", "error");
          return;
        }

        audio.pause();
        audio.src = url;
        audio.volume = vlRef.current;
        await audio.play();
        setCurrentSong(target);
        setIsPlaying(true);
        setCurrentTime(0);
        addRecent(target);

        if (newQueue.length > 0) {
          setQueue(newQueue);
          setQueueIndex(newQueue.findIndex((s) => s.id === song.id));
          qRef.current = newQueue;
          qiRef.current = newQueue.findIndex((s) => s.id === song.id);
        }
        // Preload suggestions when queue is thin
        if (newQueue.length <= 1) {
          fetch(`${API}/song/recommend?id=${target.id}&n=10`)
            .then((r) => r.json())
            .then((d) => {
              const suggs = Array.isArray(d?.data) ? d.data : [];
              if (suggs.length)
                setQueue((prev) =>
                  prev.length <= 1 ? [target, ...suggs] : [...prev, ...suggs],
                );
            })
            .catch(() => {});
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          addToast("Playback failed. Try another song.", "error");
          setIsPlaying(false);
        }
      }
    },
    [addRecent, addToast],
  );

  // ── Audio event listeners ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onError = () => {
      addToast("Audio load failed.", "error");
      setIsPlaying(false);
    };
    const onEnded = () => {
      const q = qRef.current;
      const idx = qiRef.current;
      const rep = rpRef.current;
      const shf = sfRef.current;
      if (rep === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      if (!q.length) return;
      let next;
      if (shf) {
        next = Math.floor(Math.random() * q.length);
      } else {
        next = idx + 1;
        if (next >= q.length) {
          if (rep === "all") {
            next = 0;
          } else {
            const cur = csRef.current;
            if (cur) {
              fetch(`${API}/song/recommend?id=${cur.id}&n=10`)
                .then((r) => r.json())
                .then((d) => {
                  const suggs = Array.isArray(d?.data) ? d.data : [];
                  if (suggs.length) {
                    setQueue((prev) => {
                      const ext = [...prev, ...suggs];
                      qRef.current = ext;
                      const ni = idx + 1;
                      qiRef.current = ni;
                      playSong(ext[ni], ext);
                      return ext;
                    });
                  }
                })
                .catch(() => {});
            }
            return;
          }
        }
      }
      setQueueIndex(next);
      qiRef.current = next;
      playSong(q[next], q);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [addToast, playSong]);

  // ── Playback controls ──
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  }, [isPlaying, currentSong]);

  const handleSeek = useCallback((v) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = v;
      setCurrentTime(v);
    }
  }, []);

  const handleVolume = useCallback((v) => {
    const audio = audioRef.current;
    if (audio) audio.volume = v;
    setVolume(v);
  }, []);

  const handleNext = useCallback(() => {
    const q = qRef.current,
      idx = qiRef.current;
    if (!q.length) return;
    let next;
    if (sfRef.current) next = Math.floor(Math.random() * q.length);
    else {
      next = idx + 1;
      if (next >= q.length) next = rpRef.current === "all" ? 0 : q.length - 1;
    }
    setQueueIndex(next);
    qiRef.current = next;
    playSong(q[next], q);
  }, [playSong]);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const q = qRef.current,
      idx = qiRef.current;
    if (!q.length) return;
    const prev = Math.max(0, idx - 1);
    setQueueIndex(prev);
    qiRef.current = prev;
    playSong(q[prev], q);
  }, [playSong]);

  const handleLike = useCallback(
    (song) => {
      const wasLiked = !!likedSongs[song.id];
      toggleLike(song);
      addToast(
        wasLiked ? "Removed from Liked Songs" : "Added to Liked Songs ♥",
        wasLiked ? "info" : "success",
        2000,
      );
    },
    [likedSongs, toggleLike, addToast],
  );

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      const next = r === "off" ? "all" : r === "all" ? "one" : "off";
      rpRef.current = next;
      return next;
    });
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === "m" || e.key === "M")
        handleVolume(vlRef.current > 0 ? 0 : 0.8);
      if (e.key === "q" || e.key === "Q") setQueueOpen((p) => !p);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePlayPause, handleNext, handlePrev, handleVolume]);

  // ── Navigation ──
  const pushNav = useCallback(
    (extra = {}) => {
      setNavHistory((h) => [
        ...h.slice(-19),
        { view, artistId, albumId, liveQuery, searchQuery, ...extra },
      ]);
    },
    [view, artistId, albumId, liveQuery, searchQuery],
  );

  const goBack = useCallback(() => {
    if (!navHistory.length) return;
    const prev = navHistory[navHistory.length - 1];
    setNavHistory((h) => h.slice(0, -1));
    setView(prev.view);
    if (prev.artistId !== undefined) setArtistId(prev.artistId);
    if (prev.albumId !== undefined) setAlbumId(prev.albumId);
    if (prev.liveQuery !== undefined) setLiveQuery(prev.liveQuery);
    if (prev.searchQuery !== undefined) setSearchQuery(prev.searchQuery);
  }, [navHistory]);

  const openArtist = useCallback(
    (a) => {
      pushNav();
      setArtistId(a.id);
      setView("artist");
    },
    [pushNav],
  );

  const openAlbum = useCallback(
    (al) => {
      pushNav();
      setAlbumId(al.id);
      setView("album");
    },
    [pushNav],
  );

  const triggerSearch = useCallback((q) => {
    setLiveQuery(q);
    setSearchQuery(q);
    setView("search");
  }, []);

  const goHome = useCallback(() => {
    setView("home");
    setLiveQuery("");
    setSearchQuery("");
  }, []);

  const jumpToQueue = useCallback(
    (idx) => {
      const q = qRef.current;
      setQueueIndex(idx);
      qiRef.current = idx;
      playSong(q[idx], q);
    },
    [playSong],
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-screen bg-sp-black overflow-hidden"
      style={{ fontFamily: "'Inter',system-ui,sans-serif" }}
    >
      <audio ref={audioRef} preload="metadata" />

      <Sidebar
        view={view}
        setView={(v) => {
          if (v === "home") goHome();
          else setView(v);
        }}
        onGenreSearch={triggerSearch}
        currentSong={currentSong}
        recentlyPlayed={recentlyPlayed}
        onSongPlay={(s) => playSong(s)}
      />

      <div
        className={`flex-1 ml-60 ${queueOpen ? "mr-72" : ""} flex flex-col overflow-hidden transition-all duration-300`}
      >
        {/* Top bar */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-6 py-3.5 sticky top-0 z-20 backdrop-blur-md"
          style={{
            background: `linear-gradient(to bottom,${bgColor}bb 0%,transparent 100%)`,
          }}
        >
          <div className="flex gap-1.5">
            <button
              onClick={goBack}
              disabled={!navHistory.length}
              className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white disabled:opacity-25 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled
              className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white opacity-20 cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex-1 max-w-lg relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sp-sub pointer-events-none"
            />
            <input
              type="text"
              value={liveQuery}
              onChange={(e) => setLiveQuery(e.target.value)}
              onFocus={() => {
                if (!liveQuery.trim()) setView("search");
              }}
              placeholder="Search songs, artists, albums..."
              className="w-full text-sm text-white placeholder-sp-muted rounded-full pl-10 pr-9 py-2.5 outline-none focus:ring-2 focus:ring-white/20 transition-all"
              style={{ background: "#242424" }}
            />
            {liveQuery && (
              <button
                onClick={() => {
                  setLiveQuery("");
                  setSearchQuery("");
                  setView("home");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sp-sub hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 pt-4 pb-12">
          {view === "home" && (
            <HomePage
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={playSong}
              onSearch={triggerSearch}
              recentlyPlayed={recentlyPlayed}
              likedSongs={likedSongs}
              onLike={handleLike}
            />
          )}
          {view === "search" && (
            <SearchPage
              query={searchQuery}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={playSong}
              onArtistClick={openArtist}
              onAlbumClick={openAlbum}
              onSearch={triggerSearch}
              likedSongs={likedSongs}
              onLike={handleLike}
            />
          )}
          {view === "artist" && (
            <ArtistPage
              artistId={artistId}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={playSong}
              onBack={goBack}
              likedSongs={likedSongs}
              onLike={handleLike}
            />
          )}
          {view === "album" && (
            <AlbumPage
              albumId={albumId}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={playSong}
              onBack={goBack}
              likedSongs={likedSongs}
              onLike={handleLike}
            />
          )}
          {view === "liked" && (
            <LikedPage
              likedSongs={likedSongs}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={playSong}
              onLike={handleLike}
            />
          )}
        </main>
      </div>

      {queueOpen && (
        <QueuePanel
          queue={queue}
          queueIndex={queueIndex}
          currentSong={currentSong}
          onClose={() => setQueueOpen(false)}
          onJump={jumpToQueue}
        />
      )}

      <Player
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        shuffle={shuffle}
        repeat={repeat}
        likedSongs={likedSongs}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onVolume={handleVolume}
        onPrev={handlePrev}
        onNext={handleNext}
        onShuffle={() => setShuffle((s) => !s)}
        onRepeat={cycleRepeat}
        onLike={handleLike}
        onOpenFullscreen={() => setNpOpen(true)}
        onToggleQueue={() => setQueueOpen((q) => !q)}
        queueOpen={queueOpen}
      />

      {npOpen && currentSong && (
        <NowPlayingView
          currentSong={currentSong}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          shuffle={shuffle}
          repeat={repeat}
          liked={!!likedSongs[currentSong?.id]}
          onClose={() => setNpOpen(false)}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onVolume={handleVolume}
          onPrev={handlePrev}
          onNext={handleNext}
          onShuffle={() => setShuffle((s) => !s)}
          onRepeat={cycleRepeat}
          onLike={handleLike}
        />
      )}

      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
