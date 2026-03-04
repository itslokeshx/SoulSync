import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  Globe,
  Palette,
  PartyPopper,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api/backend";
import toast from "react-hot-toast";

/* ── Data ──────────────────────────────────────────────────────── */
const LANGUAGES = [
  { id: "tamil", label: "Tamil", script: "தமிழ்", color: "#f59e0b" },
  { id: "hindi", label: "Hindi", script: "हिन्दी", color: "#ef4444" },
  { id: "english", label: "English", script: "ABC", color: "#3b82f6" },
  { id: "telugu", label: "Telugu", script: "తెలుగు", color: "#8b5cf6" },
  { id: "malayalam", label: "Malayalam", script: "മലയാളം", color: "#06b6d4" },
  { id: "kannada", label: "Kannada", script: "ಕನ್ನಡ", color: "#10b981" },
  { id: "punjabi", label: "Punjabi", script: "ਪੰਜਾਬੀ", color: "#f97316" },
  { id: "bengali", label: "Bengali", script: "বাংলা", color: "#ec4899" },
  { id: "marathi", label: "Marathi", script: "मराठी", color: "#14b8a6" },
  { id: "gujarati", label: "Gujarati", script: "ગુજરાતી", color: "#a855f7" },
];

const ERAS = [
  { id: "60s-70s", label: "60s–70s", sub: "Classics", color: "#d97706" },
  { id: "80s", label: "80s", sub: "Retro", color: "#e11d48" },
  { id: "90s", label: "90s", sub: "Golden Era", color: "#7c3aed" },
  { id: "2000s", label: "2000s", sub: "Pop", color: "#2563eb" },
  { id: "2010s", label: "2010s", sub: "Modern", color: "#0891b2" },
  { id: "2020s", label: "2020s", sub: "Current", color: "#059669" },
];

const MOODS = [
  { id: "chill", label: "Chill", emoji: "😌", color: "#06b6d4" },
  { id: "energetic", label: "Energetic", emoji: "⚡", color: "#f59e0b" },
  { id: "romantic", label: "Romantic", emoji: "💕", color: "#ec4899" },
  { id: "sad", label: "Emotional", emoji: "🥺", color: "#6366f1" },
  { id: "party", label: "Party", emoji: "🎉", color: "#a855f7" },
  { id: "focus", label: "Focus", emoji: "📚", color: "#0ea5e9" },
  { id: "workout", label: "Workout", emoji: "💪", color: "#ef4444" },
  { id: "road-trip", label: "Road Trip", emoji: "🚗", color: "#10b981" },
];

const TOTAL_STEPS = 4;

const STEP_META = [
  { icon: Music2, title: "Your Name", accent: "#1db954" },
  { icon: Globe, title: "Languages", accent: "#3b82f6" },
  { icon: Palette, title: "Your Vibe", accent: "#8b5cf6" },
  { icon: PartyPopper, title: "All Set", accent: "#1db954" },
];

const stepVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.98,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.98,
  }),
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [languages, setLanguages] = useState<string[]>([]);
  const [eras, setEras] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (
    list: string[],
    setList: (l: string[]) => void,
    item: string,
  ) =>
    setList(
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item],
    );

  const goNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const updatedUser = await api.updatePreferences({
        name: displayName.trim() || user?.name,
        languages,
        eras,
        moods,
      });
      updateUser(updatedUser);
      toast.success("Welcome to SoulSync! 🎵");
      navigate("/", { replace: true });
    } catch {
      toast.error("Failed to save preferences. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const canProceed =
    step === 0
      ? displayName.trim().length > 0
      : step === 1
        ? languages.length > 0
        : step === 2
          ? moods.length > 0 || eras.length > 0
          : true;

  const accent = STEP_META[step].accent;

  return (
    <div className="min-h-[100dvh] bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">
      {/* ── Ambient background ────────────────────────────────── */}
      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full blur-[200px] opacity-[0.07] pointer-events-none"
        style={{ top: "30%", left: "50%", x: "-50%", y: "-50%" }}
        animate={{
          background: [
            `radial-gradient(circle, ${accent}, transparent)`,
            `radial-gradient(circle, ${accent}88, transparent)`,
            `radial-gradient(circle, ${accent}, transparent)`,
          ],
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* ── Progress bar ──────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/[0.04] z-50">
        <motion.div
          className="h-full rounded-r-full"
          style={{
            background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
            boxShadow: `0 0 12px ${accent}40`,
          }}
          animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* ── Step indicator pills ──────────────────────────────── */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.05] backdrop-blur-xl">
        {STEP_META.map((s, i) => {
          const StepIcon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-6 h-px transition-colors duration-500 ${isDone ? "bg-sp-green/50" : "bg-white/[0.06]"}`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-500 ${
                  isActive
                    ? "bg-white/[0.08] border border-white/[0.1]"
                    : isDone
                      ? "bg-sp-green/10 border border-sp-green/20"
                      : "border border-transparent"
                }`}
              >
                {isDone ? (
                  <Check size={12} className="text-sp-green" />
                ) : (
                  <StepIcon
                    size={12}
                    className={isActive ? "text-white" : "text-white/20"}
                  />
                )}
                <span
                  className={`text-[10px] font-semibold hidden sm:inline transition-colors duration-300 ${
                    isActive
                      ? "text-white"
                      : isDone
                        ? "text-sp-green/70"
                        : "text-white/20"
                  }`}
                >
                  {s.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Main card ─────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-lg px-4 sm:px-6 mt-16 sm:mt-20">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ═══ Step 0: Welcome + Name ═══ */}
          {step === 0 && (
            <motion.div
              key="step0"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <div
                className="rounded-3xl p-8 sm:p-10"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow:
                    "0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 flex items-center justify-center mx-auto mb-6"
                    style={{ boxShadow: "0 0 50px rgba(29,185,84,0.3)" }}
                  >
                    <Music2
                      size={30}
                      className="text-black"
                      strokeWidth={2.5}
                    />
                  </motion.div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Welcome to{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green to-emerald-300">
                      SoulSync
                    </span>
                  </h2>
                  <p className="text-white/35 text-sm mt-2 max-w-xs mx-auto">
                    Let's set up your personalized music experience
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] block">
                    What should we call you?
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl px-5 py-4 text-white text-base placeholder-white/20 outline-none focus:border-sp-green/40 focus:bg-white/[0.07] transition-all duration-300"
                      autoFocus
                      onKeyDown={(e) =>
                        e.key === "Enter" && canProceed && goNext()
                      }
                    />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-sp-green rounded-full transition-all duration-500 group-focus-within:w-1/2" />
                  </div>
                  {displayName.trim() && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-white/20 mt-2"
                    >
                      Nice to meet you,{" "}
                      <span className="text-sp-green font-semibold">
                        {displayName.trim()}
                      </span>{" "}
                      ✨
                    </motion.p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ Step 1: Languages ═══ */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="text-center mb-6 sm:mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mx-auto mb-4"
                >
                  <Globe size={22} className="text-blue-400" />
                </motion.div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Pick your languages
                </h2>
                <p className="text-white/30 text-sm mt-2">
                  Select the languages you love listening to
                </p>
                {languages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-sp-green/10 border border-sp-green/20"
                  >
                    <Check size={12} className="text-sp-green" />
                    <span className="text-[11px] text-sp-green font-semibold">
                      {languages.length} selected
                    </span>
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {LANGUAGES.map(({ id, label, script, color }, i) => {
                  const selected = languages.includes(id);
                  return (
                    <motion.button
                      key={id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.04 }}
                      onClick={() => toggle(languages, setLanguages, id)}
                      className={`relative flex items-center gap-3 px-4 py-3.5 sm:py-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden group ${
                        selected
                          ? "border-white/15 bg-white/[0.06]"
                          : "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08]"
                      }`}
                    >
                      {/* Accent line */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-all duration-300 ${selected ? "opacity-100" : "opacity-0"}`}
                        style={{ background: color }}
                      />
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-300 ${
                          selected ? "scale-110" : "group-hover:scale-105"
                        }`}
                        style={{
                          background: selected
                            ? `${color}20`
                            : "rgba(255,255,255,0.04)",
                          color: selected ? color : "rgba(255,255,255,0.3)",
                          border: `1px solid ${selected ? `${color}30` : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        {script.slice(0, 2)}
                      </div>
                      <span
                        className={`text-sm font-semibold transition-colors duration-300 ${selected ? "text-white" : "text-white/50"}`}
                      >
                        {label}
                      </span>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: `${color}25` }}
                        >
                          <Check size={11} style={{ color }} />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ═══ Step 2: Eras + Moods ═══ */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                  className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center mx-auto mb-4"
                >
                  <Palette size={22} className="text-purple-400" />
                </motion.div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Your vibe
                </h2>
                <p className="text-white/30 text-sm mt-2">
                  Pick eras and moods you love
                </p>
              </div>

              {/* Eras */}
              <div className="mb-6">
                <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                  <span className="w-3 h-px bg-white/10" /> Eras
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {ERAS.map(({ id, label, sub, color }, i) => {
                    const selected = eras.includes(id);
                    return (
                      <motion.button
                        key={id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + i * 0.04 }}
                        onClick={() => toggle(eras, setEras, id)}
                        className={`relative py-3 sm:py-3.5 rounded-2xl border text-center transition-all duration-300 overflow-hidden ${
                          selected
                            ? "border-white/15 bg-white/[0.06]"
                            : "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]"
                        }`}
                      >
                        {selected && (
                          <motion.div
                            layoutId={`era-bg-${id}`}
                            className="absolute inset-0 opacity-[0.08]"
                            style={{
                              background: `radial-gradient(circle at center, ${color}, transparent 70%)`,
                            }}
                          />
                        )}
                        <p
                          className={`text-sm font-bold relative z-10 ${selected ? "text-white" : "text-white/50"}`}
                        >
                          {label}
                        </p>
                        <p className="text-[10px] text-white/25 relative z-10 mt-0.5">
                          {sub}
                        </p>
                        {selected && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "50%" }}
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full"
                            style={{ background: color }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Moods */}
              <div>
                <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                  <span className="w-3 h-px bg-white/10" /> Moods
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MOODS.map(({ id, label, emoji, color }, i) => {
                    const selected = moods.includes(id);
                    return (
                      <motion.button
                        key={id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.04 }}
                        onClick={() => toggle(moods, setMoods, id)}
                        className={`relative flex items-center gap-2.5 px-4 py-3 sm:py-3.5 rounded-2xl border transition-all duration-300 overflow-hidden group ${
                          selected
                            ? "border-white/15 bg-white/[0.06]"
                            : "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]"
                        }`}
                      >
                        {selected && (
                          <motion.div
                            className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            style={{ background: color }}
                          />
                        )}
                        <span className="text-lg">{emoji}</span>
                        <span
                          className={`text-sm font-semibold transition-colors duration-300 ${selected ? "text-white" : "text-white/50"}`}
                        >
                          {label}
                        </span>
                        {selected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="ml-auto"
                          >
                            <Check size={13} style={{ color }} />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ Step 3: All set ═══ */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <div
                className="rounded-3xl p-8 sm:p-10 text-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow:
                    "0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                {/* Animated check circle */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  className="relative mx-auto mb-6 w-20 h-20 sm:w-24 sm:h-24"
                >
                  <div
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center"
                    style={{ boxShadow: "0 0 60px rgba(29,185,84,0.4)" }}
                  >
                    <Sparkles size={36} className="text-black" />
                  </div>
                  <motion.div
                    className="absolute -inset-2 rounded-full border-2 border-sp-green/30"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -inset-4 rounded-full border border-sp-green/10"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  />
                </motion.div>

                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
                  You're all set,{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green to-emerald-300">
                    {displayName.trim() || "friend"}
                  </span>
                  !
                </h2>
                <p className="text-white/30 text-sm mb-6 max-w-xs mx-auto">
                  We've tailored your experience based on your preferences
                </p>

                {/* Summary tags */}
                <div className="flex flex-wrap justify-center gap-2 mb-2">
                  {languages.map((l) => (
                    <motion.span
                      key={l}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-3 py-1.5 rounded-full bg-sp-green/10 border border-sp-green/20 text-sp-green text-xs font-semibold capitalize"
                    >
                      {l}
                    </motion.span>
                  ))}
                  {moods.slice(0, 3).map((m) => (
                    <motion.span
                      key={m}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold capitalize"
                    >
                      {m}
                    </motion.span>
                  ))}
                  {eras.slice(0, 2).map((e) => (
                    <motion.span
                      key={e}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold"
                    >
                      {e}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Navigation buttons ──────────────────────────────── */}
        <div className="flex items-center justify-between mt-8 pb-8">
          {step > 0 ? (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={goBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white/40 hover:text-white hover:bg-white/[0.05] transition-all duration-300"
            >
              <ArrowLeft size={15} /> Back
            </motion.button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <motion.button
              whileHover={{ scale: canProceed ? 1.03 : 1 }}
              whileTap={{ scale: canProceed ? 0.97 : 1 }}
              onClick={goNext}
              disabled={!canProceed}
              className="flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold bg-white text-black hover:bg-white/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
              style={{
                boxShadow: canProceed
                  ? "0 4px 24px rgba(255,255,255,0.15)"
                  : "none",
              }}
            >
              Continue <ArrowRight size={15} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold bg-gradient-to-r from-sp-green to-emerald-400 text-black hover:opacity-90 disabled:opacity-50 transition-all duration-300"
              style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.35)" }}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Start Listening <Music2 size={15} />
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
