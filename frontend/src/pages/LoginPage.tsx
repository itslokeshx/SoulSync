import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { motion } from "framer-motion";
import {
  Music2,
  Headphones,
  Users,
  Sparkles,
  Radio,
  Disc3,
  Mic2,
  Zap,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import toast from "react-hot-toast";

/* ── Floating particle config ─────────────────────────────────── */
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: Math.random() * 3 + 1,
  x: Math.random() * 100,
  y: Math.random() * 100,
  dur: Math.random() * 12 + 10,
  delay: Math.random() * 5,
  opacity: Math.random() * 0.25 + 0.05,
}));

const NOTES = ["♪", "♫", "♬", "♩"];
const FLOATING_NOTES = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  note: NOTES[i % NOTES.length],
  x: 10 + Math.random() * 80,
  dur: 8 + Math.random() * 10,
  delay: Math.random() * 6,
  size: 14 + Math.random() * 14,
}));

const features = [
  {
    icon: Headphones,
    label: "AI Playlists",
    desc: "Curated by intelligence",
    color: "#1db954",
    bg: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    icon: Users,
    label: "Duo Mode",
    desc: "Listen together, live",
    color: "#8b5cf6",
    bg: "from-purple-500/20 to-purple-500/5",
  },
  {
    icon: Sparkles,
    label: "Smart Search",
    desc: "Find by mood or vibe",
    color: "#f59e0b",
    bg: "from-amber-500/20 to-amber-500/5",
  },
  {
    icon: Radio,
    label: "Offline Mode",
    desc: "Download & play anywhere",
    color: "#06b6d4",
    bg: "from-cyan-500/20 to-cyan-500/5",
  },
];

const stats = [
  { label: "Songs", display: "50M+" },
  { label: "Artists", display: "200K+" },
  { label: "Free forever", display: "100%" },
];

export default function LoginPage() {
  const { isAuthenticated, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  /* ── Loading splash ──────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 flex items-center justify-center animate-breathe">
              <Music2 size={28} className="text-black" strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-sp-green/20 blur-xl animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sp-green animate-bounce [animation-delay:0ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-sp-green animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-sp-green animate-bounce [animation-delay:300ms]" />
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Main login layout ───────────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] bg-[#050505] flex flex-col lg:flex-row overflow-hidden relative">
      {/* ─── LEFT HERO PANEL (lg) / TOP SECTION (mobile) ───────── */}
      <div className="relative lg:w-[55%] min-h-[38dvh] lg:min-h-screen flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 overflow-hidden">
        {/* Gradient mesh bg */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 20%, rgba(29,185,84,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 50% 50%, rgba(6,182,212,0.05) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Particles */}
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-sp-green"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: p.opacity,
            }}
            animate={{
              y: [0, -40, 0],
              x: [0, 20, -10, 0],
              opacity: [p.opacity, p.opacity * 2, p.opacity],
            }}
            transition={{
              duration: p.dur,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Floating notes — desktop */}
        <div className="hidden lg:block">
          {FLOATING_NOTES.map((n) => (
            <motion.span
              key={n.id}
              className="absolute text-white/[0.06] select-none pointer-events-none font-serif"
              style={{ left: `${n.x}%`, fontSize: n.size }}
              animate={{
                y: [0, -60, 0],
                rotate: [-10, 10, -10],
                opacity: [0.04, 0.1, 0.04],
              }}
              transition={{
                duration: n.dur,
                delay: n.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {n.note}
            </motion.span>
          ))}
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-lg text-center lg:text-left w-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-4 mb-6 lg:mb-12 justify-center lg:justify-start"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="relative"
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 flex items-center justify-center"
                style={{ boxShadow: "0 0 40px rgba(29,185,84,0.35)" }}
              >
                <Music2
                  size={24}
                  className="text-black sm:w-[26px] sm:h-[26px]"
                  strokeWidth={2.5}
                />
              </div>
              <motion.div
                className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-sp-green/30 to-emerald-400/10"
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-none">
                Soul
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green via-emerald-300 to-teal-300">
                  Sync
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-white/30 font-medium tracking-[0.2em] uppercase mt-0.5">
                Feel every beat
              </p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mb-6 lg:mb-10"
          >
            <h2 className="text-xl sm:text-2xl lg:text-[2.75rem] font-black text-white leading-[1.1] tracking-tight">
              Music that{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green to-emerald-300">
                understands
              </span>
              <br className="hidden sm:block" /> your soul
            </h2>
            <p className="text-white/30 text-xs sm:text-sm lg:text-base mt-2 sm:mt-4 max-w-md leading-relaxed">
              AI-powered recommendations, real-time duo listening, and 50
              million songs — completely free.
            </p>
          </motion.div>

          {/* Feature cards — desktop */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="hidden lg:grid grid-cols-2 gap-3 mb-10"
          >
            {features.map(({ icon: Icon, label, desc, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className={`flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br ${bg} border border-white/[0.04] hover:border-white/[0.08] transition-all duration-300 group cursor-default`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                  style={{
                    background: `${color}15`,
                    border: `1px solid ${color}25`,
                  }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">{label}</p>
                  <p className="text-white/30 text-xs mt-0.5">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Mobile feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center lg:hidden gap-2 mb-4"
          >
            {features.map(({ icon: Icon, label, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.03]"
              >
                <Icon size={11} style={{ color }} />
                <span className="text-[10px] text-white/50 font-medium">
                  {label}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats bar — desktop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="hidden lg:flex items-center gap-6"
          >
            {stats.map(({ label, display }, i) => (
              <div key={label} className="flex items-center gap-3">
                {i > 0 && <div className="w-px h-8 bg-white/[0.06]" />}
                <div>
                  <p className="text-xl font-black text-white">{display}</p>
                  <p className="text-[10px] text-white/25 font-medium uppercase tracking-wider">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ─── RIGHT LOGIN PANEL ─────────────────────────────────── */}
      <div className="relative lg:w-[45%] flex items-center justify-center p-5 sm:p-8 lg:p-16 flex-1 lg:flex-none">
        {/* Left border — desktop */}
        <div className="hidden lg:block absolute left-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="w-full max-w-sm relative"
        >
          {/* Glass card */}
          <div
            className="relative rounded-3xl p-7 sm:p-9"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow:
                "0 32px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
              backdropFilter: "blur(40px)",
            }}
          >
            {/* Glow top accent */}
            <div className="absolute -top-px left-1/2 -translate-x-1/2 w-24 h-[2px] bg-gradient-to-r from-transparent via-sp-green/50 to-transparent rounded-full" />

            {/* Card header */}
            <div className="text-center mb-7">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Welcome back
              </h2>
              <p className="text-white/30 text-sm mt-1.5">
                Sign in to continue your journey
              </p>
            </div>

            {/* Decorative icons */}
            <div className="flex justify-center gap-3 mb-7">
              {[Disc3, Mic2, Zap, Headphones].map((Icon, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.08 }}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center"
                >
                  <Icon size={15} className="text-white/20" />
                </motion.div>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-7">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              <span className="text-[10px] text-white/20 font-semibold uppercase tracking-widest">
                Continue with
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            </div>

            {/* Google Login */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="flex flex-col items-center gap-5"
            >
              <div className="relative w-full flex justify-center">
                {loggingIn && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center z-10 bg-black/50 rounded-full backdrop-blur-sm"
                  >
                    <div className="w-5 h-5 border-2 border-sp-green border-t-transparent rounded-full animate-spin" />
                  </motion.div>
                )}
                <GoogleLogin
                  onSuccess={async (response) => {
                    if (response.credential) {
                      setLoggingIn(true);
                      try {
                        const { isNewUser } = await login(response.credential);
                        navigate(isNewUser ? "/onboarding" : "/", {
                          replace: true,
                        });
                      } catch {
                        toast.error("Login failed. Please try again.");
                      } finally {
                        setLoggingIn(false);
                      }
                    }
                  }}
                  onError={() => toast.error("Google sign-in failed")}
                  theme="filled_black"
                  size="large"
                  shape="pill"
                  text="continue_with"
                  width="300"
                />
              </div>

              {/* Security badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                <div className="w-1.5 h-1.5 rounded-full bg-sp-green" />
                <p className="text-[10px] text-white/20 font-medium">
                  Secured with Google OAuth 2.0
                </p>
              </div>
            </motion.div>
          </div>

          {/* Terms */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-[10px] text-white/15 text-center mt-5 leading-relaxed max-w-xs mx-auto"
          >
            By continuing, you agree to SoulSync's Terms of Service and Privacy
            Policy. Your data is encrypted and never shared.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
