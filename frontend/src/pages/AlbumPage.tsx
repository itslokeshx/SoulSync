import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Play, Shuffle } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";
import { GreenButton } from "../components/ui/GreenButton";
import { SongRow } from "../components/cards/SongRow";
import { bestImg, fmt, onImgErr, extractColor } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import { getAlbum as fetchAlbum } from "../api/jiosaavn";
import { useApp } from "../context/AppContext";

export const AlbumPage = () => {
  const { id: albumId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
    likedSongs,
    handleLike: onLike,
  } = useApp();
  const onBack = () => navigate(-1);
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bgColor, setBgColor] = useState("#1a1a1a");

  useEffect(() => {
    if (!albumId) return;
    setLoading(true);
    setAlbum(null);
    fetchAlbum(albumId)
      .then((data) => {
        setAlbum(data);
        if (data) {
          const img = bestImg(data.image);
          if (img) extractColor(img).then((c) => c && setBgColor(c));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [albumId]);

  if (loading)
    return (
      <div className="animate-fadeIn space-y-4">
        <div className="flex gap-6 flex-wrap">
          <Skeleton className="w-52 h-52 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <div className="space-y-2 mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
    );
  if (!album)
    return <div className="text-sp-sub p-10 text-center">Album not found.</div>;

  const songs = album.songs || [];
  const img = bestImg(album.image) || FALLBACK_IMG;
  const artist = Array.isArray(album.artist_map?.primary_artists)
    ? album.artist_map.primary_artists.map((a: any) => a.name).join(", ")
    : Array.isArray(album.artists?.primary)
      ? album.artists.primary.map((a: any) => a.name).join(", ")
      : album.primaryArtists || album.subtitle || "";
  const totalDur = songs.reduce(
    (acc: number, s: any) => acc + (s.duration || 0),
    0,
  );

  return (
    <div className="animate-fadeIn -mt-6 -mx-6">
      <div
        className="px-6 pt-6 pb-6"
        style={{
          background: `linear-gradient(to bottom,${bgColor} 0%,#0e0e0e 100%)`,
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-[13px] mb-6 transition-colors duration-200"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex gap-6 flex-wrap items-end">
          <img
            src={img}
            onError={onImgErr}
            className="w-48 h-48 md:w-52 md:h-52 object-cover rounded-2xl flex-shrink-0"
            style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}
          />
          <div className="flex flex-col justify-end min-w-0 pb-2">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2">
              Album
            </p>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight tracking-tight">
              {album.name}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-[13px]">
              <span className="font-semibold text-white">{artist}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/50">{album.year}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/50">
                {songs.length} songs, {fmt(totalDur)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 flex items-center gap-4">
        <GreenButton onClick={() => songs.length && onPlay(songs[0], songs)}>
          <Play size={16} className="fill-black" /> Play All
        </GreenButton>
        <button className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-all duration-200">
          <Shuffle size={15} />
        </button>
      </div>

      <div className="px-6">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-white/[0.04] text-[10px] font-semibold tracking-[0.15em] text-white/25 uppercase mb-1">
          <span className="w-5 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="hidden lg:block w-36 text-center">Album</span>
          <span className="w-9 text-right">⏱</span>
        </div>
        <div className="space-y-0.5 pb-10">
          {songs.map((s: any, i: number) => (
            <SongRow
              key={s.id}
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
    </div>
  );
};
