import React, { useState, useEffect, useRef } from "react";
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

// ── Background & Pulse Animation Keyframes ──────────────────────────
const bgAnimations = {
  ring1: { scale: [1, 1.2, 1], opacity: [0.07, 0.12, 0.07] },
  ring2: { scale: [1.2, 1, 1.2], opacity: [0.05, 0.1, 0.05] },
  ring3: { scale: [1, 1.15, 1], opacity: [0.03, 0.06, 0.03] },
};

const pulseAnimations = {
  ring1: { scale: [1, 1.8], opacity: [0.4, 0] },
  ring2: { scale: [1, 2.2], opacity: [0.2, 0] },
};

// ── Animated background ─────────────────────────────────────────────
const SoulLinkBG = React.memo(() => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-[#060608]" />
    <motion.div
      animate={bgAnimations.ring1}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-sp-green/30 blur-[120px]"
    />
    <motion.div
      animate={bgAnimations.ring2}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[120px]"
    />
    <motion.div
      animate={bgAnimations.ring3}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-purple-500/20 blur-[100px]"
    />
  </div>
));
SoulLinkBG.displayName = "SoulLinkBG";

// ── Pulse ring for connection status ────────────────────────────────
const StatusPulse = ({
  connected,
  warning,
}: {
  connected: boolean;
  warning?: boolean;
}) => {
  const colorClass = connected
    ? "bg-sp-green"
    : warning
      ? "bg-amber-400"
      : "bg-red-500";
  const pingClass = connected
    ? "bg-sp-green animate-ping"
    : warning
      ? "bg-amber-400 animate-pulse"
      : "bg-red-500 animate-pulse";

  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${pingClass}`}
        style={{ animationDuration: "2s" }}
      />
      <span
        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorClass}`}
      />
    </span>
  );
};

// ── Isolated Chat Input to prevent parent re-renders while typing ────
const ChatInput = ({ onSend }: { onSend: (text: string) => void }) => {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3.5 border-t border-white/[0.04] flex-shrink-0 bg-[#0c0c10]/40 flex gap-2"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-sp-green/30 focus:bg-white/[0.05] transition-all text-sm"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="w-11 h-11 rounded-xl bg-sp-green flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 flex-shrink-0"
      >
        <Send size={16} />
      </button>
    </form>
  );
};

// ── Chat Panel Component ────────────────────────────────────────────
const ChatPanel = ({
  messages,
  role,
  partnerConnected,
  partnerName,
  onSendMessage,
}: {
  messages: any[];
  role: string;
  partnerConnected: boolean;
  partnerName: string;
  onSendMessage: (text: string) => void;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col h-[480px] lg:h-[540px] w-full border border-white/[0.04] shadow-2xl">
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2 flex-shrink-0 bg-white/[0.01]">
        <MessageCircle size={16} className="text-sp-green" />
        <span className="text-xs font-bold text-white/80 uppercase tracking-wider">
          Chat Room
        </span>
        {partnerConnected && messages.length > 0 && (
          <span className="ml-auto text-[10px] text-white/30 font-medium bg-white/[0.05] px-2 py-0.5 rounded-full">
            {messages.length} messages
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3.5 thin-scrollbar flex-col flex bg-black/15">
        {!partnerConnected ? (
          <div className="flex flex-col items-center justify-center py-12 flex-1 text-center px-4">
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-14 h-14 rounded-full bg-white/[0.02] flex items-center justify-center mb-4 text-white/20 border border-white/[0.04]"
            >
              <Users size={20} />
            </motion.div>
            <p className="text-sm font-semibold text-white/70 mb-1.5">
              Chat unlocks when partner joins
            </p>
            <p className="text-xs text-white/30 max-w-xs leading-relaxed">
              Send the room code to your friend. Once they connect, you can chat in real time.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 flex-1 text-white/20 text-center">
            <MessageCircle size={22} className="mb-2 text-white/10" />
            <span className="text-xs">No messages yet. Send one to start the conversation!</span>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.from === role;
            return (
              <div
                key={`${m.at}-${m.from}-${m.text}`}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`px-4 py-2.5 rounded-2xl text-[13px] max-w-[85%] leading-relaxed ${
                    isMe
                      ? "bg-sp-green text-black font-semibold rounded-br-none shadow-md shadow-sp-green/5"
                      : "bg-white/[0.06] text-white/90 rounded-bl-none border border-white/[0.04]"
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[9px] text-white/20 mt-1 px-1 font-medium tracking-wide">
                  {isMe ? "You" : m.fromName || partnerName}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {partnerConnected && <ChatInput onSend={onSendMessage} />}
    </div>
  );
};

// ── SoulLink Hub (Consolidated Room Information Card) ────────────────
const SoulLinkHub = ({
  myName,
  partnerName,
  partnerConnected,
  roomCode,
  role,
  socketConnected,
  onCopyCode,
  onEndSession,
  onPlayMusic,
  copied,
}: {
  myName: string;
  partnerName: string;
  partnerConnected: boolean;
  roomCode: string;
  role: string;
  socketConnected: boolean;
  onCopyCode: () => void;
  onEndSession: () => void;
  onPlayMusic: () => void;
  copied: boolean;
}) => {
  return (
    <div className="glass rounded-2xl p-6 border border-white/[0.04] shadow-2xl flex flex-col gap-6 w-full h-full justify-between">
      <div className="flex flex-col gap-6">
        {/* Header Info */}
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <StatusPulse
                connected={socketConnected && partnerConnected}
                warning={socketConnected && !partnerConnected}
              />
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                {!socketConnected
                  ? "Connecting to Room"
                  : partnerConnected
                    ? "Synced Session"
                    : "Waiting Room"}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {partnerConnected ? (
                <>
                  Linked with <span className="text-sp-green">{partnerName}</span>
                </>
              ) : (
                "Waiting for Partner"
              )}
            </h2>
            <p className="text-xs text-white/40 leading-relaxed">
              {partnerConnected
                ? "Every track you play matches on both screens"
                : "Share the code to start synchronized listening"}
            </p>
          </div>

          <div className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-sp-green flex-shrink-0">
            {partnerConnected ? (
              <Headphones size={18} />
            ) : (
              <Radio size={18} className="animate-pulse" />
            )}
          </div>
        </div>

        {/* Room Code Section */}
        <div className="bg-white/[0.01] border border-white/[0.03] rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
              Room Code
            </span>
            <p className="text-2xl font-black text-white font-mono tracking-[0.25em] pl-0.5">
              {roomCode}
            </p>
          </div>
          <button
            onClick={onCopyCode}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
              copied
                ? "bg-sp-green/20 text-sp-green"
                : "bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Members Section */}
        <div className="space-y-3">
          <span className="text-[9px] font-bold text-white/25 uppercase tracking-widest block px-1">
            Listeners
          </span>
          <div className="space-y-2.5">
            {/* You */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.01] border border-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sp-green/20 border border-sp-green/30 flex items-center justify-center text-xs font-bold text-sp-green">
                  {myName?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{myName}</p>
                  <p className="text-[10px] text-white/30 capitalize">{role} (You)</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-sp-green/10 text-sp-green px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-sp-green animate-pulse" />
                Active
              </div>
            </div>

            {/* Partner */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.01] border border-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold ${
                  partnerConnected
                    ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                    : "bg-white/[0.02] border-dashed border-white/8 text-white/20"
                }`}>
                  {partnerConnected ? (
                    partnerName?.charAt(0)?.toUpperCase() || "?"
                  ) : (
                    <UserPlus size={12} />
                  )}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${partnerConnected ? "text-white" : "text-white/30"}`}>
                    {partnerConnected ? partnerName : "Pending Link..."}
                  </p>
                  <p className="text-[10px] text-white/30 capitalize">
                    {role === "host" ? "Guest" : "Host"}
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                partnerConnected
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "bg-amber-400/10 text-amber-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${partnerConnected ? "bg-indigo-400" : "bg-amber-400"}`} />
                {partnerConnected ? "Linked" : "Waiting"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-white/[0.03]">
        <button
          onClick={onPlayMusic}
          className="flex-1 py-3.5 rounded-xl bg-sp-green text-black font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-sp-green/10 flex items-center justify-center gap-2"
        >
          <Play size={15} fill="black" />
          Browse Music
        </button>
        <button
          onClick={onEndSession}
          className="px-5 py-3.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all text-sm font-bold flex items-center justify-center gap-1.5"
        >
          <LogOut size={15} />
          End
        </button>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════
// ── PAGE COMPONENT ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
export default function SoulLinkPage() {
  const navigate = useNavigate();
  const { isOnline } = useNetwork();
  const { user } = useAuth();
  const { duo } = usePlayer();
  const {
    active,
    partnerConnected,
    partnerName,
    roomCode,
    myName,
    role,
    socketConnected,
    messages,
  } = useDuoStore();

  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState(user?.name || "");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mobile navigation tab inside active session
  const [mobileTab, setMobileTab] = useState<"hub" | "chat">("hub");

  // Auto switch mobile view to Chat once partner joins
  useEffect(() => {
    if (partnerConnected) {
      setMobileTab("chat");
    } else {
      setMobileTab("hub");
    }
  }, [partnerConnected]);

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
      <div className="min-h-dvh relative flex flex-col">
        <SoulLinkBG />

        {/* Top Navigation Bar */}
        <div className="sticky top-0 z-20 px-4 pt-4 sm:px-6">
          <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
            <button
              onClick={() => navigate("/")}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-white/[0.04]"
            >
              <ArrowLeft size={16} className="text-white/70" />
            </button>

            {/* Desktop Center Status */}
            <div className="hidden sm:flex items-center gap-2 bg-[#0c0c10]/40 border border-white/[0.05] px-3.5 py-1.5 rounded-full">
              <StatusPulse
                connected={socketConnected && partnerConnected}
                warning={socketConnected && !partnerConnected}
              />
              <span className="text-xs font-semibold text-white/60">
                {!socketConnected
                  ? "Connecting to server..."
                  : partnerConnected
                    ? "Synced with partner"
                    : "Waiting for partner..."}
              </span>
            </div>

            <button
              onClick={duo.endSession}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-semibold border border-transparent hover:border-red-500/10"
            >
              <LogOut size={14} />
              <span>Disconnect</span>
            </button>
          </div>
        </div>

        {/* Main Dashboard Workspace */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col justify-center">
          
          {/* Mobile Navigation Tabs (Tab bar is hidden on Desktop) */}
          <div className="flex sm:hidden p-1.5 mb-5 bg-[#0c0c10]/55 rounded-xl border border-white/[0.03] w-full">
            <button
              onClick={() => setMobileTab("hub")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                mobileTab === "hub"
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/40"
              }`}
            >
              <Users size={13} />
              Session Hub
            </button>
            <button
              onClick={() => setMobileTab("chat")}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 relative ${
                mobileTab === "chat"
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/40"
              }`}
            >
              <MessageCircle size={13} />
              Chat Room
              {partnerConnected && messages.length > 0 && (
                <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-sp-green" />
              )}
            </button>
          </div>

          {/* Desktop & Mobile Content Layout Grid */}
          <div className="w-full">
            
            {/* Desktop view: side-by-side columns */}
            <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
              <SoulLinkHub
                myName={myName}
                partnerName={partnerName}
                partnerConnected={partnerConnected}
                roomCode={roomCode}
                role={role || ""}
                socketConnected={socketConnected}
                onCopyCode={copyCode}
                onEndSession={duo.endSession}
                onPlayMusic={() => navigate("/")}
                copied={copied}
              />
              <ChatPanel
                messages={messages}
                role={role || ""}
                partnerConnected={partnerConnected}
                partnerName={partnerName}
                onSendMessage={duo.sendMessage}
              />
            </div>

            {/* Mobile View: Dynamic screen fitting depending on selected tab */}
            <div className="sm:hidden w-full">
              <AnimatePresence mode="wait">
                {mobileTab === "hub" ? (
                  <motion.div
                    key="hub"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <SoulLinkHub
                      myName={myName}
                      partnerName={partnerName}
                      partnerConnected={partnerConnected}
                      roomCode={roomCode}
                      role={role || ""}
                      socketConnected={socketConnected}
                      onCopyCode={copyCode}
                      onEndSession={duo.endSession}
                      onPlayMusic={() => navigate("/")}
                      copied={copied}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChatPanel
                      messages={messages}
                      role={role || ""}
                      partnerConnected={partnerConnected}
                      partnerName={partnerName}
                      onSendMessage={duo.sendMessage}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // ── LANDING / CREATE / JOIN VIEW ─────────────────────────────────
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-dvh relative flex flex-col justify-center items-center p-4">
      <SoulLinkBG />

      {/* Back button */}
      <div className="absolute top-5 left-5 z-20">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-white/[0.04]"
        >
          <ArrowLeft size={18} className="text-white/70" />
        </button>
      </div>

      <div className="relative z-10 w-full max-w-[460px] flex flex-col items-center py-8">
        {/* Sleek Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center mx-auto mb-4.5 shadow-lg shadow-sp-green/20"
          >
            <Zap size={26} className="text-black fill-black" />
          </motion.div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Soul<span className="text-sp-green">Link</span>
          </h1>
          <p className="text-white/40 text-xs mt-2 max-w-[320px] mx-auto leading-relaxed">
            Listen to music together in perfect real-time sync.
          </p>
        </div>

        {/* Central Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 150, damping: 25 }}
          className="glass rounded-2xl overflow-hidden w-full border border-white/[0.06] shadow-2xl p-6 flex flex-col gap-6"
        >
          {/* Tab switcher */}
          <div className="flex p-1.5 bg-[#0c0c10]/40 rounded-xl border border-white/[0.03]">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                tab === "create"
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <Zap size={13} />
              Create Room
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                tab === "join"
                  ? "bg-white/[0.08] text-white shadow-sm"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <UserPlus size={13} />
              Join Room
            </button>
          </div>

          {/* Form Content */}
          <div className="w-full">
            <AnimatePresence mode="wait">
              {tab === "create" ? (
                <motion.div
                  key="create"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/25 uppercase tracking-widest block px-1">
                      Your Name
                    </label>
                    <div className="relative">
                      <Users
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
                      />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-sp-green/30 focus:bg-white/[0.04] transition-all text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (loading || !name.trim()) return;
                      setLoading(true);
                      try {
                        await duo.createSession(name.trim());
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={!name.trim() || loading}
                    className="w-full py-3.5 rounded-xl bg-sp-green text-black font-bold text-sm hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-20 shadow-lg shadow-sp-green/10 flex items-center justify-center gap-2"
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
                </motion.div>
              ) : (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/25 uppercase tracking-widest block px-1">
                      Your Name
                    </label>
                    <div className="relative">
                      <Users
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
                      />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-sp-green/30 focus:bg-white/[0.04] transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-white/25 uppercase tracking-widest block px-1">
                      Room Code
                    </label>
                    <div className="relative">
                      <Hash
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"
                      />
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) =>
                          setJoinCode(e.target.value.toUpperCase())
                        }
                        placeholder="6-digit code"
                        maxLength={6}
                        className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-sp-green/30 focus:bg-white/[0.04] transition-all text-sm font-mono tracking-[0.25em] font-bold"
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (loading || !name.trim() || joinCode.length < 4) return;
                      setLoading(true);
                      try {
                        await duo.joinSession(joinCode.trim(), name.trim());
                      } finally {
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer info badge */}
        <div className="mt-6">
          <p className="text-[11px] text-white/20 flex items-center gap-1.5 font-medium tracking-wide">
            <Shield size={12} className="text-white/30" /> Private & real-time audio synchronization.
          </p>
        </div>
      </div>
    </div>
  );
}
