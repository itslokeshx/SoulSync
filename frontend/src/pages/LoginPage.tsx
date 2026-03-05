import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { motion } from "framer-motion";
import {
  Music2,
  Headphones,
  Users,
  Zap,
  ShieldOff,
  Download,
  Chrome,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { isNative } from "../utils/platform";
import toast from "react-hot-toast";

/* ── EQ visualizer bars ─────────────────────────────────────── */
const EqBar = ({ delay, h }: { delay: number; h: number }) => (
  <motion.div
    className="w-[3px] rounded-full bg-sp-green"
    animate={{ height: [h, h * 2.5, h * 0.7, h * 1.8, h] }}
    transition={{
      duration: 1.4,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

export default function LoginPage() {
  const { isAuthenticated, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div
        className="h-screen w-screen bg-sp-black flex items-center justify-center"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-sp-green flex items-center justify-center">
            <Music2 size={26} className="text-black" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
            <div className="w-1 h-1 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
            <div className="w-1 h-1 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] bg-sp-black flex flex-col lg:flex-row overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* ═══════════════ LEFT: Hero ═══════════════ */}
      <div className="relative lg:w-[52%] flex flex-col justify-center items-center px-5 sm:px-6 py-8 sm:py-14 lg:py-0 lg:px-16 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Green gradient orb */}
          <div
            className="absolute w-[280px] h-[280px] sm:w-[500px] sm:h-[500px] -top-20 left-1/2 -translate-x-1/2 lg:translate-x-0 lg:-left-32 sm:-top-32 opacity-[0.12]"
            style={{
              background:
                "radial-gradient(circle, #1db954 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute w-[180px] h-[180px] sm:w-[300px] sm:h-[300px] bottom-0 right-0 opacity-[0.06]"
            style={{
              background:
                "radial-gradient(circle, #1db954 0%, transparent 70%)",
            }}
          />
          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative z-10 max-w-md w-full text-center lg:text-left">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 sm:gap-3.5 mb-7 sm:mb-10 lg:mb-14 justify-center lg:justify-start"
          >
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sp-green flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: "0 0 24px rgba(29,185,84,0.3)" }}
            >
              <Music2
                size={22}
                className="text-black sm:w-6 sm:h-6"
                strokeWidth={2.5}
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
                Soul<span className="text-sp-green">Sync</span>
              </h1>
              <p className="text-[10px] text-white/20 font-medium tracking-[0.18em] uppercase mt-0.5">
                Feel every beat
              </p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h2 className="text-[1.6rem] sm:text-[2.5rem] lg:text-[2.8rem] font-black text-white leading-[1.1] tracking-tight">
              Your music,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green via-emerald-300 to-teal-400">
                your way.
              </span>
            </h2>
            <p className="text-white/35 text-[13px] sm:text-base mt-3 sm:mt-4 leading-relaxed max-w-sm mx-auto lg:mx-0">
              AI-powered playlists, real-time duo sessions, and 50 million songs
              — completely free, forever.
            </p>
          </motion.div>

          {/* EQ + feature chips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-7 sm:mt-10 lg:mt-14"
          >
            {/* EQ visualizer */}
            <div className="flex items-end gap-[3px] h-5 sm:h-6 mb-4 sm:mb-6 justify-center lg:justify-start">
              {[6, 10, 4, 14, 8, 12, 5, 9, 7, 11, 6, 13, 5, 8].map((h, i) => (
                <EqBar key={i} delay={i * 0.08} h={h} />
              ))}
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              {[
                { icon: Headphones, label: "AI Playlists" },
                { icon: Users, label: "Duo Mode" },
                { icon: Zap, label: "Offline Play" },
                { icon: ShieldOff, label: "No Ads" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]"
                >
                  <Icon
                    size={12}
                    className="text-sp-green sm:w-[13px] sm:h-[13px]"
                  />
                  <span className="text-[11px] sm:text-xs text-white/50 font-medium">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Stats — desktop only */}
            <div className="hidden lg:flex items-center gap-8 mt-10">
              {[
                { val: "50M+", label: "Songs" },
                { val: "200K+", label: "Artists" },
                { val: "100%", label: "Free" },
              ].map(({ val, label }, i) => (
                <div key={label} className="flex items-center gap-6">
                  {i > 0 && <div className="w-px h-8 bg-white/[0.06]" />}
                  <div>
                    <p className="text-2xl font-black text-white">{val}</p>
                    <p className="text-[10px] text-white/20 uppercase tracking-wider font-medium mt-0.5">
                      {label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════ RIGHT: Login ═══════════════ */}
      <div className="relative lg:w-[48%] flex flex-col items-center justify-center px-5 sm:px-6 pb-8 sm:pb-12 lg:py-0 lg:px-16">
        {/* Horizontal divider — mobile */}
        <div className="lg:hidden w-16 h-px bg-white/[0.06] mx-auto mb-6 sm:mb-8" />
        {/* Vertical divider — desktop */}
        <div className="hidden lg:block absolute left-0 top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="w-full max-w-sm"
        >
          {/* Card */}
          <div
            className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-9"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow:
                "0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Top green accent line */}
            <div className="w-10 sm:w-12 h-1 rounded-full bg-sp-green mx-auto mb-5 sm:mb-7" />

            <div className="text-center mb-5 sm:mb-7">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                Get started
              </h2>
              <p className="text-sm text-white/30 mt-1.5 leading-relaxed">
                One click to your personalized
                <br className="hidden sm:block" /> music experience
              </p>
            </div>

            {/* Google Login */}
            <div className="flex flex-col items-center">
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
                {isNative() ? (
                  /* Native APK: open Google OAuth in system browser */
                  <button
                    onClick={async () => {
                      setLoggingIn(true);
                      try {
                        const backendUrl =
                          import.meta.env.VITE_BACKEND_URL ||
                          "https://soulsync-backend-a5fs.onrender.com";
                        const { Browser } = await import("@capacitor/browser");
                        await Browser.open({
                          url: `${backendUrl}/api/auth/google/native`,
                          windowName: "_system",
                        });
                      } catch {
                        toast.error("Could not open browser for sign-in");
                      } finally {
                        setLoggingIn(false);
                      }
                    }}
                    className="flex items-center gap-3 px-6 py-3 rounded-full bg-white text-black text-[14px] font-semibold hover:bg-gray-100 active:scale-95 transition-all shadow-lg"
                  >
                    <Chrome size={18} />
                    Continue with Google
                  </button>
                ) : (
                  /* Web: use standard Google OAuth component */
                  <GoogleLogin
                    onSuccess={async (response) => {
                      if (response.credential) {
                        setLoggingIn(true);
                        try {
                          const { isNewUser } = await login(
                            response.credential,
                          );
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
                    width="280"
                  />
                )}
              </div>

              {/* Native APK: skip login → offline mode */}
              {isNative() && (
                <button
                  onClick={() => navigate("/offline", { replace: true })}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] border border-white/[0.06] hover:bg-white/[0.1] transition-all text-white/50 text-sm font-medium"
                >
                  <Download size={14} className="text-amber-400" />
                  Continue offline
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 sm:gap-3 my-4 sm:my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-sp-green/50" />
                <span className="text-[10px] text-white/20 font-medium">
                  Encrypted & Secure
                </span>
              </div>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Testimonial-style social proof */}
            <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              {/* Stacked avatars */}
              <div className="flex -space-x-2 flex-shrink-0">
                {["🎵", "🎧", "🎶"].map((e, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full bg-white/[0.06] border-2 border-sp-black flex items-center justify-center text-xs"
                  >
                    {e}
                  </div>
                ))}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] text-white/50 leading-snug">
                  Join thousands of music lovers already vibing on SoulSync
                </p>
              </div>
            </div>
          </div>

          {/* Mobile stats */}
          <div className="flex lg:hidden items-center justify-center gap-4 sm:gap-5 mt-5 sm:mt-6">
            {[
              { val: "50M+", label: "Songs" },
              { val: "200K+", label: "Artists" },
              { val: "100%", label: "Free" },
            ].map(({ val, label }, i) => (
              <div key={label} className="flex items-center gap-4">
                {i > 0 && <div className="w-px h-4 bg-white/[0.06]" />}
                <div className="text-center">
                  <p className="text-sm font-bold text-white/60">{val}</p>
                  <p className="text-[9px] text-white/15 uppercase tracking-wider font-medium">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Terms */}
          <p className="text-[10px] text-white/10 text-center mt-5 leading-relaxed">
            By continuing, you agree to SoulSync's Terms of Service and Privacy
            Policy.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
