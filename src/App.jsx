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
import {
  DuoButton,
  DuoModal,
  DuoPanel,
  DuoEndCard,
  DuoHeartbeat,
  useDuo,
  useDuoStore,
} from "./duo/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & API
// ─────────────────────────────────────────────────────────────────────────────
const API = "https://jiosaavn.rajputhemant.dev";
// NOTE: This API uses snake_case fields. image[].link, download_url[].link, artist_map.primary_artists

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23282828'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' font-size='64' fill='%23535353'%3E%E2%99%AA%3C/text%3E%3C/svg%3E";

const GENRE_CATEGORIES = [
  { label: "Fresh Drops", q: "latest tamil hits 2025", color: "#e13300" },
  { label: "Kollywood", q: "tamil movie songs 2025", color: "#8b5cf6" },
  { label: "Anirudh", q: "anirudh ravichander songs", color: "#0d72ea" },
  { label: "Rahman", q: "ar rahman best songs", color: "#e91429" },
  {
    label: "Heartstrings",
    q: "romantic english songs chill",
    color: "#e91e8c",
  },
  { label: "Charts", q: "top english pop songs 2025", color: "#f59b23" },
  { label: "Melody Lane", q: "tamil melody songs romantic", color: "#148a08" },
  { label: "Reels", q: "viral reels songs 2025", color: "#d97706" },
  { label: "Unwind", q: "chill english songs sad vibes", color: "#56688a" },
  {
    label: "Dancefloor",
    q: "party songs english dance 2025",
    color: "#dc2626",
  },
  { label: "Sid Sriram", q: "sid sriram songs", color: "#7c3aed" },
  { label: "On Repeat", q: "tamil trending songs 2025", color: "#1db954" },
];

const HOME_SECTIONS = [
  {
    key: "tamilHeatwave",
    title: "Scorching Right Now",
    icon: "🔥",
    songs: [
      "Monica Coolie",
      "Kanimaa",
      "Oorum Blood Dude",
      "Vazhithunaiye",
      "Muththa Mazhai",
      "Sawadeeka",
      "Powerhouse Coolie",
      "Yedi",
      "Jinguchaa",
      "Pottala Muttaye",
    ],
  },
  {
    key: "tamilReplay",
    title: "Can't Stop Streaming",
    icon: "💫",
    songs: [
      "Chikitu",
      "Og Sambavam",
      "The One Retro",
      "Rise Of Dragon",
      "Vizhi Veekura",
      "God Bless U",
      "Salambala",
      "Sugar Baby",
      "Vinveli Nayaga",
      "Manasilaayo",
    ],
  },
  {
    key: "tamilAfterHours",
    title: "Late Night Feels",
    icon: "🌙",
    songs: [
      "Katchi Sera",
      "Kannadi Poove",
      "Hey Minnale",
      "Unakku Enna Odave",
      "Yendi Vittu Pona",
      "Sithira Puthiri",
      "Enakenna Yaarum Illaye",
      "Golden Sparrow",
      "Vaa Kannamma",
      "Edho Pesathanae",
    ],
  },
  {
    key: "midnightLove",
    title: "Love & Longing",
    icon: "💖",
    songs: [
      "Die With A Smile",
      "I Think They Call This Love",
      "Dusk Till Dawn",
      "Heat Waves",
      "Golden Hour",
      "Until I Found You",
      "Yellow",
      "Someone You Loved",
      "Perfect",
      "Ocean Eyes",
    ],
  },
  {
    key: "globalPulse",
    title: "Worldwide Anthems",
    icon: "🌍",
    songs: [
      "Blinding Lights",
      "As It Was",
      "Flowers",
      "Cupid",
      "Stay",
      "Sunroof",
      "Industry Baby",
      "Savage Love",
      "Dance Monkey",
      "Good 4 U",
    ],
  },
];

const POPULAR_ARTISTS = [
  "Anirudh Ravichander",
  "AR Rahman",
  "Sid Sriram",
  "The Weeknd",
  "Dua Lipa",
  "Bruno Mars",
  "Olivia Rodrigo",
  "Billie Eilish",
  "Yuvan Shankar Raja",
  "Doja Cat",
  "Ed Sheeran",
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
    className={`bg-sp-green hover:bg-sp-green-light text-black font-bold rounded-full flex items-center gap-2 transition-all duration-200 hover:scale-[1.04] active:scale-100 ${small ? "px-5 py-2 text-[13px]" : "px-6 py-3 text-[13px]"} ${className}`}
    style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.3)" }}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// TOAST CONTAINER
// ─────────────────────────────────────────────────────────────────────────────
const Toasts = ({ toasts, dismiss }) => (
  <div className="fixed bottom-36 md:bottom-24 right-4 md:right-5 z-[60] flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-[13px] font-medium animate-fadeIn backdrop-blur-2xl border ${
          t.type === "error"
            ? "bg-red-900/80 text-red-100 border-red-500/20"
            : t.type === "success"
              ? "bg-sp-green/90 text-black border-sp-green/30"
              : "bg-white/[0.08] text-white border-white/[0.06]"
        }`}
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
      >
        <span className="text-[11px]">
          {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
        </span>
        <span>{t.message}</span>
        <button
          onClick={() => dismiss(t.id)}
          className="ml-1 opacity-40 hover:opacity-100 transition-opacity"
        >
          <X size={11} />
        </button>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DUO MOBILE BAR — shows current song + end session above nav on mobile
// ─────────────────────────────────────────────────────────────────────────────
const DuoMobileBar = ({ currentSong, onEndSession, onOpenPanel }) => {
  const img = currentSong
    ? bestImg(currentSong.image, "50x50") || FALLBACK_IMG
    : null;
  const artists = currentSong ? getArtists(currentSong) : null;

  return (
    <div
      className="fixed left-0 right-0 md:hidden z-[41] animate-fadeUp"
      style={{ bottom: "calc(3.5rem + 4rem)" }}
    >
      <div
        className="mx-2.5 rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.12), rgba(10,10,10,0.97))",
          border: "1px solid rgba(29,185,84,0.25)",
          boxShadow:
            "0 -4px 24px rgba(0,0,0,0.5), 0 0 30px rgba(29,185,84,0.08)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Now Playing in Duo */}
        <div
          onClick={onOpenPanel}
          role="button"
          tabIndex={0}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 active:bg-white/[0.03] transition-colors cursor-pointer"
        >
          {/* Song artwork or duo icon */}
          {currentSong ? (
            <img
              src={img}
              onError={onImgErr}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-sp-green/15 flex items-center justify-center flex-shrink-0">
              <Music2 size={18} className="text-sp-green" />
            </div>
          )}

          {/* Song info + partner */}
          <div className="flex-1 min-w-0 text-left">
            {currentSong ? (
              <>
                <p className="text-[13px] font-semibold text-white truncate leading-tight">
                  {currentSong.name}
                </p>
                <p className="text-[10px] text-white/40 truncate mt-0.5">
                  {artists}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-sp-green leading-tight">
                  SoulLink Active
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Waiting for a song…
                </p>
              </>
            )}
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-sp-green/15">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-sp-green opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sp-green" />
              </span>
              <span className="text-[9px] font-bold text-sp-green tracking-wider">
                LIVE
              </span>
            </div>
          </div>

          {/* End button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEndSession();
            }}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/30 transition-colors"
          >
            <span className="text-[11px] font-bold text-red-400">END</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE BOTTOM NAV
// ─────────────────────────────────────────────────────────────────────────────
const MobileNav = ({ view, onHome, onSearch, onLiked, duoButton }) => (
  <nav
    className="fixed bottom-0 left-0 right-0 h-[3.5rem] md:hidden z-50 flex items-center justify-around select-none backdrop-blur-xl"
    style={{
      background: "rgba(6,6,6,0.92)",
      borderTop: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    {[
      { id: "home", Icon: Home, label: "Home", action: onHome },
      { id: "search", Icon: Search, label: "Search", action: onSearch },
      { id: "liked", Icon: Heart, label: "Liked", action: onLiked },
    ].map(({ id, Icon, label, action }) => (
      <button
        key={id}
        onClick={action}
        className={`flex flex-col items-center gap-0.5 py-2 px-6 transition-all duration-200 ${
          view === id ? "text-sp-green" : "text-sp-sub/60 active:text-white"
        }`}
      >
        <Icon size={20} strokeWidth={view === id ? 2.5 : 1.8} />
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    ))}
    {/* Duo tab */}
    {duoButton}
  </nav>
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
  duoButton,
}) => (
  <aside
    className="hidden md:flex md:flex-col fixed left-0 top-0 bottom-24 w-[17rem] z-30 select-none border-r border-white/[0.06]"
    style={{ background: "linear-gradient(180deg,#0e0e0e 0%,#080808 100%)" }}
  >
    <div
      className="px-5 pt-6 pb-5 flex items-center gap-3 cursor-pointer active:scale-95 transition-transform"
      onClick={() => setView("home")}
    >
      <div
        className="w-9 h-9 rounded-xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center flex-shrink-0"
        style={{ boxShadow: "0 0 20px rgba(29,185,84,0.25)" }}
      >
        <Music2 size={16} className="text-black" strokeWidth={2.5} />
      </div>
      <span className="text-[17px] font-extrabold tracking-tight text-white">
        Soul<span className="text-sp-green">Sync</span>
      </span>
    </div>

    <nav className="px-3 space-y-0.5 mb-4">
      {[
        { id: "home", label: "Home", Icon: Home },
        { id: "search", label: "Search", Icon: Search },
        { id: "liked", label: "Liked Songs", Icon: Heart },
      ].map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => setView(id)}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
            view === id
              ? "bg-white/[0.08] text-white backdrop-blur-sm"
              : "text-sp-sub hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <Icon
            size={17}
            className={view === id ? "text-sp-green" : ""}
            strokeWidth={view === id ? 2.5 : 2}
          />
          <span className="flex-1 text-left">{label}</span>
          {view === id && (
            <span className="w-1.5 h-1.5 rounded-full bg-sp-green animate-pulse" />
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

    {/* Duo Button — prominent sidebar section */}
    <div className="px-3 pb-3 pt-2 border-t border-white/[0.04] mt-auto">
      {duoButton}
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
      className="flex-shrink-0 w-[10.5rem] p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] cursor-pointer transition-all duration-300 group"
      style={{ boxShadow: hov ? "0 8px 40px rgba(0,0,0,0.4)" : "none" }}
    >
      <div className="relative mb-3 rounded-xl overflow-hidden">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full aspect-square object-cover transition-all duration-500 ${hov ? "scale-105 brightness-[0.4]" : ""}`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${hov || (isCurrent && isPlaying) ? "opacity-100" : "opacity-0"}`}
        >
          {isCurrent && isPlaying && !hov ? (
            <EqBars size="lg" />
          ) : (
            <button
              className="w-11 h-11 rounded-full bg-sp-green flex items-center justify-center hover:scale-110 transition-transform duration-200"
              style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.5)" }}
            >
              {isCurrent && isPlaying ? (
                <Pause size={16} className="text-black fill-black" />
              ) : (
                <Play size={16} className="text-black fill-black ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>
      <p
        className={`text-[13px] font-semibold truncate leading-tight ${isCurrent ? "text-sp-green" : "text-white"}`}
      >
        {song.name}
      </p>
      <p className="text-[11px] text-sp-sub truncate mt-1">
        {getArtists(song)}
      </p>
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
      className="flex-shrink-0 w-[10.5rem] p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] transition-all duration-300 text-left group"
      style={{ boxShadow: hov ? "0 8px 40px rgba(0,0,0,0.4)" : "none" }}
    >
      <div className="relative mb-3 rounded-xl overflow-hidden">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full aspect-square object-cover transition-all duration-500 ${hov ? "scale-105 brightness-[0.4]" : ""}`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${hov ? "opacity-100" : "opacity-0"}`}
        >
          <div
            className="w-11 h-11 rounded-full bg-sp-green flex items-center justify-center"
            style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.5)" }}
          >
            <Play size={16} className="text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>
      <p className="text-[13px] font-semibold text-white truncate">
        {album.name}
      </p>
      <p className="text-[11px] text-sp-sub truncate mt-1">
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
      className="flex-shrink-0 flex flex-col items-center gap-2.5 w-[7rem] group"
    >
      <div
        className="relative w-[5.5rem] h-[5.5rem] rounded-full overflow-hidden"
        style={{ boxShadow: hov ? "0 8px 32px rgba(0,0,0,0.4)" : "none" }}
      >
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full h-full object-cover transition-all duration-400 ${hov ? "brightness-[0.5] scale-110" : ""}`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${hov ? "opacity-100" : "opacity-0"}`}
        >
          <Play size={22} className="text-white fill-white drop-shadow-lg" />
        </div>
      </div>
      <div className="text-center w-full">
        <p className="text-[12px] font-semibold text-white truncate">
          {artist.name}
        </p>
        <p className="text-[10px] text-white/25 mt-0.5">Artist</p>
      </div>
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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
        isCurrent ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
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
  <div className="mb-10 animate-fadeIn">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        {title}
      </h2>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="text-[11px] font-semibold text-sp-sub hover:text-white tracking-wider uppercase transition-colors duration-200"
        >
          See all
        </button>
      )}
    </div>
    <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
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
    <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">
      Browse
    </h1>
    <p className="text-sp-sub/60 text-sm mb-6">
      Explore Tamil hits & global viral tracks
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mb-10">
      {GENRE_CATEGORIES.map(({ label, q, color }) => (
        <button
          key={label}
          onClick={() => onSearch(q)}
          className="relative h-[5.5rem] rounded-2xl overflow-hidden text-left px-4 py-3 font-bold text-white text-[13px] hover:scale-[1.03] active:scale-100 transition-all duration-200"
          style={{
            background: `linear-gradient(135deg,${color}dd 0%,${color}44 100%)`,
          }}
        >
          <span className="relative z-10">{label}</span>
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </button>
      ))}
    </div>
    <h2 className="text-lg font-bold text-white mb-3">Popular Artists</h2>
    <div className="flex flex-wrap gap-2">
      {POPULAR_ARTISTS.map((name) => (
        <button
          key={name}
          onClick={() => onSearch(name)}
          className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-sp-green hover:text-black text-white text-[13px] font-medium transition-all duration-200 border border-white/[0.06] hover:border-sp-green"
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
    const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
    // Deduplicate songs: keep only the first occurrence of each song name
    const dedup = (songs) => {
      const seen = new Set();
      return songs.filter((s) => {
        const key = (s.name || "")
          .replace(/\s*\(.*\)$/g, "")
          .trim()
          .toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const getCached = (key) => {
      try {
        const raw = sessionStorage.getItem(`ss_${key}`);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL) {
          sessionStorage.removeItem(`ss_${key}`);
          return null;
        }
        return data;
      } catch {
        return null;
      }
    };
    const setCache = (key, data) => {
      try {
        sessionStorage.setItem(
          `ss_${key}`,
          JSON.stringify({ data, ts: Date.now() }),
        );
      } catch {}
    };
    const fetchWithBackoff = async (url, maxRetries = 3) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const r = await fetch(url);
        if (r.ok) return r.json();
        if (r.status === 429 && attempt < maxRetries) {
          await delay(1000 * Math.pow(2, attempt)); // 1s, 2s, 4s
          continue;
        }
        return null;
      }
      return null;
    };
    // Search each song name individually, take the best match
    const searchOneSong = async (songName) => {
      try {
        const d = await fetchWithBackoff(
          `${API}/search/songs?q=${encodeURIComponent(songName)}&n=5&page=1`,
        );
        const results = d?.data?.results || [];
        // Pick the result whose name best matches the query
        const lower = songName.toLowerCase();
        const exact = results.find(
          (r) => (r.name || "").toLowerCase() === lower,
        );
        if (exact) return exact;
        const partial = results.find((r) =>
          (r.name || "").toLowerCase().includes(lower),
        );
        return partial || results[0] || null;
      } catch {
        return null;
      }
    };

    const fetchSection = async (section, idx) => {
      const { key, songs: songNames } = section;
      // Try cache first
      const cached = getCached(key);
      if (cached) {
        if (!cancelled) setSections((p) => ({ ...p, [key]: cached }));
        return;
      }
      setLoadings((p) => ({ ...p, [key]: true }));
      try {
        // Inter-section delay
        if (idx > 0) await delay(500);
        const results = [];
        // Fetch songs in batches of 3 to avoid rate limits
        for (let b = 0; b < songNames.length; b += 3) {
          if (cancelled) break;
          if (b > 0) await delay(400);
          const batch = songNames.slice(b, b + 3);
          const batchResults = await Promise.all(
            batch.map((name) => searchOneSong(name)),
          );
          results.push(...batchResults);
        }
        if (!cancelled) {
          const songs = dedup(results.filter(Boolean));
          setSections((p) => ({ ...p, [key]: songs }));
          if (songs.length) setCache(key, songs);
        }
      } catch {
        if (!cancelled) setSections((p) => ({ ...p, [key]: [] }));
      } finally {
        if (!cancelled) setLoadings((p) => ({ ...p, [key]: false }));
      }
    };

    const fetchAllSections = async () => {
      for (let i = 0; i < HOME_SECTIONS.length; i++) {
        if (cancelled) return;
        await fetchSection(HOME_SECTIONS[i], i);
      }
    };
    fetchAllSections();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="animate-fadeIn">
      <h1 className="text-3xl md:text-4xl font-black text-white mb-1.5 tracking-tight">
        {getGreeting()}
      </h1>
      <p className="text-sp-sub/70 text-sm mb-8">
        Curated for you — Tamil heat & global vibes
      </p>

      {recentlyPlayed.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-bold text-white mb-3">Recently Played</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {recentlyPlayed.slice(0, 8).map((s) => {
              const img = bestImg(s.image, "50x50") || FALLBACK_IMG;
              const isCur = currentSong?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onPlay(s, recentlyPlayed)}
                  className="flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl overflow-hidden transition-all duration-200 h-[3.25rem] group"
                >
                  <img
                    src={img}
                    onError={onImgErr}
                    className="w-[3.25rem] h-[3.25rem] object-cover flex-shrink-0 rounded-l-xl"
                  />
                  <span
                    className={`flex-1 text-[13px] font-semibold text-left truncate pr-3 leading-tight ${isCur ? "text-sp-green" : "text-white"}`}
                  >
                    {s.name}
                  </span>
                  {isCur && isPlaying && (
                    <span className="pr-3">
                      <EqBars />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {HOME_SECTIONS.map(({ key, title, icon, songs: songNames }) => (
        <HSection
          key={key}
          title={title}
          icon={icon}
          songs={sections[key] || []}
          loading={loadings[key]}
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlay={onPlay}
          onSeeAll={() => onSearch(title)}
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
        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center">
          <Search size={22} className="text-sp-muted" />
        </div>
        <div>
          <p className="text-white font-semibold text-base">No results found</p>
          <p className="text-sp-sub/60 text-sm mt-1">
            for &ldquo;{query}&rdquo;
          </p>
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
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 border ${
              tab === t
                ? "bg-white text-black border-white"
                : "bg-white/[0.04] text-white/80 border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12]"
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
              className="p-6 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] cursor-pointer transition-all duration-300 group relative overflow-hidden border border-white/[0.04]"
            >
              <img
                src={bestImg(top.image) || FALLBACK_IMG}
                onError={onImgErr}
                className="w-20 h-20 rounded-xl object-cover mb-5 group-hover:scale-[1.03] transition-transform duration-300"
                style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}
              />
              <p className="text-2xl font-black text-white truncate">
                {top.name}
              </p>
              <p className="text-[13px] text-sp-sub mt-1.5">
                {getArtists(top)} · Song
              </p>
              <div
                className="absolute bottom-5 right-5 w-11 h-11 rounded-full bg-sp-green flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.5)" }}
              >
                <Play size={16} className="text-black fill-black ml-0.5" />
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
          background: `linear-gradient(to bottom,${bgColor} 0%,#0e0e0e 100%)`,
        }}
      >
        <img
          src={img}
          onError={onImgErr}
          className="absolute inset-0 w-full h-full object-cover object-top opacity-30"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom,transparent 20%,#0e0e0e 100%)",
          }}
        />
        <button
          onClick={onBack}
          className="absolute top-5 left-5 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-all duration-200"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="absolute bottom-6 left-6">
          <span className="text-[10px] font-bold bg-sp-green text-black px-2.5 py-1 rounded-full uppercase tracking-widest">
            Verified Artist
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-3 leading-none tracking-tight">
            {artist.name}
          </h1>
          {followers && (
            <p className="text-white/50 text-[13px] mt-2">
              {followers} followers
            </p>
          )}
        </div>
      </div>

      <div className="px-6 py-5 flex items-center gap-4">
        <GreenBtn onClick={() => songs.length && onPlay(songs[0], songs)}>
          <Play size={16} className="fill-black" /> Play
        </GreenBtn>
        <button className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all duration-200">
          <Shuffle size={15} />
        </button>
      </div>

      <div className="px-6">
        <h2 className="text-lg font-bold text-white mb-3">Popular</h2>
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
          background: `linear-gradient(to bottom,${bgColor} 0%,#0e0e0e 100%)`,
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-[13px] mb-6 transition-colors duration-200"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex gap-6 flex-wrap items-end">
          <img
            src={img}
            onError={onImgErr}
            className="w-48 h-48 md:w-52 md:h-52 object-cover rounded-2xl flex-shrink-0"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
          />
          <div className="flex flex-col justify-end min-w-0 pb-2">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2">
              Album
            </p>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight tracking-tight">
              {album.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-[13px]">
              <span className="font-semibold text-white">{artist}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/50">{album.year}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/50">
                {songs.length} songs, {fmt(totalDur)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex items-center gap-4">
        <GreenBtn onClick={() => songs.length && onPlay(songs[0], songs)}>
          <Play size={16} className="fill-black" /> Play All
        </GreenBtn>
        <button className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all duration-200">
          <Shuffle size={15} />
        </button>
      </div>

      <div className="px-6">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.04] text-[10px] font-semibold tracking-[0.15em] text-white/25 uppercase mb-1">
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
        className="flex items-end gap-6 mb-10 p-7 rounded-3xl overflow-hidden relative"
        style={{
          background:
            "linear-gradient(135deg,#450af5 0%,#8b5cf6 50%,#c4efd9 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div
          className="relative w-36 h-36 md:w-40 md:h-40 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg,#450af5,#8b5cf6)",
            boxShadow: "0 20px 60px rgba(69,10,245,0.4)",
          }}
        >
          <Heart size={56} className="text-white fill-white" />
        </div>
        <div className="pb-2 relative">
          <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.2em] mb-1">
            Playlist
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Liked Songs
          </h1>
          <p className="text-white/60 text-[13px] mt-2">{songs.length} songs</p>
        </div>
      </div>
      {songs.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-5">
            <Heart size={28} className="text-sp-muted" />
          </div>
          <p className="text-white font-semibold text-base">
            Songs you like will appear here
          </p>
          <p className="text-sp-sub/60 text-sm mt-1.5">
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
  <div
    className="fixed right-0 top-0 bottom-[7.5rem] md:bottom-20 w-full md:w-72 z-40 flex flex-col animate-slideInRight border-l border-white/[0.06]"
    style={{ background: "rgba(10,10,10,0.95)", backdropFilter: "blur(24px)" }}
  >
    <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
      <h3 className="font-semibold text-white text-[13px]">Queue</h3>
      <button
        onClick={onClose}
        className="text-white/30 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
      >
        <X size={15} />
      </button>
    </div>
    {currentSong && (
      <div className="px-5 py-3 border-b border-white/[0.04]">
        <p className="text-[10px] font-semibold text-sp-green uppercase tracking-[0.15em] mb-2">
          Now Playing
        </p>
        <div className="flex items-center gap-3">
          <img
            src={bestImg(currentSong.image, "50x50") || FALLBACK_IMG}
            onError={onImgErr}
            className="w-10 h-10 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-sp-green truncate">
              {currentSong.name}
            </p>
            <p className="text-[11px] text-sp-sub/60 truncate">
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
          className="w-full flex items-center gap-3 px-5 py-2 hover:bg-white/[0.04] transition-all duration-200 text-left"
        >
          <img
            src={bestImg(s.image, "50x50") || FALLBACK_IMG}
            onError={onImgErr}
            className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white truncate">{s.name}</p>
            <p className="text-[11px] text-sp-sub/50 truncate">
              {getArtists(s)}
            </p>
          </div>
          <span className="text-[10px] text-white/20 tabular-nums">
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
  onSeekStart,
  onSeekEnd,
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
        background: `linear-gradient(to bottom,${bgColor} 0%,#0e0e0e 50%,#060606 100%)`,
      }}
    >
      <div className="flex items-center justify-between px-6 md:px-8 pt-5 pb-2">
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
        >
          <ChevronDown size={24} />
        </button>
        <div className="text-center">
          <p className="text-white/90 text-[10px] font-bold uppercase tracking-[0.2em]">
            Now Playing
          </p>
          <p className="text-white/40 text-[11px] mt-0.5 truncate max-w-[220px]">
            {currentSong.album?.name || ""}
          </p>
        </div>
        <button className="text-white/40 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-10 gap-8 min-h-0">
        <div
          className={`transition-all duration-700 ease-out ${isPlaying ? "scale-100" : "scale-[0.92] opacity-75"}`}
          style={{ boxShadow: `0 40px 100px ${bgColor}80` }}
        >
          <img
            src={img}
            onError={onImgErr}
            className="w-64 h-64 md:w-72 md:h-72 rounded-3xl object-cover"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
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
              step="any"
              value={currentTime}
              onChange={(e) => onSeek(+e.target.value)}
              onPointerDown={onSeekStart}
              onPointerUp={onSeekEnd}
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
              className="w-[4.25rem] h-[4.25rem] rounded-full bg-white flex items-center justify-center hover:scale-[1.06] active:scale-100 transition-all duration-200"
              style={{ boxShadow: "0 4px 30px rgba(255,255,255,0.15)" }}
            >
              {isPlaying ? (
                <Pause size={24} className="text-black fill-black" />
              ) : (
                <Play size={24} className="text-black fill-black ml-0.5" />
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
  onSeekStart,
  onSeekEnd,
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
      className="fixed bottom-14 md:bottom-0 left-0 right-0 h-16 md:h-20 z-40 flex items-center px-3 md:px-5 gap-2 md:gap-3 select-none backdrop-blur-xl"
      style={{
        background: "rgba(6,6,6,0.92)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Left: song info */}
      <div className="flex items-center gap-2.5 md:gap-3 flex-1 md:flex-none md:w-[28%] min-w-0">
        {currentSong ? (
          <>
            <button onClick={onOpenFullscreen} className="flex-shrink-0 group">
              <img
                src={img}
                onError={onImgErr}
                className="w-11 h-11 md:w-12 md:h-12 rounded-xl object-cover group-hover:brightness-75 transition-all duration-200"
                style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}
              />
            </button>
            <div className="min-w-0 flex-1" onClick={onOpenFullscreen}>
              <p className="text-[13px] font-semibold text-white truncate cursor-pointer hover:underline leading-tight">
                {currentSong.name}
              </p>
              <p className="text-[11px] text-white/40 truncate mt-0.5">
                {getArtists(currentSong)}
              </p>
            </div>
            <button
              onClick={() => onLike(currentSong)}
              className="ml-1 p-1 flex-shrink-0 hidden md:block"
            >
              <Heart
                size={14}
                className={
                  likedSongs?.[currentSong.id]
                    ? "text-sp-green fill-sp-green"
                    : "text-white/25 hover:text-white/50 transition-colors duration-200"
                }
              />
            </button>
          </>
        ) : (
          <p className="text-sp-muted text-sm hidden md:block">
            Select a song to play
          </p>
        )}
      </div>

      {/* Mobile compact controls */}
      <div className="flex md:hidden items-center gap-1 flex-shrink-0">
        <button
          onClick={onPrev}
          className="text-white p-2 hover:scale-110 transition-transform"
        >
          <SkipBack size={19} className="fill-current" />
        </button>
        <button
          onClick={onPlayPause}
          disabled={!currentSong}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-100 transition-all duration-200 disabled:opacity-20"
          style={{ boxShadow: "0 2px 10px rgba(255,255,255,0.1)" }}
        >
          {isPlaying ? (
            <Pause size={14} className="text-black fill-black" />
          ) : (
            <Play size={14} className="text-black fill-black ml-0.5" />
          )}
        </button>
        <button
          onClick={onNext}
          className="text-white p-2 hover:scale-110 transition-transform"
        >
          <SkipForward size={19} className="fill-current" />
        </button>
      </div>

      {/* Center: full controls (desktop only) */}
      <div className="hidden md:flex flex-col items-center gap-1.5 flex-1 max-w-[44%]">
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
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-[1.06] active:scale-100 transition-all duration-200 disabled:opacity-20"
            style={{ boxShadow: "0 2px 12px rgba(255,255,255,0.1)" }}
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
            step="any"
            value={currentTime}
            onChange={(e) => onSeek(+e.target.value)}
            onPointerDown={onSeekStart}
            onPointerUp={onSeekEnd}
            disabled={!currentSong}
            className="progress-bar flex-1 h-1 rounded-full cursor-pointer disabled:cursor-default"
            style={{ "--progress": `${progress}%` }}
          />
          <span className="text-[10px] text-sp-sub w-8 tabular-nums">
            {fmt(duration)}
          </span>
        </div>
      </div>

      {/* Right: volume (desktop only) */}
      <div className="hidden md:flex items-center gap-2 w-[28%] justify-end">
        <button
          onClick={onToggleQueue}
          title="Queue (Q)"
          className={`p-1.5 rounded-lg transition-all duration-200 ${queueOpen ? "text-sp-green bg-sp-green/10" : "text-white/30 hover:text-white/60"}`}
        >
          <ListMusic size={15} />
        </button>
        <button
          onClick={() => onVolume(volume > 0 ? 0 : 0.8)}
          title="Mute (M)"
          className="text-white/30 hover:text-white/60 transition-colors duration-200"
        >
          {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
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
  const seekingRef = useRef(false);

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

  // Duo Live Sync hook
  const duoActive = useDuoStore((s) => s.active);
  const duoPanelOpen = useDuoStore((s) => s.panelOpen);
  const playSongRef = useRef(null); // will be assigned after playSong is defined
  const duoCurrentSongRef = useRef(null); // ref so Duo can read host's current song
  const duoQueueRef = useRef([]); // ref so Duo can read host's queue
  const duo = useDuo({
    playSongRef,
    audioRef,
    currentSongRef: duoCurrentSongRef,
    queueRef: duoQueueRef,
    setIsPlaying,
    setCurrentTime,
    addToast,
  });
  // We need a ref so the hook's playSong can call our playSong
  const duoRef = useRef(duo);
  duoRef.current = duo;

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
  // _fromDuo: when true, skip emitting sync back (prevents infinite A↔B loop)
  const playSong = useCallback(
    async (song, newQueue = [], _fromDuo = false) => {
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

        // Duo sync: only emit when user-initiated (not from partner sync)
        if (!_fromDuo) {
          duoRef.current.syncSongChange(
            target,
            newQueue.length > 0 ? newQueue : [target],
            newQueue.length > 0
              ? newQueue.findIndex((s) => s.id === song.id)
              : 0,
          );
        }

        setCurrentSong(target);
        setIsPlaying(true);
        setCurrentTime(0);
        addRecent(target);
        audio.play().catch(() => {});

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

  // Keep playSongRef in sync so useDuo socket handlers can call it
  playSongRef.current = playSong;

  // Keep Duo sync refs up to date so useDuo can read current song/queue
  duoCurrentSongRef.current = currentSong;
  duoQueueRef.current = queue;

  // ── Audio event listeners ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (!seekingRef.current) setCurrentTime(audio.currentTime);
    };
    const onMeta = () => {
      const d = audio.duration;
      setDuration(d && isFinite(d) ? d : 0);
    };
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
      duoRef.current.syncPause(audio.currentTime);
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          duoRef.current.syncPlay(audio.currentTime, currentSong?.id);
        })
        .catch(() => {});
    }
  }, [isPlaying, currentSong]);

  const handleSeek = useCallback((v) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = v;
      setCurrentTime(v);
      duoRef.current.syncSeek(v);
    }
  }, []);

  const handleSeekStart = useCallback(() => {
    seekingRef.current = true;
  }, []);

  const handleSeekEnd = useCallback(() => {
    seekingRef.current = false;
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
    useDuoStore.getState().setPanelOpen(false);
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
        duoButton={<DuoButton variant="sidebar" />}
      />

      <div
        className={`flex-1 md:ml-[17rem] ${queueOpen || duoPanelOpen ? "md:mr-80" : ""} flex flex-col overflow-hidden transition-all duration-300`}
      >
        {/* Top bar */}
        <div
          className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-3.5 sticky top-0 z-20 backdrop-blur-2xl"
          style={{
            background: `linear-gradient(to bottom,${bgColor}60 0%,transparent 100%)`,
          }}
        >
          {/* Mobile logo */}
          <button
            onClick={goHome}
            className="flex items-center gap-2 md:hidden flex-shrink-0 active:scale-95 transition-transform"
          >
            <div
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center"
              style={{ boxShadow: "0 0 16px rgba(29,185,84,0.2)" }}
            >
              <Music2 size={14} className="text-black" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-extrabold tracking-tight text-white">
              Soul<span className="text-sp-green">Sync</span>
            </span>
          </button>
          {/* Desktop nav arrows */}
          <div className="hidden md:flex gap-1.5 flex-shrink-0">
            <button
              onClick={goBack}
              disabled={!navHistory.length}
              className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/[0.12] transition-all duration-200"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled
              className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-white opacity-20 cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
            {duoActive && <DuoHeartbeat />}
          </div>

          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
            />
            <input
              type="text"
              value={liveQuery}
              onChange={(e) => setLiveQuery(e.target.value)}
              onFocus={() => {
                if (!liveQuery.trim()) setView("search");
              }}
              placeholder="Search songs, artists, albums..."
              className="w-full text-[13px] text-white placeholder-white/25 rounded-full pl-10 pr-9 py-2.5 outline-none border border-white/[0.06] focus:border-white/[0.15] transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            {liveQuery && (
              <button
                onClick={() => {
                  setLiveQuery("");
                  setSearchQuery("");
                  setView("home");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 pb-32 md:pb-28">
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
        onSeekStart={handleSeekStart}
        onSeekEnd={handleSeekEnd}
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
          onSeekStart={handleSeekStart}
          onSeekEnd={handleSeekEnd}
          onVolume={handleVolume}
          onPrev={handlePrev}
          onNext={handleNext}
          onShuffle={() => setShuffle((s) => !s)}
          onRepeat={cycleRepeat}
          onLike={handleLike}
        />
      )}

      {/* Duo mobile bar — shows current song + end session above player on mobile */}
      {duoActive && (
        <DuoMobileBar
          currentSong={currentSong}
          onEndSession={duo.endSession}
          onOpenPanel={() => useDuoStore.getState().setPanelOpen(true)}
        />
      )}

      <MobileNav
        view={view}
        onHome={goHome}
        onSearch={() => {
          setLiveQuery("");
          setView("search");
        }}
        onLiked={() => setView("liked")}
        duoButton={<DuoButton variant="mobile-nav" />}
      />

      <Toasts toasts={toasts} dismiss={dismiss} />

      {/* Duo components */}
      <DuoModal onCreate={duo.createSession} onJoin={duo.joinSession} />
      {duoActive && (
        <DuoPanel
          onSendMessage={duo.sendMessage}
          onEndSession={duo.endSession}
        />
      )}
      <DuoEndCard />
    </div>
  );
}
