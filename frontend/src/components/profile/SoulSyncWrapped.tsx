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
} from "lucide-react";
import { User, UserStats } from "../../types/user";
import { onImgErr } from "../../lib/helpers";

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
      desc: "Music is the rhythm of your life. You spend hours lost in complex melodies, curating a deep, premium listening experience.",
      accent: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
      badge: "👑",
    };
  }

  if (primaryMood === "chill" || primaryMood === "sleep" || primaryMood === "focus") {
    return {
      title: "The Dreamy Voyager",
      desc: "You look for sanctuary in sound. Your tracks are a warm blanket, helping you find focus, peace, and quiet in a busy world.",
      accent: "text-sky-400 border-sky-500/20 bg-sky-500/5",
      badge: "🌌",
    };
  }

  if (primaryMood === "energetic" || primaryMood === "workout" || primaryMood === "party") {
    return {
      title: "The Groove Catalyst",
      desc: "High energy, heavy beats, and pure movement. You use music as fuel to power your days and keep the momentum alive.",
      accent: "text-amber-400 border-amber-500/20 bg-amber-500/5",
      badge: "⚡",
    };
  }

  if (primaryMood === "romantic" || primaryMood === "sad" || primaryMood === "melancholy") {
    return {
      title: "The Emotional Alchemist",
      desc: "You feel every single beat. Music is your poetry, translating deep feelings, nostalgia, and relationships into sonic art.",
      accent: "text-rose-400 border-rose-500/20 bg-rose-500/5",
      badge: "💖",
    };
  }

  if (languagesCount >= 3) {
    return {
      title: "The Global Explorer",
      desc: "Your taste knows no borders. You seamlessly leap across languages and regions, connecting with stories and beats worldwide.",
      accent: "text-teal-400 border-teal-500/20 bg-teal-500/5",
      badge: "🌍",
    };
  }

  return {
    title: "The Eclectic Seeker",
    desc: "Your music taste is beautifully diverse. You refuse to be boxed in, seeking out whatever song matches your exact vibe in the moment.",
    accent: "text-purple-400 border-purple-500/20 bg-purple-500/5",
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
  const progressInterval = 50;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse">
        <div className="h-5 w-40 bg-white/[0.06] rounded-full mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2 h-40 bg-white/[0.04] rounded-2xl" />
          <div className="h-40 bg-white/[0.04] rounded-2xl" />
        </div>
      </div>
    );
  }

  const soul = getSoulIdentity(stats, user);
  const joinDays = getJoinDays();
  const hasHistory = stats && stats.totalSongsPlayed > 0;

  return (
    <div className="mb-8">
      {/* ── Dashboard Wrapped Card Widget (Clean & Premium) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main CTA Card */}
        <div className="col-span-1 md:col-span-2 relative overflow-hidden rounded-2xl p-6 flex flex-col justify-between border border-white/[0.06] bg-[#0c0c0e]">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full bg-sp-green/10 text-sp-green text-[10px] font-bold tracking-wider uppercase border border-sp-green/20 flex items-center gap-1.5">
                <Sparkles size={10} /> Live Wrapped
              </span>
              <span className="text-white/40 text-xs">Since day one</span>
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight leading-tight mb-2">
              Your SoulSync Journey
            </h3>
            <p className="text-xs text-white/50 max-w-md leading-relaxed mb-6">
              {hasHistory
                ? `You've spent ${formatListeningTime(stats.totalListeningTime)} minutes listening to your synced music collection. Dive into your custom stats and music personality.`
                : "You are starting your musical adventure. Sync more tracks to unlock your customized SoulSync Wrapped!"}
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between mt-auto">
            {hasHistory ? (
              <button
                onClick={handleLaunch}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-sp-green text-black font-bold text-xs hover:bg-sp-green/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play size={12} fill="currentColor" />
                Launch Wrapped
              </button>
            ) : (
              <span className="text-xs text-white/30 italic">Play 5+ tracks to unlock</span>
            )}
            <div className="text-right">
              <p className="text-xl font-black text-white/90 font-mono">
                {joinDays}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-white/40 font-bold">
                Days Synced
              </p>
            </div>
          </div>
        </div>

        {/* Profile Identity Card */}
        <div className="col-span-1 relative overflow-hidden rounded-2xl p-6 border border-white/[0.06] bg-[#0d0d10] flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              My Vibe
            </span>
            <span className="text-xl" role="img" aria-label="badge">
              {soul.badge}
            </span>
          </div>

          <div>
            <h4 className="text-base font-bold text-white mb-1">
              {hasHistory ? soul.title : "The Listener"}
            </h4>
            <p className="text-xs text-white/50 leading-relaxed line-clamp-3">
              {hasHistory
                ? soul.desc
                : "Your musical character will write itself as you listen to more tracks. We're tuning in!"}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sp-green/80" />
            <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">
              Profile Synced
            </span>
          </div>
        </div>
      </div>

      {/* ── Wrapped Interactive Slides Modal (Premium, Clean & Minimal) ── */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 md:backdrop-blur-md"
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") handleNext();
              if (e.key === "ArrowLeft") handlePrev();
              if (e.key === "Escape") setIsOpen(false);
            }}
          >
            {/* Center Story Window */}
            <div
              className="w-full h-full md:h-[750px] md:max-w-md md:rounded-2xl md:border md:border-white/10 relative overflow-hidden flex flex-col justify-between shadow-2xl bg-[#0c0c0e]"
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              {/* Subtle ambient light in back */}
              <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

              {/* Invisible touch hotspots for navigation */}
              <div className="absolute inset-y-0 left-0 w-1/4 z-30 cursor-w-resize" onClick={handlePrev} />
              <div className="absolute inset-y-0 right-0 w-3/4 z-30 cursor-e-resize" onClick={handleNext} />

              {/* Progress Indicators Header */}
              <div className="relative z-40 p-4 pt-5 flex gap-1 w-full">
                {Array.from({ length: totalSlides }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-[3px] flex-1 rounded-full bg-white/10 overflow-hidden"
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
              <div className="relative z-40 px-4 flex justify-between items-center text-white/40">
                <span className="text-[9px] font-bold tracking-widest">
                  SOULSYNC WRAPPED
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="p-1.5 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content viewport */}
              <div className="flex-1 flex flex-col justify-center px-8 relative z-20 select-none">
                <AnimatePresence mode="wait">
                  {currentSlide === 0 && (
                    <motion.div
                      key="slide0"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      className="text-center space-y-6"
                    >
                      <div className="w-24 h-24 rounded-full mx-auto bg-white/[0.02] border border-white/10 flex items-center justify-center relative">
                        {user?.photoURL ? (
                          <img
                            src={user.photoURL}
                            onError={onImgErr}
                            className="w-20 h-20 rounded-full object-cover grayscale"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                            <Music size={24} className="text-white/40" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-widest text-sp-green font-bold">
                          Hello, {user?.name.split(" ")[0]}
                        </span>
                        <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">
                          Your Music Story,<br />
                          <span className="text-white/50">Fully Unwrapped.</span>
                        </h1>
                        <p className="text-xs text-white/40 max-w-[220px] mx-auto leading-relaxed pt-1">
                          A clean look back at your listens, moods, and synced tracks.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {currentSlide === 1 && (
                    <motion.div
                      key="slide1"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      className="space-y-6 text-left"
                    >
                      <span className="px-2 py-0.5 rounded border border-white/10 text-white/50 text-[9px] font-bold uppercase tracking-wider w-fit flex items-center gap-1.5">
                        <Calendar size={10} /> The Journey
                      </span>

                      <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-white tracking-tight">
                          Joined in {getJoinMonthYear()}
                        </h2>
                        <p className="text-xs text-white/50 leading-relaxed">
                          Since that first day, you've spent{" "}
                          <strong className="text-white font-semibold">
                            {formatListeningTime(stats?.totalListeningTime || 0)} minutes
                          </strong>{" "}
                          synced with your favorite tunes.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-3">
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-xl font-bold text-white block">
                            {stats?.totalSongsPlayed}
                          </span>
                          <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider">
                            Songs Played
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-xl font-bold text-white block">
                            {stats?.likedSongsCount}
                          </span>
                          <span className="text-[9px] text-white/40 uppercase font-bold tracking-wider">
                            Liked Songs
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {currentSlide === 2 && (
                    <motion.div
                      key="slide2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      className="text-center space-y-6"
                    >
                      <span className="px-2 py-0.5 rounded border border-white/10 text-white/50 text-[9px] font-bold uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Heart size={10} /> Top Artist
                      </span>

                      {stats?.topArtists?.[0] ? (
                        <div className="space-y-4">
                          <div className="w-24 h-24 mx-auto rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center overflow-hidden">
                            {stats.topArtists[0].albumArt ? (
                              <img
                                src={stats.topArtists[0].albumArt}
                                onError={onImgErr}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xl font-bold text-white/60">
                                {stats.topArtists[0]._id?.[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-white/40 text-xs">Your top played artist</p>
                            <h2 className="text-xl font-bold text-white">
                              {stats.topArtists[0]._id}
                            </h2>
                            <p className="text-xs text-sp-green font-bold">
                              {stats.topArtists[0].count} plays
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 py-6">
                          <Music size={32} className="text-white/20 mx-auto" />
                          <p className="text-white/40 text-xs">No artists logged yet.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {currentSlide === 3 && (
                    <motion.div
                      key="slide3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      className="space-y-5 text-left"
                    >
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-sp-green font-bold">
                          Frequent Listens
                        </span>
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                          Top Artists
                        </h2>
                      </div>

                      <div className="space-y-3 pt-1">
                        {stats?.topArtists?.slice(0, 5).map((artist, idx) => {
                          const maxCount = stats.topArtists[0]?.count || 1;
                          const percent = Math.max(12, Math.min(100, (artist.count / maxCount) * 100));

                          return (
                            <div key={artist._id} className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-medium text-white/80 truncate max-w-[260px]">
                                  {idx + 1}. {artist._id}
                                </span>
                                <span className="text-white/40">{artist.count} plays</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${percent}%` }}
                                  className="h-full bg-sp-green/80 rounded-full"
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      className="space-y-6 text-center"
                    >
                      <span className="px-2 py-0.5 rounded border border-white/10 text-white/50 text-[9px] font-bold uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Globe size={10} /> Language
                      </span>

                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                          Primary Languages
                        </h2>
                        <p className="text-xs text-white/40">
                          The musical dialects you connected with most.
                        </p>
                      </div>

                      {stats?.languageBreakdown && stats.languageBreakdown.length > 0 ? (
                        <div className="flex flex-col gap-2 max-w-[240px] mx-auto pt-2">
                          {stats.languageBreakdown.slice(0, 4).map((lang) => (
                            <div
                              key={lang._id}
                              className="px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between"
                            >
                              <span className="text-xs font-semibold text-white/80 capitalize">
                                {lang._id}
                              </span>
                              <span className="text-[11px] text-white/40">
                                {lang.count} play{lang.count !== 1 ? "s" : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/30 italic">No language data logged.</p>
                      )}
                    </motion.div>
                  )}

                  {currentSlide === 5 && (
                    <motion.div
                      key="slide5"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      className="text-center space-y-5"
                    >
                      <span className="px-2 py-0.5 rounded border border-white/10 text-white/50 text-[9px] font-bold uppercase tracking-wider w-fit mx-auto flex items-center gap-1.5">
                        <Award size={10} /> Profile
                      </span>

                      <div className="space-y-3">
                        <span className="text-white/40 text-[10px] uppercase tracking-wider font-bold">
                          Your Music Character
                        </span>
                        <div className={`p-4 rounded-xl border ${soul.accent} max-w-[260px] mx-auto`}>
                          <span className="text-2xl block mb-2">{soul.badge}</span>
                          <h3 className="text-base font-bold text-white mb-1">
                            {soul.title}
                          </h3>
                          <p className="text-xs text-white/60 leading-relaxed">
                            {soul.desc}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {currentSlide === 6 && (
                    <motion.div
                      key="slide6"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35 }}
                      className="space-y-5 text-center"
                    >
                      {/* Share Card Container */}
                      <div className="relative rounded-2xl p-5 border border-white/10 bg-white/[0.02] text-left">
                        <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              onError={onImgErr}
                              className="w-10 h-10 rounded-full object-cover grayscale"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                              <Music size={16} className="text-white/40" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-xs font-bold text-white leading-tight">
                              {user?.name}
                            </h3>
                            <p className="text-[10px] text-white/40">@{user?.username || "listener"}</p>
                          </div>
                          <span className="ml-auto text-base">{soul.badge}</span>
                        </div>

                        <div className="space-y-3 pt-3">
                          <div>
                            <span className="text-[8px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                              Musical Soul
                            </span>
                            <span className="text-xs font-bold text-white">
                              {soul.title}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[8px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                                Top Artist
                              </span>
                              <span className="text-xs font-medium text-white truncate block">
                                {stats?.topArtists?.[0]?._id || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                                Listen Time
                              </span>
                              <span className="text-xs font-medium text-white">
                                {stats ? `${formatListeningTime(stats.totalListeningTime)} mins` : "0"}
                              </span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[8px] uppercase tracking-wider text-white/40 font-bold block mb-0.5">
                              Top Artists
                            </span>
                            <div className="space-y-0.5">
                              {stats?.topArtists?.slice(0, 3).map((a, idx) => (
                                <p key={a._id} className="text-[10px] text-white/60 truncate">
                                  {idx + 1}. {a._id}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[8px] text-white/30 font-bold tracking-wider">
                          <span>SOULSYNC WRAPPED</span>
                          <span>2026</span>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-center pt-2">
                        <button
                          onClick={handleLaunch}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold transition-all"
                        >
                          <RotateCcw size={12} /> Replay
                        </button>
                        <button
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-sp-green hover:bg-sp-green/90 text-black text-xs font-bold transition-all"
                        >
                          Done
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom controls */}
              <div className="relative z-40 p-4 pb-5 flex justify-between items-center text-white/40 select-none">
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className="flex items-center gap-1 hover:text-white transition-colors disabled:opacity-20 text-[10px] font-bold"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalSlides }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`w-1 h-1 rounded-full transition-all ${
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
