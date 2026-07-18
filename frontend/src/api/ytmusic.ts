/**
 * SoulSync — YouTube Music API Client (Proxy wrapper)
 * Calls Node.js backend which proxies to the Python FastAPI microservice.
 */
import { api } from "./backend";

export interface YTThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface YTArtistRef {
  name: string;
  id?: string;
}

export interface YTTrack {
  videoId: string;
  title: string;
  artists?: YTArtistRef[];
  album?: {
    name: string;
    id?: string;
  };
  duration?: string;
  duration_seconds?: number;
  thumbnails?: YTThumbnail[];
  isAvailable?: boolean;
}

export interface YTHomeSection {
  title: string;
  contents: any[];
}

export interface YTCharts {
  songs?: any;
  videos?: any;
  artists?: any;
  trending?: any;
}

/** Search YT Music */
export async function searchYTMusic(
  query: string,
  filter?: "songs" | "videos" | "albums" | "artists" | "playlists" | "podcasts",
  limit = 20
): Promise<any[]> {
  const { data } = await api.get("/api/music/search", {
    params: { q: query, filter, limit },
  });
  return data.results || [];
}

/** Fetch YT Music Home Discovery Feed */
export async function getYTMusicHome(limit = 6): Promise<YTHomeSection[]> {
  const { data } = await api.get("/api/music/home", {
    params: { limit },
  });
  return data.sections || [];
}

/** Fetch YT Music Charts */
export async function getYTMusicCharts(country?: string): Promise<YTCharts> {
  const { data } = await api.get("/api/music/charts", {
    params: { country },
  });
  return data;
}

/** Fetch Mood Categories */
export async function getYTMusicMoods(): Promise<any> {
  const { data } = await api.get("/api/music/moods");
  return data.categories || {};
}

/** Fetch Mood Playlists */
export async function getYTMusicMoodPlaylists(params: string): Promise<any[]> {
  const { data } = await api.get(`/api/music/moods/${params}`);
  return data.playlists || [];
}

/** Fetch Song Details by videoId */
export async function getYTMusicSong(videoId: string): Promise<any> {
  const { data } = await api.get(`/api/music/song/${videoId}`);
  return data;
}

/** Fetch Watch Queue / Autoplay suggestions for a track */
export async function getYTMusicWatchPlaylist(
  videoId: string,
  radio = false,
  shuffle = false
): Promise<any> {
  const { data } = await api.get(`/api/music/watch/${videoId}`, {
    params: { radio, shuffle },
  });
  return data;
}

/** Fetch Related suggestions / sections for a track */
export async function getYTMusicSongRelated(browseId: string): Promise<any[]> {
  const { data } = await api.get(`/api/music/related/${browseId}`);
  return data.sections || [];
}

/** Fetch Lyrics for a track by its browseId */
export async function getYTMusicLyrics(browseId: string): Promise<string | null> {
  try {
    const { data } = await api.get(`/api/music/lyrics/${browseId}`);
    return data.lyrics || null;
  } catch (err) {
    console.warn("[YTMusicService] Failed to fetch lyrics:", err);
    return null;
  }
}

/** Fetch Artist Details by channelId/browseId */
export async function getYTMusicArtist(channelId: string): Promise<any> {
  const { data } = await api.get(`/api/music/artist/${channelId}`);
  return data;
}

/** Fetch Album Details by browseId */
export async function getYTMusicAlbum(browseId: string): Promise<any> {
  const { data } = await api.get(`/api/music/album/${browseId}`);
  return data;
}

/** Fetch Playlist details by playlistId */
export async function getYTMusicPlaylist(playlistId: string, limit?: number): Promise<any> {
  const { data } = await api.get(`/api/music/playlist/${playlistId}`, {
    params: { limit },
  });
  return data;
}

/** Fetch Podcast Show details by playlistId */
export async function getYTMusicPodcast(playlistId: string): Promise<any> {
  const { data } = await api.get(`/api/music/podcast/${playlistId}`);
  return data;
}

/** Fetch Podcast Episode details by videoId */
export async function getYTMusicEpisode(videoId: string): Promise<any> {
  const { data } = await api.get(`/api/music/episode/${videoId}`);
  return data;
}
