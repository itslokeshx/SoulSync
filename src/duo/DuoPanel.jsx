// ─────────────────────────────────────────────────────────────────────────────
// DuoPanel — Side panel with WhatsApp-style chat & song history
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Send,
  Music,
  Clock,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { useDuoStore } from "./duoStore.js";

export function DuoPanel({ onSendMessage, onEndSession }) {
  const {
    panelOpen,
    setPanelOpen,
    roomCode,
    myName,
    partnerName,
    partnerConnected,
    role,
    songHistory,
    messages,
  } = useDuoStore();
  const [msgText, setMsgText] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("chat"); // "chat" | "history"
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  if (!panelOpen) return null;

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (!msgText.trim()) return;
    onSendMessage(msgText.trim());
    setMsgText("");
  };

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div
      className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-20 md:w-80 z-[45] flex flex-col animate-slideInRight md:border-l border-white/[0.06]"
      style={{
        background: "rgba(10,10,10,0.98)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-white/[0.04] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center">
              <Music size={14} className="text-black" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${partnerConnected ? "bg-sp-green" : "bg-amber-400"}`}
            />
          </div>
          <div>
            <h3 className="font-semibold text-white text-[13px]">SoulLink</h3>
            <p className="text-[10px] text-sp-sub/50">
              {partnerConnected
                ? `with ${partnerName}`
                : "Waiting for partner…"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="text-white/30 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      {/* Room code — compact row */}
      <div className="px-4 md:px-5 py-2.5 md:py-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <p className="text-[10px] text-sp-sub/40 uppercase tracking-widest font-semibold">
              Room
            </p>
            <p className="text-base md:text-lg font-bold text-sp-green tracking-[0.15em] font-mono">
              {roomCode}
            </p>
          </div>
          <button
            onClick={copyCode}
            className="p-2 rounded-lg hover:bg-white/[0.06] text-sp-sub/40 hover:text-sp-green transition-all"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-0.5 mx-4 md:mx-5 mt-2.5 md:mt-3 mb-2 p-0.5 rounded-lg bg-white/[0.03]">
        {[
          { id: "chat", label: "Chat", Icon: MessageCircle },
          { id: "history", label: "History", Icon: Clock },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === id
                ? "bg-white/[0.08] text-white"
                : "text-sp-sub/50 hover:text-white"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-3 flex flex-col">
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto hide-scrollbar space-y-1.5 pb-2">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-40">
                  <MessageCircle size={28} className="text-sp-sub/30 mb-3" />
                  <p className="text-[12px] text-sp-sub/50 font-medium">
                    No messages yet
                  </p>
                  <p className="text-[10px] text-sp-sub/30 mt-1">
                    Say hi to your partner! 👋
                  </p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.from === role;
                  // Check if we should show timestamp (first message or 5+ min gap)
                  const prevMsg = i > 0 ? messages[i - 1] : null;
                  const showTime = !prevMsg || m.at - prevMsg.at > 300000;

                  return (
                    <div key={i}>
                      {showTime && (
                        <div className="flex justify-center my-3">
                          <span className="text-[9px] text-sp-sub/30 bg-white/[0.03] px-3 py-1 rounded-full">
                            {formatTime(m.at)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`relative max-w-[80%] px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed ${
                            isMe
                              ? "bg-sp-green/20 text-sp-green rounded-br-md"
                              : "bg-white/[0.06] text-white/85 rounded-bl-md"
                          }`}
                        >
                          {!isMe && (
                            <p className="text-[9px] font-semibold text-sp-green/60 mb-0.5">
                              {m.fromName || partnerName}
                            </p>
                          )}
                          <p className="break-words">{m.text}</p>
                          <p
                            className={`text-[8px] mt-1 ${isMe ? "text-sp-green/40 text-right" : "text-white/20"}`}
                          >
                            {formatTime(m.at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Message input — always at bottom */}
            <div className="flex gap-2 pt-2 border-t border-white/[0.04] mt-auto">
              <input
                type="text"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Type a message…"
                maxLength={300}
                className="flex-1 px-3.5 py-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.06] text-white text-[13px] placeholder-white/20 outline-none focus:border-sp-green/30 transition-all"
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button
                onClick={handleSend}
                disabled={!msgText.trim()}
                className="p-2.5 rounded-2xl bg-sp-green/15 text-sp-green hover:bg-sp-green/25 transition-all disabled:opacity-20 flex-shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-1">
            {songHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-40">
                <Music size={28} className="text-sp-sub/30 mb-3" />
                <p className="text-[12px] text-sp-sub/50 font-medium">
                  No songs played yet
                </p>
                <p className="text-[10px] text-sp-sub/30 mt-1">
                  Songs you listen to together appear here
                </p>
              </div>
            ) : (
              [...songHistory].reverse().map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-all"
                >
                  <Clock size={12} className="text-sp-sub/30 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-white/70 truncate">
                      {s.name}
                    </p>
                    <p className="text-[10px] text-sp-sub/30">
                      {formatTime(s.at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer: End session */}
      <div className="px-4 md:px-5 py-3 border-t border-white/[0.04] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          onClick={onEndSession}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[12px] font-semibold transition-all"
        >
          <LogOut size={13} />
          End SoulLink
        </button>
      </div>
    </div>
  );
}
