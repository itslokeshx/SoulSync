import { useState, useEffect, useRef, useCallback } from "react";
import { X, GripVertical, Trash2, Plus } from "lucide-react";
import { EqBars } from "../ui/EqBars";
import { bestImg, getArtists, fmt, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";
import { usePlayerStore } from "../../store/playerStore";
import { useQueueStore } from "../../store/queueStore";
import { getAutoplaySongs } from "../../api/backend";
import { ArtistLinks } from "../ui/ArtistLinks";

interface QueuePanelProps {
  queue: any[];
  queueIndex: number;
  currentSong: any;
  onClose: () => void;
  onJump: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}

export const QueuePanel = ({
  queue,
  queueIndex,
  currentSong,
  onClose,
  onJump,
  onMove,
  onRemove,
}: QueuePanelProps) => {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);

  // Split queue into played, current, and upcoming
  const played = queue.slice(0, queueIndex);
  const upcoming = queue.slice(queueIndex + 1);

  // Scroll to the currently playing song when the panel opens or song changes
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [queueIndex, currentSong?.id]);

  // ── Autoplay preview ─────────────────────────────────────────────
  const { autoplay } = usePlayerStore();
  const { addLast } = useQueueStore();
  const [autoplaySongs, setAutoplaySongs] = useState<any[]>([]);
  const [autoplayLoading, setAutoplayLoading] = useState(false);
  const [autoplayFilter, setAutoplayFilter] = useState<"similar" | "popular" | "discover">("similar");

  useEffect(() => {
    if (!autoplay || !currentSong?.id || currentSong?._isOffline) {
      setAutoplaySongs([]);
      return;
    }
    let cancelled = false;
    setAutoplayLoading(true);
    const queueIds = queue.map((s: any) => s.id).filter(Boolean);
    getAutoplaySongs(currentSong.id, autoplayFilter, queueIds)
      .then((data) => {
        if (cancelled) return;
        const inQueue = new Set(queue.map((s: any) => s.id));
        setAutoplaySongs(
          (data.songs ?? []).filter((s: any) => !inQueue.has(s.id)),
        );
      })
      .catch(() => !cancelled && setAutoplaySongs([]))
      .finally(() => !cancelled && setAutoplayLoading(false));
    return () => { cancelled = true; };
  }, [currentSong?.id, autoplay, autoplayFilter, queue]);

  // Drag handlers operate on upcoming items only (relative index in upcoming array)
  const toAbsolute = (relIdx: number) => queueIndex + 1 + relIdx;

  const handleDragStart = useCallback((e: React.DragEvent, relIdx: number) => {
    setDragIdx(relIdx);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = "move";
    // ghost image
    const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
    ghost.style.opacity = "0.6";
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 20);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, relIdx: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIdx !== null && relIdx !== dragIdx) setOverIdx(relIdx);
    },
    [dragIdx],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, relIdx: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== relIdx) {
        onMove(toAbsolute(dragIdx), toAbsolute(relIdx));
      }
      setDragIdx(null);
      setOverIdx(null);
    },
    [dragIdx, onMove, queueIndex], // eslint-disable-line
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  return (
    <div
      className="fixed right-0 top-0 bottom-[7.5rem] md:bottom-20 w-full md:w-72 z-40 flex flex-col animate-slideInRight border-l border-white/[0.06]"
      style={{
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(24px)",
      }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <h3 className="font-semibold text-white text-[13px]">Queue</h3>
        <span className="text-[10px] text-white/25 tabular-nums mr-auto ml-2">
          {queue.length} {queue.length === 1 ? "song" : "songs"}
        </span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {/* ── Played songs section ── */}
        {played.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest px-5 py-3">
              Played · {played.length}
            </p>
            {played.map((s, i) => (
              <button
                key={`played-${s.id}-${i}`}
                onClick={() => onJump(i)}
                className="flex items-center gap-3 px-5 pr-3 py-2 mx-2 rounded-xl hover:bg-white/[0.04] transition-all w-[calc(100%-1rem)] text-left opacity-40 hover:opacity-70"
              >
                <span className="text-[10px] text-white/20 tabular-nums w-5 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <img
                  src={bestImg(s.image, "50x50") || FALLBACK_IMG}
                  onError={onImgErr}
                  className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white/70 truncate">{s.name}</p>
                  <p className="text-[11px] text-white/30 truncate">
                    <ArtistLinks song={s} />
                  </p>
                </div>
                <span className="text-[10px] text-white/15 tabular-nums flex-shrink-0">
                  {fmt(s.duration)}
                </span>
              </button>
            ))}
          </>
        )}

        {/* ── Now Playing ── */}
        {currentSong && (
          <div ref={currentRef}>
            <p className="text-[10px] font-semibold text-sp-green uppercase tracking-[0.15em] px-5 py-3">
              Now Playing
            </p>
            <div className="flex items-center gap-3 px-5 pr-3 py-2.5 mx-2 rounded-xl bg-sp-green/[0.08] border border-sp-green/15">
              <img
                src={bestImg(currentSong.image, "50x50") || FALLBACK_IMG}
                onError={onImgErr}
                className="w-10 h-10 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-sp-green truncate">
                  {currentSong.name}
                </p>
                <p className="text-[11px] text-sp-sub/60 truncate">
                  <ArtistLinks song={currentSong} />
                </p>
              </div>
              <EqBars />
            </div>
          </div>
        )}

        {/* ── Next Up section ── */}
        <p className="text-[10px] font-bold text-sp-muted uppercase tracking-widest px-5 py-3">
          Next Up · {upcoming.length} songs
        </p>
        {upcoming.length === 0 && (
          <p className="text-sp-muted text-sm px-5 py-4 text-center">
            Nothing in queue
          </p>
        )}
        {upcoming.map((s, i) => {
          const isDragging = dragIdx === i;
          const isOver = overIdx === i;
          return (
            <div
              key={`${s.id}-${i}`}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 px-3 pr-2 py-2 mx-2 rounded-xl transition-all duration-150 group cursor-default select-none ${
                isDragging
                  ? "opacity-30 scale-95"
                  : isOver
                    ? "bg-sp-green/10 border border-sp-green/20"
                    : "hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              {/* Drag handle */}
              <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 transition-colors touch-none">
                <GripVertical size={14} />
              </div>

              {/* Song thumbnail + info (clickable to jump) */}
              <button
                onClick={() => onJump(toAbsolute(i))}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <img
                  src={bestImg(s.image, "50x50") || FALLBACK_IMG}
                  onError={onImgErr}
                  className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white truncate">{s.name}</p>
                  <p className="text-[11px] text-sp-sub/50 truncate">
                    <ArtistLinks song={s} />
                  </p>
                </div>
              </button>

              {/* Duration + remove */}
              <span className="text-[10px] text-white/20 tabular-nums flex-shrink-0">
                {fmt(s.duration)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(toAbsolute(i));
                }}
                className="p-1 rounded-lg text-white/15 hover:text-red-400 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                title="Remove from queue"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {/* ── Autoplay preview section ── */}
        {autoplay && (
          <div className="mt-1 border-t border-white/[0.04]">
            <p className="text-[10px] font-bold text-sp-muted uppercase tracking-widest px-5 py-3">
              Up next · Autoplay
            </p>
            <div className="flex gap-1.5 px-5 pb-2 overflow-x-auto thin-scrollbar">
              {[
                { id: "similar", label: "Similar" },
                { id: "popular", label: "Popular" },
                { id: "discover", label: "Discover New" },
              ].map((chip) => {
                const active = autoplayFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setAutoplayFilter(chip.id as any)}
                    className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-150 ${
                      active
                        ? "bg-white text-black"
                        : "bg-white/[0.04] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            {autoplayLoading && (
              <p className="text-sp-muted text-xs px-5 py-2 text-center opacity-50">
                Loading…
              </p>
            )}
            {autoplaySongs.map((s, i) => (
              <div
                key={`ap-${s.id}-${i}`}
                className="flex items-center gap-2 px-3 pr-2 py-2 mx-2 rounded-xl hover:bg-white/[0.04] group"
              >
                <img
                  src={bestImg(s.image, "50x50") || FALLBACK_IMG}
                  onError={onImgErr}
                  className="w-9 h-9 rounded-xl object-cover flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white/60 group-hover:text-white/90 truncate transition-colors">
                    {s.name}
                  </p>
                  <p className="text-[11px] text-sp-sub/40 truncate">
                    <ArtistLinks song={s} />
                  </p>
                </div>
                <span className="text-[10px] text-white/15 tabular-nums flex-shrink-0">
                  {fmt(s.duration)}
                </span>
                <button
                  onClick={() => addLast(s)}
                  className="p-1 rounded-lg text-white/15 hover:text-sp-green hover:bg-sp-green/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Add to queue"
                >
                  <Plus size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
