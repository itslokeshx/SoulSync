import { useState, useEffect } from "react";
import { Sparkles, Calendar } from "lucide-react";
import { getDailyMix } from "../../api/backend";
import { SongCard } from "../cards/SongCard";

interface DailyMixProps {
  currentSong: any;
  isPlaying: boolean;
  onPlay: (song: any, queue: any[]) => void;
}

export const DailyMix = ({ currentSong, isPlaying, onPlay }: DailyMixProps) => {
  const [songs, setSongs] = useState<any[]>([]);
  const [dateStr, setDateStr] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDailyMix()
      .then((res) => {
        if (cancelled) return;
        if (res && res.success && Array.isArray(res.songs) && res.songs.length > 0) {
          setSongs(res.songs);
          setDateStr(res.dateStr || "");
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

  if (loading || failed || !songs || songs.length === 0) {
    return null;
  }

  const formattedDate = dateStr
    ? new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "Today";

  return (
    <div className="mb-10 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-sp-green" />
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Daily Mix
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sp-green/10 text-sp-green border border-sp-green/20">
              <Calendar size={10} />
              {formattedDate}
            </span>
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
