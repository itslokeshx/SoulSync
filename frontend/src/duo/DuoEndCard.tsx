import { X, Music, Clock, Heart } from "lucide-react";
import { useDuoStore } from "./duoStore";

export function DuoEndCard() {
  const { endCardOpen, setEndCardOpen, songHistory, partnerName, fullReset } =
    useDuoStore();

  if (!endCardOpen) return null;

  const uniqueSongs = [
    ...new Map(songHistory.map((s: any) => [s.id, s])).values(),
  ];
  const totalMinutes =
    songHistory.length > 1
      ? Math.round(
          (songHistory[songHistory.length - 1].at - songHistory[0].at) / 60_000,
        )
      : 0;

  const close = () => {
    setEndCardOpen(false);
    fullReset();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden animate-scaleIn"
        style={{
          background: "linear-gradient(180deg, #1a2a1f 0%, #0e0e0e 60%)",
          boxShadow:
            "0 40px 100px rgba(0,0,0,0.6), 0 0 80px rgba(29,185,84,0.08)",
          border: "1px solid rgba(29,185,84,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 text-white/30 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-all"
        >
          <X size={16} />
        </button>

        <div className="px-8 pt-10 pb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-sp-green/10 mb-5">
            <Heart size={32} className="text-sp-green fill-sp-green" />
          </div>
          <h2 className="text-2xl font-black text-white mb-1">
            SoulLink Complete
          </h2>
          <p className="text-sp-sub/60 text-sm mb-8">
            {partnerName ? `with ${partnerName}` : "Great listening session!"}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="py-4 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.04]">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <Music size={14} className="text-sp-green" />
                <span className="text-2xl font-black text-white">
                  {uniqueSongs.length}
                </span>
              </div>
              <p className="text-[11px] text-sp-sub/50">Songs Played</p>
            </div>
            <div className="py-4 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.04]">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <Clock size={14} className="text-sp-green" />
                <span className="text-2xl font-black text-white">
                  {totalMinutes || "<1"}
                </span>
              </div>
              <p className="text-[11px] text-sp-sub/50">Minutes Together</p>
            </div>
          </div>

          {uniqueSongs.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-semibold text-sp-sub/40 uppercase tracking-widest mb-3">
                Songs Shared
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto hide-scrollbar">
                {uniqueSongs.slice(0, 10).map((s: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.03]"
                  >
                    <span className="text-[10px] text-sp-sub/30 w-4">
                      {i + 1}
                    </span>
                    <span className="text-[12px] text-white/70 truncate flex-1">
                      {s.name}
                    </span>
                  </div>
                ))}
                {uniqueSongs.length > 10 && (
                  <p className="text-[11px] text-sp-sub/30 mt-1">
                    +{uniqueSongs.length - 10} more
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={close}
            className="w-full py-3 rounded-xl bg-sp-green hover:bg-sp-green-light text-black font-bold text-[14px] transition-all duration-200 hover:scale-[1.02] active:scale-100"
            style={{ boxShadow: "0 4px 24px rgba(29,185,84,0.3)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
