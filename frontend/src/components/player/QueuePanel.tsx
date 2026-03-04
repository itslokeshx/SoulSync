import { useState, useRef, useCallback } from "react";
import { X, GripVertical, Trash2 } from "lucide-react";
import { EqBars } from "../ui/EqBars";
import { bestImg, getArtists, fmt, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";

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

  // "Next Up" items start after queueIndex
  const upcoming = queue.slice(queueIndex + 1);

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
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
        >
          <X size={15} />
        </button>
      </div>

      {currentSong && (
        <div className="px-5 py-3 border-b border-white/[0.04]">
          <p className="text-[10px] font-semibold text-sp-green uppercase tracking-[0.15em] mb-2">
            Now Playing
          </p>
          <div className="flex items-center gap-3">
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
                {getArtists(currentSong)}
              </p>
            </div>
            <EqBars />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto hide-scrollbar">
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
                    {getArtists(s)}
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
      </div>
    </div>
  );
};
