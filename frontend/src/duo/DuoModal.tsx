import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { useDuoStore } from "./duoStore";

interface DuoModalProps {
  onCreate: (name: string) => Promise<string | null>;
  onJoin: (code: string, name: string) => Promise<boolean>;
}

export function DuoModal({ onCreate, onJoin }: DuoModalProps) {
  const { modalOpen, setModalOpen } = useDuoStore();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!modalOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const roomCode = await onCreate(name.trim());
    setLoading(false);
    if (roomCode) setCreatedCode(roomCode);
  };

  const handleJoin = async () => {
    if (!name.trim() || !code.trim()) return;
    setLoading(true);
    const ok = await onJoin(code.trim(), name.trim());
    setLoading(false);
    if (ok) {
      setModalOpen(false);
      setName("");
      setCode("");
      setCreatedCode(null);
    }
  };

  const copyCode = () => {
    if (createdCode) {
      navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const close = () => {
    setModalOpen(false);
    setCreatedCode(null);
    setName("");
    setCode("");
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/[0.08] overflow-hidden animate-scaleIn"
        style={{
          background: "linear-gradient(180deg, #1a1a1a 0%, #0e0e0e 100%)",
          boxShadow:
            "0 40px 100px rgba(0,0,0,0.6), 0 0 60px rgba(29,185,84,0.05)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">SoulLink</h2>
            <p className="text-[13px] text-sp-sub/60 mt-0.5">
              Listen together with a friend in real-time
            </p>
          </div>
          <button
            onClick={close}
            className="text-white/30 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {!createdCode && (
          <div className="flex gap-1 mx-6 mb-5 p-1 rounded-xl bg-white/[0.04]">
            {(["create", "join"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${tab === t ? "bg-sp-green text-black" : "text-sp-sub hover:text-white"}`}
              >
                {t === "create" ? "Create Room" : "Join Room"}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 pb-6">
          {createdCode ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sp-green/10 mb-4">
                <Check size={28} className="text-sp-green" />
              </div>
              <p className="text-white font-semibold mb-2">Room Created!</p>
              <p className="text-sp-sub/60 text-sm mb-5">
                Share this code with your partner
              </p>
              <div
                className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl mb-5"
                style={{
                  background: "rgba(29,185,84,0.06)",
                  border: "1px solid rgba(29,185,84,0.15)",
                }}
              >
                <span className="text-3xl font-black tracking-[0.3em] text-sp-green font-mono">
                  {createdCode}
                </span>
                <button
                  onClick={copyCode}
                  className="p-2 rounded-lg hover:bg-sp-green/10 text-sp-green transition-all"
                  title="Copy code"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-[12px] text-sp-sub/40">
                Waiting for partner to join…
              </p>
              <button
                onClick={close}
                className="mt-4 px-6 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-white text-[13px] font-semibold transition-all"
              >
                Done
              </button>
            </div>
          ) : tab === "create" ? (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-sp-sub/60 uppercase tracking-wider mb-1.5 block">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name…"
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm placeholder-white/20 outline-none focus:border-sp-green/40 transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || loading}
                className="w-full py-3 rounded-xl bg-sp-green hover:bg-sp-green-light text-black font-bold text-[14px] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-100"
                style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.3)" }}
              >
                {loading ? "Creating…" : "Create SoulLink Room"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-sp-sub/60 uppercase tracking-wider mb-1.5 block">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name…"
                  maxLength={20}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm placeholder-white/20 outline-none focus:border-sp-green/40 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-sp-sub/60 uppercase tracking-wider mb-1.5 block">
                  Room Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white text-sm placeholder-white/20 outline-none focus:border-sp-green/40 transition-all font-mono tracking-[0.2em] text-center text-lg"
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={!name.trim() || !code.trim() || loading}
                className="w-full py-3 rounded-xl bg-sp-green hover:bg-sp-green-light text-black font-bold text-[14px] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-100"
                style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.3)" }}
              >
                {loading ? "Joining…" : "Join SoulLink Room"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
