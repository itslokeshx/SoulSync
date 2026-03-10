import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Search, Music2, ChevronLeft } from "lucide-react";
import { usePlayerStore } from "../../store/playerStore";
import { useQueueStore } from "../../store/queueStore";
import { useUIStore } from "../../store/uiStore";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { PlayerBar, NowPlayingView, QueuePanel } from "../player";
import { AuthGateModal } from "../ui/AuthGateModal";
import { ContextMenu } from "../ui/ContextMenu";
import { AIPlaylistModal } from "../ui/AIPlaylistModal";
import { AppContext } from "../../context/AppContext";
import { useAuthGate } from "../../hooks/useAuthGate";
import { useLikedSongs } from "../../hooks";
import { usePlayer } from "../../providers/PlayerProvider";
import {
  bestImg,
  extractColor,
  hashColor,
  getArtists,
} from "../../lib/helpers";
import * as api from "../../api/backend";
import toast from "react-hot-toast";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { gate, isAuthenticated } = useAuthGate();

  const isSearchPage = location.pathname === "/search";
  const [liveQuery, setLiveQuery] = useState("");
  const [npOpen, setNpOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [bgColor, setBgColor] = useState("#121212");

  // Close fullscreen player when navigating to a different page
  useEffect(() => {
    setNpOpen(false);
  }, [location.pathname]);

  const { handleSeek } = usePlayer();

  const {
    currentSong,
    isPlaying,
    volume,
    isShuffle,
    repeatMode,
    currentTime,
    duration,
    togglePlay,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    playSong,
    seekTo,
    pause,
  } = usePlayerStore();

  const { queue, queueIndex, next, prev, move, remove, shuffle, setQueue } =
    useQueueStore();

  const [likedSongs, toggleLike, setAllLiked] = useLikedSongs(isAuthenticated);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  // Dynamic bg color from current song
  useEffect(() => {
    if (!currentSong) return;
    const img = bestImg(currentSong.image);
    if (img) extractColor(img).then((c) => c && setBgColor(c));
    else setBgColor(hashColor(currentSong.id));
  }, [currentSong?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "q" || e.key === "Q") setQueueOpen((p) => !p);
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        navigate("/search");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, navigate]);

  const handleLike = useCallback(
    (song: any) => {
      gate(() => {
        const wasLiked = !!likedSongs[song.id];
        toggleLike(song);
        toast(
          wasLiked ? "Removed from Liked Songs" : "Added to Liked Songs ♥",
          {
            icon: wasLiked ? "💔" : "❤️",
            duration: 2000,
          },
        );
        if (wasLiked) api.unlikeSong(song.id).catch(() => {});
        else
          api
            .likeSong({
              songId: song.id,
              title: song.name || "",
              artist: getArtists(song),
              albumArt: bestImg(song.image) || "",
              duration: Number(song.duration) || 0,
            })
            .catch(() => {});
      }, "Sign in to save this song to your library");
    },
    [likedSongs, toggleLike, gate],
  );

  const appContextValue = {
    currentSong,
    isPlaying,
    playSong: (song: any, songs?: any[]) => {
      if (songs)
        setQueue(
          songs,
          songs.findIndex((s) => s.id === song.id),
        );
      playSong(song);
    },
    likedSongs,
    handleLike,
    setLikedSongs: setAllLiked,
    recentlyPlayed: [], // Could bridge to queueStore.history if needed
    handlePlayPause: togglePlay,
    addToQueue: (song: any) => useQueueStore.getState().addLast(song),
    playNext: (song: any) => useQueueStore.getState().addNext(song),
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="flex h-screen bg-sp-black overflow-hidden font-sans">
        <AuthGateModal />
        <Sidebar />

        <div
          className={`flex-1 transition-all duration-300 flex flex-col overflow-hidden 
          ${sidebarCollapsed ? "md:ml-[4.5rem]" : "md:ml-[17rem]"} 
          ${queueOpen ? "md:mr-80" : ""}`}
        >
          {/* Top Header */}
          {!isSearchPage && (
            <header
              className="flex-shrink-0 flex items-center gap-4 px-4 md:px-6 py-3 sticky top-0 z-20 backdrop-blur-3xl"
              style={{
                background: `linear-gradient(to bottom, ${bgColor}40 0%, transparent 100%)`,
              }}
            >
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 md:hidden"
              >
                <div className="w-8 h-8 rounded-xl bg-sp-green flex items-center justify-center shadow-lg shadow-sp-green/20">
                  <Music2 size={16} className="text-black" />
                </div>
                <span className="text-lg font-bold text-white tracking-tight">
                  SoulSync
                </span>
              </button>

              <div className="hidden md:flex gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              <div className="flex-1 relative max-w-xl">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="text"
                  value={liveQuery}
                  onChange={(e) => {
                    setLiveQuery(e.target.value);
                    navigate(
                      e.target.value.trim()
                        ? `/search?q=${encodeURIComponent(e.target.value)}`
                        : "/search",
                    );
                  }}
                  onFocus={() => navigate("/search")}
                  placeholder="Search songs, artists, albums..."
                  className="w-full bg-white/5 border border-white/5 hover:bg-white/10 focus:bg-white/10 focus:border-white/20 rounded-full pl-10 pr-4 py-2 text-sm transition-all outline-none"
                />
              </div>
            </header>
          )}

          {/* Main Content */}
          <main
            className={`flex-1 overflow-y-auto ${!isSearchPage ? "px-4 md:px-8 pb-32 md:pb-24" : ""}`}
          >
            <Outlet />
          </main>
        </div>

        {/* Overlays & Player */}
        {queueOpen && currentSong && (
          <QueuePanel
            queue={queue}
            queueIndex={queueIndex}
            currentSong={currentSong}
            onClose={() => setQueueOpen(false)}
            onJump={(idx) => {
              const s = queue[idx];
              if (s) {
                setQueue(queue, idx);
                playSong(s);
              }
            }}
            onMove={move}
            onRemove={remove}
          />
        )}

        <PlayerBar
          currentSong={currentSong}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          shuffle={isShuffle}
          repeat={repeatMode}
          likedSongs={likedSongs}
          onPlayPause={togglePlay}
          onSeek={handleSeek}
          onSeekStart={() => {}}
          onSeekEnd={() => {}}
          onVolume={setVolume}
          onPrev={() => {
            const p = prev();
            if (p) playSong(p);
          }}
          onNext={() => {
            const n = next(repeatMode);
            if (n) playSong(n);
          }}
          onShuffle={toggleShuffle}
          onRepeat={cycleRepeat}
          onLike={handleLike}
          onOpenFullscreen={() => setNpOpen(true)}
          onToggleQueue={() => setQueueOpen(!queueOpen)}
          queueOpen={queueOpen}
        />

        {npOpen && currentSong && (
          <NowPlayingView
            currentSong={currentSong}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            shuffle={isShuffle}
            repeat={repeatMode}
            liked={!!likedSongs[currentSong.id]}
            onClose={() => setNpOpen(false)}
            onPlayPause={togglePlay}
            onSeek={handleSeek}
            onSeekStart={() => {}}
            onSeekEnd={() => {}}
            onVolume={setVolume}
            onPrev={() => {
              const p = prev();
              if (p) playSong(p);
            }}
            onNext={() => {
              const n = next(repeatMode);
              if (n) playSong(n);
            }}
            onShuffle={toggleShuffle}
            onRepeat={cycleRepeat}
            onLike={handleLike}
            onPlaySong={(song) => playSong(song)}
            queue={queue}
            queueIndex={queueIndex}
            onJump={(idx) => {
              const s = queue[idx];
              if (s) {
                setQueue(queue, idx);
                playSong(s);
              }
            }}
            onMove={move}
            onRemove={remove}
            onShuffleQueue={shuffle}
          />
        )}

        <MobileNav />
        <ContextMenu />
        <AIPlaylistModal />
      </div>
    </AppContext.Provider>
  );
}
