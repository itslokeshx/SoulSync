import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Sparkles,
  Loader2,
  Play,
  Save,
  Check,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "../../store/uiStore";
import { useApp } from "../../context/AppContext";
import { bestImg, getArtists, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";
import * as api from "../../api/backend";
import toast from "react-hot-toast";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://soulsync-backend-a5fs.onrender.com";
const MAX_SONGS_INPUT = 100;
const MAX_CHARS = 10000;

const MOOD_CHIPS = [
  "Chill late night",
  "Tamil party vibes",
  "Romantic drive",
  "Focus & study",
  "Workout pump",
  "Sad & emotional",
  "90s nostalgia",
  "Morning energy",
  "Rainy day",
  "Bollywood classics",
];

export function AIPlaylistModal() {
  const { aiPlaylistOpen, closeAIPlaylist } = useUIStore();
  const { playSong } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"mood" | "songs">("mood");
  const [mood, setMood] = useState("");
  const [songList, setSongList] = useState("");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [playlistName, setPlaylistName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [targetCount, setTargetCount] = useState(20);
  const [streamProgress, setStreamProgress] = useState({
    message: "",
    percent: 0,
  });
  const [streamedSongs, setStreamedSongs] = useState<any[]>([]);
  const esRef = useRef<EventSource | null>(null);

  // Reset when closed
  useEffect(() => {
    if (!aiPlaylistOpen) {
      esRef.current?.close();
      esRef.current = null;
      setResults(null);
      setMood("");
      setSongList("");
      setGenerating(false);
      setPlaylistName("");
      setSelected(new Set());
      setMode("mood");
      setStreamProgress({ message: "", percent: 0 });
      setStreamedSongs([]);
    }
  }, [aiPlaylistOpen]);

  const allSongs: any[] = [
    ...(results?.matched || []),
    ...(results?.partial || []),
  ]
    .map((m: any) => m.song)
    .filter(Boolean);

  const handleGenerate = async () => {
    if (mode === "mood" && !mood.trim()) return;
    if (mode === "songs" && !songList.trim()) return;
    setGenerating(true);
    setResults(null);
    setStreamedSongs([]);
    setStreamProgress({ message: "Starting AI...", percent: 2 });

    const songs =
      mode === "songs"
        ? songList
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    try {
      const token = api.getNativeToken();
      const response = await fetch(`${BACKEND_URL}/api/ai/build-playlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          songs,
          mood: mode === "mood" ? mood.trim() : undefined,
          targetCount,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Generation failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trimEnd();
          if (trimmed.startsWith("event: ")) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (currentEvent === "progress") {
                setStreamProgress({
                  message: data.message ?? "",
                  percent: data.percent ?? 0,
                });
              } else if (currentEvent === "song" && data.song) {
                setStreamedSongs((prev) => {
                  if (prev.find((s) => s.id === data.song.id)) return prev;
                  return [...prev, data.song];
                });
              } else if (currentEvent === "done") {
                setResults(data);
                setPlaylistName(data.playlistName || "AI Mix");
                const ids = new Set<string>(
                  [...(data.matched || []), ...(data.partial || [])]
                    .map((m: any) => m.song?.id)
                    .filter(Boolean),
                );
                setSelected(ids);
                setGenerating(false);
                return;
              } else if (currentEvent === "error") {
                throw new Error(data.message || "AI error");
              }
            } catch (parseErr: any) {
              if (parseErr?.message) throw parseErr;
            }
            currentEvent = "";
          } else if (trimmed === "") {
            // blank line = SSE event boundary; currentEvent is reset after data
          }
        }
      }
    } catch (err: any) {
      const msg = err?.message || "AI generation failed. Please try again.";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const toggleSong = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSave = async () => {
    if (!playlistName.trim() || selected.size === 0) return;
    setSaving(true);
    try {
      // Map JioSaavn objects → PlaylistSong schema { songId, title, artist, albumArt, duration, downloadUrl }
      const songs = allSongs
        .filter((s: any) => s?.id && selected.has(s.id))
        .map((s: any) => ({
          songId: s.id,
          title: s.name || s.title || "",
          artist: getArtists(s),
          albumArt: bestImg(s.image) || "",
          duration: s.duration || 0,
          downloadUrl: (s.download_url || s.downloadUrl || []).map(
            (u: any) => ({
              quality: u.quality || "",
              url: u.link || u.url || "",
            }),
          ),
        }));
      const playlist = await api.createPlaylist({
        name: playlistName,
        isAIGenerated: true,
        songs,
      });
      toast.success(`✨ "${playlist.name}" saved!`);
      closeAIPlaylist();
      navigate(`/playlist/${playlist._id}`);
    } catch {
      toast.error("Failed to save playlist");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {aiPlaylistOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAIPlaylist();
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 24, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
            style={{
              background:
                "linear-gradient(155deg,#141428 0%,#0c0c18 60%,#080810 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow:
                "0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(29,185,84,0.05)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg,#1db954,#0d9e3e)",
                    boxShadow: "0 0 20px rgba(29,185,84,0.3)",
                  }}
                >
                  <Sparkles size={18} className="text-black" />
                </div>
                <div>
                  <p className="text-white font-bold text-[15px]">
                    AI Playlist Builder
                  </p>
                  <p className="text-white/35 text-[11px]">Powered by Groq</p>
                </div>
              </div>
              <button
                onClick={closeAIPlaylist}
                className="text-white/25 hover:text-white p-2 rounded-xl hover:bg-white/[0.06] transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!results && !generating && (
                <div className="space-y-5">
                  {/* Mode toggle */}
                  <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.05]">
                    {(["mood", "songs"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
                          mode === m
                            ? "bg-white text-black shadow-lg"
                            : "text-white/40 hover:text-white"
                        }`}
                      >
                        {m === "mood" ? "✨ By Mood" : "🎵 From Song Names"}
                      </button>
                    ))}
                  </div>

                  {mode === "mood" ? (
                    <div className="space-y-4">
                      <textarea
                        value={mood}
                        onChange={(e) => setMood(e.target.value)}
                        placeholder='Describe your vibe... e.g. "chill late night tamil songs with emotional feels"'
                        rows={3}
                        className="w-full rounded-2xl px-4 py-3 text-white text-[13px] placeholder-white/20 outline-none resize-none transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "rgba(29,185,84,0.4)")
                        }
                        onBlur={(e) =>
                          (e.target.style.borderColor =
                            "rgba(255,255,255,0.07)")
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        {MOOD_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            onClick={() =>
                              setMood((p) => (p ? `${p}, ${chip}` : chip))
                            }
                            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:border-sp-green/40 hover:text-sp-green hover:bg-sp-green/[0.08]"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              borderColor: "rgba(255,255,255,0.07)",
                              color: "rgba(255,255,255,0.55)",
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-white/35 text-xs">
                          One song per line — typos are totally fine!
                        </p>
                        <span
                          className={`text-[11px] ${songList.length > MAX_CHARS * 0.9 ? "text-amber-400" : "text-white/20"}`}
                        >
                          {songList.split("\n").filter(Boolean).length}/
                          {MAX_SONGS_INPUT}
                        </span>
                      </div>
                      <textarea
                        value={songList}
                        onChange={(e) =>
                          setSongList(e.target.value.slice(0, MAX_CHARS))
                        }
                        placeholder={
                          "Blinding Lights\nKanimaa\nSawadeeka\nAs It Was\nHeat Waves\nOg Sambavam"
                        }
                        rows={8}
                        className="w-full rounded-2xl px-4 py-3 text-white text-[13px] placeholder-white/[0.15] outline-none resize-none font-mono transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                        onFocus={(e) =>
                          (e.target.style.borderColor = "rgba(29,185,84,0.4)")
                        }
                        onBlur={(e) =>
                          (e.target.style.borderColor =
                            "rgba(255,255,255,0.07)")
                        }
                      />
                    </div>
                  )}

                  {/* Target count slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-white/40 text-[12px]">
                        Songs to generate
                      </span>
                      <span className="text-sp-green font-bold text-[13px]">
                        {targetCount}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={targetCount}
                      onChange={(e) => setTargetCount(Number(e.target.value))}
                      className="w-full accent-sp-green cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-white/20">
                      <span>5</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={mode === "mood" ? !mood.trim() : !songList.trim()}
                    className="w-full py-3.5 rounded-2xl font-bold text-[14px] transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg,#1db954,#16a34a)",
                      color: "#000",
                      boxShadow: "0 4px 20px rgba(29,185,84,0.25)",
                    }}
                  >
                    <Sparkles size={16} />
                    Generate {targetCount} Songs
                  </button>
                </div>
              )}

              {/* Generating animation with SSE progress */}
              {generating && (
                <div className="flex flex-col items-center py-10 gap-5">
                  <div className="relative">
                    <div
                      className="w-20 h-20 rounded-3xl flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg,#1db954,#0d9e3e)",
                        boxShadow: "0 0 40px rgba(29,185,84,0.4)",
                      }}
                    >
                      <Sparkles size={32} className="text-black" />
                    </div>
                    <div className="absolute -inset-2 rounded-[28px] border-2 border-sp-green/20 animate-ping" />
                  </div>

                  {/* Progress bar */}
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/50">
                        {streamProgress.message || "Thinking..."}
                      </span>
                      <span className="text-sp-green font-bold">
                        {streamProgress.percent}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full bg-sp-green rounded-full transition-all duration-300"
                        style={{ width: `${streamProgress.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Live song preview */}
                  {streamedSongs.length > 0 && (
                    <div className="w-full space-y-1 max-h-48 overflow-y-auto thin-scrollbar">
                      <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">
                        Found so far ({streamedSongs.length})
                      </p>
                      {streamedSongs.slice(-8).map((song) => (
                        <div
                          key={song.id}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg"
                        >
                          <img
                            src={bestImg(song.image) || FALLBACK_IMG}
                            onError={onImgErr}
                            className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                            alt=""
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white/70 text-[12px] truncate">
                              {song.name}
                            </p>
                            <p className="text-white/30 text-[11px] truncate">
                              {getArtists(song)}
                            </p>
                          </div>
                          <Check
                            size={12}
                            className="text-sp-green flex-shrink-0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {results && !generating && (
                <div className="space-y-5">
                  {/* Playlist name */}
                  <div>
                    <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">
                      Playlist Name
                    </p>
                    <input
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      className="w-full rounded-xl px-4 py-2.5 text-white font-bold text-[15px] outline-none transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                      onFocus={(e) =>
                        (e.target.style.borderColor = "rgba(29,185,84,0.4)")
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.07)")
                      }
                    />
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div
                      className="py-3 rounded-xl"
                      style={{
                        background: "rgba(29,185,84,0.08)",
                        border: "1px solid rgba(29,185,84,0.12)",
                      }}
                    >
                      <p className="text-sp-green font-black text-2xl">
                        {results.matched?.length || 0}
                      </p>
                      <p className="text-white/35 text-[11px] mt-0.5">
                        Matched
                      </p>
                    </div>
                    <div
                      className="py-3 rounded-xl"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <p className="text-white font-black text-2xl">
                        {results.partial?.length || 0}
                      </p>
                      <p className="text-white/35 text-[11px] mt-0.5">
                        Similar
                      </p>
                    </div>
                    <div
                      className="py-3 rounded-xl"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <p className="text-white/40 font-black text-2xl">
                        {results.unmatched?.length || 0}
                      </p>
                      <p className="text-white/25 text-[11px] mt-0.5">
                        Not found
                      </p>
                    </div>
                  </div>

                  {/* Song list */}
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
                    Songs ({selected.size} selected)
                  </p>
                  <div className="space-y-1">
                    {allSongs.map((song: any) => {
                      if (!song?.id) return null;
                      const img = bestImg(song.image, "50x50") || FALLBACK_IMG;
                      const isSel = selected.has(song.id);
                      return (
                        <div
                          key={song.id}
                          onClick={() => toggleSong(song.id)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                            isSel
                              ? "bg-white/[0.05]"
                              : "opacity-35 hover:opacity-60"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              isSel
                                ? "bg-sp-green border-sp-green"
                                : "border-white/20"
                            }`}
                          >
                            {isSel && (
                              <Check
                                size={11}
                                className="text-black"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                          <img
                            src={img}
                            onError={onImgErr}
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-semibold truncate">
                              {song.name}
                            </p>
                            <p className="text-white/35 text-[11px] truncate">
                              {getArtists(song)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playSong(song);
                            }}
                            className="text-white/25 hover:text-sp-green p-1.5 rounded-lg hover:bg-sp-green/10 transition-all flex-shrink-0"
                          >
                            <Play size={12} className="fill-current" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setResults(null)}
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white/40 hover:text-white border border-white/[0.07] hover:border-white/[0.14] transition-all"
                    >
                      <RotateCcw size={13} /> Try Again
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || selected.size === 0}
                      className="flex-1 py-2.5 rounded-xl font-bold text-[13px] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                      style={{
                        background: "linear-gradient(135deg,#1db954,#16a34a)",
                        color: "#000",
                      }}
                    >
                      {saving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Save {selected.size > 0 ? `(${selected.size} songs)` : ""}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
