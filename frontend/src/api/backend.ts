import axios from "axios";
import { Playlist, AIPlaylistResult } from "../types/playlist";
import { User, UserStats } from "../types/user";
import { isNative } from "../utils/platform";
import { bestImg, getArtists } from "../lib/helpers";

export const api = axios.create({
  baseURL: (
    import.meta.env.VITE_BACKEND_URL ||
    "https://soulsync-backend-a5fs.onrender.com"
  ).replace(/\/$/, ""),

  withCredentials: true,
  timeout: 30000,
});

// ── Native and Web token management ──
let _nativeToken: string | null = null;
let _adminToken: string | null = null;

export function setNativeToken(token: string | null) {
  _nativeToken = token;
}

export function getNativeToken(): string | null {
  if (!_nativeToken && typeof window !== "undefined") {
    const webToken = localStorage.getItem("auth_token_web");
    if (webToken) _nativeToken = webToken;
  }
  return _nativeToken;
}

/** Load token from Capacitor Preferences (call once on app start) */
export async function loadNativeToken(): Promise<string | null> {
  if (isNative()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: "auth_token" });
      if (value) _nativeToken = value;
      return value;
    } catch {
      return null;
    }
  } else {
    const val = localStorage.getItem("auth_token_web");
    if (val) _nativeToken = val;
    return val;
  }
}

/** Save token to Capacitor Preferences */
export async function saveNativeToken(token: string): Promise<void> {
  _nativeToken = token;
  if (isNative()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: "auth_token", value: token });
    } catch {}
  } else {
    localStorage.setItem("auth_token_web", token);
  }
}

/** Clear stored native token */
export async function clearNativeToken(): Promise<void> {
  _nativeToken = null;
  if (isNative()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: "auth_token" });
    } catch {}
  } else {
    localStorage.removeItem("auth_token_web");
  }
}

// Track service degradation backoff
let _serviceBackoffUntil = 0;

export function isServiceDegraded(): boolean {
  return Date.now() < _serviceBackoffUntil;
}

// Attach Bearer token for native requests (and web fallback)
api.interceptors.request.use((config) => {
  if (Date.now() < _serviceBackoffUntil) {
    const url = config.url || "";
    // Allow admin, health, cookie updates, and stream requests during backoff
    if (!url.includes("/cookies") && !url.includes("/health") && !url.includes("/admin") && !url.includes("/stream")) {
      const err = new Error("Music service temporarily degraded. Backing off for recovery.");
      (err as any).isBackoff = true;
      return Promise.reject(err);
    }
  }

  const isAdminRequest = config.url?.includes("/admin") || config.url?.includes("/api/feedback/admin");
  if (isAdminRequest && _adminToken) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set("Authorization", `Bearer ${_adminToken}`);
    } else {
      config.headers.Authorization = `Bearer ${_adminToken}`;
    }
  } else {
    const token = getNativeToken();
    if (token) {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set("Authorization", `Bearer ${token}`);
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

// Intercept responses to silently handle expected 401s for guest users and track 503 backoffs
api.interceptors.response.use(
  (response) => {
    const contentType = String(response.headers?.["content-type"] || "");
    if (contentType.includes("text/html")) {
      console.error(
        `[API] Received non-JSON response from ${response.config.url || "unknown URL"} — possible wrong backend URL (hitting client/frontend domain instead).`
      );
      throw new Error(`[API] Expected JSON but received HTML from ${response.config.url || "unknown URL"}`);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 503) {
      const retryAfterHeader = error.response.headers?.["retry-after"];
      const retryAfter = parseInt(retryAfterHeader || "15", 10);
      _serviceBackoffUntil = Date.now() + (isNaN(retryAfter) ? 15 : retryAfter) * 1000;
      console.warn(`[API] Music service degraded (503) — backing off requests for ${retryAfter}s`);
    }

    // Specifically silence 401s from /api/auth/me and /api/playlists which are expected for guests
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      if (url.includes("/api/auth/me") || url.includes("/api/playlists")) {
        // Return a mocked successful-looking rejection to prevent console.error spam from Unhandled Rejections
        return Promise.reject({ ...error, isExpectedAuthError: true });
      }
    }
    return Promise.reject(error);
  },
);

// Wake up backend on first load (Render free tier sleeps after 15 min)
let _wakeUpDone = false;
async function ensureBackendAwake() {
  if (_wakeUpDone) return;
  _wakeUpDone = true;
  try {
    await api.get("/health", { timeout: 45000 });
  } catch {
    // Backend might be sleeping or health check blocked by client extension — continue
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

export async function loginWithCredentials(data: {
  identifier: string;
  password: string;
}): Promise<{ data: { user: User; isNewUser: boolean; token?: string } }> {
  return api.post("/api/auth/login", data);
}

export async function register(data: {
  name: string;
  username?: string;
  email: string;
  password: string;
}): Promise<{ data: { user: User; isNewUser: boolean; token?: string } }> {
  return api.post("/api/auth/register", data);
}

export async function checkUsername(
  username: string,
): Promise<{ available: boolean; reason?: string }> {
  const { data } = await api.get(`/api/auth/check-username?u=${username}`);
  return data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post("/api/auth/forgot-password", { email });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post("/api/auth/reset-password", { token, newPassword });
}

export async function getMe(): Promise<User | null> {
  await ensureBackendAwake();
  try {
    const { data } = await api.get("/api/auth/me", { timeout: 45000 });
    return data.user;
  } catch (err: any) {
    if (err?.response?.status === 401) {
      await clearNativeToken();
    }
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
  artistId?: string;
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

export async function shuffleLikedSongs(): Promise<void> {
  await api.post("/api/user/liked/shuffle");
}

export async function reorderLikedSongs(songIds: string[]): Promise<void> {
  await api.patch("/api/user/liked/reorder", { songIds });
}

export async function getFollowedArtists(): Promise<any[]> {
  try {
    const { data } = await api.get("/api/user/followed-artists");
    return data.followedArtists || [];
  } catch {
    return [];
  }
}

export async function followArtist(artist: {
  id: string;
  name: string;
  image?: string;
  followerCount?: string;
}): Promise<void> {
  await api.post("/api/user/followed-artists", { artist }).catch(() => {});
}

export async function unfollowArtist(artistId: string): Promise<void> {
  await api.delete(`/api/user/followed-artists/${artistId}`).catch(() => {});
}

export async function getUserStats(): Promise<UserStats> {
  const { data } = await api.get("/api/user/stats");
  return data;
}

// ── Playlists ───────────────────────────────────────────────────────────────
export async function getPlaylists(): Promise<Playlist[]> {
  try {
    const { data } = await api.get("/api/playlists");
    return data.playlists || [];
  } catch (err: any) {
    if (err.isExpectedAuthError || err.response?.status === 401) return [];
    throw err;
  }
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
  song: any,
): Promise<Playlist> {
  const mappedSong = {
    songId: song.songId || song.id,
    title: song.title || song.name || "",
    artist: song.artist || getArtists(song),
    albumArt: song.albumArt || bestImg(song.image) || "",
    duration: Number(song.duration) || 0,
    downloadUrl: (song.downloadUrl || song.download_url || []).map((u: any) => ({
      quality: u.quality || "",
      url: u.url || u.link || "",
    })),
  };

  const { data } = await api.post(`/api/playlists/${playlistId}/songs`, {
    song: mappedSong,
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

export async function reorderPlaylist(
  id: string,
  songIds: string[],
): Promise<Playlist> {
  const { data } = await api.patch(`/api/playlists/${id}/reorder`, { songIds });
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

export async function getRelatedSongs(
  songId: string,
  page = 1,
  limit = 50,
): Promise<{ songs: any[]; total: number; page: number; hasMore: boolean }> {
  const { data } = await api.get("/api/search/related", {
    params: { songId, page, limit },
  });
  return data;
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export async function getDashboard(): Promise<any> {
  const { data } = await api.get("/api/dashboard");
  return data;
}

export async function getGuestDashboard(): Promise<any> {
  const { data } = await api.get("/api/dashboard/guest");
  return data;
}

export async function getMixes(): Promise<any> {
  const { data } = await api.get("/api/mixes");
  return data;
}

export async function getGuestMixes(): Promise<any> {
  const { data } = await api.get("/api/mixes/guest");
  return data;
}

// ── Recommendations ─────────────────────────────────────────────────────────
export async function getHomeRecommendations(): Promise<{
  songs: any[];
  total: number;
  source: string;
}> {
  const { data } = await api.get("/api/recommendations/home");
  return data;
}

export async function getNextRecommendations(
  currentSongId: string,
  excludeIds?: string[],
): Promise<{ songs: any[]; total: number; hasMore: boolean; source: string }> {
  const { data } = await api.get("/api/recommendations/next", {
    params: {
      currentSongId,
      excludeIds: excludeIds?.join(","),
    },
  });
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

// ── Import ──────────────────────────────────────────────────────────────────
export async function importPlaylist(input: string): Promise<{
  name: string;
  image: string | null;
  songNames: string[];
  count: number;
  detectedPlatform: string;
  success: boolean;
}> {
  const { data } = await api.post("/api/import", { input });
  return data;
}

export async function buildPlaylistFromImport(
  songNames: string[],
  playlistName?: string,
): Promise<any> {
  const { data } = await api.post("/api/ai/build-playlist", {
    songs: songNames.join("\n"),
    targetCount: songNames.length,
  });
  return data;
}

export async function getSongDetails(id: string): Promise<any> {
  const { data } = await api.get("/api/search/song", { params: { id } });
  return data;
}

export async function getMoreRecommendations(
  excludeIds: string[],
  limit = 20,
): Promise<{ songs: any[]; hasMore: boolean }> {
  const { data } = await api.post("/api/recommendations/feed/more", {
    excludeIds,
    limit,
  });
  return data;
}

export async function startRadio(
  seedSongId: string,
): Promise<{ songs: any[] }> {
  const { data } = await api.post("/api/radio/start", { seedSongId }, { timeout: 15000 });
  return data;
}

// ── Admin and Feedback API Client ──────────────────────────────────────────
export function setAdminToken(token: string | null) {
  _adminToken = token;
}

export function getAdminToken(): string | null {
  return _adminToken;
}

export async function submitFeedback(
  message: string,
  category: "bug" | "suggestion" | "other",
  appVersion: string,
  platform: "web" | "android" | "desktop"
): Promise<{ success: boolean; feedback: any }> {
  const { data } = await api.post("/api/feedback", {
    message,
    category,
    appVersion,
    platform,
  });
  return data;
}

export async function adminLogin(password: string): Promise<{ success: boolean; token: string }> {
  const { data } = await api.post("/api/admin/login", { password });
  if (data.token) {
    setAdminToken(data.token);
  }
  return data;
}

export async function adminLogout(): Promise<{ success: boolean }> {
  const { data } = await api.post("/api/admin/logout");
  setAdminToken(null);
  return data;
}

export async function getFeedback(status?: string, category?: string, search?: string, sort?: string): Promise<{ feedback: any[] }> {
  const { data } = await api.get("/api/feedback/admin", {
    params: { status, category, search, sort },
  });
  return data;
}

export async function sendAdminReply(id: string, reply: string): Promise<{ success: boolean; feedback: any }> {
  const { data } = await api.post(`/api/feedback/admin/${id}/reply`, { reply });
  return data;
}

export async function updateAdminReply(id: string, reply: string): Promise<{ success: boolean; feedback: any }> {
  const { data } = await api.put(`/api/feedback/admin/${id}/reply`, { reply });
  return data;
}

export async function deleteAdminReply(id: string): Promise<{ success: boolean; message: string; feedback: any }> {
  const { data } = await api.delete(`/api/feedback/admin/${id}/reply`);
  return data;
}

export async function closeAdminFeedback(id: string): Promise<{ success: boolean; feedback: any }> {
  const { data } = await api.patch(`/api/feedback/admin/${id}/close`);
  return data;
}

export async function getUserFeedbackHistory(): Promise<{ success: boolean; history: any[] }> {
  const { data } = await api.get("/api/feedback/history");
  return data;
}

export async function markFeedbackRead(id: string): Promise<{ success: boolean; feedback: any }> {
  const { data } = await api.patch(`/api/feedback/${id}/read`);
  return data;
}

export async function updateFeedbackStatus(id: string, status: string): Promise<{ success: boolean; feedback: any }> {
  const { data } = await api.patch(`/api/feedback/admin/${id}`, { status });
  return data;
}

export async function deleteFeedback(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete(`/api/feedback/admin/${id}`);
  return data;
}

export async function getAdminAnnouncements(): Promise<{ announcements: any[] }> {
  const { data } = await api.get("/api/announcements/admin");
  return data;
}

export async function createAnnouncement(announcementData: any): Promise<{ success: boolean; announcement: any }> {
  const { data } = await api.post("/api/announcements/admin", announcementData);
  return data;
}

export async function updateAnnouncement(id: string, updates: any): Promise<{ success: boolean; announcement: any }> {
  const { data } = await api.patch(`/api/announcements/admin/${id}`, updates);
  return data;
}

export async function deleteAnnouncement(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete(`/api/announcements/admin/${id}`);
  return data;
}

export async function getActiveAnnouncements(): Promise<{ announcements: any[]; seenAnnouncements?: string[]; lastSeenWhatsNewVersion?: string }> {
  const { data } = await api.get("/api/announcements/active");
  return data;
}

export async function markAnnouncementSeen(id: string): Promise<{ success: boolean }> {
  const { data } = await api.post(`/api/announcements/${id}/seen`);
  return data;
}

export async function markWhatsNewVersionSeen(version: string): Promise<{ success: boolean }> {
  const { data } = await api.post("/api/announcements/version/seen", { version });
  return data;
}

export async function getAutoplaySongs(songId: string, filter = "similar", excludeIds: string[] = []): Promise<{ songs: any[] }> {
  try {
    const { data } = await api.get(`/api/recommendations/next`, {
      params: { currentSongId: songId, excludeIds: excludeIds.join(","), type: filter },
      timeout: 12000
    });
    if (data && Array.isArray(data.songs) && data.songs.length > 0) {
      return { songs: data.songs };
    }
  } catch {}
  const { data } = await api.get(`/api/search/autoplay/${songId}`, {
    params: { type: filter },
    timeout: 12000
  });
  return data;
}

export async function checkCookiesHealth(): Promise<any> {
  const { data } = await api.get("/api/music/cookies/health");
  return data;
}

export async function updateCookies(cookies: string): Promise<any> {
  const { data } = await api.post("/api/music/cookies/update", { cookies });
  return data;
}

export async function getDailyMix(date?: string): Promise<{ success: boolean; dateStr: string; songs: any[]; isCached: boolean }> {
  const { data } = await api.get("/api/daily-mix", { params: { date } });
  return data;
}

export async function getLosslessStream(title: string, artist: string): Promise<{ success: boolean; streamUrl: string | null; quality: string | null }> {
  const { data } = await api.get("/api/lossless/stream", { params: { title, artist } });
  return data;
}


