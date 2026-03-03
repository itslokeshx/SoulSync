// ─────────────────────────────────────────────────────────────────────────────
// DuoPanel — Side panel showing Duo session info, notes, reactions
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { X, Copy, Check, Send, Music, Clock, LogOut } from "lucide-react";
import { useDuoStore } from "./duoStore.js";

export function DuoPanel({
  onSendReaction,
  onSendNote,
  onSendMoodMode,
  onEndSession,
}) {
  const {
    panelOpen,
    setPanelOpen,
    roomCode,
    myName,
    partnerName,
    partnerConnected,
    role,
    songHistory,
    notes,
    moodMode,
  } = useDuoStore();
  const [noteText, setNoteText] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("reactions"); // "reactions" | "notes" | "history"

  if (!panelOpen) return null;

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendNote = () => {
    if (!noteText.trim()) return;
    onSendNote(noteText.trim());
    setNoteText("");
  };

  const REACTION_EMOJIS = [
    "❤️",
    "🔥",
    "😍",
    "🎵",
    "💃",
    "🤘",
    "👏",
    "😭",
    "🥺",
    "✨",
    "💜",
    "⚡",
  ];

  const MOODS = [
    { id: "chill", label: "Chill", emoji: "🌙" },
    { id: "hype", label: "Hype", emoji: "⚡" },
    { id: "sad", label: "Sad", emoji: "🥺" },
    { id: "romantic", label: "Romantic", emoji: "💕" },
  ];

  return (
    <div
      className="fixed right-0 top-0 bottom-[7.5rem] md:bottom-20 w-full md:w-80 z-40 flex flex-col animate-slideInRight border-l border-white/[0.06]"
      style={{
        background: "rgba(10,10,10,0.97)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center">
              <Music size={14} className="text-black" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sp-black ${partnerConnected ? "bg-sp-green" : "bg-amber-400"}`}
            />
          </div>
          <div>
            <h3 className="font-semibold text-white text-[13px]">Duo Live</h3>
            <p className="text-[10px] text-sp-sub/50">
              {partnerConnected
                ? `with ${partnerName}`
                : "Waiting for partner…"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="text-white/30 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
        >
          <X size={15} />
        </button>
      </div>

      {/* Room code */}
      <div className="px-5 py-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-sp-sub/40 uppercase tracking-widest font-semibold">
              Room Code
            </p>
            <p className="text-lg font-bold text-sp-green tracking-[0.15em] font-mono">
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

      {/* Mood Mode */}
      <div className="px-5 py-3 border-b border-white/[0.04]">
        <p className="text-[10px] text-sp-sub/40 uppercase tracking-widest font-semibold mb-2">
          Mood
        </p>
        <div className="flex gap-1.5">
          {MOODS.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => onSendMoodMode(moodMode === id ? null : id)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                moodMode === id
                  ? "bg-sp-green/20 text-sp-green border border-sp-green/30"
                  : "bg-white/[0.04] text-sp-sub/60 hover:text-white hover:bg-white/[0.08] border border-transparent"
              }`}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-0.5 mx-5 mt-3 mb-2 p-0.5 rounded-lg bg-white/[0.03]">
        {[
          { id: "reactions", label: "React" },
          { id: "notes", label: "Notes" },
          { id: "history", label: "History" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === id
                ? "bg-white/[0.08] text-white"
                : "text-sp-sub/50 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 py-3">
        {activeTab === "reactions" && (
          <div className="grid grid-cols-4 gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction(emoji)}
                className="py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] hover:scale-110 active:scale-95 transition-all duration-200 text-xl"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Send a note…"
                maxLength={100}
                className="flex-1 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.06] text-white text-[13px] placeholder-white/20 outline-none focus:border-sp-green/30 transition-all"
                onKeyDown={(e) => e.key === "Enter" && sendNote()}
              />
              <button
                onClick={sendNote}
                disabled={!noteText.trim()}
                className="p-2.5 rounded-xl bg-sp-green/10 text-sp-green hover:bg-sp-green/20 transition-all disabled:opacity-20"
              >
                <Send size={14} />
              </button>
            </div>

            {notes.length === 0 ? (
              <p className="text-[12px] text-sp-sub/30 text-center py-8">
                No notes yet
              </p>
            ) : (
              <div className="space-y-2">
                {[...notes].reverse().map((n, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 rounded-xl text-[12px] ${
                      n.from === role
                        ? "bg-sp-green/10 text-sp-green ml-6"
                        : "bg-white/[0.04] text-white/80 mr-6"
                    }`}
                  >
                    <p>{n.text}</p>
                    {n.song && (
                      <p className="text-[10px] opacity-40 mt-1">♪ {n.song}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-1">
            {songHistory.length === 0 ? (
              <p className="text-[12px] text-sp-sub/30 text-center py-8">
                No songs played yet
              </p>
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
                      {new Date(s.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer: End session */}
      <div className="px-5 py-3 border-t border-white/[0.04]">
        <button
          onClick={onEndSession}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[12px] font-semibold transition-all"
        >
          <LogOut size={13} />
          End Duo Session
        </button>
      </div>
    </div>
  );
}
