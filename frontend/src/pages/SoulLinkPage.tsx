import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Headphones,
  Copy,
  Check,
  ArrowLeft,
  WifiOff,
  Radio,
  Send,
  Link2,
  Zap,
  Music2,
  Play,
  MessageCircle,
  Shield,
  Smartphone,
  UserPlus,
  Hash,
  ChevronRight,
  LogOut,
  Volume2,
} from "lucide-react";
import { useDuoStore } from "../duo/duoStore";
import { useNetwork } from "../providers/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { usePlayer } from "../providers/PlayerProvider";
import toast from "react-hot-toast";

// ── Animated background ─────────────────────────────────────────────
const SoulLinkBG = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-[#060608]" />
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.07, 0.12, 0.07] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-sp-green/30 blur-[120px]"
    />
    <motion.div
      animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.1, 0.05] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[120px]"
    />
    <motion.div
      animate={{ scale: [1, 1.15, 1], opacity: [0.03, 0.06, 0.03] }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-purple-500/20 blur-[100px]"
    />
  </div>
);

// ── Pulse ring for connection status ────────────────────────────────
const StatusPulse = ({ connected }: { connected: boolean }) => (
  <span className="relative flex h-2.5 w-2.5">
    <span
      className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? "bg-sp-green animate-ping" : "bg-amber-400 animate-pulse"}`}
      style={{ animationDuration: "2s" }}
    />
    <span
      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? "bg-sp-green" : "bg-amber-400"}`}
    />
  </span>
);

// ── Feature card for landing ────────────────────────────────────────
const FeatureChip = ({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
    <Icon size={14} className="text-sp-green flex-shrink-0" />
    <span className="text-[11px] sm:text-xs text-white/50 font-medium whitespace-nowrap">
      {label}
    </span>
  </div>
);

// ── Step indicator ──────────────────────────────────────────────────
const Step = ({
  num,
  title,
  desc,
  active,
}: {
  num: number;
  title: string;
  desc: string;
  active: boolean;
}) => (
  <div className={`flex gap-3 items-start transition-opacity ${active ? "opacity-100" : "opacity-30"}`}>
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
        active
          ? "bg-sp-green text-black"
          : "bg-white/[0.06] text-white/40"
      }`}
    >
      {num}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-semibold text-white leading-tight">{title}</p>
      <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════
// ── PAGE COMPONENT ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
export default function SoulLinkPage() {
  const navigate = useNavigate();
  const { isOnline } = useNetwork();
  const { user } = useAuth();
  const { duo } = usePlayer();
  const { active, partnerConnected, partnerName, roomCode, myName, role } =
    useDuoStore();

  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState(user?.name || "");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messageText, setMessageText] = useState("");

  const { messages } = useDuoStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (partnerConnected) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, partnerConnected]);

  const copyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Offline state ──────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="min-h-dvh bg-[#060608] flex flex-col items-center justify-center p-6 text-center relative">
        <SoulLinkBG />
        <div className="relative z-10 max-w-sm w-full">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5 mx-auto border border-amber-500/20">
            <WifiOff size={28} className="text-amber-500/60" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">You're Offline</h2>
          <p className="text-white/35 text-sm mb-6">
            SoulLink needs an internet connection to sync music with your partner.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3.5 rounded-2xl bg-white/[0.06] text-white font-semibold hover:bg-white/[0.1] transition-all active:scale-[0.98]"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // ── ACTIVE SESSION VIEW ─────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════
  if (active && roomCode) {
    return (
      <div className="min-h-dvh relative">
        <SoulLinkBG />

        {/* Top bar */}
        <div className="sticky top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
            >
              <ArrowLeft size={16} className="text-white/70" />
            </button>

            <div className="flex items-center gap-2">
              <StatusPulse connected={partnerConnected} />
              <span className="text-xs font-medium text-white/50">
                {partnerConnected ? "Synced" : "Waiting…"}
              </span>
            </div>

            <button
              onClick={duo.endSession}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-medium"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">End</span>
            </button>
          </div>
        </div>

        <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-6 pb-6">
          {/* Session header */}
          <div className="text-center pt-4 sm:pt-8 pb-4 sm:pb-6">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3">
              {/* Animated rings */}
              {partnerConnected && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full border border-sp-green/30"
                  />
                  <motion.div
                    animate={{ scale: [1, 2.2], opacity: [0.2, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
                    className="absolute inset-0 rounded-full border border-sp-green/20"
                  />
                </>
              )}
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-sp-green/20 to-sp-green/5 border border-sp-green/20 flex items-center justify-center">
                {partnerConnected ? (
                  <Headphones size={22} className="text-sp-green" />
                ) : (
                  <Radio size={22} className="text-sp-green animate-pulse" />
                )}
              </div>
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-white">
              {partnerConnected ? (
                <>
                  Linked with{" "}
                  <span className="text-sp-green">{partnerName}</span>
                </>
              ) : (
                "Waiting for Partner"
              )}
            </h1>
            <p className="text-white/30 text-xs sm:text-sm mt-1">
              {partnerConnected
                ? "Every beat, perfectly synced"
                : "Share your room code to start listening together"}
            </p>
          </div>

          {/* Room code card */}
          <div className="glass rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-[0.2em] mb-1">
                  Room Code
                </p>
                <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-[0.25em]">
                  {roomCode}
                </p>
              </div>
              <button
                onClick={copyCode}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                  copied
                    ? "bg-sp-green/20 text-sp-green"
                    : "bg-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.1]"
                }`}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-sp-green text-black font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-sp-green/20"
            >
              <Play size={16} fill="black" />
              Play Music
            </button>
            <button
              onClick={copyCode}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl glass text-white/70 font-medium text-sm hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <Link2 size={16} />
              Share Code
            </button>
          </div>

          {/* Connection info */}
          <div className="glass rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-9 h-9 rounded-full bg-sp-green/20 border-2 border-[#0a0a0a] flex items-center justify-center">
                  <span className="text-xs font-bold text-sp-green">
                    {myName?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
                <div
                  className={`w-9 h-9 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center ${
                    partnerConnected
                      ? "bg-indigo-500/20"
                      : "bg-white/[0.04] border-dashed border-white/10"
                  }`}
                >
                  {partnerConnected ? (
                    <span className="text-xs font-bold text-indigo-400">
                      {partnerName?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  ) : (
                    <UserPlus size={12} className="text-white/20" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {myName}
                  {partnerConnected ? ` & ${partnerName}` : ""}
                </p>
                <p className="text-[11px] text-white/30">
                  {role === "host" ? "Host" : "Guest"} •{" "}
                  {partnerConnected ? "Both connected" : "Waiting for partner…"}
                </p>
              </div>
              <div
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  partnerConnected
                    ? "bg-sp-green/10 text-sp-green"
                    : "bg-amber-400/10 text-amber-400"
                }`}
              >
                {partnerConnected ? "Live" : "Pending"}
              </div>
            </div>
          </div>

          {/* Chat section */}
          <AnimatePresence>
            {partnerConnected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="glass rounded-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
                  <MessageCircle size={14} className="text-white/30" />
                  <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    Chat
                  </span>
                  {messages.length > 0 && (
                    <span className="ml-auto text-[10px] text-white/20 font-medium">
                      {messages.length} messages
                    </span>
                  )}
                </div>

                <div className="min-h-[120px] max-h-[35vh] overflow-y-auto p-3 space-y-2 thin-scrollbar">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-white/15">
                      <MessageCircle size={20} className="mb-2" />
                      <span className="text-xs">No messages yet</span>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${m.from === role ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`px-3 py-2 rounded-2xl text-[13px] max-w-[80%] ${
                          m.from === role
                            ? "bg-sp-green text-black font-semibold rounded-br-md"
                            : "bg-white/[0.06] text-white/80 rounded-bl-md"
                        }`}
                      >
                        {m.text}
                      </div>
                      <span className="text-[9px] text-white/15 mt-0.5 px-1 font-medium">
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
                  className="p-2 border-t border-white/[0.04]"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Say something…"
                      className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 text-white placeholder-white/15 focus:outline-none focus:border-sp-green/30 focus:bg-white/[0.06] transition-all text-sm"
                    />
                    <button
                      type="submit"
                      disabled={!messageText.trim()}
                      className="w-10 h-10 rounded-xl bg-sp-green flex items-center justify-center text-black hover:scale-105 active:scale-90 transition-all disabled:opacity-30 disabled:hover:scale-100 flex-shrink-0"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // ── LANDING / CREATE / JOIN VIEW ─────────────────────────────────
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-dvh relative">
      <SoulLinkBG />

      {/* Back */}
      <div className="sticky top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        >
          <ArrowLeft size={16} className="text-white/70" />
        </button>
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 sm:px-6 pb-10">
        {/* Hero */}
        <div className="text-center pt-4 sm:pt-6 pb-6 sm:pb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-sp-green/30"
          >
            <Zap size={24} className="text-black fill-black" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight"
          >
            Soul<span className="text-sp-green">Link</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/35 text-sm sm:text-base max-w-xs mx-auto leading-relaxed"
          >
            Listen to music together in perfect sync, no matter the distance.
          </motion.p>
        </div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-3 px-1">
            <Zap size={12} className="text-sp-green" />
            <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em]">
              How it works
            </span>
          </div>
          <div className="glass rounded-2xl p-4 space-y-3">
            <Step
              num={1}
              title="Create or Join"
              desc="One person creates a room, the other joins with the code"
              active={true}
            />
            <Step
              num={2}
              title="Play any song"
              desc="Search and play — it syncs automatically for both"
              active={true}
            />
            <Step
              num={3}
              title="Enjoy together"
              desc="Play, pause, skip — everything stays perfectly in sync"
              active={true}
            />
          </div>
        </motion.div>

        {/* Feature chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap gap-2 justify-center mb-6"
        >
          <FeatureChip icon={Volume2} label="Real-time sync" />
          <FeatureChip icon={Shield} label="Private rooms" />
          <FeatureChip icon={Smartphone} label="Cross-device" />
          <FeatureChip icon={Music2} label="Full library" />
        </motion.div>

        {/* Create / Join tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl overflow-hidden"
        >
          {/* Tab switcher */}
          <div className="flex p-1.5 mx-4 mt-4 bg-white/[0.03] rounded-xl border border-white/[0.03]">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                tab === "create"
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              <Zap size={14} />
              Create Room
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                tab === "join"
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              <UserPlus size={14} />
              Join Room
            </button>
          </div>

          {/* Tab content */}
          <div className="p-4 pt-5">
            <AnimatePresence mode="wait">
              {tab === "create" ? (
                <motion.div
                  key="create"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em] mb-2 block px-1">
                      Your Name
                    </label>
                    <div className="relative">
                      <Users
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/15"
                      />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/15 focus:outline-none focus:border-sp-green/30 focus:bg-white/[0.06] transition-all text-sm"
                      />
                    </div>
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
                    className="w-full py-3.5 rounded-xl bg-sp-green text-black font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-20 shadow-lg shadow-sp-green/20 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                      />
                    ) : (
                      <>
                        Create Room
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-white/20 text-center leading-relaxed">
                    You'll get a 6-character code to share with your partner
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em] mb-2 block px-1">
                      Your Name
                    </label>
                    <div className="relative">
                      <Users
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/15"
                      />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/15 focus:outline-none focus:border-sp-green/30 focus:bg-white/[0.06] transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em] mb-2 block px-1">
                      Room Code
                    </label>
                    <div className="relative">
                      <Hash
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/15"
                      />
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) =>
                          setJoinCode(e.target.value.toUpperCase())
                        }
                        placeholder="Enter code"
                        maxLength={6}
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/15 focus:outline-none focus:border-sp-green/30 focus:bg-white/[0.06] transition-all text-sm font-mono tracking-[0.2em] font-bold"
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
                    disabled={!name.trim() || joinCode.length < 4 || loading}
                    className="w-full py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-20 shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                      />
                    ) : (
                      <>
                        Join Room
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-white/20 text-center leading-relaxed">
                    Ask your friend for their room code to join
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center justify-center gap-5 mt-6 opacity-30"
        >
          <div className="flex items-center gap-1.5">
            <Shield size={10} className="text-white" />
            <span className="text-[9px] font-bold text-white uppercase tracking-widest">
              Private
            </span>
          </div>
          <div className="w-0.5 h-3 bg-white/20 rounded-full" />
          <div className="flex items-center gap-1.5">
            <Zap size={10} className="text-white" />
            <span className="text-[9px] font-bold text-white uppercase tracking-widest">
              Real-time
            </span>
          </div>
          <div className="w-0.5 h-3 bg-white/20 rounded-full" />
          <div className="flex items-center gap-1.5">
            <Music2 size={10} className="text-white" />
            <span className="text-[9px] font-bold text-white uppercase tracking-widest">
              Full Sync
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
