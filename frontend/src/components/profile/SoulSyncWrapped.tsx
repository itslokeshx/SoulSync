import { useState, useEffect, useRef } from "react";
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

  const totalSlides = 7;
  const slideDuration = 6500; // 6.5 seconds per slide
  const progressInterval = 50;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger continuous confetti showers on the final slide
  useEffect(() => {
    if (isOpen && currentSlide === totalSlides - 1) {
      const duration = 4 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 35, spread: 360, ticks: 60, zIndex: 100 };

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

  // Rich Spotify-wrapped bold color block backgrounds
  const slideGradients = [
    "from-[#2e0854] via-[#0f051d] to-[#040108]", // Slide 0 (Welcome): Deep Electric Violet
    "from-[#0b3c29] via-[#03150e] to-[#010604]", // Slide 1 (Milestones): Deep Mint/Forest
    "from-[#4c0519] via-[#1c0209] to-[#0a0003]", // Slide 2 (Top Artist): Rich Wine Red
    "from-[#431407] via-[#1a0502] to-[#070100]", // Slide 3 (Artists List): Warm Copper
    "from-[#083344] via-[#02151e] to-[#010609]", // Slide 4 (Languages): Cyan Wave
    "from-[#4a044e] via-[#1a021c] to-[#070008]", // Slide 5 (Identity): Fuchsia/Purple
    "from-[#111827] via-[#090d16] to-[#030407]", // Slide 6 (Poster): Clean Dark Slate
  ];

  const slideThemes = [
    "text-indigo-400",
    "text-emerald-400",
    "text-pink-400",
    "text-orange-400",
    "text-cyan-400",
    "text-fuchsia-400",
    "text-sp-green",
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
                <Sparkles size={11} className="animate-spin text-fuchsia-400" style={{ animationDuration: "3s" }} /> Live Wrapped
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

      {/* ── Wrapped Interactive Slides Modal ── */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/98 md:backdrop-blur-2xl"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") handleNext();
              if (e.key === "ArrowLeft") handlePrev();
              if (e.key === "Escape") setIsOpen(false);
            }}
          >
            {/* Center Story Window */}
            <div
              className={`w-full h-full md:h-[770px] md:max-w-md md:rounded-[36px] md:border md:border-white/10 relative overflow-hidden flex flex-col justify-between shadow-2xl transition-colors duration-1000 bg-gradient-to-b ${slideGradients[currentSlide]}`}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              {/* Subtle visual ambient glow */}
              <div
                className="absolute -top-32 -left-32 w-72 h-72 rounded-full pointer-events-none opacity-20 blur-3xl transition-all duration-1000"
                style={{
                  background:
                    currentSlide === 0
                      ? "rgba(139, 92, 246, 0.6)"
                      : currentSlide === 1
                        ? "rgba(52, 211, 153, 0.6)"
                        : currentSlide === 2
                          ? "rgba(244, 63, 94, 0.6)"
                          : currentSlide === 3
                            ? "rgba(249, 115, 22, 0.6)"
                            : currentSlide === 4
                              ? "rgba(6, 182, 212, 0.6)"
                              : currentSlide === 5
                                ? "rgba(217, 70, 239, 0.6)"
                                : "rgba(29, 185, 84, 0.4)",
                }}
              />

              {/* Touch hotspots for navigation */}
              <div className="absolute inset-y-0 left-0 w-1/4 z-30 cursor-w-resize" onClick={handlePrev} />
              <div className="absolute inset-y-0 right-0 w-3/4 z-30 cursor-e-resize" onClick={handleNext} />

              {/* Progress Indicators Header */}
              <div className="relative z-40 p-4 pt-6 flex gap-1.5 w-full">
                {Array.from({ length: totalSlides }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-1 flex-1 rounded-full bg-white/15 overflow-hidden"
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

              {/* Top info and Close */}
              <div className="relative z-40 px-5 flex justify-between items-center text-white/40">
                <span className="text-[10px] font-black tracking-widest uppercase">
                  SOULSYNC WRAPPED
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Slide Content Viewport */}
              <div className="flex-1 flex flex-col justify-center px-8 relative z-20 select-none">
                <AnimatePresence mode="wait">
                  {currentSlide === 0 && (
                    <motion.div
                      key="slide0"
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.05, y: -15 }}
                      transition={{ type: "spring", stiffness: 120, damping: 14 }}
                      className="text-center space-y-7"
                    >
                      <div className="w-28 h-28 rounded-full mx-auto relative flex items-center justify-center">
                        {/* Glowing ring */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-30 blur-lg animate-pulse" />
                        <div className="w-24 h-24 rounded-full bg-black border-2 border-white/10 flex items-center justify-center relative overflow-hidden ring-4 ring-violet-500/20">
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              onError={onImgErr}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                              <Music size={28} className="text-white" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="text-xs uppercase tracking-widest text-violet-400 font-black">
                          Hello, {user?.name.split(" ")[0]}
                        </span>
                        <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
                          Let's explore your <br />
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-sp-green">
                            musical universe.
                          </span>
                        </h1>
                        <p className="text-xs text-white/50 max-w-[240px] mx-auto leading-relaxed pt-1">
                          A custom recap of your favorite sounds, metrics, and listening character.
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
                      className="space-y-6 text-left"
                    >
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider w-fit flex items-center gap-1.5">
                        <Calendar size={12} /> The Journey
                      </span>

                      <div className="space-y-3">
                        <h2 className="text-4xl font-black text-white tracking-tight leading-none">
                          Syncing since <br />
                          <span className="text-emerald-400">{getJoinMonthYear()}</span>
                        </h2>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Since that first day, your ears have been treated to some amazing beats.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 pt-3">
                        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-white/40 uppercase font-black tracking-wider block">
                              Minutes Listened
                            </span>
                            <span className="text-2xl font-black text-emerald-400">
                              <Counter value={formatListeningTime(stats?.totalListeningTime || 0)} />
                            </span>
                          </div>
                          <Clock size={28} className="text-emerald-500/30" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                            <span className="text-[9px] text-white/40 uppercase font-black tracking-wider block mb-1">
                              Songs Played
                            </span>
                            <span className="text-xl font-black text-white">
                              <Counter value={stats?.totalSongsPlayed || 0} />
                            </span>
                          </div>
                          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                            <span className="text-[9px] text-white/40 uppercase font-black tracking-wider block mb-1">
                              Liked Songs
                            </span>
                            <span className="text-xl font-black text-white">
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
                      initial={{ opacity: 0, scale: 0.9, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.05, y: -15 }}
                      transition={{ type: "spring", stiffness: 120, damping: 14 }}
                      className="text-center space-y-6"
                    >
                      <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Heart size={12} fill="currentColor" /> Ultimate Muse
                      </span>

                      {stats?.topArtists?.[0] ? (
                        <div className="space-y-6">
                          <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden ring-4 ring-rose-500/20 flex items-center justify-center bg-white/[0.02]">
                            {stats.topArtists[0].albumArt ? (
                              <img
                                src={stats.topArtists[0].albumArt}
                                onError={onImgErr}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-3xl font-black text-rose-400">
                                {stats.topArtists[0]._id?.[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-white/50 text-xs">Your absolute #1 artist</p>
                            <h2 className="text-3xl font-black text-white tracking-tight leading-tight">
                              {stats.topArtists[0]._id}
                            </h2>
                            <p className="text-sm font-black text-rose-400">
                              {stats.topArtists[0].count} plays
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 py-8">
                          <Music size={36} className="text-white/20 mx-auto" />
                          <p className="text-white/50 text-xs">No artists logged yet.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {currentSlide === 3 && (
                    <motion.div
                      key="slide3"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ type: "spring", stiffness: 120, damping: 14 }}
                      className="space-y-6 text-left"
                    >
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-orange-400 font-black">
                          In Heavy Rotation
                        </span>
                        <h2 className="text-3xl font-black text-white tracking-tight">
                          Top Artists
                        </h2>
                      </div>

                      <div className="space-y-3.5 pt-1">
                        {stats?.topArtists?.slice(0, 5).map((artist, idx) => {
                          const maxCount = stats.topArtists[0]?.count || 1;
                          const percent = Math.max(12, Math.min(100, (artist.count / maxCount) * 100));

                          // Colorful progressive gradient bars
                          const barColors = [
                            "bg-gradient-to-r from-amber-400 to-orange-500",
                            "bg-gradient-to-r from-orange-400 to-pink-500",
                            "bg-gradient-to-r from-pink-400 to-fuchsia-500",
                            "bg-gradient-to-r from-fuchsia-400 to-violet-500",
                            "bg-gradient-to-r from-violet-400 to-indigo-500",
                          ];

                          return (
                            <div key={artist._id} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-white/90 truncate max-w-[260px]">
                                  {idx + 1}. {artist._id}
                                </span>
                                <span className="text-white/40">{artist.count} plays</span>
                              </div>
                              <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
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

                  {currentSlide === 4 && (
                    <motion.div
                      key="slide4"
                      initial={{ opacity: 0, y: -15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 15 }}
                      transition={{ type: "spring", stiffness: 120, damping: 14 }}
                      className="space-y-6 text-center"
                    >
                      <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Globe size={12} /> Cultural Vibe
                      </span>

                      <div className="space-y-2">
                        <h2 className="text-3xl font-black text-white tracking-tight">
                          Global Spectrum
                        </h2>
                        <p className="text-xs text-white/50 max-w-[230px] mx-auto">
                          You explored diverse languages, finding resonance in different dialects.
                        </p>
                      </div>

                      {stats?.languageBreakdown && stats.languageBreakdown.length > 0 ? (
                        <div className="flex flex-col gap-2.5 max-w-[250px] mx-auto pt-2">
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
                                className={`px-4 py-3 rounded-2xl bg-white/[0.02] border flex items-center justify-between ${gradients[idx % gradients.length].split(" ")[2]}`}
                              >
                                <span className="text-xs font-black text-white capitalize flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${gradients[idx % gradients.length].split(" ").slice(0, 2).join(" ")}`} />
                                  {lang._id}
                                </span>
                                <span className="text-[11px] text-white/40 font-mono">
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

                  {currentSlide === 5 && (
                    <motion.div
                      key="slide5"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ type: "spring", stiffness: 120, damping: 14 }}
                      className="text-center space-y-6"
                    >
                      <span className="px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-[10px] font-black uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Award size={12} /> Soul Verdict
                      </span>

                      <div className="space-y-4">
                        <p className="text-white/40 text-[10px] uppercase tracking-widest font-black">
                          Your Music Character
                        </p>
                        
                        {/* Interactive holographic-style card */}
                        <motion.div
                          whileHover={{ rotateY: 8, rotateX: 8, scale: 1.02 }}
                          className={`p-5 rounded-3xl border border-white/10 bg-gradient-to-br ${soul.gradient} max-w-[260px] mx-auto shadow-[0_10px_30px_rgba(217,70,239,0.15)] text-left flex flex-col justify-between h-56 relative overflow-hidden`}
                        >
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                          
                          <div className="relative z-10 flex justify-between items-start">
                            <span className="text-3xl">{soul.badge}</span>
                            <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 text-[8px] font-black tracking-widest uppercase">
                              Active
                            </span>
                          </div>

                          <div className="relative z-10">
                            <h3 className={`text-lg font-black text-transparent bg-clip-text bg-gradient-to-r ${soul.gradient} leading-tight mb-1`}>
                              {soul.title}
                            </h3>
                            <p className="text-[10px] text-white/60 leading-relaxed">
                              {soul.desc}
                            </p>
                          </div>

                          <div className="relative z-10 pt-2 border-t border-white/5 flex items-center justify-between text-[8px] text-white/40 font-bold uppercase tracking-wider">
                            <span>{soul.tagline}</span>
                            <Zap size={10} className="text-yellow-400" />
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}

                  {currentSlide === 6 && (
                    <motion.div
                      key="slide6"
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 100, damping: 14 }}
                      className="space-y-6 text-center"
                    >
                      {/* Share Card Container */}
                      <div className="relative rounded-3xl p-5 border border-white/15 bg-white/[0.02] text-left overflow-hidden shadow-2xl">
                        {/* Graphic design background color overlay */}
                        <div className={`absolute -top-16 -right-16 w-36 h-36 rounded-full bg-gradient-to-br ${soul.gradient} opacity-20 blur-2xl`} />

                        <div className="flex items-center gap-3.5 pb-4 border-b border-white/10">
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              onError={onImgErr}
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-white/20"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                              <Music size={20} className="text-white/65" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-sm font-black text-white leading-tight">
                              {user?.name}
                            </h3>
                            <p className="text-[10px] text-white/40">@{user?.username || "listener"}</p>
                          </div>
                          <span className="ml-auto text-xl">{soul.badge}</span>
                        </div>

                        <div className="space-y-4 pt-4 relative z-10">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                              Musical Soul
                            </span>
                            <span className={`text-base font-black bg-clip-text text-transparent bg-gradient-to-r ${soul.gradient}`}>
                              {soul.title}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                                Top Artist
                              </span>
                              <span className="text-xs font-black text-white truncate block">
                                {stats?.topArtists?.[0]?._id || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                                Minutes Synced
                              </span>
                              <span className="text-xs font-black text-white">
                                {stats ? formatListeningTime(stats.totalListeningTime) : "0"}
                              </span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block mb-1">
                              Top Artists
                            </span>
                            <div className="space-y-1">
                              {stats?.topArtists?.slice(0, 3).map((a, idx) => (
                                <p key={a._id} className="text-[11px] text-white/80 truncate">
                                  <span className="text-white/40 font-bold">{idx + 1}.</span> {a._id}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-white/5 flex items-center justify-between text-[8px] text-white/30 font-bold tracking-widest uppercase">
                          <span>SOULSYNC 2026</span>
                          <span>MY MUSIC STORY</span>
                        </div>
                      </div>

                      <div className="flex gap-2.5 justify-center pt-2">
                        <button
                          onClick={handleLaunch}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all active:scale-95"
                        >
                          <RotateCcw size={12} /> Replay
                        </button>
                        <button
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-sp-green hover:bg-sp-green/90 text-black text-xs font-black transition-all active:scale-95"
                        >
                          Done
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Story navigation indicators */}
              <div className="relative z-40 p-4 pb-6 flex justify-between items-center text-white/40 select-none">
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className="flex items-center gap-1 hover:text-white transition-colors disabled:opacity-20 text-[10px] font-bold"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <div className="flex gap-1.5">
                  {Array.from({ length: totalSlides }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === currentSlide ? "bg-white scale-125" : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 hover:text-white transition-colors text-[10px] font-bold"
                >
                  {currentSlide === totalSlides - 1 ? "Close" : "Next"}{" "}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
