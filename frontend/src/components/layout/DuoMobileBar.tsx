import { Music2 } from "lucide-react";
import { bestImg, getArtists, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";

interface DuoMobileBarProps {
  currentSong: any;
  onEndSession: () => void;
  onOpenPanel: () => void;
}

export const DuoMobileBar = ({
  currentSong,
  onEndSession,
  onOpenPanel,
}: DuoMobileBarProps) => {
  const img = currentSong
    ? bestImg(currentSong.image, "50x50") || FALLBACK_IMG
    : null;
  const artists = currentSong ? getArtists(currentSong) : null;

  return (
    <div
      className="fixed left-0 right-0 md:hidden z-[41] animate-fadeUp"
      style={{ bottom: "calc(3.5rem + 4rem)" }}
    >
      <div
        className="mx-2.5 rounded-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.12), rgba(10,10,10,0.97))",
          border: "1px solid rgba(29,185,84,0.25)",
          boxShadow:
            "0 -4px 24px rgba(0,0,0,0.5), 0 0 30px rgba(29,185,84,0.08)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          onClick={onOpenPanel}
          role="button"
          tabIndex={0}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 active:bg-white/[0.03] transition-colors cursor-pointer"
        >
          {currentSong ? (
            <img
              src={img!}
              onError={onImgErr}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-sp-green/15 flex items-center justify-center flex-shrink-0">
              <Music2 size={18} className="text-sp-green" />
            </div>
          )}

          <div className="flex-1 min-w-0 text-left">
            {currentSong ? (
              <>
                <p className="text-[13px] font-semibold text-white truncate leading-tight">
                  {currentSong.name}
                </p>
                <p className="text-[10px] text-white/40 truncate mt-0.5">
                  {artists}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-sp-green leading-tight">
                  SoulLink Active
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Waiting for a song…
                </p>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-sp-green/15">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-sp-green opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sp-green" />
              </span>
              <span className="text-[9px] font-bold text-sp-green tracking-wider">
                LIVE
              </span>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEndSession();
            }}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/30 transition-colors"
          >
            <span className="text-[11px] font-bold text-red-400">END</span>
          </button>
        </div>
      </div>
    </div>
  );
};
