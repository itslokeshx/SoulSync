import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { motion } from "framer-motion";
import { Music2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import toast from "react-hot-toast";

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-sp-green flex items-center justify-center">
            <Music2 size={24} className="text-black" strokeWidth={2.5} />
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

  /* ── Main ────────────────────────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] bg-[#050505] flex items-center justify-center p-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-[360px] flex flex-col items-center"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-xl bg-sp-green flex items-center justify-center">
            <Music2 size={22} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">
              Soul
              <span className="text-sp-green">Sync</span>
            </h1>
            <p className="text-[9px] text-white/25 font-medium tracking-[0.2em] uppercase">
              Feel every beat
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl bg-white/[0.03] border border-white/[0.06] p-7 sm:p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-white">Welcome back</h2>
            <p className="text-sm text-white/30 mt-1">
              Sign in to your account
            </p>
          </div>

          {/* Google Login */}
          <div className="flex flex-col items-center gap-5">
            <div className="relative w-full flex justify-center">
              {loggingIn && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50 rounded-full backdrop-blur-sm">
                  <div className="w-5 h-5 border-2 border-sp-green border-t-transparent rounded-full animate-spin" />
                </div>
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
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] text-white/15 font-medium uppercase tracking-wider">
              Secured with Google
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "50M+ Songs", sub: "Free forever" },
              { label: "AI Playlists", sub: "Smart curation" },
              { label: "Duo Mode", sub: "Listen together" },
            ].map(({ label, sub }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-white/60">{label}</p>
                <p className="text-[10px] text-white/20 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Terms */}
        <p className="text-[10px] text-white/15 text-center mt-5 leading-relaxed max-w-xs">
          By continuing, you agree to SoulSync's Terms of Service and Privacy
          Policy.
        </p>
      </motion.div>
    </div>
  );
}
