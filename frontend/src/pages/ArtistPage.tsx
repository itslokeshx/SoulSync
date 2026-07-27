import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Play,
  Pause,
  Shuffle,
  UserPlus,
  UserCheck,
  Disc3,
  Users,
  CheckCircle2,
  Heart,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";
import { GreenButton } from "../components/ui/GreenButton";
import { ArtistLinks } from "../components/ui/ArtistLinks";
import { bestImg, getArtists, onImgErr, extractColor, fmt } from "../lib/helpers";
import { FALLBACK_IMG } from "../lib/constants";
import {
  getArtist as fetchArtist,
  getArtistSongs as fetchArtistSongs,
  searchArtists,
} from "../api/jiosaavn";
import { useApp } from "../context/AppContext";
import { useUIStore } from "../store/uiStore";
import { useAuth } from "../auth/AuthContext";
import * as backendApi from "../api/backend";

const ARTIST_ECOSYSTEMS: Record<string, string[]> = {
  tamil: [
    "Anirudh Ravichander", "A.R. Rahman", "Sid Sriram", "Yuvan Shankar Raja",
    "Harris Jayaraj", "G.V. Prakash", "Hiphop Tamizha", "Santhosh Narayanan",
    "Ilaiyaraaja", "Vijay Antony", "D. Imman", "Sai Abhyankkar"
  ],
  hindi: [
    "Arijit Singh", "Pritam", "Shreya Ghoshal", "A.R. Rahman", "Jubin Nautiyal",
    "Vishal-Shekhar", "Amit Trivedi", "Sachin-Jigar", "Badshah", "Atif Aslam",
    "Sonu Nigam", "Sunidhi Chauhan", "KK"
  ],
  telugu: [
    "Devi Sri Prasad", "S. Thaman", "M.M. Keeravani", "Sid Sriram", "Anirudh Ravichander",
    "A.R. Rahman", "Hesham Abdul Wahab", "Gopi Sundar"
  ],
  punjabi: [
    "Diljit Dosanjh", "Karan Aujla", "Sidhu Moose Wala", "AP Dhillon", "B Praak",
    "Guru Randhawa", "Ammy Virk", "Harrdy Sandhu", "Honey Singh"
  ],
  malayalam: [
    "Sushin Shyam", "Jakes Bejoy", "Gopi Sundar", "Hesham Abdul Wahab", "Vineeth Sreenivasan"
  ],
  kannada: [
    "Arjun Janya", "V. Harikrishna", "B. Ajaneesh Loknath", "Ravi Basrur", "Vijay Prakash"
  ],
  english: [
    "Ed Sheeran", "Taylor Swift", "The Weeknd", "Drake", "Billie Eilish",
    "Ariana Grande", "Dua Lipa", "Bruno Mars", "Coldplay", "Justin Bieber",
    "Post Malone", "Eminem", "Rihanna", "Harry Styles", "Olivia Rodrigo", "Sabrina Carpenter"
  ]
};

function detectPrimaryLanguage(artistName: string, songs: any[]): string {
  const combined = (artistName + " " + songs.map((s) => (s.name || "") + " " + (s.language || "") + " " + (s.primaryArtists || "")).join(" ")).toLowerCase();

  if (/tamil|kollywood|katchi|aasa|anirudh|rahman|yuvan|harris|imman|hiphop|santhosh|abhyankkar|ilaiyaraaja|vijay antony|sid sriram|paal dabba/i.test(combined)) return "tamil";
  if (/hindi|bollywood|arijit|pritam|shreya|jubin|badshah|atif|sonu|sunidhi/i.test(combined)) return "hindi";
  if (/telugu|tollywood|thaman|dsp|pushpa|devara|keeravani/i.test(combined)) return "telugu";
  if (/punjabi|aujla|dosanjh|dhillon|moose|b praak/i.test(combined)) return "punjabi";
  if (/malayalam|sushin|jakes|aavesham|illuminati/i.test(combined)) return "malayalam";

  const langCounts: Record<string, number> = {};
  for (const s of songs) {
    const l = (s.language || "").toLowerCase().trim();
    if (l && l !== "unknown" && l !== "null") {
      langCounts[l] = (langCounts[l] || 0) + 1;
    }
  }

  let topLang = "";
  let maxCount = 0;
  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topLang = lang;
    }
  }

  if (topLang && ARTIST_ECOSYSTEMS[topLang]) return topLang;

  return "english";
}

export const ArtistPage = () => {
  const { id: artistId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
    likedSongs,
    handleLike: onLike,
  } = useApp();
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  const [artist, setArtist] = useState<any>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [similarArtists, setSimilarArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bgColor, setBgColor] = useState("#18181b");
  const [isFollowing, setIsFollowing] = useState(false);
  const [songLimit, setSongLimit] = useState(10);
  const [showFullBio, setShowFullBio] = useState(false);

  // User preferred language set
  const prefLangs = (() => {
    let list: string[] = [];
    if (user?.preferences?.languages && Array.isArray(user.preferences.languages) && user.preferences.languages.length > 0) {
      list = user.preferences.languages.map((l: string) => l.toLowerCase());
    } else {
      try {
        const raw = localStorage.getItem("ss_pref_langs");
        if (raw) list = JSON.parse(raw).map((l: string) => l.toLowerCase());
      } catch {}
    }
    if (list.length === 0) list = ["tamil", "english"];
    return new Set(list);
  })();

  // Check localStorage for follow state
  useEffect(() => {
    if (!artistId) return;
    try {
      const followed = JSON.parse(
        localStorage.getItem("ss_followed_artists") || "[]",
      );
      setIsFollowing(followed.map(String).includes(String(artistId)));
    } catch {}

    backendApi.getFollowedArtists().then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        const ids = list.map((a) => String(a.id));
        localStorage.setItem("ss_followed_artists", JSON.stringify(ids));
        localStorage.setItem("ss_followed_artists_full", JSON.stringify(list));
        setIsFollowing(ids.includes(String(artistId)));
        window.dispatchEvent(new Event("soulsync:followed_artists_updated"));
      }
    }).catch(() => {});
  }, [artistId]);

  const toggleFollow = () => {
    if (!artistId || !artist) return;
    try {
      const followedIds: string[] = JSON.parse(
        localStorage.getItem("ss_followed_artists") || "[]",
      );
      const followedFull: any[] = JSON.parse(
        localStorage.getItem("ss_followed_artists_full") || "[]",
      );

      let updatedIds: string[];
      let updatedFull: any[];

      const strId = String(artistId);

      if (isFollowing) {
        updatedIds = followedIds.filter((id) => String(id) !== strId);
        updatedFull = followedFull.filter((a) => String(a.id) !== strId);
        backendApi.unfollowArtist(strId).catch(() => {});
      } else {
        updatedIds = [...followedIds.filter((id) => String(id) !== strId), strId];
        const cleanName =
          artist.name && !/^\d+$/.test(String(artist.name).trim())
            ? artist.name
            : artistId === "456269"
              ? "A.R. Rahman"
              : "Artist";
        const artistObj = {
          id: strId,
          name: cleanName,
          image: bestImg(artist.image) || FALLBACK_IMG,
          follower_count: artist.follower_count || artist.followers || "1000000",
        };
        updatedFull = [artistObj, ...followedFull.filter((a) => String(a.id) !== strId)];
        backendApi.followArtist(artistObj).catch(() => {});
      }

      localStorage.setItem("ss_followed_artists", JSON.stringify(updatedIds));
      localStorage.setItem("ss_followed_artists_full", JSON.stringify(updatedFull));
      setIsFollowing(!isFollowing);

      window.dispatchEvent(new Event("soulsync:followed_artists_updated"));
    } catch {}
  };

  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  const [artistPage, setArtistPage] = useState(0);
  const [hasMoreSongs, setHasMoreSongs] = useState(true);

  const handleLoadMoreSongs = async () => {
    if (loadingMoreSongs) return;

    if (songLimit < songs.length) {
      setSongLimit((prev) => prev + 25);
      return;
    }

    if (!hasMoreSongs || !artistId) return;
    setLoadingMoreSongs(true);
    try {
      const nextPage = artistPage + 1;
      const newSongs = await fetchArtistSongs(artistId, nextPage);
      if (newSongs && newSongs.length > 0) {
        setSongs((prev) => {
          const existingIds = new Set(prev.map((s) => String(s.id)));
          const filtered = newSongs.filter((s: any) => s.id && !existingIds.has(String(s.id)));
          return [...prev, ...filtered];
        });
        setArtistPage(nextPage);
        setSongLimit((prev) => prev + 25);
      } else {
        setHasMoreSongs(false);
      }
    } catch {
      setHasMoreSongs(false);
    } finally {
      setLoadingMoreSongs(false);
    }
  };

  const loadArtistData = useCallback(async () => {
    if (!artistId) return;
    setLoading(true);
    setArtist(null);
    setSongs([]);
    setAlbums([]);
    setSimilarArtists([]);
    setArtistPage(0);
    setHasMoreSongs(true);

    try {
      const [artistData, songList] = await Promise.all([
        fetchArtist(artistId).catch(() => null),
        fetchArtistSongs(artistId, 0).catch(() => []),
      ]);

      const mainArtist: any = artistData || {};

      // Extract & sort top songs by popularity & release year
      const rawSongs = songList?.length
        ? songList
        : mainArtist?.top_songs || mainArtist?.songs || [];

      const sortedSongs = [...rawSongs].sort((a: any, b: any) => {
        const langA = (a.language || "").toLowerCase();
        const langB = (b.language || "").toLowerCase();

        const isPrefA = prefLangs.has(langA) ? 1 : 0;
        const isPrefB = prefLangs.has(langB) ? 1 : 0;

        if (isPrefA !== isPrefB) {
          return isPrefB - isPrefA; // Preferred language songs FIRST
        }

        const pA = a.playCount || a.play_count || 0;
        const pB = b.playCount || b.play_count || 0;
        if (pB !== pA) return pB - pA;
        const yA = parseInt(a.year || "0", 10);
        const yB = parseInt(b.year || "0", 10);
        return yB - yA;
      });

      // If artist name is missing or raw numeric ID (e.g. "456269"), extract clean name from top songs or known map
      let resolvedName = (mainArtist?.name || mainArtist?.artist || "").trim();
      if (!resolvedName || /^\d+$/.test(resolvedName) || resolvedName === "null") {
        const topSongArtist = sortedSongs[0]?.primaryArtists || sortedSongs[0]?.artist || sortedSongs[0]?.singers || "";
        if (topSongArtist) {
          resolvedName = topSongArtist.split(",")[0].trim();
        }
      }
      if (!resolvedName || /^\d+$/.test(resolvedName)) {
        resolvedName = "Artist";
      }

      mainArtist.name = resolvedName;
      setArtist(mainArtist);
      setSongs(sortedSongs);

      // Extract albums (newest year first)
      const rawAlbums = mainArtist?.albums || mainArtist?.top_albums || [];
      const sortedAlbums = [...rawAlbums].sort((a: any, b: any) => {
        const yA = parseInt(a.year || "0", 10);
        const yB = parseInt(b.year || "0", 10);
        return yB - yA;
      });
      setAlbums(sortedAlbums);

      // Always use curated native language ecosystem for Fans Also Like
      const artistNameStr = mainArtist?.name || artistId || "";
      const primaryLang = detectPrimaryLanguage(artistNameStr, sortedSongs);
      const ecosystemNames = ARTIST_ECOSYSTEMS[primaryLang] || ARTIST_ECOSYSTEMS["english"];

      const filteredNames = ecosystemNames.filter(
        (n) => n.toLowerCase() !== artistNameStr.toLowerCase()
      ).slice(0, 10);

      try {
        const searchResults = await Promise.allSettled(
          filteredNames.map((name) => searchArtists(name).catch(() => []))
        );

        const ecoArtists: any[] = [];
        const seenArtistIds = new Set<string>();

        for (const res of searchResults) {
          if (res.status === "fulfilled" && Array.isArray(res.value) && res.value.length > 0) {
            const matchedArtist = res.value[0];
            const aId = String(matchedArtist.id || (matchedArtist as any).artistId || "");
            if (aId && aId !== String(artistId) && !seenArtistIds.has(aId)) {
              seenArtistIds.add(aId);
              ecoArtists.push(matchedArtist);
            }
          }
        }

        setSimilarArtists(ecoArtists.slice(0, 10));
      } catch {
        setSimilarArtists([]);
      }

      // Extract color from artist image
      const imgUrl = bestImg(mainArtist?.image);
      if (imgUrl) {
        extractColor(imgUrl).then((c) => c && setBgColor(c));
      }
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    loadArtistData();
  }, [loadArtistData]);

  if (loading) {
    return (
      <div className="animate-fadeIn space-y-6 max-w-7xl mx-auto p-4">
        <Skeleton className="w-full h-80 rounded-3xl" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <p className="text-white/50 text-base font-semibold">Artist not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2 rounded-full bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  const img = bestImg(artist.image) || FALLBACK_IMG;
  const followersCount = artist.follower_count || artist.followerCount || artist.followers;
  const formattedFollowers = followersCount
    ? parseInt(followersCount, 10).toLocaleString()
    : null;

  const bioText = artist.bio
    ? Array.isArray(artist.bio)
      ? artist.bio[0]?.text || artist.bio[0]
      : typeof artist.bio === "string"
      ? artist.bio
      : artist.bio.text || ""
    : "";

  const handleShufflePlay = () => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    onPlay(shuffled[0], shuffled);
  };

  return (
    <div className="animate-fadeIn pb-32 -mt-6 -mx-4 md:-mx-8">
      {/* ── Premium Hero Header ────────────────────────────────────────── */}
      <div
        className="relative min-h-[340px] md:min-h-[400px] flex flex-col justify-end p-6 md:p-10 overflow-hidden"
        style={{
          background: `linear-gradient(to bottom, ${bgColor} 0%, #0e0e10 100%)`,
        }}
      >
        {/* Subtle Background Glow */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e10] via-[#0e0e10]/60 to-transparent" />

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-all"
          aria-label="Go back"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Artist Profile Content */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/10 flex-shrink-0 bg-neutral-900">
            <img
              src={img}
              alt={artist.name}
              className="w-full h-full object-cover"
              onError={onImgErr}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-sp-green text-black uppercase tracking-wider shadow-md">
                <CheckCircle2 size={13} className="fill-black text-sp-green" /> Verified Artist
              </span>
              <button
                onClick={toggleFollow}
                className={`px-4 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 transition-all border ${
                  isFollowing
                    ? "bg-sp-green/20 text-sp-green border-sp-green/40 hover:bg-sp-green/30"
                    : "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/40"
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck size={14} /> Following
                  </>
                ) : (
                  <>
                    <UserPlus size={14} /> Follow
                  </>
                )}
              </button>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-none">
              {artist.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-white/70 pt-1">
              {formattedFollowers && (
                <span className="flex items-center gap-1.5 text-white/80">
                  <Users size={14} className="text-sp-green" />
                  {formattedFollowers} followers
                </span>
              )}
              {songs.length > 0 && (
                <span>• {songs.length} top tracks</span>
              )}
              {albums.length > 0 && (
                <span>• {albums.length} albums</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 max-w-7xl mx-auto space-y-10">
        {/* ── Action Controls Bar ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 py-4 border-b border-white/5">
          <GreenButton
            onClick={() => songs.length > 0 && onPlay(songs[0], songs)}
            className="px-6 py-3.5 shadow-xl hover:scale-105 transition-transform"
          >
            {isPlaying && songs.some((s) => s.id === currentSong?.id) ? (
              <>
                <Pause size={18} className="fill-black" /> Pause
              </>
            ) : (
              <>
                <Play size={18} className="fill-black" /> Play Top Songs
              </>
            )}
          </GreenButton>

          <button
            onClick={handleShufflePlay}
            className="w-12 h-12 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white hover:border-white/40 transition-all duration-200 shadow-md"
            title="Shuffle artist songs"
          >
            <Shuffle size={18} />
          </button>

          <button
            onClick={toggleFollow}
            className={`px-5 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 transition-all border ${
              isFollowing
                ? "bg-sp-green/10 text-sp-green border-sp-green/40 hover:bg-sp-green/20"
                : "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/40"
            }`}
          >
            {isFollowing ? (
              <>
                <UserCheck size={15} /> Following
              </>
            ) : (
              <>
                <UserPlus size={15} /> Follow
              </>
            )}
          </button>
        </div>

        {/* ── Artist Biography Excerpt (if available) ──────────────────── */}
        {bioText && (
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-2">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider">
              About the Artist
            </h3>
            <p className={`text-xs md:text-sm text-white/70 leading-relaxed ${!showFullBio ? "line-clamp-3" : ""}`}>
              {bioText}
            </p>
            {bioText.length > 180 && (
              <button
                onClick={() => setShowFullBio(!showFullBio)}
                className="text-xs font-bold text-sp-green hover:underline flex items-center gap-1 pt-1"
              >
                {showFullBio ? (
                  <>Show Less <ChevronUp size={14} /></>
                ) : (
                  <>Read Full Bio <ChevronDown size={14} /></>
                )}
              </button>
            )}
          </div>
        )}

        {/* ── Section 1: Popular Songs ─────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-white">Popular Songs</h2>
            <span className="text-xs text-white/40 font-medium">Top {songs.length}</span>
          </div>

          <div className="space-y-1">
            {songs.slice(0, songLimit).map((s, index) => {
              const isCurrent = currentSong?.id === s.id;
              const imgUrl = bestImg(s.image) || FALLBACK_IMG;
              const duration = fmt(s.duration);
              const artistName = getArtists(s);

              return (
                <div
                  key={s.id}
                  onClick={() => onPlay(s, songs)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onPlay(s, songs)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.08] active:bg-white/[0.12] transition-all group text-left cursor-pointer border border-transparent ${
                    isCurrent ? "bg-white/[0.06] border-white/10" : ""
                  }`}
                >
                  <span className="w-5 text-center text-xs font-medium text-white/30 group-hover:hidden flex-shrink-0 font-mono select-none">
                    {isCurrent && isPlaying ? (
                      <span className="text-sp-green text-xs animate-pulse">▶</span>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="relative flex-shrink-0 hidden group-hover:block w-5">
                    {isCurrent && isPlaying ? (
                      <Pause size={13} className="text-sp-green fill-sp-green" />
                    ) : (
                      <Play size={13} className="text-white fill-white" />
                    )}
                  </div>

                  <img
                    src={imgUrl}
                    alt={s.name}
                    className="w-11 h-11 rounded-lg object-cover bg-neutral-900 flex-shrink-0"
                    onError={onImgErr}
                  />

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isCurrent ? "text-sp-green" : "text-white"
                      }`}
                    >
                      {s.name}
                    </p>
                    <p className="text-xs text-white/50 truncate mt-0.5">
                      <ArtistLinks song={s} />
                    </p>
                  </div>

                  {s.album && (
                    <p className="hidden md:block text-xs text-white/40 truncate max-w-[180px]">
                      {typeof s.album === "string" ? s.album : s.album.name || ""}
                    </p>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLike(s);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-sp-green transition-all"
                  >
                    <Heart
                      size={15}
                      className={likedSongs?.[s.id] ? "fill-sp-green text-sp-green opacity-100" : ""}
                    />
                  </button>

                  <span className="text-xs text-white/40 font-mono flex-shrink-0">
                    {duration}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showContextMenu(e.clientX, e.clientY, s);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all flex-shrink-0"
                  >
                    <MoreVertical size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          {(songLimit < songs.length || hasMoreSongs) && (
            <div className="pt-3 text-center">
              <button
                onClick={handleLoadMoreSongs}
                disabled={loadingMoreSongs}
                className="px-8 py-3 rounded-full bg-sp-green/10 hover:bg-sp-green/20 text-sp-green border border-sp-green/30 text-xs font-extrabold transition-all duration-200 active:scale-95 flex items-center gap-2 mx-auto shadow-md"
              >
                {loadingMoreSongs ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Fetching more tracks...
                  </>
                ) : (
                  <>
                    Load More Songs ({songs.length > songLimit ? `${songs.length - songLimit} ready` : "Fetch more discography"})
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* ── Section 2: More From This Artist (Albums) ────────────────── */}
        {albums.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Disc3 size={20} className="text-blue-400" /> More From {artist.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {albums.map((album: any) => {
                const albImg = bestImg(album.image) || FALLBACK_IMG;
                return (
                  <div
                    key={album.id}
                    onClick={() => navigate(`/album/${album.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/album/${album.id}`)}
                    className="group relative bg-white/[0.03] hover:bg-white/[0.08] p-3.5 rounded-2xl transition-all duration-200 cursor-pointer border border-white/5 hover:border-white/10 hover:scale-[1.02] flex flex-col"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-neutral-900 shadow-md">
                      <img
                        src={albImg}
                        alt={album.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={onImgErr}
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-sp-green text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                          <Play size={18} className="fill-black ml-0.5" />
                        </div>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-sp-green transition-colors">
                      {album.name}
                    </h3>
                    <div className="mt-auto pt-2 flex items-center justify-between text-[11px] text-white/40">
                      <span>{album.year || "Album"}</span>
                      <span className="flex items-center gap-1">
                        <Disc3 size={11} /> Album
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Section 3: Fans Also Like (Related Artists) ─────────────── */}
        {similarArtists.length > 0 && (
          <section className="space-y-4 pt-4">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Users size={20} className="text-purple-400" /> Fans Also Like
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {similarArtists.map((sim: any) => {
                const simImg = bestImg(sim.image) || FALLBACK_IMG;
                return (
                  <div
                    key={sim.id}
                    onClick={() => {
                      navigate(`/artist/${sim.id}`);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        navigate(`/artist/${sim.id}`);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className="group relative bg-white/[0.03] hover:bg-white/[0.08] p-4 rounded-2xl transition-all duration-200 cursor-pointer border border-white/5 hover:border-white/10 hover:scale-[1.02] flex flex-col items-center text-center"
                  >
                    <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden mb-3 bg-neutral-900 shadow-md ring-2 ring-white/10 group-hover:ring-sp-green/50 transition-all">
                      <img
                        src={simImg}
                        alt={sim.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={onImgErr}
                      />
                    </div>
                    <h3 className="text-xs font-bold text-white truncate max-w-full group-hover:text-sp-green transition-colors">
                      {sim.name}
                    </h3>
                    <span className="mt-1.5 text-[10px] font-semibold text-white/50">
                      Artist
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
