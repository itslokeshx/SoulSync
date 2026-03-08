import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  ListPlus,
  ListEnd,
  Heart,
  HeartOff,
  Download,
  User,
  Disc3,
  FolderPlus,
  ChevronRight,
  Loader2,
  Check,
  Share2,
} from "lucide-react";
import { useUIStore } from "../../store/uiStore";
import { useApp } from "../../context/AppContext";
import { getArtists } from "../../lib/helpers";
import { downloadSong } from "../../utils/downloadSong";
import { shareSong } from "../../utils/share";
import { useAuthGate } from "../../hooks/useAuthGate";
import * as api from "../../api/backend";
import toast from "react-hot-toast";

export function ContextMenu() {
  const { contextMenu, hideContextMenu } = useUIStore();
  const { playSong, handleLike, likedSongs, addToQueue, playNext } = useApp();
  const { gate } = useAuthGate();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [addedToId, setAddedToId] = useState<string | null>(null);

  const song = contextMenu.song as any;
  const isLiked = song ? !!likedSongs[song.id] : false;

  // Close on outside click
  useEffect(() => {
    if (!contextMenu.show) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideContextMenu();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu.show, hideContextMenu]);

  // Reset submenu when menu closes
  useEffect(() => {
    if (!contextMenu.show) {
      setShowPlaylists(false);
      setAddedToId(null);
    }
  }, [contextMenu.show]);

  if (!contextMenu.show || !song) return null;

  const x = Math.min(contextMenu.x, window.innerWidth - 240);
  const y = Math.min(contextMenu.y, window.innerHeight - 380);

  const handleAddToPlaylist = async () => {
    setShowPlaylists(true);
    if (!playlists.length) {
      setLoadingPlaylists(true);
      try {
        const lists = await api.getPlaylists();
        setPlaylists(lists);
      } catch {
        toast.error("Failed to load playlists");
      } finally {
        setLoadingPlaylists(false);
      }
    }
  };

  const handlePickPlaylist = async (pl: any) => {
    try {
      await api.addSongToPlaylist(pl._id, song);
      setAddedToId(pl._id);
      toast.success(`Added to "${pl.name}"`);
      setTimeout(() => hideContextMenu(), 700);
    } catch {
      toast.error("Failed to add to playlist");
    }
  };

  const mainActions = [
    {
      icon: Play,
      label: "Play",
      action: () => {
        playSong(song);
        hideContextMenu();
      },
    },
    {
      icon: ListPlus,
      label: "Play Next",
      action: () => {
        playNext(song);
        hideContextMenu();
      },
    },
    {
      icon: ListEnd,
      label: "Add to Queue",
      action: () => {
        addToQueue(song);
        hideContextMenu();
      },
    },
    { divider: true },
    {
      icon: isLiked ? HeartOff : Heart,
      label: isLiked ? "Remove from Liked" : "Add to Liked",
      action: () => {
        handleLike(song);
        hideContextMenu();
      },
      green: !isLiked,
    },
    {
      icon: Download,
      label: "Download",
      action: () => {
        downloadSong(song);
        hideContextMenu();
      },
    },
    {
      icon: FolderPlus,
      label: "Add to Playlist",
      action: () => gate(handleAddToPlaylist, "Sign in to add this song to a playlist"),
      submenu: true,
    },
    {
      icon: Share2,
      label: "Share",
      action: () => {
        shareSong(song);
        hideContextMenu();
      },
    },
    { divider: true },
    ...(song.artists?.primary?.[0]?.id ||
      song.artist_map?.primary_artists?.[0]?.id
      ? [
        {
          icon: User,
          label: "View Artist",
          action: () => {
            const artistId =
              song.artists?.primary?.[0]?.id ||
              song.artist_map?.primary_artists?.[0]?.id;
            if (artistId) navigate(`/artist/${artistId}`);
            hideContextMenu();
          },
        },
      ]
      : []),
    ...(song.album?.id
      ? [
        {
          icon: Disc3,
          label: "View Album",
          action: () => {
            navigate(`/album/${song.album.id}`);
            hideContextMenu();
          },
        },
      ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-[100]" onClick={hideContextMenu}>
      <div
        ref={menuRef}
        className="absolute w-56 py-1.5 rounded-xl shadow-2xl shadow-black/70 backdrop-blur-xl animate-fadeIn"
        style={{
          left: x,
          top: y,
          background: "#1a1a1a",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Song info header */}
        <div
          className="px-3 py-2.5 border-b mb-1"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs font-semibold text-white truncate">
            {song.name}
          </p>
          <p className="text-[10px] text-white/35 truncate mt-0.5">
            {getArtists(song)}
          </p>
        </div>

        {/* Main actions */}
        {!showPlaylists &&
          mainActions.map((item: any, i) => {
            if (item.divider) {
              return (
                <div
                  key={`div-${i}`}
                  className="my-1 h-px mx-2"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />
              );
            }
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-white/75 hover:bg-white/[0.07] hover:text-white transition-all duration-100"
              >
                <Icon
                  size={13}
                  className={`flex-shrink-0 ${item.green ? "text-sp-green" : "text-white/40"}`}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {item.submenu && (
                  <ChevronRight size={12} className="text-white/25" />
                )}
              </button>
            );
          })}

        {/* Playlist submenu */}
        {showPlaylists && (
          <div>
            <button
              onClick={() => setShowPlaylists(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-white/40 hover:text-white transition-colors"
            >
              <ChevronRight size={12} className="rotate-180" />
              Add to Playlist
            </button>
            <div
              className="my-1 h-px mx-2"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            {loadingPlaylists ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="text-white/30 animate-spin" />
              </div>
            ) : playlists.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-white/30 text-center">
                No playlists yet
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto">
                {playlists.map((pl) => (
                  <button
                    key={pl._id}
                    onClick={() => handlePickPlaylist(pl)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-white/75 hover:bg-white/[0.07] hover:text-white transition-all"
                  >
                    <FolderPlus
                      size={13}
                      className="text-white/30 flex-shrink-0"
                    />
                    <span className="flex-1 text-left truncate">{pl.name}</span>
                    {addedToId === pl._id && (
                      <Check
                        size={12}
                        className="text-sp-green flex-shrink-0"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
