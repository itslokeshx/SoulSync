import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music2,
  Headphones,
  Users,
  Zap,
  ShieldOff,
  Download,
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { isNative } from "../utils/platform";
import * as api from "../api/backend";
import toast from "react-hot-toast";

type AuthState = "welcome" | "login" | "register" | "forgot-password";

const EqBar = ({ delay, h }: { delay: number; h: number }) => (
  <motion.div
    className="w-[3px] rounded-full bg-sp-green"
    animate={{ height: [h, h * 2.5, h * 0.7, h * 1.8, h] }}
    transition={{ duration: 1.4, delay, repeat: Infinity, ease: "easeInOut" }}
  />
);

function getStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Weak", color: "#ef4444" },
    { label: "Fair", color: "#f59e0b" },
    { label: "Strong", color: "#3b82f6" },
    { label: "Great", color: "#1db954" },
  ];
  return { score, ...levels[Math.min(score, 3)] };
}

function AuthInput({
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  error,
  suffix,
  hint,
}: {
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  error?: string;
  suffix?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`w-full h-12 px-4 rounded-xl bg-white/[0.06] border text-white text-[14px] placeholder-white/20 outline-none focus:border-sp-green/50 focus:bg-white/[0.08] transition-all ${error
            ? "border-red-500/60 bg-red-500/5"
            : "border-white/[0.08] hover:border-white/[0.12]"
            } ${suffix ? "pr-11" : ""}`}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
      </div>
      {error && error !== " " && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}
      {hint && !error && (
        <div className="text-[11px] text-white/30">{hint}</div>
      )}
    </div>
  );
}

function GoogleBtn({
  loading,
  onSuccess,
  onNativeClick,
}: {
  loading: boolean;
  onSuccess: (cred: string) => void;
  onNativeClick: () => void;
}) {
  if (isNative()) {
    return (
      <button
        onClick={onNativeClick}
        disabled={loading}
        className="w-full h-12 flex items-center justify-center gap-3 rounded-xl bg-white/[0.07] border border-white/[0.1] text-white text-[14px] font-semibold hover:bg-white/[0.12] active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        Continue with Google
      </button>
    );
  }
  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={(r) => r.credential && onSuccess(r.credential)}
        onError={() => toast.error("Google sign-in failed")}
        theme="filled_black"
        size="large"
        shape="pill"
        text="continue_with"
        width="280"
      />
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-[11px] text-white/20 font-medium">or</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

export default function LoginPage() {
  const {
    isAuthenticated,
    isLoading,
    login,
    loginWithCredentials,
    loginAfterRegister,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const [authState, setAuthState] = useState<AuthState>(
    searchParams.get("mode") === "register" ? "register" : "welcome",
  );
  const [googleLoading, setGoogleLoading] = useState(false);

  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (isAuthenticated) navigate(returnTo, { replace: true });
  }, [isAuthenticated, navigate, returnTo]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleGoogleSuccess = async (cred: string) => {
    setGoogleLoading(true);
    try {
      const { isNewUser } = await login(cred);
      navigate(isNewUser ? "/onboarding" : returnTo, { replace: true });
    } catch {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleNativeGoogle = async () => {
    setGoogleLoading(true);
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
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPw) return;
    setLoginLoading(true);
    setLoginError("");
    try {
      const { isNewUser } = await loginWithCredentials(loginId.trim(), loginPw);
      navigate(isNewUser ? "/onboarding" : returnTo, { replace: true });
    } catch (err: any) {
      setLoginError(err?.response?.data?.error || "Invalid credentials");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!regName.trim()) errors.name = "Name is required";
    if (!regEmail || !/\S+@\S+\.\S+/.test(regEmail))
      errors.email = "Valid email required";
    if (regPw.length < 8) errors.password = "Minimum 8 characters";
    else if (!/[A-Z]/.test(regPw))
      errors.password = "Need one uppercase letter";
    else if (!/\d/.test(regPw)) errors.password = "Need one number";
    if (Object.keys(errors).length) {
      setRegErrors(errors);
      return;
    }
    setRegErrors({});
    setRegLoading(true);
    try {
      const { data } = await api.register({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        password: regPw,
      });
      await loginAfterRegister(data.user, data.token);
      navigate("/onboarding", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Registration failed";
      if (msg.includes("Email")) setRegErrors({ email: msg });
      else toast.error(msg);
    } finally {
      setRegLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await api.forgotPassword(forgotEmail.trim());
    } catch {
      /* always succeed */
    } finally {
      setForgotSent(true);
      setResendCountdown(60);
      setForgotLoading(false);
    }
  };

  const strength = getStrength(regPw);

  if (isLoading) {
    return (
      <div
        className="h-screen w-screen bg-sp-black flex items-center justify-center"
        style={{
          paddingTop: "env(safe-area-inset-top,0px)",
          paddingBottom: "env(safe-area-inset-bottom,0px)",
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
            {[0, 150, 300].map((d) => (
              <div
                key={d}
                className="w-1 h-1 rounded-full bg-white/30 animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] bg-sp-black flex flex-col lg:flex-row overflow-x-hidden overflow-y-auto lg:overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top,0px)",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
      }}
    >
      {/* LEFT HERO — desktop only */}
      <div className="relative lg:w-[52%] hidden lg:flex flex-col justify-center items-center px-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute w-[500px] h-[500px] -top-32 -left-32 opacity-[0.12]"
            style={{
              background: "radial-gradient(circle,#1db954 0%,transparent 70%)",
            }}
          />
          <div
            className="absolute w-[300px] h-[300px] bottom-0 right-0 opacity-[0.06]"
            style={{
              background: "radial-gradient(circle,#1db954 0%,transparent 70%)",
            }}
          />
        </div>
        <div className="relative z-10 max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3.5 mb-14"
          >
            <div
              className="w-12 h-12 rounded-xl bg-sp-green flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: "0 0 24px rgba(29,185,84,0.3)" }}
            >
              <Music2 size={24} className="text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                Soul<span className="text-sp-green">Sync</span>
              </h1>
              <p className="text-[10px] text-white/20 font-medium tracking-[0.18em] uppercase mt-0.5">
                Feel every beat
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h2 className="text-[2.8rem] font-black text-white leading-[1.1] tracking-tight">
              Your music,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green via-emerald-300 to-teal-400">
                your way.
              </span>
            </h2>
            <p className="text-white/35 text-base mt-4 leading-relaxed max-w-sm">
              AI-powered playlists, real-time duo sessions, and 50 million songs
              — completely free, forever.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-14"
          >
            <div className="flex items-end gap-[3px] h-6 mb-6">
              {[6, 10, 4, 14, 8, 12, 5, 9, 7, 11, 6, 13, 5, 8].map((h, i) => (
                <EqBar key={i} delay={i * 0.08} h={h} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: Headphones, label: "AI Playlists" },
                { icon: Users, label: "Duo Mode" },
                { icon: Zap, label: "Offline Play" },
                { icon: ShieldOff, label: "No Ads" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]"
                >
                  <Icon size={13} className="text-sp-green" />
                  <span className="text-xs text-white/50 font-medium">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-8 mt-10">
              {[
                { val: "50M+", label: "Songs" },
                { val: "200K+", label: "Artists" },
                { val: "100%", label: "Free" },
              ].map(({ val, label }, i) => (
                <div key={label} className="flex items-center gap-8">
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

      {/* RIGHT AUTH PANEL */}
      <div className="relative flex-1 lg:w-[48%] flex flex-col items-center justify-center px-5 sm:px-6 pt-2 pb-10 lg:py-0 lg:px-16">
        {/* ── Mobile Hero — only shown on welcome screen ── */}
        <div
          className={`lg:hidden relative w-full px-5 sm:px-6 pt-10 pb-8 overflow-hidden transition-all duration-300 ${authState !== "welcome" ? "hidden" : ""}`}
        >
          {/* background orbs */}
          <div
            className="absolute -top-16 -left-16 w-72 h-72 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle,rgba(29,185,84,0.13) 0%,transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-8 -right-8 w-52 h-52 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle,rgba(29,185,84,0.06) 0%,transparent 70%)",
            }}
          />

          {/* Logo row */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-7 relative z-10"
          >
            <div
              className="w-11 h-11 rounded-xl bg-sp-green flex items-center justify-center flex-shrink-0"
              style={{
                boxShadow:
                  "0 0 22px rgba(29,185,84,0.35), 0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              <Music2 size={22} className="text-black" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-none tracking-tight">
                Soul<span className="text-sp-green">Sync</span>
              </h1>
              <p className="text-[9px] text-white/25 font-semibold tracking-[0.2em] uppercase mt-0.5">
                Feel every beat
              </p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative z-10 mb-4"
          >
            <h2 className="text-[2rem] sm:text-[2.4rem] font-black text-white leading-[1.08] tracking-tight">
              Your music,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green via-emerald-300 to-teal-400">
                your way.
              </span>
            </h2>
            <p className="text-white/35 text-[13px] sm:text-sm mt-3 leading-relaxed max-w-xs">
              AI-powered playlists, real-time duo sessions, and 50 million songs
              — completely free, forever.
            </p>
          </motion.div>

          {/* EQ bars */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-end gap-[3px] h-5 mb-4 relative z-10"
          >
            {[6, 10, 4, 14, 8, 12, 5, 9, 7, 11, 6, 13, 5, 8].map((h, i) => (
              <EqBar key={i} delay={i * 0.08} h={h * 0.7} />
            ))}
          </motion.div>

          {/* Feature chips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap gap-1.5 mb-6 relative z-10"
          >
            {[
              { icon: Headphones, label: "AI Playlists" },
              { icon: Users, label: "Duo Mode" },
              { icon: Zap, label: "Offline Play" },
              { icon: ShieldOff, label: "No Ads" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]"
              >
                <Icon size={11} className="text-sp-green" />
                <span className="text-[11px] text-white/50 font-medium">
                  {label}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="flex items-center gap-0 relative z-10"
          >
            {[
              { val: "50M+", label: "Songs" },
              { val: "200K+", label: "Artists" },
              { val: "100%", label: "Free" },
            ].map(({ val, label }, i) => (
              <div key={label} className="flex items-center">
                {i > 0 && <div className="w-px h-7 bg-white/[0.07] mx-5" />}
                <div>
                  <p className="text-[1.35rem] font-black text-white leading-none">
                    {val}
                  </p>
                  <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mt-0.5">
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
        <div className="hidden lg:block absolute left-0 top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />

        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {authState === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col gap-4"
              >
                <div className="hidden lg:block text-center mb-2">
                  <p className="text-[13px] text-sp-green font-semibold">
                    🎧 SoulSync
                  </p>
                  <h2 className="text-2xl font-black text-white mt-1">
                    Listen together.
                  </h2>
                  <p className="text-white/30 text-sm mt-1">Feel together.</p>
                </div>
                <GoogleBtn
                  loading={googleLoading}
                  onSuccess={handleGoogleSuccess}
                  onNativeClick={handleNativeGoogle}
                />
                <OrDivider />
                <button
                  onClick={() => setAuthState("login")}
                  className="w-full h-12 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white text-[14px] font-bold hover:bg-white/[0.10] hover:border-white/[0.18] active:scale-[0.98] transition-all"
                >
                  Sign In
                </button>
                <p className="text-center text-[12px] text-white/30 mt-0.5">
                  New to SoulSync?{" "}
                  <button
                    onClick={() => setAuthState("register")}
                    className="text-sp-green hover:text-sp-green/80 font-semibold transition-colors"
                  >
                    Create account
                  </button>
                </p>

              </motion.div>
            )}

            {authState === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22 }}
              >
                <button
                  onClick={() => {
                    setAuthState("welcome");
                    setLoginError("");
                  }}
                  className="flex items-center gap-1.5 text-white/40 hover:text-white text-[13px] mb-5 transition-colors"
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
                <h2 className="text-2xl font-black text-white">Welcome back</h2>
                <p className="text-white/30 text-sm mt-1 mb-6">
                  Sign in to SoulSync
                </p>
                <form onSubmit={handleLogin} className="flex flex-col gap-3">
                  {loginError && (
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                      <X size={14} className="flex-shrink-0" />
                      {loginError}
                    </div>
                  )}
                  <AuthInput
                    placeholder="email or username"
                    value={loginId}
                    onChange={(v) => {
                      setLoginId(v);
                      setLoginError("");
                    }}
                    autoComplete="username"
                    error={loginError ? " " : undefined}
                  />
                  <AuthInput
                    type={showLoginPw ? "text" : "password"}
                    placeholder="password"
                    value={loginPw}
                    onChange={(v) => {
                      setLoginPw(v);
                      setLoginError("");
                    }}
                    autoComplete="current-password"
                    error={loginError ? " " : undefined}
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowLoginPw((s) => !s)}
                        className="text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showLoginPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => setAuthState("forgot-password")}
                      className="text-[12px] text-sp-green/70 hover:text-sp-green transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={loginLoading || !loginId || !loginPw}
                    className="w-full h-12 rounded-xl bg-sp-green text-black font-bold text-[14px] hover:bg-sp-green/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                    style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.25)" }}
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                  <OrDivider />
                  <GoogleBtn
                    loading={googleLoading}
                    onSuccess={handleGoogleSuccess}
                    onNativeClick={handleNativeGoogle}
                  />
                </form>
                <p className="text-center text-[12px] text-white/30 mt-5">
                  Don't have an account?{" "}
                  <button
                    onClick={() => setAuthState("register")}
                    className="text-sp-green hover:text-sp-green/80 font-semibold transition-colors"
                  >
                    Create account
                  </button>
                </p>
              </motion.div>
            )}

            {authState === "register" && (
              <motion.div
                key="register"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22 }}
              >
                <button
                  onClick={() => {
                    setAuthState("welcome");
                    setRegErrors({});
                  }}
                  className="flex items-center gap-1.5 text-white/40 hover:text-white text-[13px] mb-5 transition-colors"
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
                <h2 className="text-2xl font-black text-white">
                  Create your account
                </h2>
                <p className="text-white/30 text-sm mt-1 mb-6">
                  Join SoulSync — it's free
                </p>
                <form onSubmit={handleRegister} className="flex flex-col gap-3">
                  <AuthInput
                    placeholder="your name"
                    value={regName}
                    onChange={setRegName}
                    autoComplete="name"
                    error={regErrors.name}
                  />
                  <AuthInput
                    type="email"
                    placeholder="email address"
                    value={regEmail}
                    onChange={(v) => {
                      setRegEmail(v);
                      setRegErrors((e) => ({ ...e, email: "" }));
                    }}
                    autoComplete="email"
                    error={regErrors.email}
                  />
                  <div>
                    <AuthInput
                      type={showRegPw ? "text" : "password"}
                      placeholder="password (min 8 chars)"
                      value={regPw}
                      onChange={(v) => {
                        setRegPw(v);
                        setRegErrors((e) => ({ ...e, password: "" }));
                      }}
                      autoComplete="new-password"
                      error={regErrors.password}
                      suffix={
                        <button
                          type="button"
                          onClick={() => setShowRegPw((s) => !s)}
                          className="text-white/30 hover:text-white/60 transition-colors"
                        >
                          {showRegPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />
                    {regPw.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex gap-1 flex-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="flex-1 h-1 rounded-full transition-all duration-300"
                              style={{
                                background:
                                  i < strength.score
                                    ? strength.color
                                    : "rgba(255,255,255,0.08)",
                              }}
                            />
                          ))}
                        </div>
                        <span
                          className="text-[11px] font-semibold flex-shrink-0"
                          style={{ color: strength.color }}
                        >
                          {strength.label}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full h-12 rounded-xl bg-sp-green text-black font-bold text-[14px] hover:bg-sp-green/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                    style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.25)" }}
                  >
                    {regLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </button>
                  <OrDivider />
                  <GoogleBtn
                    loading={googleLoading}
                    onSuccess={handleGoogleSuccess}
                    onNativeClick={handleNativeGoogle}
                  />
                </form>
                <p className="text-center text-[12px] text-white/25 mt-5">
                  Already have an account?{" "}
                  <button
                    onClick={() => setAuthState("login")}
                    className="text-sp-green hover:text-sp-green/80 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </motion.div>
            )}

            {authState === "forgot-password" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.22 }}
              >
                <button
                  onClick={() => {
                    setAuthState("login");
                    setForgotSent(false);
                    setForgotEmail("");
                  }}
                  className="flex items-center gap-1.5 text-white/40 hover:text-white text-[13px] mb-5 transition-colors"
                >
                  <ArrowLeft size={15} />
                  Back to sign in
                </button>
                <h2 className="text-2xl font-black text-white">
                  Reset your password
                </h2>
                <p className="text-white/30 text-sm mt-1 mb-6">
                  Enter your email and we'll send a reset link
                </p>
                {!forgotSent ? (
                  <form
                    onSubmit={handleForgotPassword}
                    className="flex flex-col gap-3"
                  >
                    <AuthInput
                      type="email"
                      placeholder="your email address"
                      value={forgotEmail}
                      onChange={setForgotEmail}
                      autoComplete="email"
                    />
                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotEmail.trim()}
                      className="w-full h-12 rounded-xl bg-sp-green text-black font-bold text-[14px] hover:bg-sp-green/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                      style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.25)" }}
                    >
                      {forgotLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Reset Link"
                      )}
                    </button>
                  </form>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 py-4"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-sp-green/10 border border-sp-green/20 flex items-center justify-center">
                      <Mail size={28} className="text-sp-green" />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-lg">
                        Check your email
                      </p>
                      <p className="text-white/40 text-sm mt-1.5 leading-relaxed">
                        We sent a reset link to
                        <br />
                        <span className="text-white/70">{forgotEmail}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setAuthState("login");
                        setForgotSent(false);
                      }}
                      className="w-full h-11 rounded-xl border border-white/[0.12] text-white text-[14px] font-semibold hover:bg-white/[0.05] transition-all"
                    >
                      Back to sign in
                    </button>
                    <button
                      onClick={() => {
                        if (resendCountdown > 0) return;
                        setForgotSent(false);
                      }}
                      disabled={resendCountdown > 0}
                      className="text-[12px] text-white/30 disabled:text-white/15 hover:text-white/50 transition-colors"
                    >
                      {resendCountdown > 0
                        ? `Resend in ${resendCountdown}s`
                        : "Resend email"}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-[10px] text-white/10 text-center mt-8 leading-relaxed">
            By continuing, you agree to SoulSync's Terms of Service and Privacy
            Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
