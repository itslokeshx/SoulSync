import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Music,
  Clock,
  Heart,
  Globe,
  Award,
  Calendar,
  Zap,
} from "lucide-react";
import { User, UserStats } from "../../types/user";
import { onImgErr } from "../../lib/helpers";
import confetti from "canvas-confetti";

interface SoulSyncWrappedProps {
  stats: UserStats | null;
  user: User | null;
  loading: boolean;
}

// Deterministic Premium Musical Soul Identity Generator
function getSoulIdentity(stats: UserStats | null, user: User | null) {
  const listenTime = stats?.totalListeningTime || 0;
  const languagesCount = stats?.languageBreakdown?.length || 0;
  
  const moods = user?.preferences?.moods || [];
  const primaryMood = moods[0]?.toLowerCase() || "";

  if (listenTime > 36000) {
    return {
      title: "The Sonic Connoisseur",
      desc: "Music is your fuel. You live and breathe complex rhythms and spend hours curating your ultimate personal soundscape.",
      gradient: "from-amber-400 via-orange-500 to-rose-600",
      accentGlow: "rgba(245, 158, 11, 0.5)",
      badge: "👑",
      tagline: "Unrivaled Listening Dedication",
    };
  }

  if (primaryMood === "chill" || primaryMood === "sleep" || primaryMood === "focus") {
    return {
      title: "The Dreamy Voyager",
      desc: "Sound is your sanctuary. You search for soft harmonies and tranquil beats to soothe the mind and build a peaceful universe.",
      gradient: "from-cyan-400 via-sky-500 to-indigo-600",
      accentGlow: "rgba(34, 211, 238, 0.5)",
      badge: "🌌",
      tagline: "Connoisseur of Calm",
    };
  }

  if (primaryMood === "energetic" || primaryMood === "workout" || primaryMood === "party") {
    return {
      title: "The Groove Catalyst",
      desc: "High tempos and pure vibration. You harness beats to elevate your state, spark late nights, and fuel high-octane moments.",
      gradient: "from-green-400 via-emerald-500 to-teal-600",
      accentGlow: "rgba(52, 211, 153, 0.5)",
      badge: "⚡",
      tagline: "High Voltage Playlist Curator",
    };
  }

  if (primaryMood === "romantic" || primaryMood === "sad" || primaryMood === "melancholy") {
    return {
      title: "The Emotional Alchemist",
      desc: "Every lyric hits close to home. You translate deep sentiment, raw nostalgia, and relationships into a beautiful sonic diary.",
      gradient: "from-rose-400 via-pink-500 to-violet-600",
      accentGlow: "rgba(251, 113, 133, 0.5)",
      badge: "💖",
      tagline: "Poetry of the Heartstrings",
    };
  }

  if (languagesCount >= 3) {
    return {
      title: "The Global Explorer",
      desc: "Borders cannot contain your vibe. You easily leap from culture to culture, collecting rhythms from all over the world.",
      gradient: "from-violet-400 via-purple-500 to-indigo-600",
      accentGlow: "rgba(167, 139, 250, 0.5)",
      badge: "🌍",
      tagline: "Multi-linguistic Sonic Traveler",
    };
  }

  return {
    title: "The Eclectic Seeker",
    desc: "Your taste defies classification. You drift seamlessly across genres, choosing exactly whatever matches your vibration.",
    gradient: "from-fuchsia-400 via-pink-500 to-amber-400",
    accentGlow: "rgba(232, 121, 249, 0.5)",
    badge: "✨",
    tagline: "Refuser of Musical Boundaries",
  };
}

// Counting up effect component for that dopamine hit
function Counter({ value, duration = 2 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) return;
    
    const totalMiliseconds = duration * 1000;
    const incrementTime = Math.max(Math.floor(totalMiliseconds / end), 20);
    
    const timer = setInterval(() => {
      start += Math.ceil(end / (totalMiliseconds / incrementTime));
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
}

export default function SoulSyncWrapped({ stats, user, loading }: SoulSyncWrappedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const totalSlides = 8;
  const slideDuration = 6500; // 6.5 seconds per slide
  const progressInterval = 50;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger continuous confetti showers on the final slide
  useEffect(() => {
    if (isOpen && currentSlide === totalSlides - 1) {
      const duration = 4 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 35, spread: 360, ticks: 60, zIndex: 100000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 45 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [isOpen, currentSlide]);

  // Stories auto-advance effect
  useEffect(() => {
    if (!isOpen || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentSlide < totalSlides - 1) {
            setCurrentSlide((s) => s + 1);
            return 0;
          } else {
            setIsOpen(false);
            return 0;
          }
        }
        return prev + (progressInterval / slideDuration) * 100;
      });
    }, progressInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isPaused, currentSlide]);

  // Lock body scroll when story is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNext = () => {
    setProgress(0);
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide((s) => s + 1);
    } else {
      setIsOpen(false);
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (currentSlide > 0) {
      setCurrentSlide((s) => s - 1);
    }
  };

  const handleLaunch = () => {
    setCurrentSlide(0);
    setProgress(0);
    setIsOpen(true);
    setIsPaused(false);
    // Initial launch burst
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
  };

  const formatListeningTime = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    return mins;
  };

  const getJoinDays = () => {
    if (!user?.createdAt) return 0;
    const diffTime = Math.abs(Date.now() - new Date(user.createdAt).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getJoinMonthYear = () => {
    if (!user?.createdAt) return "some time ago";
    return new Date(user.createdAt).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.04] animate-pulse">
        <div className="h-6 w-48 bg-white/[0.06] rounded-full mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2 h-44 bg-white/[0.04] rounded-2xl" />
          <div className="h-44 bg-white/[0.04] rounded-2xl" />
        </div>
      </div>
    );
  }

  const soul = getSoulIdentity(stats, user);
  const joinDays = getJoinDays();
  const hasHistory = stats && stats.totalSongsPlayed > 0;

  // Rich Spotify-wrapped bold color block backgrounds (Ordered: Welcome -> Milestones -> Top Songs -> Top Artist -> Top Artists Chart -> Languages -> Persona -> Poster)
  const slideGradients = [
    "from-[#2e0854] via-[#0f051d] to-[#040108]", // Slide 0 (Welcome): Deep Electric Violet
    "from-[#0b3c29] via-[#03150e] to-[#010604]", // Slide 1 (Milestones): Deep Mint/Forest
    "from-[#0c1b40] via-[#03091c] to-[#010208]", // Slide 2 (Top Songs): Deep Indigo
    "from-[#4c0519] via-[#1c0209] to-[#0a0003]", // Slide 3 (Top Artist): Rich Wine Red
    "from-[#431407] via-[#1a0502] to-[#070100]", // Slide 4 (Artists List): Warm Copper
    "from-[#083344] via-[#02151e] to-[#010609]", // Slide 5 (Languages): Cyan Wave
    "from-[#4a044e] via-[#1a021c] to-[#070008]", // Slide 6 (Identity): Fuchsia/Purple
    "from-[#111827] via-[#090d16] to-[#030407]", // Slide 7 (Poster): Clean Dark Slate
  ];

  return (
    <div className="mb-10">
      {/* ── Dashboard Widget Card (Eye-catching & Premium) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main CTA Widget Card */}
        <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl p-7 flex flex-col justify-between border border-white/[0.08] bg-[#0c0c0f] group">
          {/* Dynamic colorful border light */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sp-green transition-all" />
          
          {/* Glow backdrop mesh */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none transition-opacity group-hover:opacity-30 duration-500"
            style={{
              background:
                "radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.4) 0%, transparent 60%), radial-gradient(circle at 90% 80%, rgba(29, 185, 84, 0.3) 0%, transparent 60%)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 text-fuchsia-300 text-[10px] font-black tracking-widest uppercase border border-fuchsia-500/20 flex items-center gap-1.5 shadow-[0_0_15px_rgba(217,70,239,0.1)]">
                <Sparkles size={11} className="text-fuchsia-400" /> Live Wrapped
              </span>
              <span className="text-white/40 text-xs font-semibold">Since Day One</span>
            </div>

            <h3 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">
              Your SoulSync Story
            </h3>
            <p className="text-xs text-white/50 max-w-lg leading-relaxed mb-6">
              {hasHistory
                ? `You've synced ${formatListeningTime(stats.totalListeningTime)} minutes of pure sound. Dive in to claim your custom musical personality badge and explore your top artists!`
                : "You are starting your musical adventure. Sync more tracks to unlock your customized SoulSync Wrapped!"}
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between mt-auto">
            {hasHistory ? (
              <button
                onClick={handleLaunch}
                className="group flex items-center gap-2 px-6 py-3.5 rounded-full bg-sp-green text-black font-black text-xs hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_6px_25px_rgba(29,185,84,0.35)]"
              >
                <Play size={12} fill="currentColor" />
                Launch Wrapped
              </button>
            ) : (
              <span className="text-xs text-white/30 italic">Play 5+ tracks to unlock</span>
            )}
            <div className="text-right">
              <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300 font-mono">
                {joinDays}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-white/40 font-black">
                Days Synced
              </p>
            </div>
          </div>
        </div>

        {/* Profile Identity Card */}
        <div className="col-span-1 relative overflow-hidden rounded-3xl p-7 border border-white/[0.08] bg-[#0d0d11] flex flex-col justify-between group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/[0.02] to-transparent pointer-events-none rounded-full blur-xl" />
          
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-bold text-white/45 uppercase tracking-widest">
              My Vibe
            </span>
            <span className="text-2xl" role="img" aria-label="badge">
              {soul.badge}
            </span>
          </div>

          <div>
            <h4 className={`text-lg font-black bg-clip-text text-transparent bg-gradient-to-r ${soul.gradient} mb-1.5`}>
              {hasHistory ? soul.title : "The Listener"}
            </h4>
            <p className="text-xs text-white/50 leading-relaxed line-clamp-3">
              {hasHistory
                ? soul.desc
                : "Your musical character will write itself as you listen to more tracks. We're tuning in!"}
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-white/[0.05] flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${soul.gradient}`} />
            <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">
              {soul.tagline}
            </span>
          </div>
        </div>
      </div>

      {/* ── Wrapped Interactive Slides Modal (Rendered at Root body level via React Portal) ── */}
      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          className={`fixed inset-0 w-screen h-screen z-[99999] overflow-hidden flex flex-col justify-between transition-colors duration-1000 bg-gradient-to-b ${slideGradients[currentSlide]}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") handleNext();
            if (e.key === "ArrowLeft") handlePrev();
            if (e.key === "Escape") setIsOpen(false);
          }}
        >
          {/* Subtle visual ambient glow */}
          <div
            className="absolute -top-32 -left-32 w-96 h-96 rounded-full pointer-events-none opacity-20 blur-3xl transition-all duration-1000"
            style={{
              background:
                currentSlide === 0
                  ? "rgba(139, 92, 246, 0.6)"
                  : currentSlide === 1
                    ? "rgba(52, 211, 153, 0.6)"
                    : currentSlide === 2
                      ? "rgba(99, 102, 241, 0.6)" // Royal blue/Indigo glow for top songs
                      : currentSlide === 3
                        ? "rgba(244, 63, 94, 0.6)" // Wine Red glow for top artist
                        : currentSlide === 4
                          ? "rgba(249, 115, 22, 0.6)" // Warm Copper/Orange glow for artists list
                          : currentSlide === 5
                            ? "rgba(6, 182, 212, 0.6)" // Cyan glow for languages
                            : currentSlide === 6
                              ? "rgba(217, 70, 239, 0.6)" // Fuchsia glow for persona
                              : "rgba(29, 185, 84, 0.4)", // Poster glow
            }}
          />

          {/* Touch hotspots for navigation (covering left 1/3 and right 2/3 of viewport) */}
          <div className="absolute inset-y-0 left-0 w-1/3 z-30 cursor-w-resize" onClick={handlePrev} />
          <div className="absolute inset-y-0 right-0 w-2/3 z-30 cursor-e-resize" onClick={handleNext} />

          {/* Progress Indicators Header (Wide layout on desktop) */}
          <div className="relative z-40 p-5 pt-8 flex gap-2 w-full max-w-5xl mx-auto">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <div
                key={idx}
                className="h-1.5 flex-1 rounded-full bg-white/15 overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all ease-linear"
                  style={{
                    width:
                      idx < currentSlide
                        ? "100%"
                        : idx === currentSlide
                          ? `${progress}%`
                          : "0%",
                    transitionDuration: idx === currentSlide ? `${progressInterval}ms` : "0ms",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Top info and Close (Wide layout on desktop) */}
          <div className="relative z-40 px-6 flex justify-between items-center text-white/50 w-full max-w-5xl mx-auto">
            <span className="text-xs font-black tracking-widest uppercase">
              SOULSYNC WRAPPED
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="p-2.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Slide Content Viewport (Desktop-first split structure & scaling fonts) */}
          <div className="flex-1 flex flex-col justify-center px-6 md:px-12 relative z-20 select-none w-full max-w-5xl mx-auto py-8">
            <AnimatePresence mode="wait">
              {currentSlide === 0 && (
                <motion.div
                  key="slide0"
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.05, y: -15 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center md:text-left"
                >
                  <div className="w-36 h-36 md:w-56 md:h-56 rounded-full relative flex items-center justify-center flex-shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-40 blur-xl animate-pulse" />
                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-black border-4 border-white/10 flex items-center justify-center relative overflow-hidden ring-8 ring-violet-500/20">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          onError={onImgErr}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                          <Music size={48} className="text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 max-w-lg">
                    <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs uppercase tracking-widest text-violet-400 font-black">
                      Hello, {user?.name.split(" ")[0]}
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
                      Your Music Story, <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-sp-green">
                        Fully Unwrapped.
                      </span>
                    </h1>
                    <p className="text-sm md:text-base text-white/50 leading-relaxed pt-1">
                      A premium, visual playback of your listening patterns, preferences, and musical vibe.
                    </p>
                  </div>
                </motion.div>
              )}

              {currentSlide === 1 && (
                <motion.div
                  key="slide1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider w-fit flex items-center gap-1.5">
                      <Calendar size={14} /> The Journey
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Synced since <br />
                      <span className="text-emerald-400">{getJoinMonthYear()}</span>
                    </h2>
                    <p className="text-sm md:text-base text-white/60 leading-relaxed">
                      You've been mapping your musical state to SoulSync, capturing each beat, vibe, and play counts along the way.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-between">
                      <div>
                        <span className="text-xs text-white/40 uppercase font-black tracking-wider block mb-1">
                          Minutes Listened
                        </span>
                        <span className="text-3xl md:text-4xl font-black text-emerald-400">
                          <Counter value={formatListeningTime(stats?.totalListeningTime || 0)} />
                        </span>
                      </div>
                      <Clock size={36} className="text-emerald-500/30" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.05]">
                        <span className="text-[10px] text-white/40 uppercase font-black tracking-wider block mb-1">
                          Songs Played
                        </span>
                        <span className="text-2xl md:text-3xl font-black text-white">
                          <Counter value={stats?.totalSongsPlayed || 0} />
                        </span>
                      </div>
                      <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.05]">
                        <span className="text-[10px] text-white/40 uppercase font-black tracking-wider block mb-1">
                          Liked Songs
                        </span>
                        <span className="text-2xl md:text-3xl font-black text-white">
                          <Counter value={stats?.likedSongsCount || 0} />
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 2 && (
                <motion.div
                  key="slide2"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="text-xs uppercase tracking-wider text-indigo-400 font-black px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
                      Your Anthems
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Your Top <br />Played Songs
                    </h2>
                    <p className="text-sm md:text-base text-white/50 leading-relaxed">
                      These were the tracks you couldn't stop playing. Your ultimate soundtrack, logged back-to-back.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {stats?.topSongs && stats.topSongs.length > 0 ? (
                      stats.topSongs.slice(0, 5).map((song, idx) => (
                        <div
                          key={song._id}
                          className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all"
                        >
                          <span className="w-5 text-center text-xs font-black text-white/40">
                            {idx + 1}
                          </span>
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 relative flex items-center justify-center">
                            {song.albumArt ? (
                              <img
                                src={song.albumArt}
                                onError={onImgErr}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music size={16} className="text-white/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-sm text-white truncate block">
                              {song.title || "Unknown Title"}
                            </span>
                            <span className="text-xs text-white/50 truncate block">
                              {song.artist || "Unknown Artist"}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                              {song.count} plays
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-white/30 italic text-center py-6">No song history logged.</p>
                    )}
                  </div>
                </motion.div>
              )}

              {currentSlide === 3 && (
                <motion.div
                  key="slide3"
                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.05, y: -15 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center md:text-left"
                >
                  {stats?.topArtists?.[0] ? (
                    <>
                      <div className="relative w-36 h-36 md:w-64 md:h-64 rounded-full overflow-hidden ring-4 ring-rose-500/20 flex-shrink-0 flex items-center justify-center bg-white/[0.02] shadow-2xl">
                        {stats.topArtists[0].albumArt ? (
                          <img
                            src={stats.topArtists[0].albumArt}
                            onError={onImgErr}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-5xl font-black text-rose-400">
                            {stats.topArtists[0]._id?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="space-y-4 max-w-md">
                        <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-wider w-fit mx-auto md:mx-0 flex items-center gap-1.5">
                          <Heart size={12} fill="currentColor" /> Ultimate Muse
                        </span>
                        <p className="text-white/50 text-xs md:text-sm uppercase tracking-widest font-bold">Your #1 played artist</p>
                        <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
                          {stats.topArtists[0]._id}
                        </h2>
                        <p className="text-lg md:text-xl font-black text-rose-400">
                          {stats.topArtists[0].count} plays
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 py-8">
                      <Music size={48} className="text-white/20 mx-auto" />
                      <p className="text-white/50 text-xs">No artists logged yet.</p>
                    </div>
                  )}
                </motion.div>
              )}

              {currentSlide === 4 && (
                <motion.div
                  key="slide4"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="text-xs uppercase tracking-wider text-orange-400 font-black px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 w-fit">
                      In Heavy Rotation
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Your Top 5 <br />Artists
                    </h2>
                    <p className="text-sm md:text-base text-white/50 leading-relaxed">
                      These artists provided the constant backbeat to your days, racking up the highest play counts in your library.
                    </p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {stats?.topArtists?.slice(0, 5).map((artist, idx) => {
                      const maxCount = stats.topArtists[0]?.count || 1;
                      const percent = Math.max(12, Math.min(100, (artist.count / maxCount) * 100));

                      const barColors = [
                        "bg-gradient-to-r from-amber-400 to-orange-500",
                        "bg-gradient-to-r from-orange-400 to-pink-500",
                        "bg-gradient-to-r from-pink-400 to-fuchsia-500",
                        "bg-gradient-to-r from-fuchsia-400 to-violet-500",
                        "bg-gradient-to-r from-violet-400 to-indigo-500",
                      ];

                      return (
                        <div key={artist._id} className="space-y-1">
                          <div className="flex justify-between items-center text-xs md:text-sm">
                            <span className="font-semibold text-white/95 truncate max-w-[280px] md:max-w-xs">
                              {idx + 1}. {artist._id}
                            </span>
                            <span className="text-white/40">{artist.count} plays</span>
                          </div>
                          <div className="h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 1.2, type: "spring", stiffness: 80, damping: 12 }}
                              className={`h-full ${barColors[idx % barColors.length]} rounded-full`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {currentSlide === 5 && (
                <motion.div
                  key="slide5"
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-wider w-fit flex items-center gap-1.5">
                      <Globe size={14} /> Cultural Vibe
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Global <br />Spectrum
                    </h2>
                    <p className="text-sm md:text-base text-white/50 leading-relaxed">
                      You crossed borders through melodies, syncing up with artists speaking different musical dialects and languages.
                    </p>
                  </div>

                  {stats?.languageBreakdown && stats.languageBreakdown.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {stats.languageBreakdown.slice(0, 4).map((lang, idx) => {
                        const gradients = [
                          "from-cyan-400 to-blue-500/20 border-cyan-500/30",
                          "from-purple-400 to-indigo-500/20 border-purple-500/30",
                          "from-amber-400 to-orange-500/20 border-orange-500/30",
                          "from-rose-400 to-pink-500/20 border-pink-500/30",
                        ];

                        return (
                          <div
                            key={lang._id}
                            className={`px-5 py-4 rounded-2xl bg-white/[0.02] border flex items-center justify-between ${gradients[idx % gradients.length].split(" ")[2]}`}
                          >
                            <span className="text-sm font-black text-white capitalize flex items-center gap-3">
                              <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${gradients[idx % gradients.length].split(" ").slice(0, 2).join(" ")}`} />
                              {lang._id}
                            </span>
                            <span className="text-xs font-black text-white/40 font-mono">
                              {lang.count} play{lang.count !== 1 ? "s" : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 italic">No language data logged.</p>
                  )}
                </motion.div>
              )}

              {currentSlide === 6 && (
                <motion.div
                  key="slide6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-black uppercase tracking-wider w-fit flex items-center gap-1.5">
                      <Award size={14} /> Soul Verdict
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Musical <br />Soul Persona
                    </h2>
                    <p className="text-sm md:text-base text-white/50 leading-relaxed">
                      Based on your preferences, mood choices, and listening history, we have mapped you to a specific musical profile.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    {/* 3D tilt-interactive card */}
                    <motion.div
                      whileHover={{ rotateY: 10, rotateX: 10, scale: 1.03 }}
                      className={`p-6 md:p-8 rounded-[36px] border border-white/10 bg-gradient-to-br ${soul.gradient} w-full max-w-sm shadow-2xl text-left flex flex-col justify-between h-72 md:h-80 relative overflow-hidden`}
                    >
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                      
                      <div className="relative z-10 flex justify-between items-start">
                        <span className="text-4xl md:text-5xl">{soul.badge}</span>
                        <span className="px-3 py-1 rounded bg-white/10 text-white/80 text-[10px] font-black tracking-widest uppercase">
                          Active
                        </span>
                      </div>

                      <div className="relative z-10 space-y-2">
                        <h3 className={`text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${soul.gradient} leading-tight`}>
                          {soul.title}
                        </h3>
                        <p className="text-xs md:text-sm text-white/60 leading-relaxed">
                          {soul.desc}
                        </p>
                      </div>

                      <div className="relative z-10 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/45 font-bold uppercase tracking-wider">
                        <span>{soul.tagline}</span>
                        <Zap size={12} className="text-yellow-400" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 7 && (
                <motion.div
                  key="slide7"
                  initial={{ opacity: 0, y: 25 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 100, damping: 14 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  {/* Share Card Container */}
                  <div className="relative rounded-[36px] p-6 border border-white/15 bg-white/[0.02] overflow-hidden shadow-2xl w-full max-w-md mx-auto md:mx-0">
                    <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${soul.gradient} opacity-20 blur-2xl`} />

                    <div className="flex items-center gap-4 pb-4 border-b border-white/10">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          onError={onImgErr}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-white/20"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                          <Music size={24} className="text-white/65" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-black text-white leading-tight">
                          {user?.name}
                        </h3>
                        <p className="text-xs text-white/40">@{user?.username || "listener"}</p>
                      </div>
                      <span className="ml-auto text-2xl">{soul.badge}</span>
                    </div>

                    <div className="space-y-4 pt-4 relative z-10">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                          Musical Soul
                        </span>
                        <span className={`text-lg font-black bg-clip-text text-transparent bg-gradient-to-r ${soul.gradient}`}>
                          {soul.title}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                            Top Artist
                          </span>
                          <span className="text-sm font-black text-white truncate block">
                            {stats?.topArtists?.[0]?._id || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                            Top Song
                          </span>
                          <span className="text-sm font-black text-white truncate block">
                            {stats?.topSongs?.[0]?.title || "—"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold block mb-1.5">
                          Top Artists
                        </span>
                        <div className="space-y-1">
                          {stats?.topArtists?.slice(0, 3).map((a, idx) => (
                            <p key={a._id} className="text-xs text-white/80 truncate">
                              <span className="text-white/40 font-bold">{idx + 1}.</span> {a._id}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30 font-bold tracking-widest uppercase">
                      <span>SOULSYNC 2026</span>
                      <span>MY MUSIC STORY</span>
                    </div>
                  </div>

                  {/* Actions & Text */}
                  <div className="space-y-6">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                      Share Your <br />Vibe
                    </h2>
                    <p className="text-sm md:text-base text-white/50 leading-relaxed">
                      Download your ticket and share your musical profile with friends. Let them sync with your musical identity.
                    </p>

                    <div className="flex gap-4 pt-2">
                      <button
                        onClick={handleLaunch}
                        className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-all active:scale-95"
                      >
                        <RotateCcw size={14} /> Replay
                      </button>
                      <button
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-8 py-3 rounded-full bg-sp-green hover:bg-sp-green/90 text-black text-sm font-black transition-all active:scale-95"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Story navigation indicators (Wide layout on desktop) */}
          <div className="relative z-40 p-5 pb-8 flex justify-between items-center text-white/40 select-none w-full max-w-5xl mx-auto">
            <button
              onClick={handlePrev}
              disabled={currentSlide === 0}
              className="flex items-center gap-1.5 hover:text-white transition-colors disabled:opacity-20 text-xs font-bold"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <div className="flex gap-2">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <span
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentSlide ? "bg-white scale-125" : "bg-white/20"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 hover:text-white transition-colors text-xs font-bold"
            >
              {currentSlide === totalSlides - 1 ? "Close" : "Next"}{" "}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
