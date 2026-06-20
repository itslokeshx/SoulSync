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
  Share2,
  Bookmark,
  Calendar,
} from "lucide-react";
import { User, UserStats } from "../../types/user";
import { bestImg, onImgErr } from "../../lib/helpers";
import confetti from "canvas-confetti";

interface SoulSyncWrappedProps {
  stats: UserStats | null;
  user: User | null;
  loading: boolean;
}

// Deterministic Musical Soul Identity Generator
function getSoulIdentity(stats: UserStats | null, user: User | null) {
  const listenTime = stats?.totalListeningTime || 0;
  const totalSongs = stats?.totalSongsPlayed || 0;
  const languagesCount = stats?.languageBreakdown?.length || 0;
  
  // Primary mood from preferences
  const moods = user?.preferences?.moods || [];
  const primaryMood = moods[0]?.toLowerCase() || "";

  if (listenTime > 36000) { // > 10 hours
    return {
      title: "The Sonic Connoisseur",
      desc: "Music isn't just background noise for you; it's the rhythm of your life. You spend hours lost in complex melodies and curating the ultimate sonic experience.",
      color: "from-amber-400 via-orange-500 to-red-600",
      bgGlow: "rgba(245, 158, 11, 0.4)",
      badge: "👑",
    };
  }

  if (primaryMood === "chill" || primaryMood === "sleep" || primaryMood === "focus") {
    return {
      title: "The Dreamy Voyager",
      desc: "You look for sanctuary in sound. Your tracks are a warm blanket, helping you drift away, focus, or find peace in a chaotic world.",
      color: "from-sky-400 via-indigo-500 to-purple-600",
      bgGlow: "rgba(56, 189, 248, 0.4)",
      badge: "🌌",
    };
  }

  if (primaryMood === "energetic" || primaryMood === "workout" || primaryMood === "party") {
    return {
      title: "The Groove Catalyst",
      desc: "High energy, heavy bass, and pure dopamine. You use music as fuel to power your days, charge up your workouts, and keep the vibe alive.",
      color: "from-green-400 via-emerald-500 to-teal-600",
      bgGlow: "rgba(52, 211, 153, 0.4)",
      badge: "⚡",
    };
  }

  if (primaryMood === "romantic" || primaryMood === "sad" || primaryMood === "melancholy") {
    return {
      title: "The Emotional Alchemist",
      desc: "You feel every single beat. Music is your poetry, translating deep emotions, nostalgia, and heartstrings into pure sonic therapy.",
      color: "from-rose-400 via-pink-500 to-violet-600",
      bgGlow: "rgba(251, 113, 133, 0.4)",
      badge: "💖",
    };
  }

  if (languagesCount >= 3) {
    return {
      title: "The Global Explorer",
      desc: "Your taste knows no borders. You seamlessly leap across languages and regions, connecting with stories and beats from every corner of the world.",
      color: "from-cyan-400 via-blue-500 to-indigo-600",
      bgGlow: "rgba(34, 211, 238, 0.4)",
      badge: "🌍",
    };
  }

  // Fallback
  return {
    title: "The Eclectic Seeker",
    desc: "Refusing to be boxed in, your music taste is beautifully diverse. You seek out whatever song matches your exact vibration in the moment.",
    color: "from-fuchsia-400 via-purple-500 to-pink-600",
    bgGlow: "rgba(232, 121, 249, 0.4)",
    badge: "✨",
  };
}

export default function SoulSyncWrapped({ stats, user, loading }: SoulSyncWrappedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const totalSlides = 7;
  const slideDuration = 6000; // 6 seconds per slide
  const progressInterval = 50; // update progress every 50ms
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger confetti on final slide
  useEffect(() => {
    if (isOpen && currentSlide === totalSlides - 1) {
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

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
            // End of Wrapped
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
  };

  const formatListeningTime = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    return mins.toLocaleString();
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
          <div className="col-span-1 md:col-span-2 h-44 bg-white/[0.04] rounded-2xl" />
          <div className="h-44 bg-white/[0.04] rounded-2xl" />
        </div>
      </div>
    );
  }

  const soul = getSoulIdentity(stats, user);
  const joinDays = getJoinDays();
  const hasHistory = stats && stats.totalSongsPlayed > 0;

  // Background gradient map for slides
  const slideGradients = [
    "from-violet-950 via-indigo-950 to-[#030206]",
    "from-emerald-950 via-teal-950 to-[#020504]",
    "from-rose-950 via-pink-950 to-[#070204]",
    "from-amber-950 via-orange-950 to-[#060302]",
    "from-cyan-950 via-sky-950 to-[#020507]",
    "from-fuchsia-950 via-purple-950 to-[#060207]",
    "from-slate-950 via-zinc-950 to-black",
  ];

  return (
    <div className="mb-10">
      {/* ── Dashboard Wrapped Card Widget ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main CTA Card */}
        <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-3xl p-6 flex flex-col justify-between border border-white/[0.06] bg-[#0c0c0e]">
          {/* Ambient moving gradient border */}
          <div
            className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.4) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(236, 72, 153, 0.35) 0%, transparent 50%)",
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-sp-green/15 text-sp-green text-[10px] font-bold tracking-wider uppercase border border-sp-green/20 flex items-center gap-1.5 animate-pulse">
                <Sparkles size={10} /> Live Wrapped
              </span>
              <span className="text-white/40 text-xs font-medium">Since day one</span>
            </div>

            <h3 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">
              Your SoulSync Journey
            </h3>
            <p className="text-xs text-white/50 max-w-sm leading-relaxed mb-6">
              {hasHistory
                ? `You've spent ${formatListeningTime(stats.totalListeningTime)} minutes syncing with your favorite songs. Let's see your music personality and top hits!`
                : "You are starting your musical adventure. Sync more tracks to unlock your customized SoulSync Wrapped!"}
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between mt-auto">
            {hasHistory ? (
              <button
                onClick={handleLaunch}
                className="group flex items-center gap-2 px-6 py-3 rounded-full bg-sp-green text-black font-extrabold text-sm hover:bg-sp-green/90 hover:scale-105 active:scale-95 transition-all shadow-[0_4px_24px_rgba(29,185,84,0.3)]"
              >
                <Play size={14} fill="currentColor" />
                Launch Wrapped
              </button>
            ) : (
              <span className="text-xs text-white/30 italic">Play 5+ tracks to unlock</span>
            )}
            <div className="text-right">
              <p className="text-2xl font-black text-white/90 font-mono">
                {joinDays}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-white/35 font-bold">
                Days Synced
              </p>
            </div>
          </div>
        </div>

        {/* Profile Identity Card */}
        <div className="col-span-1 relative overflow-hidden rounded-3xl p-6 border border-white/[0.06] bg-[#0d0d10] flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">
              My Vibe
            </span>
            <span className="text-2xl" role="img" aria-label="badge">
              {soul.badge}
            </span>
          </div>

          <div>
            <h4 className="text-lg font-black text-white mb-1">
              {hasHistory ? soul.title : "The Listener"}
            </h4>
            <p className="text-[11px] text-white/40 leading-relaxed line-clamp-3">
              {hasHistory
                ? soul.desc
                : "Your musical character will write itself as you listen to more tracks. We're tuning in!"}
            </p>
          </div>

          {hasHistory && (
            <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-sp-green animate-ping" />
              <span className="text-[10px] text-sp-green font-bold uppercase tracking-wider">
                Sync Active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Wrapped Interactive Slides Modal ── */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 md:backdrop-blur-xl"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") handleNext();
              if (e.key === "ArrowLeft") handlePrev();
              if (e.key === "Escape") setIsOpen(false);
            }}
          >
            {/* Center Story Window */}
            <div
              className={`w-full h-full md:h-[780px] md:max-w-md md:rounded-[32px] md:border md:border-white/10 relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-700 bg-gradient-to-b ${slideGradients[currentSlide]}`}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              {/* Invisible touch hotspots for story navigation */}
              <div className="absolute inset-y-0 left-0 w-1/4 z-30 cursor-w-resize" onClick={handlePrev} />
              <div className="absolute inset-y-0 right-0 w-3/4 z-30 cursor-e-resize" onClick={handleNext} />

              {/* Progress Indicators Header */}
              <div className="relative z-40 p-4 pt-6 flex gap-1.5 w-full">
                {Array.from({ length: totalSlides }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden"
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

              {/* Controls bar */}
              <div className="relative z-40 px-4 flex justify-between items-center text-white/50">
                <span className="text-[10px] font-bold font-mono tracking-wider">
                  SOULSYNC WRAPPED
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Story Content Viewport */}
              <div className="flex-1 flex flex-col justify-center px-8 relative z-20 select-none">
                <AnimatePresence mode="wait">
                  {currentSlide === 0 && (
                    <motion.div
                      key="slide0"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      className="text-center space-y-6"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                        className="w-40 h-40 rounded-full mx-auto relative flex items-center justify-center"
                      >
                        {/* Vinyl Mock */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-600 via-pink-500 to-sp-green opacity-40 blur-xl animate-pulse" />
                        <div className="w-36 h-36 rounded-full bg-black border-4 border-zinc-800 flex items-center justify-center relative">
                          <div className="absolute inset-4 rounded-full border border-dashed border-zinc-700/60" />
                          <div className="absolute inset-8 rounded-full border border-dashed border-zinc-700/60" />
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              onError={onImgErr}
                              className="w-14 h-14 rounded-full object-cover ring-2 ring-sp-green"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-sp-green flex items-center justify-center">
                              <Music size={20} className="text-black" />
                            </div>
                          )}
                        </div>
                      </motion.div>

                      <div className="space-y-2">
                        <span className="text-xs uppercase tracking-widest text-sp-green font-black">
                          Hello, {user?.name.split(" ")[0]}
                        </span>
                        <h1 className="text-3xl font-black text-white tracking-tight leading-none">
                          Your Musical Soul, <br />
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300">
                            Fully Unwrapped.
                          </span>
                        </h1>
                        <p className="text-xs text-white/50 max-w-[250px] mx-auto leading-relaxed pt-2">
                          Your listens tell a story of beats, feelings, and late-night synced tracks.
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
                      className="space-y-8 text-left"
                    >
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider w-fit flex items-center gap-1.5">
                        <Calendar size={12} /> The Starting Line
                      </span>

                      <div className="space-y-4">
                        <h2 className="text-4xl font-black text-white tracking-tight leading-none">
                          It began in <br />
                          <span className="text-emerald-400">{getJoinMonthYear()}</span>
                        </h2>
                        <p className="text-sm text-white/60 leading-relaxed">
                          Since that first sync, you've spent{" "}
                          <strong className="text-white">
                            {formatListeningTime(stats?.totalListeningTime || 0)} minutes
                          </strong>{" "}
                          engrossed in tracks.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-4">
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                          <span className="text-2xl font-black text-white block">
                            {stats?.totalSongsPlayed}
                          </span>
                          <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                            Songs Played
                          </span>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                          <span className="text-2xl font-black text-white block">
                            {stats?.likedSongsCount}
                          </span>
                          <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                            Liked Songs
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {currentSlide === 2 && (
                    <motion.div
                      key="slide2"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      className="text-center space-y-6"
                    >
                      <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Heart size={12} fill="currentColor" /> Your Muse
                      </span>

                      {stats?.topArtists?.[0] ? (
                        <div className="space-y-6">
                          <div className="relative w-36 h-36 mx-auto rounded-full overflow-hidden ring-4 ring-rose-500/30">
                            {stats.topArtists[0].albumArt ? (
                              <img
                                src={stats.topArtists[0].albumArt}
                                onError={onImgErr}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center">
                                <span className="text-3xl font-black text-white">
                                  {stats.topArtists[0]._id?.[0]?.toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/10" />
                          </div>

                          <div className="space-y-2">
                            <p className="text-white/50 text-xs">Your absolute #1 artist</p>
                            <h2 className="text-3xl font-black text-white tracking-tight leading-tight">
                              {stats.topArtists[0]._id}
                            </h2>
                            <p className="text-sm text-rose-400 font-bold">
                              {stats.topArtists[0].count} plays
                            </p>
                            <p className="text-xs text-white/40 max-w-[200px] mx-auto leading-relaxed pt-2">
                              They hit the perfect note, staying in heavy rotation all day.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 py-10">
                          <Music size={40} className="text-white/20 mx-auto" />
                          <p className="text-white/50 text-sm">No artists logged yet.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {currentSlide === 3 && (
                    <motion.div
                      key="slide3"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      className="space-y-6 text-left"
                    >
                      <div>
                        <span className="text-xs uppercase tracking-widest text-amber-400 font-black">
                          Top Tier
                        </span>
                        <h2 className="text-3xl font-black text-white tracking-tight">
                          Your Top Artists
                        </h2>
                        <p className="text-xs text-white/50 mt-1">
                          The musicians who kept you company day in and day out.
                        </p>
                      </div>

                      <div className="space-y-3.5 pt-2">
                        {stats?.topArtists?.slice(0, 5).map((artist, idx) => {
                          const maxCount = stats.topArtists[0]?.count || 1;
                          const percent = Math.max(10, Math.min(100, (artist.count / maxCount) * 100));

                          return (
                            <div key={artist._id} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-white/90 truncate max-w-[250px]">
                                  {idx + 1}. {artist._id}
                                </span>
                                <span className="text-white/40">{artist.count} plays</span>
                              </div>
                              <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percent}%` }}
                                  transition={{ duration: 1.2, ease: "easeOut" }}
                                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
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
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="space-y-8 text-center"
                    >
                      <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Globe size={12} /> Sound Waves Without Borders
                      </span>

                      <div className="space-y-2">
                        <h2 className="text-3xl font-black text-white tracking-tight">
                          Linguistic Spectrum
                        </h2>
                        <p className="text-xs text-white/50 max-w-[240px] mx-auto">
                          You explored diverse sounds, connecting with music across different languages.
                        </p>
                      </div>

                      {stats?.languageBreakdown && stats.languageBreakdown.length > 0 ? (
                        <div className="flex flex-col gap-3 max-w-[260px] mx-auto pt-2">
                          {stats.languageBreakdown.slice(0, 4).map((lang, idx) => {
                            const colors = [
                              "from-cyan-400 to-blue-500 border-cyan-400/20",
                              "from-purple-400 to-indigo-500 border-purple-400/20",
                              "from-amber-400 to-yellow-500 border-amber-400/20",
                              "from-rose-400 to-red-500 border-rose-400/20",
                            ];
                            const curColor = colors[idx % colors.length];

                            return (
                              <div
                                key={lang._id}
                                className={`px-4 py-3 rounded-2xl bg-white/[0.02] border flex items-center justify-between ${curColor.split(" ")[2]}`}
                              >
                                <span className="text-xs font-bold text-white capitalize flex items-center gap-2">
                                  <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${curColor.split(" ").slice(0,2).join(" ")}`} />
                                  {lang._id}
                                </span>
                                <span className="text-xs text-white/40 font-mono">
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
                      className="text-center space-y-6"
                    >
                      <span className="px-3 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-[10px] font-bold uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Award size={12} /> The Verdict
                      </span>

                      <div className="space-y-4">
                        <p className="text-white/40 text-xs uppercase tracking-widest font-bold">
                          Your Music Character
                        </p>
                        <div className="relative w-32 h-32 mx-auto rounded-3xl overflow-hidden flex items-center justify-center">
                          {/* Shifting card halo */}
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${soul.color} opacity-40 blur-xl animate-pulse`}
                          />
                          <div className="absolute inset-0 bg-[#0e0c15] border border-white/10 rounded-3xl" />
                          <span className="text-5xl relative z-10">{soul.badge}</span>
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
                          {soul.title}
                        </h2>
                        <p className="text-xs text-white/60 leading-relaxed max-w-[280px] mx-auto">
                          {soul.desc}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {currentSlide === 6 && (
                    <motion.div
                      key="slide6"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-6 text-center"
                    >
                      {/* Share Card Container */}
                      <div className="relative rounded-3xl p-5 border border-white/15 bg-black/60 backdrop-blur-md overflow-hidden text-left shadow-2xl">
                        {/* Aesthetic design details */}
                        <div
                          className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${soul.color} opacity-30 blur-2xl`}
                        />
                        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-sp-green opacity-10 blur-3xl" />

                        <div className="flex items-center gap-3.5 pb-4 border-b border-white/10">
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              onError={onImgErr}
                              className="w-11 h-11 rounded-full object-cover ring-2 ring-white/20"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                              <Music size={16} className="text-white" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-sm font-black text-white leading-tight">
                              {user?.name}
                            </h3>
                            <p className="text-[10px] text-white/40">@{user?.username || "soulsync_user"}</p>
                          </div>
                          <span className="ml-auto text-xl">{soul.badge}</span>
                        </div>

                        <div className="space-y-4 pt-4 relative z-10">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                              Musical Soul
                            </span>
                            <span className={`text-base font-black bg-clip-text text-transparent bg-gradient-to-r ${soul.color}`}>
                              {soul.title}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                                Top Artist
                              </span>
                              <span className="text-xs font-bold text-white truncate block">
                                {stats?.topArtists?.[0]?._id || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                                Minutes Synced
                              </span>
                              <span className="text-xs font-bold text-white">
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

                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold block mb-1">
                              Primary Language
                            </span>
                            <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 text-[10px] font-bold uppercase capitalize tracking-wider w-fit">
                              {stats?.languageBreakdown?.[0]?._id || "None"}
                            </span>
                          </div>
                        </div>

                        {/* Branding */}
                        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[8px] text-white/30 font-semibold tracking-widest uppercase">
                          <span>SOULSYNC 2026</span>
                          <span>MY MUSIC STORY</span>
                        </div>
                      </div>

                      <div className="flex gap-2.5 justify-center">
                        <button
                          onClick={handleLaunch}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all active:scale-95"
                        >
                          <RotateCcw size={12} /> Replay
                        </button>
                        <button
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-sp-green hover:bg-sp-green/90 text-black text-xs font-black transition-all active:scale-95 shadow-lg shadow-sp-green/10"
                        >
                          Done
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation overlays */}
              <div className="relative z-40 p-4 pb-6 flex justify-between items-center text-white/30 select-none">
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className="flex items-center gap-1 hover:text-white transition-colors disabled:opacity-20 text-[11px] font-bold"
                >
                  <ChevronLeft size={16} /> Back
                </button>
                <div className="flex gap-1">
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
                  className="flex items-center gap-1 hover:text-white transition-colors text-[11px] font-bold"
                >
                  {currentSlide === totalSlides - 1 ? "Close" : "Next"}{" "}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
