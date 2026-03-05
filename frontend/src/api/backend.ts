import axios from "axios";
import { Playlist, AIPlaylistResult } from "../types/playlist";
import { User, UserStats } from "../types/user";
import { isNative } from "../utils/platform";

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:4000",
  withCredentials: true,
  timeout: 30000,
});

// ── Native token management ──
let _nativeToken: string | null = null;

export function setNativeToken(token: string | null) {
  _nativeToken = token;
}

export function getNativeToken(): string | null {
  return _nativeToken;
}

/** Load token from Capacitor Preferences (call once on app start) */
export async function loadNativeToken(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: "auth_token" });
    if (value) _nativeToken = value;
    return value;
  } catch {
    return null;
  }
}

/** Save token to Capacitor Preferences */
export async function saveNativeToken(token: string): Promise<void> {
  _nativeToken = token;
  if (!isNative()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: "auth_token", value: token });
  } catch {}
}

/** Clear stored native token */
export async function clearNativeToken(): Promise<void> {
  _nativeToken = null;
  if (!isNative()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key: "auth_token" });
  } catch {}
}

// Attach Bearer token for native requests
api.interceptors.request.use((config) => {
  if (isNative() && _nativeToken) {
    config.headers.Authorization = `Bearer ${_nativeToken}`;
  }
  return config;
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
      // On native, store the JWT token for session persistence
      if (data.token) {
        await saveNativeToken(data.token);
      }
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
  await clearNativeToken();
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
