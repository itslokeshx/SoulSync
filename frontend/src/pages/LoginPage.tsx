import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { motion } from "framer-motion";
import { Music2, Headphones, Users, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import toast from "react-hot-toast";

const features = [
  { icon: Headphones, label: "AI Playlists", color: "#1db954" },
  { icon: Users, label: "Duo Mode", color: "#8b5cf6" },
  { icon: Sparkles, label: "Smart Search", color: "#f59e0b" },
];

export default function LoginPage() {
  const { isAuthenticated, login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-sp-green border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden">
      {/* Animated background orbs */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.08] blur-[120px]"
        style={{ background: "#1db954", top: "-10%", left: "-10%" }}
        animate={{
          x: [0, 60, 0],
          y: [0, 40, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]"
        style={{ background: "#8b5cf6", bottom: "-5%", right: "-5%" }}
        animate={{
          x: [0, -50, 0],
          y: [0, -30, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 max-w-sm w-full mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 flex items-center justify-center mx-auto mb-6"
            style={{ boxShadow: "0 0 60px rgba(29,185,84,0.3)" }}
          >
            <Music2 size={36} className="text-black" strokeWidth={2.5} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-black text-white tracking-tight"
          >
            Soul
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green to-emerald-300">
              Sync
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/40 mt-2.5 text-sm font-medium"
          >
            Your music, your way — powered by AI
          </motion.p>
        </div>

        {/* Feature highlights */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex justify-center gap-6 mb-10"
        >
          {features.map(({ icon: Icon, label, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <span className="text-[11px] text-white/50 font-medium">
                {label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Google Login */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            {loggingIn && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40 rounded-full">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
          <p className="text-[11px] text-white/20 text-center max-w-[260px] leading-relaxed">
            By continuing, you agree to SoulSync's Terms of Service and Privacy
            Policy
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
