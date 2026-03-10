import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import * as api from "../api/backend";
import toast from "react-hot-toast";

export default function SongSharePage() {
  const params = useParams<{ slug?: string; id?: string }>();
  const id = params.id || params.slug;
  const navigate = useNavigate();
  const { playSong } = useApp();

  useEffect(() => {
    if (!id) {
      navigate("/", { replace: true });
      return;
    }

    const loadAndPlay = async () => {
      try {
        // Backend /api/search/song returns a single Song object (not an array)
        const res = await api.getSongDetails(id);
        // Handle both a direct song object and an array (future-proof)
        const song = Array.isArray(res) ? res[0] : res;
        if (song && (song.id || song.songId)) {
          playSong(song, [song]);
          toast.success(`Playing ${song.name || "Shared Song"}`);
          // Navigate to home so the player is visible and the URL cleans up
          navigate("/", { replace: true });
        } else {
          toast.error("Song not found");
          navigate("/", { replace: true });
        }
      } catch (err) {
        console.error("Failed to load shared song", err);
        toast.error("Failed to load shared song");
        navigate("/", { replace: true });
      }
    };

    loadAndPlay();
  }, [id, navigate, playSong]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center animate-pulse">
        <div className="w-16 h-16 border-4 border-sp-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white font-bold">Loading song...</p>
      </div>
    </div>
  );
}
