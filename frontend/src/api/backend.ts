import axios from "axios";
import { Playlist, AIPlaylistResult } from "../types/playlist";
import { User, UserStats } from "../types/user";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:4000",
  withCredentials: true,
  timeout: 30000,
});

// Wake up backend on first load (Render free tier sleeps after 15 min)
let _wakeUpDone = false;
async function ensureBackendAwake() {
  if (_wakeUpDone) return;
  try {
    await api.get("/health", { timeout: 45000 });
    _wakeUpDone = true;
  } catch {
    // Backend might be sleeping, give it time
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────
export async function loginWithGoogle(
  idToken: string,
): Promise<{ user: User; isNewUser: boolean }> {
  // Ensure backend is awake before login attempt
  await ensureBackendAwake();
  // Retry up to 3 times for cold-start scenarios
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await api.post(
        "/api/auth/google",
        { idToken },
        {
          timeout: 30000,
        },
      );
      return data;
    } catch (err) {
      lastErr = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}

export async function getMe(): Promise<User | null> {
  try {
    const { data } = await api.get("/api/auth/me");
    return data.user;
  } catch {
    return null;
  }
}

// ── User ────────────────────────────────────────────────────────────────────
export async function updatePreferences(prefs: {
  name?: string;
  languages?: string[];
  eras?: string[];
  moods?: string[];
}): Promise<User> {
  const { data } = await api.patch("/api/user/preferences", prefs);
  return data.user;
}

export async function logHistory(entry: {
  songId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  source?: string;
  language?: string;
}): Promise<void> {
  await api.post("/api/user/history", entry).catch(() => {});
}

export async function getHistory(
  page = 1,
  limit = 20,
): Promise<{ history: unknown[]; total: number }> {
  const { data } = await api.get("/api/user/history", {
    params: { page, limit },
  });
  return data;
}

export async function likeSong(song: {
  songId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  downloadUrl?: { quality: string; url: string }[];
}): Promise<void> {
  await api.post("/api/user/liked", { song });
}

export async function unlikeSong(songId: string): Promise<void> {
  await api.delete(`/api/user/liked/${songId}`);
}

export async function getLikedSongs(): Promise<unknown[]> {
  const { data } = await api.get("/api/user/liked");
  return data.likedSongs || [];
}

export async function getUserStats(): Promise<UserStats> {
  const { data } = await api.get("/api/user/stats");
  return data;
}

// ── Playlists ───────────────────────────────────────────────────────────────
export async function getPlaylists(): Promise<Playlist[]> {
  const { data } = await api.get("/api/playlists");
  return data.playlists || [];
}

export async function getPlaylist(id: string): Promise<Playlist> {
  const { data } = await api.get(`/api/playlists/${id}`);
  return data.playlist;
}

export async function createPlaylist(payload: {
  name: string;
  description?: string;
  isPublic?: boolean;
  isAIGenerated?: boolean;
  songs?: unknown[];
  tags?: string[];
}): Promise<Playlist> {
  const { data } = await api.post("/api/playlists", payload);
  return data.playlist;
}

export async function updatePlaylist(
  id: string,
  payload: {
    name?: string;
    description?: string;
    isPublic?: boolean;
  },
): Promise<Playlist> {
  const { data } = await api.patch(`/api/playlists/${id}`, payload);
  return data.playlist;
}

export async function deletePlaylist(id: string): Promise<void> {
  await api.delete(`/api/playlists/${id}`);
}

export async function addSongToPlaylist(
  playlistId: string,
  song: unknown,
): Promise<Playlist> {
  const { data } = await api.post(`/api/playlists/${playlistId}/songs`, {
    song,
  });
  return data.playlist;
}

export async function removeSongFromPlaylist(
  playlistId: string,
  songId: string,
): Promise<Playlist> {
  const { data } = await api.delete(
    `/api/playlists/${playlistId}/songs/${songId}`,
  );
  return data.playlist;
}

// ── Search (via backend) ────────────────────────────────────────────────────
export async function smartSearch(
  query: string,
  type = "all",
  limit = 25,
): Promise<unknown> {
  const { data } = await api.get("/api/search", {
    params: { q: query, type, limit },
  });
  return data;
}

export async function getSearchSuggestions(query: string): Promise<unknown> {
  const { data } = await api.get("/api/search/suggestions", {
    params: { q: query },
  });
  return data;
}

export async function getTrending(): Promise<unknown> {
  const { data } = await api.get("/api/search/top");
  return data;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export async function getDashboard(): Promise<unknown> {
  const { data } = await api.get("/api/dashboard");
  return data;
}

export async function getGuestDashboard(): Promise<unknown> {
  const { data } = await api.get("/api/dashboard/guest");
  return data;
}

// ── AI ──────────────────────────────────────────────────────────────────────
export async function buildAIPlaylist(
  songs?: string[],
  mood?: string,
): Promise<AIPlaylistResult> {
  const { data } = await api.post("/api/ai/build-playlist", { songs, mood });
  return data;
}

// ── Duo Session ─────────────────────────────────────────────────────────────
export async function createSession(
  hostName: string,
): Promise<{ code: string; sessionId: string }> {
  const { data } = await api.post("/api/session/create", { hostName });
  return data;
}

export async function joinSession(
  code: string,
  guestName: string,
): Promise<unknown> {
  const { data } = await api.post("/api/session/join", { code, guestName });
  return data;
}

export async function getSession(code: string): Promise<unknown> {
  const { data } = await api.get(`/api/session/${code}`);
  return data;
}
