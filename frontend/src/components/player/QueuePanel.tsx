import { useState, useRef, useCallback } from "react";
import {
  X,
  GripVertical,
  Trash2,
  Infinity,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { EqBars } from "../ui/EqBars";
import { bestImg, getArtists, fmt, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";
import { useQueueStore } from "../../store/queueStore";

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const past = queue.slice(0, Math.max(queueIndex, 0));
  const activeSong = queue[queueIndex] || currentSong;
  const upcoming = queue.slice(queueIndex + 1);

  const { autoplay, setAutoplay } = useQueueStore();

  const handleDragStart = useCallback((e: React.DragEvent, relIdx: number) => {
    setDragIdx(relIdx);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = "move";
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
        onMove(queueIndex + 1 + dragIdx, queueIndex + 1 + relIdx);
      }
      setDragIdx(null);
      setOverIdx(null);
    },
    [dragIdx, onMove, queueIndex],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  const renderSong = (
    song: any,
    absoluteIndex: number,
    options: {
      dimmed?: boolean;
      current?: boolean;
      draggable?: boolean;
      relIdx?: number;
    } = {},
  ) => {
    const isDragging = options.relIdx !== undefined && dragIdx === options.relIdx;
    const isOver = options.relIdx !== undefined && overIdx === options.relIdx;

    return (
      <div
        key={`${song.id}-${absoluteIndex}`}
        draggable={options.draggable}
        onDragStart={
          options.draggable && options.relIdx !== undefined
            ? (e) => handleDragStart(e, options.relIdx!)
            : undefined
        }
        onDragOver={
          options.draggable && options.relIdx !== undefined
            ? (e) => handleDragOver(e, options.relIdx!)
            : undefined
        }
        onDrop={
          options.draggable && options.relIdx !== undefined
            ? (e) => handleDrop(e, options.relIdx!)
            : undefined
        }
        onDragEnd={options.draggable ? handleDragEnd : undefined}
        className={`flex items-center gap-2 px-3 pr-2 py-2 mx-2 rounded-xl transition-all duration-150 group cursor-default select-none ${
          options.current
            ? "bg-sp-green/10 border-l-2 border-sp-green"
            : isDragging
              ? "opacity-30 scale-95"
              : isOver
                ? "bg-sp-green/10 border border-sp-green/20"
                : "hover:bg-white/[0.04] border border-transparent"
        } ${options.dimmed ? "opacity-40 hover:opacity-70" : ""}`}
      >
        {options.draggable ? (
          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 transition-colors touch-none">
            <GripVertical size={14} />
          </div>
        ) : (
          <div className="w-[14px] flex-shrink-0" />
        )}

        <button
          onClick={() => onJump(absoluteIndex)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <img
            src={bestImg(song.image, "50x50") || FALLBACK_IMG}
            onError={onImgErr}
            className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p
              className={`text-[13px] truncate ${
                options.current ? "text-sp-green font-semibold" : "text-white"
              }`}
            >
              {song.name}
            </p>
            <p className="text-[11px] text-sp-sub/50 truncate">
              {getArtists(song)}
            </p>
          </div>
        </button>

        {options.current && <EqBars />}
        <span className="text-[10px] text-white/20 tabular-nums flex-shrink-0">
          {fmt(song.duration)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(absoluteIndex);
          }}
          className="p-1 rounded-lg text-white/15 hover:text-red-400 hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
          title="Remove from queue"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  };

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoplay(!autoplay)}
            className={`transition-colors p-1 rounded-full ${
              autoplay
                ? "text-green-400 bg-green-400/10"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            title={autoplay ? "Autoplay On" : "Autoplay Off"}
            aria-label={autoplay ? "Autoplay On" : "Autoplay Off"}
            aria-pressed={autoplay}
          >
            <Infinity size={15} />
          </button>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <button
          onClick={() => setHistoryOpen((open) => !open)}
          className="w-full flex items-center justify-between text-[10px] font-bold text-sp-muted uppercase tracking-widest px-5 py-3 hover:text-white/50 transition-colors"
        >
          <span>History · {past.length} songs</span>
          {historyOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        {historyOpen &&
          past.map((song, index) =>
            renderSong(song, index, {
              dimmed: true,
            }),
          )}

        {activeSong && (
          <div className="border-t border-white/[0.04]">
            <p className="text-[10px] font-bold text-sp-muted uppercase tracking-widest px-5 py-3">
              Now Playing
            </p>
            {renderSong(activeSong, queueIndex, { current: true })}
          </div>
        )}

        <div className="border-t border-white/[0.04] mt-2">
          <p className="text-[10px] font-bold text-sp-muted uppercase tracking-widest px-5 py-3">
            Up Next · {upcoming.length} songs
          </p>
          {upcoming.length === 0 && (
            <p className="text-sp-muted text-sm px-5 py-4 text-center">
              Nothing in queue
            </p>
          )}
          {upcoming.map((song, index) =>
            renderSong(song, queueIndex + 1 + index, {
              draggable: true,
              relIdx: index,
            }),
          )}
          {autoplay && (
            <p className="text-[10px] font-bold text-sp-green uppercase tracking-widest px-5 py-4">
              Autoplay
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
