import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, ArrowRight, ArrowLeft, Sparkles, Check } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api/backend";
import toast from "react-hot-toast";

const LANGUAGES = [
  { id: "tamil", label: "Tamil", emoji: "🎵" },
  { id: "hindi", label: "Hindi", emoji: "🎶" },
  { id: "english", label: "English", emoji: "🎤" },
  { id: "telugu", label: "Telugu", emoji: "🎹" },
  { id: "malayalam", label: "Malayalam", emoji: "🎸" },
  { id: "kannada", label: "Kannada", emoji: "🥁" },
  { id: "punjabi", label: "Punjabi", emoji: "🎺" },
  { id: "bengali", label: "Bengali", emoji: "🎻" },
  { id: "marathi", label: "Marathi", emoji: "🪘" },
  { id: "gujarati", label: "Gujarati", emoji: "🪕" },
];

const ERAS = [
  { id: "60s-70s", label: "60s–70s Classics" },
  { id: "80s", label: "80s Retro" },
  { id: "90s", label: "90s Golden" },
  { id: "2000s", label: "2000s Pop" },
  { id: "2010s", label: "2010s Modern" },
  { id: "2020s", label: "2020s Current" },
];

const MOODS = [
  { id: "chill", label: "Chill & Calm", emoji: "😌" },
  { id: "energetic", label: "Energetic", emoji: "⚡" },
  { id: "romantic", label: "Romantic", emoji: "💕" },
  { id: "sad", label: "Sad & Emotional", emoji: "🥺" },
  { id: "party", label: "Party & Dance", emoji: "🎉" },
  { id: "focus", label: "Focus & Study", emoji: "📚" },
  { id: "workout", label: "Workout", emoji: "💪" },
  { id: "road-trip", label: "Road Trip", emoji: "🚗" },
];

const stepVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -300 : 300,
    opacity: 0,
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

  const toggleItem = (
    list: string[],
    setList: (l: string[]) => void,
    item: string,
  ) => {
    setList(
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item],
    );
  };

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

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.06] blur-[150px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ background: "linear-gradient(135deg, #1db954, #8b5cf6)" }}
      />

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/5 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-sp-green to-emerald-400"
          animate={{ width: `${((step + 1) / 4) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                s === step
                  ? "bg-sp-green w-6"
                  : s < step
                    ? "bg-sp-green/50"
                    : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          {/* Step 0: Welcome + Name */}
          {step === 0 && (
            <motion.div
              key="step0"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center mx-auto mb-6">
                <Music2 size={28} className="text-black" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">
                Welcome to SoulSync
              </h2>
              <p className="text-white/40 text-sm mb-8">
                Let's personalize your experience
              </p>
              <div className="text-left">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">
                  What should we call you?
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-white/[0.06] border border-white/[0.08] rounded-2xl px-5 py-3.5 text-white text-sm placeholder-white/25 outline-none focus:border-sp-green/50 transition-all duration-300"
                  autoFocus
                />
              </div>
            </motion.div>
          )}

          {/* Step 1: Languages */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h2 className="text-2xl font-black text-white mb-2 text-center">
                Pick your languages
              </h2>
              <p className="text-white/40 text-sm mb-8 text-center">
                Select the languages you enjoy listening to
              </p>
              <div className="grid grid-cols-2 gap-3">
                {LANGUAGES.map(({ id, label, emoji }) => {
                  const selected = languages.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleItem(languages, setLanguages, id)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-300 text-left ${
                        selected
                          ? "bg-sp-green/10 border-sp-green/40 text-white"
                          : "bg-white/[0.03] border-white/[0.06] text-white/60 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span className="text-lg">{emoji}</span>
                      <span className="text-sm font-semibold">{label}</span>
                      {selected && (
                        <Check size={14} className="ml-auto text-sp-green" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Eras + Moods */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <h2 className="text-2xl font-black text-white mb-2 text-center">
                Your vibe
              </h2>
              <p className="text-white/40 text-sm mb-6 text-center">
                Pick eras and moods you love
              </p>

              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Eras
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {ERAS.map(({ id, label }) => {
                  const selected = eras.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleItem(eras, setEras, id)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-300 ${
                        selected
                          ? "bg-sp-green/15 border-sp-green/40 text-white"
                          : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Moods
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MOODS.map(({ id, label, emoji }) => {
                  const selected = moods.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleItem(moods, setMoods, id)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-semibold transition-all duration-300 ${
                        selected
                          ? "bg-sp-green/10 border-sp-green/40 text-white"
                          : "bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Step 3: All set */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center mx-auto mb-6"
                style={{ boxShadow: "0 0 60px rgba(29,185,84,0.4)" }}
              >
                <Sparkles size={36} className="text-black" />
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-3">
                You're all set!
              </h2>
              <p className="text-white/40 text-sm mb-3 max-w-xs mx-auto">
                We've tailored your experience based on your preferences.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {languages.map((l) => (
                  <span
                    key={l}
                    className="px-3 py-1 rounded-full bg-sp-green/10 text-sp-green text-xs font-semibold capitalize"
                  >
                    {l}
                  </span>
                ))}
                {moods.slice(0, 3).map((m) => (
                  <span
                    key={m}
                    className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs font-semibold capitalize"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-10">
          {step > 0 ? (
            <button
              onClick={goBack}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white/50 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={goNext}
              disabled={!canProceed}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold bg-sp-green text-black hover:bg-sp-green/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
              style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.4)" }}
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold bg-sp-green text-black hover:bg-sp-green/90 disabled:opacity-50 transition-all duration-300"
              style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.4)" }}
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Start Listening <Music2 size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
