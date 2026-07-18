import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Play, Shuffle } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";
import { GreenButton } from "../components/ui/GreenButton";
import { SongRow } from "../components/cards/SongRow";
import { bestImg, getArtists, onImgErr, extractColor } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import {
  getArtist as fetchArtist,
  getArtistSongs as fetchArtistSongs,
} from "../api/jiosaavn";
import { useApp } from "../context/AppContext";

export const ArtistPage = () => {
  const { id: artistId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
    likedSongs,
    handleLike: onLike,
  } = useApp();
  const onBack = () => navigate(-1);
  const [artist, setArtist] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bgColor, setBgColor] = useState("#1a1a1a");

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    setArtist(null);
    setSongs([]);

    Promise.all([
      fetchArtist(artistId).catch(() => null),
      fetchArtistSongs(artistId).catch(() => []),
    ])
      .then(([data, songList]) => {
        setArtist(data);
        setSongs((data as any)?.songs?.length ? (data as any).songs : (songList?.length ? songList : (data as any)?.top_songs || []));
        if (data) {
          const img = bestImg(data.image);
          if (img) extractColor(img).then((c) => c && setBgColor(c));
        }
      })
      .finally(() => setLoading(false));
  }, [artistId]);

  if (loading)
    return (
      <div className="animate-fadeIn space-y-4">
        <Skeleton className="w-full h-72 rounded-2xl" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  if (!artist)
    return (
      <div className="text-sp-sub p-10 text-center">Artist not found.</div>
    );

  const img = bestImg(artist.image) || FALLBACK_IMG;
  const followers =
    artist.follower_count || artist.followerCount
      ? parseInt(
          artist.follower_count || artist.followerCount,
          10,
        ).toLocaleString()
      : null;

  return (
    <div className="animate-fadeIn -mt-6 -mx-6">
      <div
        className="relative h-80 overflow-hidden"
        style={{
          background: `linear-gradient(to bottom,${bgColor} 0%,#0e0e0e 100%)`,
        }}
      >
        <img
          src={img}
          onError={onImgErr}
          className="absolute inset-0 w-full h-full object-cover object-top opacity-30"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom,transparent 20%,#0e0e0e 100%)",
          }}
        />
        <button
          onClick={onBack}
          className="absolute top-5 left-5 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-all duration-200"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="absolute bottom-6 left-6">
          <span className="text-[10px] font-bold bg-sp-green text-black px-2.5 py-1 rounded-full uppercase tracking-widest">
            Verified Artist
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-3 leading-none tracking-tight">
            {artist.name}
          </h1>
          {followers && (
            <p className="text-white/50 text-[13px] mt-2">
              {followers} followers
            </p>
          )}
        </div>
      </div>

      <div className="px-6 py-5 flex items-center gap-4">
        <GreenButton onClick={() => songs.length && onPlay(songs[0], songs)}>
          <Play size={16} className="fill-black" /> Play
        </GreenButton>
        <button className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all duration-200">
          <Shuffle size={15} />
        </button>
      </div>

      <div className="px-6">
        <h2 className="text-lg font-bold text-white mb-3">Popular</h2>
        <div className="space-y-1">
          {songs.slice(0, 60).map((s, i) => (
            <SongRow
              key={`${s.id || s.songId || s.title}-${i}`}
              song={s}
              index={i}
              isCurrent={currentSong?.id === s.id}
              isPlaying={isPlaying}
              onPlay={() => onPlay(s, songs)}
              liked={!!likedSongs?.[s.id]}
              onLike={onLike}
            />
          ))}
        </div>
      </div>

      {/* Albums */}
      {artist.albums && artist.albums.length > 0 && (
        <div className="px-6 mt-8">
          <h2 className="text-lg font-bold text-white mb-3">Albums</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 thin-scrollbar">
            {artist.albums.map((a: any) => (
              <button
                key={a.id || a.name}
                onClick={() => a.id && navigate(`/album/${a.id}`)}
                className="flex flex-col gap-2 w-32 sm:w-36 flex-shrink-0 group cursor-pointer text-left"
              >
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={bestImg(a.image) || FALLBACK_IMG}
                    alt={a.name}
                    className="w-32 h-32 sm:w-36 sm:h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-sp-green flex items-center justify-center shadow-xl">
                      <Play size={16} className="text-black fill-black ml-0.5" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-white/80 text-[12px] font-medium truncate group-hover:text-white transition-colors">
                    {a.name}
                  </p>
                  <p className="text-white/35 text-[11px] truncate">
                    {a.year || "Album"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Singles */}
      {artist.singles && artist.singles.length > 0 && (
        <div className="px-6 mt-8 pb-10">
          <h2 className="text-lg font-bold text-white mb-3">Singles & EPs</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 thin-scrollbar">
            {artist.singles.map((s: any) => (
              <button
                key={s.id || s.name}
                onClick={() => s.id && navigate(`/album/${s.id}`)}
                className="flex flex-col gap-2 w-32 sm:w-36 flex-shrink-0 group cursor-pointer text-left"
              >
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={bestImg(s.image) || FALLBACK_IMG}
                    alt={s.name}
                    className="w-32 h-32 sm:w-36 sm:h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-sp-green flex items-center justify-center shadow-xl">
                      <Play size={16} className="text-black fill-black ml-0.5" />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-white/80 text-[12px] font-medium truncate group-hover:text-white transition-colors">
                    {s.name}
                  </p>
                  <p className="text-white/35 text-[11px] truncate">
                    {s.year || "Single"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
