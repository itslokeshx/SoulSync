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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const joinedAt = new Date(user.createdAt);
    joinedAt.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - joinedAt.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  };

  const getJoinDateFormatted = () => {
    if (!user?.createdAt) return "some time ago";
    return new Date(user.createdAt).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
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

  // Premium background blocks
  const slideGradients = [
    "from-[#120422] via-[#080210] to-[#030106]", // Slide 0 (Welcome): Deep Dark Amethyst
    "from-[#041a12] via-[#020d09] to-[#010503]", // Slide 1 (Milestones): Deep Emerald
    "from-[#030e24] via-[#010714] to-[#00030a]", // Slide 2 (Top Songs): Deep Sapphire
    "from-[#22020a] via-[#100104] to-[#060002]", // Slide 3 (Top Artist): Deep Ruby
    "from-[#240a02] via-[#110401] to-[#060100]", // Slide 4 (Artists List): Deep Amber
    "from-[#01161d] via-[#000a0e] to-[#000507]", // Slide 5 (Languages): Deep Cyan
    "from-[#1d0120] via-[#0e0010] to-[#060007]", // Slide 6 (Identity): Deep Purple/Fuchsia
    "from-[#08090d] via-[#040407] to-[#010102]", // Slide 7 (Poster): Sleek Near Black
  ];

  return (
    <div className="mb-10">
      {/* ── Dashboard Widget Card (Eye-catching & Premium) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main CTA Widget Card */}
        <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl p-7 flex flex-col justify-between border border-white/[0.06] bg-[#09090b] group">
          {/* Dynamic colorful border light */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sp-green transition-all" />
          
          {/* Glow backdrop mesh */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none transition-opacity group-hover:opacity-25 duration-500"
            style={{
              background:
                "radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.35) 0%, transparent 60%), radial-gradient(circle at 90% 80%, rgba(29, 185, 84, 0.25) 0%, transparent 60%)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-fuchsia-300 text-[10px] font-black tracking-widest uppercase border border-fuchsia-500/20 flex items-center gap-1.5 shadow-[0_0_15px_rgba(217,70,239,0.05)]">
                <Sparkles size={11} className="text-fuchsia-400" /> Live Wrapped
              </span>
              <span className="text-white/30 text-xs font-semibold">Since Day One</span>
            </div>

            <h3 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">
              Your SoulSync Story
            </h3>
            <p className="text-xs text-white/40 max-w-lg leading-relaxed mb-6">
              {hasHistory
                ? `You've synced ${formatListeningTime(stats.totalListeningTime)} minutes of pure sound. Dive in to claim your custom musical personality badge and explore your top artists!`
                : "You are starting your musical adventure. Sync more tracks to unlock your customized SoulSync Wrapped!"}
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between mt-auto">
            {hasHistory ? (
              <button
                onClick={handleLaunch}
                className="group flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-sp-green text-black font-black text-xs hover:bg-white hover:scale-[1.03] active:scale-[0.98] transition-all shadow-[0_6px_25px_rgba(29,185,84,0.25)]"
              >
                <Play size={11} fill="currentColor" />
                Launch Wrapped
              </button>
            ) : (
              <span className="text-xs text-white/30 italic">Play 5+ tracks to unlock</span>
            )}
            <div className="text-right">
              <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300 font-mono">
                {joinDays}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-white/30 font-black">
                Days Joined
              </p>
            </div>
          </div>
        </div>

        {/* Profile Identity Card */}
        <div className="col-span-1 relative overflow-hidden rounded-3xl p-7 border border-white/[0.06] bg-[#09090b] flex flex-col justify-between group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white/[0.01] to-transparent pointer-events-none rounded-full blur-xl" />
          
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest">
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
            <p className="text-xs text-white/40 leading-relaxed line-clamp-3">
              {hasHistory
                ? soul.desc
                : "Your musical character will write itself as you listen to more tracks. We're tuning in!"}
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-white/[0.04] flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${soul.gradient}`} />
            <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider">
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
            className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none opacity-[0.08] blur-3xl transition-all duration-1000"
            style={{
              background:
                currentSlide === 0
                  ? "rgba(139, 92, 246, 0.8)"
                  : currentSlide === 1
                    ? "rgba(52, 211, 153, 0.8)"
                    : currentSlide === 2
                      ? "rgba(99, 102, 241, 0.8)"
                      : currentSlide === 3
                        ? "rgba(244, 63, 94, 0.8)"
                        : currentSlide === 4
                          ? "rgba(249, 115, 22, 0.8)"
                          : currentSlide === 5
                            ? "rgba(6, 182, 212, 0.8)"
                            : currentSlide === 6
                              ? "rgba(217, 70, 239, 0.8)"
                              : "rgba(29, 185, 84, 0.6)",
            }}
          />

          {/* Touch hotspots for navigation */}
          <div className="absolute inset-y-0 left-0 w-1/3 z-30 cursor-w-resize" onClick={handlePrev} />
          <div className="absolute inset-y-0 right-0 w-2/3 z-30 cursor-e-resize" onClick={handleNext} />

          {/* Progress Indicators Header */}
          <div className="relative z-40 p-5 pt-8 flex gap-1.5 w-full max-w-5xl mx-auto">
            {Array.from({ length: totalSlides }).map((_, idx) => (
              <div
                key={idx}
                className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden"
              >
                <div
                  className="h-full bg-white/90 transition-all ease-linear"
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
          <div className="relative z-40 px-6 flex justify-between items-center text-white/30 w-full max-w-5xl mx-auto">
            <span className="text-[10px] font-black tracking-widest uppercase">
              SOULSYNC WRAPPED
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="p-2.5 rounded-full hover:bg-white/5 text-white/50 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Slide Content Viewport */}
          <div className="flex-1 flex flex-col justify-center px-6 md:px-12 relative z-20 select-none w-full max-w-5xl mx-auto py-8 overflow-y-auto scrollbar-none">
            <AnimatePresence mode="wait">
              {currentSlide === 0 && (
                <motion.div
                  key="slide0"
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.03, y: -10 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-20 text-center md:text-left"
                >
                  <div className="w-36 h-36 md:w-52 md:h-52 rounded-full relative flex items-center justify-center flex-shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-20 blur-xl animate-pulse" />
                    <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-black border border-white/10 flex items-center justify-center relative overflow-hidden ring-4 ring-white/[0.04]">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          onError={onImgErr}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                          <Music size={40} className="text-white" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 max-w-md">
                    <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] uppercase tracking-widest text-white/50 font-black">
                      Welcome, {user?.name.split(" ")[0]}
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
                      Your Music Year <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-emerald-400">
                        {new Date().getFullYear()} In Sync.
                      </span>
                    </h1>
                    <p className="text-xs md:text-sm text-white/40 leading-relaxed max-w-sm pt-1">
                      A premium, visual playback of your listening patterns, preferences, and musical vibe.
                    </p>
                  </div>
                </motion.div>
              )}

              {currentSlide === 1 && (
                <motion.div
                  key="slide1"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider w-fit flex items-center gap-1.5">
                      <Calendar size={13} /> The Journey
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Synced since <br />
                      <span className="text-emerald-400">{getJoinDateFormatted()}</span>
                    </h2>
                    <p className="text-xs md:text-sm text-white/40 leading-relaxed max-w-sm">
                      You've been mapping your musical state to SoulSync, capturing each beat, vibe, and play counts along the way.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-3xl bg-white/[0.01] backdrop-blur-lg border border-white/[0.04] flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-white/30 uppercase font-black tracking-wider block mb-1">
                          Minutes Listened
                        </span>
                        <span className="text-2xl md:text-3xl font-black text-emerald-400">
                          <Counter value={formatListeningTime(stats?.totalListeningTime || 0)} />
                        </span>
                      </div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white/[0.01] backdrop-blur-lg border border-white/[0.04] flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-white/30 uppercase font-black tracking-wider block mb-1">
                          Songs Played
                        </span>
                        <span className="text-2xl md:text-3xl font-black text-white">
                          <Counter value={stats?.totalSongsPlayed || 0} />
                        </span>
                      </div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white/[0.01] backdrop-blur-lg border border-white/[0.04] flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-white/30 uppercase font-black tracking-wider block mb-1">
                          Liked Songs
                        </span>
                        <span className="text-2xl md:text-3xl font-black text-white">
                          <Counter value={stats?.likedSongsCount || 0} />
                        </span>
                      </div>
                    </div>

                    <div className="p-5 rounded-3xl bg-white/[0.01] backdrop-blur-lg border border-white/[0.04] flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] text-white/30 uppercase font-black tracking-wider block mb-1">
                          Days Joined
                        </span>
                        <span className="text-2xl md:text-3xl font-black text-emerald-400">
                          <Counter value={joinDays} />
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 2 && (
                <motion.div
                  key="slide2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-black px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 w-fit">
                      Your Anthems
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Your Top <br />Played Songs
                    </h2>
                    <p className="text-xs md:text-sm text-white/40 leading-relaxed max-w-sm">
                      These were the tracks you couldn't stop playing. Your ultimate soundtrack, logged back-to-back.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {stats?.topSongs && stats.topSongs.length > 0 ? (
                      stats.topSongs.slice(0, 5).map((song, idx) => (
                        <div
                          key={song._id}
                          className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.03] hover:border-white/[0.06] transition-all"
                        >
                          <span className="w-5 text-center text-xs font-black text-white/30 font-mono">
                            0{idx + 1}
                          </span>
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 relative flex items-center justify-center border border-white/[0.04]">
                            {song.albumArt ? (
                              <img
                                src={song.albumArt}
                                onError={onImgErr}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music size={14} className="text-white/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-sm text-white truncate block">
                              {song.title || "Unknown Title"}
                            </span>
                            <span className="text-[11px] text-white/45 truncate block">
                              {song.artist || "Unknown Artist"}
                            </span>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-[9px] font-black text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
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
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.03, y: -10 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-20 text-center md:text-left"
                >
                  {stats?.topArtists?.[0] ? (
                    <>
                      {/* Premium vinyl-style disc cover */}
                      <div className="relative w-44 h-44 md:w-60 md:h-60 rounded-full flex-shrink-0 flex items-center justify-center bg-black shadow-2xl group border border-white/5 ring-8 ring-white/[0.02]">
                        <div className="absolute inset-0 rounded-full border border-white/10 animate-spin" style={{ animationDuration: "12s" }} />
                        <div className="w-[94%] h-[94%] rounded-full overflow-hidden flex items-center justify-center relative bg-[#111]">
                          {stats.topArtists[0].albumArt ? (
                            <img
                              src={stats.topArtists[0].albumArt}
                              onError={onImgErr}
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            <span className="text-5xl font-black text-rose-500/80">
                              {stats.topArtists[0]._id?.[0]?.toUpperCase()}
                            </span>
                          )}
                          {/* Inner Vinyl Ring */}
                          <div className="absolute w-12 h-12 md:w-16 md:h-16 rounded-full bg-black border-4 border-white/15 flex items-center justify-center shadow-inner">
                            <div className="w-3.5 h-3.5 rounded-full bg-rose-500/30" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 max-w-sm">
                        <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider w-fit mx-auto md:mx-0 flex items-center gap-1.5">
                          <Heart size={11} fill="currentColor" /> Ultimate Muse
                        </span>
                        <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Your #1 played artist</p>
                        <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-none">
                          {stats.topArtists[0]._id}
                        </h2>
                        <p className="text-base md:text-lg font-black text-rose-400 font-mono">
                          {stats.topArtists[0].count} plays
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 py-8">
                      <Music size={40} className="text-white/20 mx-auto" />
                      <p className="text-white/40 text-xs">No artists logged yet.</p>
                    </div>
                  )}
                </motion.div>
              )}

              {currentSlide === 4 && (
                <motion.div
                  key="slide4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-16 items-center text-left"
                >
                  <div className="space-y-3 md:space-y-4">
                    <span className="text-[10px] uppercase tracking-wider text-orange-400 font-black px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 w-fit">
                      In Heavy Rotation
                    </span>
                    <h2 className="text-3xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Your Top 5 <br className="hidden md:inline" />Artists
                    </h2>
                    <p className="text-xs md:text-sm text-white/40 leading-relaxed max-w-sm">
                      These artists provided the constant backbeat to your days, racking up the highest play counts in your library.
                    </p>
                  </div>

                  <div className="space-y-6 pt-1">
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
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-white/90 truncate max-w-[240px] md:max-w-xs">
                              0{idx + 1} &nbsp;·&nbsp; {artist._id}
                            </span>
                            <span className="text-white/45 font-mono">{artist.count} plays</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 1, type: "spring", stiffness: 70, damping: 12 }}
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
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-wider w-fit flex items-center gap-1.5">
                      <Globe size={13} /> Cultural Vibe
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Global <br />Spectrum
                    </h2>
                    <p className="text-xs md:text-sm text-white/40 leading-relaxed max-w-sm">
                      You crossed borders through melodies, syncing up with artists speaking different musical dialects and languages.
                    </p>
                  </div>

                  {stats?.languageBreakdown && stats.languageBreakdown.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {stats.languageBreakdown.slice(0, 4).map((lang, idx) => {
                        const gradients = [
                          "from-cyan-400 to-blue-500/20 border-cyan-500/20",
                          "from-purple-400 to-indigo-500/20 border-purple-500/20",
                          "from-amber-400 to-orange-500/20 border-orange-500/20",
                          "from-rose-400 to-pink-500/20 border-rose-500/20",
                        ];

                        return (
                          <div
                            key={lang._id}
                            className={`px-5 py-3.5 rounded-2xl bg-white/[0.01] backdrop-blur-md border flex items-center justify-between ${gradients[idx % gradients.length].split(" ")[2]}`}
                          >
                            <span className="text-xs font-black text-white capitalize flex items-center gap-3">
                              <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${gradients[idx % gradients.length].split(" ").slice(0, 2).join(" ")}`} />
                              {lang._id}
                            </span>
                            <span className="text-[10px] font-black text-white/30 font-mono">
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
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  <div className="space-y-4">
                    <span className="px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-[10px] font-black uppercase tracking-wider w-fit flex items-center gap-1.5">
                      <Award size={13} /> Soul Verdict
                    </span>
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                      Musical <br />Soul Persona
                    </h2>
                    <p className="text-xs md:text-sm text-white/40 leading-relaxed max-w-sm">
                      Based on your preferences, mood choices, and listening history, we have mapped you to a specific musical profile.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    {/* 3D tilt-interactive card */}
                    <motion.div
                      whileHover={{ rotateY: 8, rotateX: 8, scale: 1.02 }}
                      className={`p-6 md:p-8 rounded-[32px] border border-white/10 bg-gradient-to-br ${soul.gradient} w-full max-w-sm shadow-2xl text-left flex flex-col justify-between h-72 md:h-76 relative overflow-hidden`}
                    >
                      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
                      
                      <div className="relative z-10 flex justify-between items-start">
                        <span className="text-4xl md:text-5xl">{soul.badge}</span>
                        <span className="px-3 py-1 rounded bg-white/5 border border-white/10 text-white/70 text-[9px] font-black tracking-widest uppercase">
                          Active
                        </span>
                      </div>

                      <div className="relative z-10 space-y-2">
                        <h3 className={`text-lg md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r ${soul.gradient} leading-tight`}>
                          {soul.title}
                        </h3>
                        <p className="text-xs text-white/50 leading-relaxed">
                          {soul.desc}
                        </p>
                      </div>

                      <div className="relative z-10 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[9px] text-white/40 font-bold uppercase tracking-wider">
                        <span>{soul.tagline}</span>
                        <Zap size={11} className="text-yellow-400" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {currentSlide === 7 && (
                <motion.div
                  key="slide7"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center text-left"
                >
                  {/* Share Ticket Container (Premium Ticket Cutouts & Perforations) */}
                  <div className="relative rounded-[32px] border border-white/10 bg-[#070709] overflow-hidden shadow-2xl w-full max-w-xs md:max-w-sm mx-auto md:mx-0 px-6 py-7 flex flex-col justify-between h-[390px] md:h-[410px]">
                    {/* Background glow overlay */}
                    <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${soul.gradient} opacity-10 blur-2xl`} />

                    {/* Left & Right half-circle ticket cutouts */}
                    <div className="absolute top-[28%] -left-3.5 w-7 h-7 rounded-full bg-[#040407] border border-white/10 z-20" />
                    <div className="absolute top-[28%] -right-3.5 w-7 h-7 rounded-full bg-[#040407] border border-white/10 z-20" />

                    {/* Top Segment: Profile */}
                    <div className="flex items-center gap-3.5 pb-4">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          onError={onImgErr}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                          <Music size={20} className="text-white/60" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-black text-white leading-tight">
                          {user?.name}
                        </h3>
                        <p className="text-[10px] text-white/30">@{user?.username || "listener"}</p>
                      </div>
                      <span className="ml-auto text-2xl">{soul.badge}</span>
                    </div>

                    {/* Perforated dashed divider line */}
                    <div className="w-full border-t border-dashed border-white/15 my-1" />

                    {/* Middle Segment: Stats */}
                    <div className="space-y-4 pt-3 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-white/30 font-bold block mb-0.5">
                          Musical Soul
                        </span>
                        <span className={`text-base font-black bg-clip-text text-transparent bg-gradient-to-r ${soul.gradient}`}>
                          {soul.title}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-white/30 font-bold block mb-0.5">
                            Top Artist
                          </span>
                          <span className="text-xs font-black text-white truncate block">
                            {stats?.topArtists?.[0]?._id || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-white/30 font-bold block mb-0.5">
                            Top Song
                          </span>
                          <span className="text-xs font-black text-white truncate block">
                            {stats?.topSongs?.[0]?.title || "—"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-white/30 font-bold block mb-1">
                          Top Artists
                        </span>
                        <div className="space-y-0.5">
                          {stats?.topArtists?.slice(0, 3).map((a, idx) => (
                            <p key={a._id} className="text-xs text-white/70 truncate font-medium">
                              <span className="text-white/30 font-bold font-mono">0{idx + 1}.</span> {a._id}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Ticket Footer / Barcode */}
                      <div className="flex items-end justify-between pt-2">
                        <div className="text-[9px] text-white/20 font-bold tracking-widest uppercase font-mono">
                          <span>SOULSYNC {new Date().getFullYear()}</span>
                        </div>
                        {/* Mock vertical lines barcode */}
                        <div className="flex gap-[2px] items-center h-6 opacity-30 flex-shrink-0">
                          <div className="w-[1.5px] h-full bg-white" />
                          <div className="w-[0.5px] h-full bg-white" />
                          <div className="w-[2.5px] h-full bg-white" />
                          <div className="w-[0.5px] h-full bg-white" />
                          <div className="w-[1.5px] h-full bg-white" />
                          <div className="w-[3px] h-full bg-white" />
                          <div className="w-[0.5px] h-full bg-white" />
                          <div className="w-[1.5px] h-full bg-white" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Text */}
                  <div className="space-y-6">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                      Share Your <br />Vibe
                    </h2>
                    <p className="text-xs md:text-sm text-white/40 leading-relaxed max-w-sm">
                      Download your ticket and share your musical profile with friends. Let them sync with your musical identity.
                    </p>

                    <div className="flex gap-4 pt-2">
                      <button
                        onClick={handleLaunch}
                        className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold transition-all active:scale-[0.97]"
                      >
                        <RotateCcw size={13} /> Replay
                      </button>
                      <button
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2.5 px-8 py-3 rounded-full bg-sp-green hover:bg-sp-green/90 text-black text-xs font-black transition-all active:scale-[0.97] shadow-lg shadow-sp-green/10"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Story navigation indicators */}
          <div className="relative z-40 p-5 pb-8 flex justify-between items-center text-white/30 select-none w-full max-w-5xl mx-auto">
            <button
              onClick={handlePrev}
              disabled={currentSlide === 0}
              className="flex items-center gap-1.5 hover:text-white transition-colors disabled:opacity-10 text-[11px] font-bold"
            >
              <ChevronLeft size={14} /> Back
            </button>
            <div className="flex gap-2">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentSlide ? "bg-white scale-125" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 hover:text-white transition-colors text-[11px] font-bold"
            >
              {currentSlide === totalSlides - 1 ? "Close" : "Next"}{" "}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
