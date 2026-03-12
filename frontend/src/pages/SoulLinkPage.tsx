import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Headphones,
  Copy,
  Check,
  ArrowLeft,
  Wifi,
  WifiOff,
  Radio,
  Sparkles,
  Send,
  Link as LinkIcon,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useDuoStore } from "../duo/duoStore";
import { useNetwork } from "../providers/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { usePlayer } from "../providers/PlayerProvider";
import toast from "react-hot-toast";

// ── Components ──────────────────────────────────────────────────────

const GlassCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white/[0.03] backdrop-blur-3xl border border-white/[0.08] rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl ${className}`}
  >
    {children}
  </motion.div>
);

const PulseRing = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <motion.div
      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      className="w-full h-full rounded-full border border-sp-green/30"
    />
    <motion.div
      animate={{ scale: [1, 2], opacity: [0.3, 0] }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeOut",
        delay: 0.5,
      }}
      className="w-full h-full rounded-full border border-sp-green/20"
    />
  </div>
);

// ── Page Component ──────────────────────────────────────────────────

export default function SoulLinkPage() {
  const navigate = useNavigate();
  const { isOnline } = useNetwork();
  const { user } = useAuth();
  const { duo } = usePlayer();
  const { active, partnerConnected, partnerName, roomCode, myName } =
    useDuoStore();

  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState(user?.name || "");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messageText, setMessageText] = useState("");

  const { messages, role } = useDuoStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (partnerConnected) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, partnerConnected]);

  // Redirect if session is already active and we're not on this page?
  // Actually, SoulLinkPage IS the session control center now.

  const copyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success("Code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOnline) {
    return (
      <div className="min-h-screen bg-[#0c0c0c] flex flex-col items-center justify-center p-8 text-center">
        <GlassCard className="max-w-md w-full">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-6 mx-auto border border-amber-500/20">
            <WifiOff size={32} className="text-amber-500/50" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">You're Offline</h2>
          <p className="text-white/40 text-sm mb-8">
            SoulLink requires an active internet connection to sync with your
            partner.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-4 rounded-full bg-white/[0.05] text-white font-bold hover:bg-white/[0.1] transition-all"
          >
            Go Back
          </button>
        </GlassCard>
      </div>
    );
  }

  // ── Active session view ──
  if (active && roomCode) {
    return (
      <div
        className="min-h-[80dvh] bg-[#0a0a0a] overflow-y-auto"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(29,185,84,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.06) 0%, transparent 50%), #0a0a0a",
        }}
      >
        {/* Back button */}
        <div
          className="fixed top-3 left-3 sm:top-8 sm:left-8 z-20"
          style={{ top: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
        >
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full glass flex items-center justify-center hover:scale-110 active:scale-90 transition-all"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-8 pb-24 sm:pt-12 sm:pb-12">
          {/* Background glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-sp-green/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10">
            <div className="relative w-16 h-16 sm:w-28 sm:h-28 mx-auto mb-3 sm:mb-6">
              <PulseRing />
              <div className="w-full h-full rounded-full bg-white/[0.03] border border-white/[0.1] flex items-center justify-center relative z-10 shadow-2xl">
                {partnerConnected ? (
                  <Headphones
                    size={28}
                    className="text-sp-green sm:w-10 sm:h-10"
                  />
                ) : (
                  <Radio
                    size={28}
                    className="text-sp-green animate-pulse sm:w-10 sm:h-10"
                  />
                )}
              </div>
            </div>

            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-1 sm:mb-2"
            >
              {partnerConnected ? "Session Active" : "Waiting for Partner"}
            </motion.h1>
            <p className="text-white/40 text-xs sm:text-sm mb-6 sm:mb-10 max-w-sm mx-auto px-2">
              {partnerConnected
                ? `You are now listening together with ${partnerName}. Every beat, every skip, synced perfectly.`
                : "Share your unique room code. Once they join, your music worlds will merge."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-5 sm:mb-8 text-left">
              <div className="glass p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl">
                <p className="text-[9px] sm:text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1 sm:mb-2">
                  Room Code
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-lg sm:text-2xl font-black text-white font-mono tracking-wider">
                    {roomCode}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-1.5 sm:p-2 rounded-xl hover:bg-white/10 text-white/60 transition-all"
                  >
                    {copied ? (
                      <Check size={16} className="text-sp-green" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>
              <div className="glass p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">
                    Status
                  </p>
                  <p
                    className={`text-sm font-bold ${partnerConnected ? "text-sp-green" : "text-amber-400"}`}
                  >
                    {partnerConnected ? "Connected" : "Syncing..."}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${partnerConnected ? "bg-sp-green/10" : "bg-amber-400/10"}`}
                >
                  <Wifi
                    size={20}
                    className={
                      partnerConnected ? "text-sp-green" : "text-amber-400"
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <button
                onClick={() => navigate("/")}
                className="flex-1 py-3 sm:py-4 rounded-full bg-sp-green text-black font-black text-xs sm:text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-sp-green/20"
              >
                Start Listening
              </button>
              <button
                onClick={duo.endSession}
                className="flex-1 py-3 sm:py-4 rounded-full glass text-white font-bold text-xs sm:text-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
              >
                End Session
              </button>
            </div>

            {/* ── Messaging Interface ── */}
            <AnimatePresence>
              {partnerConnected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/[0.05] overflow-hidden flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-4 sm:mb-6 ml-2">
                    <Send size={14} className="text-white/30" />
                    <h3 className="text-[9px] sm:text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                      Synchronized Chat
                    </h3>
                  </div>

                  <div className="h-48 sm:h-64 overflow-y-auto pr-2 mb-3 sm:mb-4 thin-scrollbar space-y-2 sm:space-y-4 text-left">
                    {messages.length === 0 && (
                      <div className="h-20 flex flex-col items-center justify-center opacity-20 italic text-xs text-white">
                        No messages yet. Send a whisper.
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <div
                        key={i}
                        className={`flex flex-col ${m.from === role ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-xs sm:text-sm max-w-[85%] sm:max-w-[80%] ${
                            m.from === role
                              ? "bg-sp-green text-black font-bold shadow-lg shadow-sp-green/10"
                              : "bg-white/[0.05] text-white border border-white/[0.05]"
                          }`}
                        >
                          {m.text}
                        </div>
                        <span className="text-[9px] opacity-30 mt-1 uppercase font-bold tracking-wider px-1">
                          {m.from === role ? "You" : m.fromName}
                        </span>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (messageText.trim()) {
                        duo.sendMessage(messageText);
                        setMessageText("");
                      }
                    }}
                    className="relative"
                  >
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl pl-5 pr-14 py-4 text-white placeholder-white/10 focus:outline-none focus:border-sp-green/40 focus:bg-white/[0.05] transition-all text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!messageText.trim()}
                      className="absolute right-2 top-2 w-10 h-10 rounded-xl bg-sp-green flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-sp-green/20 disabled:grayscale disabled:opacity-50"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ── Creation/Join Flow ──
  return (
    <div
      className="min-h-[80dvh] p-3 sm:p-4 md:p-8 flex items-center justify-center overflow-y-auto w-full"
      style={{
        background:
          "radial-gradient(ellipse at 20% 50%, rgba(29,185,84,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.06) 0%, transparent 50%), #0a0a0a",
      }}
    >
      {/* Decorative floating elements */}
      <motion.div
        animate={{ y: [0, -20, 0], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-20 right-10 sm:right-20 w-48 sm:w-96 h-48 sm:h-96 bg-sp-green/20 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none"
      />
      <motion.div
        animate={{ y: [0, 20, 0], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 12, repeat: Infinity, delay: 1 }}
        className="absolute bottom-20 left-10 sm:left-20 w-48 sm:w-96 h-48 sm:h-96 bg-blue-500/10 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none"
      />

      <div className="absolute top-4 left-4 sm:top-8 sm:left-8 z-20">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full glass flex items-center justify-center hover:scale-110 active:scale-90 transition-all group"
        >
          <ArrowLeft
            size={18}
            className="text-white group-hover:-translate-x-0.5 transition-transform"
          />
        </button>
      </div>

      <div className="max-w-xl w-full">
        <div className="text-center mb-6 sm:mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-2xl shadow-sp-green/30"
          >
            <Zap size={20} className="text-black fill-black sm:w-6 sm:h-6" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-1 sm:mb-2 tracking-tight"
          >
            Soul<span className="text-sp-green">Link</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/40 text-sm sm:text-lg font-medium"
          >
            Real-time music sharing. One session, two worlds.
          </motion.p>
        </div>

        <GlassCard className="mb-5 sm:mb-8">
          <div className="flex p-1 sm:p-1.5 bg-black/20 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 border border-white/[0.02]">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm font-bold transition-all ${tab === "create" ? "bg-white/[0.07] text-white shadow-lg" : "text-white/30 hover:text-white/60"}`}
            >
              Create
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm font-bold transition-all ${tab === "join" ? "bg-white/[0.07] text-white shadow-lg" : "text-white/30 hover:text-white/60"}`}
            >
              Join
            </button>
          </div>

          <AnimatePresence mode="wait">
            {tab === "create" ? (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2.5 block ml-1">
                    Your Identity
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-4 text-white placeholder-white/10 focus:outline-none focus:border-sp-green/40 focus:bg-white/[0.05] transition-all"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (name.trim()) {
                      setLoading(true);
                      await duo.createSession(name);
                      setLoading(false);
                    }
                  }}
                  disabled={!name.trim() || loading}
                  className="w-full py-3.5 sm:py-5 rounded-full bg-sp-green text-black font-black text-sm uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 shadow-xl shadow-sp-green/20"
                >
                  {loading ? "Initializing..." : "Initiate Session"}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="join"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2.5 block ml-1">
                      Identity
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-4 text-white placeholder-white/10 focus:outline-none focus:border-sp-green/40 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2.5 block ml-1">
                      Room Code
                    </label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase())
                      }
                      placeholder="CODE"
                      maxLength={6}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-4 text-white placeholder-white/10 focus:outline-none focus:border-sp-green/40 transition-all font-mono tracking-[0.3em] font-black text-center"
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (name.trim() && joinCode.length >= 4) {
                      setLoading(true);
                      await duo.joinSession(joinCode, name);
                      setLoading(false);
                    }
                  }}
                  className="w-full py-3.5 sm:py-5 rounded-full bg-white text-black font-black text-sm uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 shadow-xl"
                  disabled={!name.trim() || joinCode.length < 4 || loading}
                >
                  {loading ? "Joining..." : "Join Session"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* Features Footer */}
        <div className="flex justify-center gap-4 sm:gap-8 opacity-40">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ShieldCheck size={12} className="text-white" />
            <span className="text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-widest">
              End-to-End Sync
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Sparkles size={12} className="text-white" />
            <span className="text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-widest">
              Premium Bitrate
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
