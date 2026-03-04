import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api/backend";
import toast from "react-hot-toast";

/* ── Data ──────────────────────────────────────────────────────── */
const LANGUAGES = [
  { id: "tamil", label: "Tamil", script: "தமிழ்" },
  { id: "hindi", label: "Hindi", script: "हिन्दी" },
  { id: "english", label: "English", script: "ABC" },
  { id: "telugu", label: "Telugu", script: "తెలుగు" },
  { id: "malayalam", label: "Malayalam", script: "മലയാളം" },
  { id: "kannada", label: "Kannada", script: "ಕನ್ನಡ" },
  { id: "punjabi", label: "Punjabi", script: "ਪੰਜਾਬੀ" },
  { id: "bengali", label: "Bengali", script: "বাংলা" },
  { id: "marathi", label: "Marathi", script: "मराठी" },
  { id: "gujarati", label: "Gujarati", script: "ગુજરાતી" },
];

const ERAS = [
  { id: "60s-70s", label: "60s–70s", sub: "Classics" },
  { id: "80s", label: "80s", sub: "Retro" },
  { id: "90s", label: "90s", sub: "Golden Era" },
  { id: "2000s", label: "2000s", sub: "Pop" },
  { id: "2010s", label: "2010s", sub: "Modern" },
  { id: "2020s", label: "2020s", sub: "Current" },
];

const MOODS = [
  { id: "chill", label: "Chill", emoji: "😌" },
  { id: "energetic", label: "Energetic", emoji: "⚡" },
  { id: "romantic", label: "Romantic", emoji: "💕" },
  { id: "sad", label: "Emotional", emoji: "🥺" },
  { id: "party", label: "Party", emoji: "🎉" },
  { id: "focus", label: "Focus", emoji: "📚" },
  { id: "workout", label: "Workout", emoji: "💪" },
  { id: "road-trip", label: "Road Trip", emoji: "🚗" },
];

const TOTAL_STEPS = 4;

const slide = {
  enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [languages, setLanguages] = useState<string[]>([]);
  const [eras, setEras] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (
    list: string[],
    setter: (l: string[]) => void,
    item: string,
  ) =>
    setter(
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item],
    );

  const next = () => {
    setDir(1);
    setStep((s) => s + 1);
  };
  const back = () => {
    setDir(-1);
    setStep((s) => s - 1);
  };

  const finish = async () => {
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
      toast.error("Failed to save. Try again.");
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
    <div className="min-h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-5">
      {/* ── Progress dots ──────────────────────────────────────── */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-400 ${
              i === step
                ? "w-6 bg-sp-green"
                : i < step
                  ? "w-1.5 bg-sp-green/40"
                  : "w-1.5 bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* ── Steps ──────────────────────────────────────────────── */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait" custom={dir}>
          {/* ═══ Step 0: Name ═══ */}
          {step === 0 && (
            <motion.div
              key="s0"
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-sp-green flex items-center justify-center mb-6">
                <Music2 size={28} className="text-black" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-white text-center mb-1">
                Welcome to SoulSync
              </h2>
              <p className="text-sm text-white/30 text-center mb-8">
                Let's personalize your experience
              </p>

              <div className="w-full max-w-xs">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-2">
                  Your name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white text-sm placeholder-white/20 outline-none focus:border-sp-green/40 transition-colors"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && canProceed && next()}
                />
                {displayName.trim() && (
                  <p className="text-xs text-white/20 mt-2">
                    Hey,{" "}
                    <span className="text-sp-green font-medium">
                      {displayName.trim()}
                    </span>{" "}
                    👋
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ Step 1: Languages ═══ */}
          {step === 1 && (
            <motion.div
              key="s1"
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Pick your languages
                </h2>
                <p className="text-sm text-white/30 mt-1">
                  Select the languages you enjoy
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map(({ id, label, script }) => {
                  const on = languages.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(languages, setLanguages, id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 ${
                        on
                          ? "border-sp-green/30 bg-sp-green/[0.08]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          on
                            ? "bg-sp-green/20 text-sp-green"
                            : "bg-white/[0.05] text-white/30"
                        }`}
                      >
                        {script.slice(0, 2)}
                      </span>
                      <span
                        className={`text-sm font-medium ${on ? "text-white" : "text-white/50"}`}
                      >
                        {label}
                      </span>
                      {on && (
                        <Check
                          size={14}
                          className="ml-auto text-sp-green flex-shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ═══ Step 2: Eras + Moods ═══ */}
          {step === 2 && (
            <motion.div
              key="s2"
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white">Your vibe</h2>
                <p className="text-sm text-white/30 mt-1">
                  Pick eras and moods you love
                </p>
              </div>

              {/* Eras */}
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2">
                Eras
              </p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {ERAS.map(({ id, label, sub }) => {
                  const on = eras.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(eras, setEras, id)}
                      className={`py-3 rounded-xl border text-center transition-all duration-200 ${
                        on
                          ? "border-sp-green/30 bg-sp-green/[0.08]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <p
                        className={`text-sm font-semibold ${on ? "text-white" : "text-white/50"}`}
                      >
                        {label}
                      </p>
                      <p className="text-[10px] text-white/20 mt-0.5">{sub}</p>
                    </button>
                  );
                })}
              </div>

              {/* Moods */}
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2">
                Moods
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MOODS.map(({ id, label, emoji }) => {
                  const on = moods.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(moods, setMoods, id)}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all duration-200 ${
                        on
                          ? "border-sp-green/30 bg-sp-green/[0.08]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="text-base">{emoji}</span>
                      <span
                        className={`text-sm font-medium ${on ? "text-white" : "text-white/50"}`}
                      >
                        {label}
                      </span>
                      {on && (
                        <Check
                          size={13}
                          className="ml-auto text-sp-green flex-shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ═══ Step 3: Done ═══ */}
          {step === 3 && (
            <motion.div
              key="s3"
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-sp-green flex items-center justify-center mx-auto mb-6">
                <Check size={28} className="text-black" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                You're all set
                {displayName.trim() ? `, ${displayName.trim()}` : ""}!
              </h2>
              <p className="text-sm text-white/30 mb-6">
                Your personalized experience is ready
              </p>

              {/* Summary */}
              <div className="flex flex-wrap justify-center gap-1.5">
                {languages.map((l) => (
                  <span
                    key={l}
                    className="px-2.5 py-1 rounded-full bg-sp-green/10 text-sp-green text-xs font-medium capitalize"
                  >
                    {l}
                  </span>
                ))}
                {moods.slice(0, 3).map((m) => (
                  <span
                    key={m}
                    className="px-2.5 py-1 rounded-full bg-white/[0.06] text-white/50 text-xs font-medium capitalize"
                  >
                    {m}
                  </span>
                ))}
                {eras.slice(0, 2).map((e) => (
                  <span
                    key={e}
                    className="px-2.5 py-1 rounded-full bg-white/[0.06] text-white/50 text-xs font-medium"
                  >
                    {e}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Nav buttons ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-10">
          {step > 0 ? (
            <button
              onClick={back}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={next}
              disabled={!canProceed}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-semibold bg-white text-black hover:bg-white/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="flex items-center gap-1.5 px-7 py-2.5 rounded-full text-sm font-semibold bg-sp-green text-black hover:bg-sp-green/90 disabled:opacity-50 transition-all"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Start Listening <Music2 size={15} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
