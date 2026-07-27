import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { getDailyMix } from "../../api/backend";
import { SongCard } from "../cards/SongCard";

interface DailyMixProps {
  currentSong: any;
  isPlaying: boolean;
  onPlay: (song: any, queue: any[]) => void;
}

export const DailyMix = ({ currentSong, isPlaying, onPlay }: DailyMixProps) => {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDailyMix()
      .then((res) => {
        if (cancelled) return;
        if (res && res.success && Array.isArray(res.songs) && res.songs.length > 0) {
          setSongs(res.songs);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mb-10 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-24 h-6 rounded-lg bg-white/10" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[10.5rem] h-56 rounded-2xl bg-white/[0.04] flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (failed || !songs || songs.length === 0) {
    return (
      <div className="mb-10 p-6 rounded-3xl bg-gradient-to-r from-white/[0.04] to-white/[0.01] border border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Daily Mix is Tuning to Your Taste</h3>
            <p className="text-xs text-white/50">Listen to a few songs to unlock your custom daily mix updated every midnight</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-amber-400" />
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Daily Mix
            </h2>
          </div>
          <p className="text-white/40 text-xs mt-1">
            Your personalized mix — updated every calendar day
          </p>
        </div>
      </div>

      <div
        className="flex overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4 gap-3"
        style={{ scrollSnapType: "x proximity" }}
      >
        {songs.map((song, idx) => (
          <div key={`${song.id}-${idx}`} style={{ scrollSnapAlign: "start" }}>
            <SongCard
              song={song}
              isCurrent={currentSong?.id === song.id}
              isPlaying={isPlaying && currentSong?.id === song.id}
              onPlay={() => onPlay(song, songs)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
