import { Skeleton } from "../ui/Skeleton";
import { SongCard } from "./SongCard";
import { AlbumCard } from "./AlbumCard";

interface HSectionProps {
  title: string;
  subtitle?: string;
  icon?: string;
  songs?: any[];
  albums?: any[];
  loading?: boolean;
  currentSong: any;
  isPlaying: boolean;
  // eslint-disable-next-line no-unused-vars
  onPlay: (song: any, queue: any[]) => void;
  // eslint-disable-next-line no-unused-vars
  onAlbumClick?: (album: any) => void;
  onSeeAll?: () => void;
}

export const HSection = ({
  title,
  subtitle,
  icon,
  songs = [],
  albums = [],
  loading,
  currentSong,
  isPlaying,
  onPlay,
  onAlbumClick,
  onSeeAll,
}: HSectionProps) => (
  <div className="mb-12">
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="text-lg w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04]">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-white/40 mt-1 font-normal">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="text-[11px] font-semibold text-sp-sub hover:text-sp-green tracking-wider uppercase transition-colors duration-200 px-3 py-1.5 rounded-full hover:bg-sp-green/10"
        >
          See all
        </button>
      )}
    </div>
    <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-3 -mx-1 px-1">
      {loading
        ? Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-44 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
            >
              <Skeleton className="w-full aspect-square mb-3 rounded-xl" />
              <Skeleton className="h-3 w-4/5 mb-2 rounded-md" />
              <Skeleton className="h-2.5 w-1/2 rounded-md" />
            </div>
          ))
        : songs.length > 0
          ? songs.map((s, idx) => (
              <SongCard
                key={`${s.id}-${idx}`}
                song={s}
                isCurrent={currentSong?.id === s.id}
                isPlaying={isPlaying}
                onPlay={() => onPlay(s, songs)}
              />
            ))
          : albums.map((a, idx) => (
              <AlbumCard
                key={`${a.id}-${idx}`}
                album={a}
                onClick={() => onAlbumClick?.(a)}
              />
            ))}
    </div>
  </div>
);
