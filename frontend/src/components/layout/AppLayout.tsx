import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Search, Music2, ChevronLeft, X } from "lucide-react";
import { useLikedSongs, useRecentlyPlayed } from "../../hooks";
import {
  bestUrl,
  bestImg,
  extractColor,
  hashColor,
  getArtists,
} from "../../lib/helpers";
import * as api from "../../api/backend";
import { PlayerBar, NowPlayingView, QueuePanel } from "../player";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { DuoMobileBar } from "./DuoMobileBar";
import {
  DuoModal,
  DuoPanel,
  DuoEndCard,
  DuoHeartbeat,
  useDuo,
  useDuoStore,
} from "../../duo";
import { useSearchStore } from "../../store/searchStore";
import { useUIStore } from "../../store/uiStore";
import { AppContext } from "../../context/AppContext";
import { ContextMenu } from "../ui/ContextMenu";
import { AIPlaylistModal } from "../ui/AIPlaylistModal";
import toast from "react-hot-toast";

const API =
  import.meta.env.VITE_JIOSAAVN_API || "https://jiosaavn.rajputhemant.dev";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekingRef = useRef(false);

  // Search
  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const [liveQuery, setLiveQuery] = useState("");

  // Core state
  const [queue, setQueue] = useState<any[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [currentSong, setCurrentSong] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");

  const [queueOpen, setQueueOpen] = useState(false);
  const [npOpen, setNpOpen] = useState(false);
  const [bgColor, setBgColor] = useState("#121212");

  const [likedSongs, toggleLike] = useLikedSongs();
  const [recentlyPlayed, addRecent] = useRecentlyPlayed();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  // Duo
  const duoActive = useDuoStore((s) => s.active);
  const duoPanelOpen = useDuoStore((s) => s.panelOpen);
  const playSongRef = useRef<
    ((song: any, queue: any[], fromDuo?: boolean) => void) | null
  >(null);
  const duoCurrentSongRef = useRef<any>(null);
  const duoQueueRef = useRef<any[]>([]);

  const addToast = useCallback(
    (msg: string, type: string = "info", _ms?: number) => {
      const opts = _ms ? { duration: _ms } : {};
      if (type === "error") toast.error(msg, opts);
      else if (type === "success") toast.success(msg, opts);
      else toast(msg, opts);
    },
    [],
  );

  const duo = useDuo({
    playSongRef,
    audioRef,
    currentSongRef: duoCurrentSongRef,
    queueRef: duoQueueRef,
    setIsPlaying,
    setCurrentTime,
    addToast,
  });
  const duoRef = useRef(duo);
  duoRef.current = duo;

  // Stale-closure refs
  const qRef = useRef<any[]>([]);
  const qiRef = useRef(-1);
  const sfRef = useRef(false);
  const rpRef = useRef<"off" | "all" | "one">("off");
  const vlRef = useRef(0.8);
  const csRef = useRef<any>(null);
  useEffect(() => {
    qRef.current = queue;
  }, [queue]);
  useEffect(() => {
    qiRef.current = queueIndex;
  }, [queueIndex]);
  useEffect(() => {
    sfRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    rpRef.current = repeat;
  }, [repeat]);
  useEffect(() => {
    vlRef.current = volume;
  }, [volume]);
  useEffect(() => {
    csRef.current = currentSong;
  }, [currentSong]);

  // Auto-close NowPlaying fullscreen on route change
  useEffect(() => {
    setNpOpen(false);
  }, [location.pathname]);

  // Debounced search → navigate to /search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(liveQuery);
      if (liveQuery.trim() && location.pathname !== "/search") {
        navigate("/search");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [liveQuery]); // eslint-disable-line

  // Dynamic bg color
  useEffect(() => {
    if (!currentSong) return;
    const img = bestImg(currentSong.image);
    if (img) extractColor(img).then((c) => c && setBgColor(c));
    else setBgColor(hashColor(currentSong.id));
  }, [currentSong?.id]); // eslint-disable-line

  // ── playSong ──
  const playSong = useCallback(
    async (song: any, newQueue: any[] = [], _fromDuo = false) => {
      if (!song) return;
      const audio = audioRef.current;
      if (!audio) return;
      try {
        let target = song;
        if (!target.download_url?.length && !target.downloadUrl?.length) {
          if (!song.id) {
            toast.error("Cannot play: missing song ID.");
            return;
          }
          const res = await fetch(`${API}/song?id=${song.id}`);
          const data = await res.json();
          target =
            data?.data?.songs?.[0] || data?.data?.[0] || data?.data || song;
        }
        const url = bestUrl(target.download_url || target.downloadUrl);
        if (!url) {
          toast.error("No playable URL for this song.");
          return;
        }

        audio.pause();
        audio.src = url;
        audio.volume = vlRef.current;

        if (!_fromDuo) {
          duoRef.current.syncSongChange(
            target,
            newQueue.length > 0 ? newQueue : [target],
            newQueue.length > 0
              ? newQueue.findIndex((s: any) => s.id === song.id)
              : 0,
          );
        }

        setCurrentSong(target);
        setIsPlaying(true);
        setCurrentTime(0);
        addRecent(target);
        audio.play().catch(() => {});

        // Log to backend for profile stats
        api.logHistory({
          songId: target.id,
          title: target.name || "",
          artist: getArtists(target),
          albumArt: bestImg(target.image) || "",
          duration: Number(target.duration) || 0,
          source: "player",
          language: target.language || "",
        });

        if (newQueue.length > 0) {
          setQueue(newQueue);
          const idx = newQueue.findIndex((s: any) => s.id === song.id);
          setQueueIndex(idx);
          qRef.current = newQueue;
          qiRef.current = idx;
        }

        if (newQueue.length <= 1) {
          fetch(`${API}/song/recommend?id=${target.id}&n=10`)
            .then((r) => r.json())
            .then((d) => {
              const suggs = Array.isArray(d?.data) ? d.data : [];
              if (suggs.length)
                setQueue((prev) =>
                  prev.length <= 1 ? [target, ...suggs] : [...prev, ...suggs],
                );
            })
            .catch(() => {});
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          toast.error("Playback failed. Try another song.");
          setIsPlaying(false);
        }
      }
    },
    [addRecent],
  );

  playSongRef.current = playSong;
  duoCurrentSongRef.current = currentSong;
  duoQueueRef.current = queue;

  // ── Audio event listeners ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (!seekingRef.current) setCurrentTime(audio.currentTime);
    };
    const onMeta = () => {
      const d = audio.duration;
      setDuration(d && isFinite(d) ? d : 0);
    };
    const onError = () => {
      toast.error("Audio load failed.");
      setIsPlaying(false);
    };
    const onEnded = () => {
      const q = qRef.current,
        idx = qiRef.current;
      const rep = rpRef.current,
        shf = sfRef.current;
      if (rep === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      if (!q.length) return;
      let next: number;
      if (shf) {
        next = Math.floor(Math.random() * q.length);
      } else {
        next = idx + 1;
        if (next >= q.length) {
          if (rep === "all") {
            next = 0;
          } else {
            const cur = csRef.current;
            if (cur) {
              fetch(`${API}/song/recommend?id=${cur.id}&n=10`)
                .then((r) => r.json())
                .then((d) => {
                  const suggs = Array.isArray(d?.data) ? d.data : [];
                  if (suggs.length) {
                    setQueue((prev) => {
                      const ext = [...prev, ...suggs];
                      qRef.current = ext;
                      const ni = idx + 1;
                      qiRef.current = ni;
                      playSong(ext[ni], ext);
                      return ext;
                    });
                  }
                })
                .catch(() => {});
            }
            return;
          }
        }
      }
      setQueueIndex(next);
      qiRef.current = next;
      playSong(q[next], q);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [playSong]);

  // ── Playback controls ──
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      duoRef.current.syncPause(audio.currentTime);
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          duoRef.current.syncPlay(audio.currentTime, currentSong?.id);
        })
        .catch(() => {});
    }
  }, [isPlaying, currentSong]);

  const handleSeek = useCallback((v: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = v;
      setCurrentTime(v);
      duoRef.current.syncSeek(v);
    }
  }, []);

  const handleSeekStart = useCallback(() => {
    seekingRef.current = true;
  }, []);
  const handleSeekEnd = useCallback(() => {
    seekingRef.current = false;
  }, []);

  const handleVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (audio) audio.volume = v;
    setVolume(v);
  }, []);

  const handleNext = useCallback(() => {
    const q = qRef.current,
      idx = qiRef.current;
    if (!q.length) return;
    let next: number;
    if (sfRef.current) next = Math.floor(Math.random() * q.length);
    else {
      next = idx + 1;
      if (next >= q.length) next = rpRef.current === "all" ? 0 : q.length - 1;
    }
    setQueueIndex(next);
    qiRef.current = next;
    playSong(q[next], q);
  }, [playSong]);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const q = qRef.current,
      idx = qiRef.current;
    if (!q.length) return;
    const prev = Math.max(0, idx - 1);
    setQueueIndex(prev);
    qiRef.current = prev;
    playSong(q[prev], q);
  }, [playSong]);

  const handleLike = useCallback(
    (song: any) => {
      const wasLiked = !!likedSongs[song.id];
      toggleLike(song);
      toast(wasLiked ? "Removed from Liked Songs" : "Added to Liked Songs ♥", {
        icon: wasLiked ? "💔" : "❤️",
        duration: 2000,
      });
      // Sync to cloud
      if (wasLiked) {
        api.unlikeSong(song.id).catch(() => {});
      } else {
        api
          .likeSong({
            songId: song.id,
            title: song.name || "",
            artist: getArtists(song),
            albumArt: bestImg(song.image) || "",
            duration: Number(song.duration) || 0,
          })
          .catch(() => {});
      }
    },
    [likedSongs, toggleLike],
  );

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      const next = r === "off" ? "all" : r === "all" ? "one" : "off";
      rpRef.current = next;
      return next;
    });
  }, []);

  // ── Queue operations ──
  const addToQueue = useCallback((song: any) => {
    setQueue((prev) => [...prev, song]);
    toast.success("Added to queue");
  }, []);

  const playNextInQueue = useCallback((song: any) => {
    setQueue((prev) => {
      const next = [...prev];
      next.splice(qiRef.current + 1, 0, song);
      return next;
    });
    toast.success("Playing next");
  }, []);

  // ── Queue move / remove ──
  const moveInQueue = useCallback((from: number, to: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      // Adjust queueIndex if needed
      let idx = qiRef.current;
      if (from === idx) idx = to;
      else {
        if (from < idx && to >= idx) idx--;
        else if (from > idx && to <= idx) idx++;
      }
      qiRef.current = idx;
      setQueueIndex(idx);
      qRef.current = next;
      return next;
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => {
      if (index <= qiRef.current) return prev; // don't remove already-played items
      const next = [...prev];
      next.splice(index, 1);
      qRef.current = next;
      return next;
    });
    toast.success("Removed from queue");
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
      if (e.key === "m" || e.key === "M")
        handleVolume(vlRef.current > 0 ? 0 : 0.8);
      if (e.key === "q" || e.key === "Q") setQueueOpen((p) => !p);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handlePlayPause, handleNext, handlePrev, handleVolume]);

  const jumpToQueue = useCallback(
    (idx: number) => {
      const q = qRef.current;
      setQueueIndex(idx);
      qiRef.current = idx;
      playSong(q[idx], q);
    },
    [playSong],
  );

  const goHome = useCallback(() => {
    navigate("/");
    setLiveQuery("");
    setSearchQuery("");
    useDuoStore.getState().setPanelOpen(false);
  }, [navigate, setSearchQuery]);

  // ── Context value ──
  const contextValue = useMemo(
    () => ({
      playSong,
      currentSong,
      isPlaying,
      likedSongs,
      handleLike,
      recentlyPlayed,
      handlePlayPause,
      addToQueue,
      playNext: playNextInQueue,
    }),
    [
      playSong,
      currentSong,
      isPlaying,
      likedSongs,
      handleLike,
      recentlyPlayed,
      handlePlayPause,
      addToQueue,
      playNextInQueue,
    ],
  );

  // ───────────────────────────────────────────────────────────────────
  return (
    <AppContext.Provider value={contextValue}>
      <div
        className="flex h-screen bg-sp-black overflow-hidden"
        style={{ fontFamily: "'Inter',system-ui,sans-serif" }}
      >
        <audio ref={audioRef} preload="metadata" />

        <Sidebar />

        <div
          className={`flex-1 ${sidebarCollapsed ? "md:ml-[4.5rem]" : "md:ml-[17rem]"} ${queueOpen || duoPanelOpen ? "md:mr-80" : ""} flex flex-col overflow-hidden transition-all duration-300`}
        >
          {/* Top bar */}
          <div
            className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-3.5 sticky top-0 z-20 backdrop-blur-2xl"
            style={{
              background: `linear-gradient(to bottom,${bgColor}60 0%,transparent 100%)`,
            }}
          >
            {/* Mobile logo */}
            <button
              onClick={goHome}
              className="flex items-center gap-2 md:hidden flex-shrink-0 active:scale-95 transition-transform"
            >
              <div
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-sp-green to-emerald-400 flex items-center justify-center"
                style={{ boxShadow: "0 0 16px rgba(29,185,84,0.2)" }}
              >
                <Music2 size={14} className="text-black" strokeWidth={2.5} />
              </div>
              <span className="text-[15px] font-extrabold tracking-tight text-white">
                Soul<span className="text-sp-green">Sync</span>
              </span>
            </button>

            {/* Desktop nav arrows */}
            <div className="hidden md:flex gap-1.5 flex-shrink-0">
              <button
                onClick={() => navigate(-1)}
                className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-white hover:bg-white/[0.12] transition-all duration-200"
              >
                <ChevronLeft size={14} />
              </button>
              {duoActive && <DuoHeartbeat />}
            </div>

            {/* Search input */}
            <div className="flex-1 relative">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
              />
              <input
                type="text"
                value={liveQuery}
                onChange={(e) => setLiveQuery(e.target.value)}
                onFocus={() => {
                  if (!liveQuery.trim()) navigate("/search");
                }}
                placeholder="Search songs, artists, albums..."
                className="w-full text-[13px] text-white placeholder-white/25 rounded-full pl-10 pr-9 py-2.5 outline-none border border-white/[0.06] focus:border-white/[0.15] transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
              {liveQuery && (
                <button
                  onClick={() => {
                    setLiveQuery("");
                    setSearchQuery("");
                    navigate("/");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 pb-32 md:pb-28">
            <Outlet />
          </main>
        </div>

        {queueOpen && (
          <QueuePanel
            queue={queue}
            queueIndex={queueIndex}
            currentSong={currentSong}
            onClose={() => setQueueOpen(false)}
            onJump={jumpToQueue}
            onMove={moveInQueue}
            onRemove={removeFromQueue}
          />
        )}

        <PlayerBar
          currentSong={currentSong}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          shuffle={shuffle}
          repeat={repeat}
          likedSongs={likedSongs}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onSeekStart={handleSeekStart}
          onSeekEnd={handleSeekEnd}
          onVolume={handleVolume}
          onPrev={handlePrev}
          onNext={handleNext}
          onShuffle={() => setShuffle((s) => !s)}
          onRepeat={cycleRepeat}
          onLike={handleLike}
          onOpenFullscreen={() => setNpOpen(true)}
          onToggleQueue={() => setQueueOpen((q) => !q)}
          queueOpen={queueOpen}
        />

        {npOpen && currentSong && (
          <NowPlayingView
            currentSong={currentSong}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            shuffle={shuffle}
            repeat={repeat}
            liked={!!likedSongs[currentSong?.id]}
            onClose={() => setNpOpen(false)}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onSeekStart={handleSeekStart}
            onSeekEnd={handleSeekEnd}
            onVolume={handleVolume}
            onPrev={handlePrev}
            onNext={handleNext}
            onShuffle={() => setShuffle((s) => !s)}
            onRepeat={cycleRepeat}
            onLike={handleLike}
            onPlaySong={(song: any) => playSong(song, [])}
          />
        )}

        {duoActive && (
          <DuoMobileBar
            currentSong={currentSong}
            onEndSession={duo.endSession}
            onOpenPanel={() => useDuoStore.getState().setPanelOpen(true)}
          />
        )}

        <MobileNav />

        <DuoModal onCreate={duo.createSession} onJoin={duo.joinSession} />
        {duoActive && (
          <DuoPanel
            onSendMessage={duo.sendMessage}
            onEndSession={duo.endSession}
          />
        )}
        <DuoEndCard />
        <ContextMenu />
        <AIPlaylistModal />
      </div>
    </AppContext.Provider>
  );
}
