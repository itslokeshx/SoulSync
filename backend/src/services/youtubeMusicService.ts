import axios from "axios";
import { fetchJioSaavnSongById, fetchJioSaavnSongsByIds, resolveJioSaavnStreamUrl } from "./jiosaavnService.js";
import { pLimit } from "../utils/concurrency.js";

export function isYouTubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export interface Song {
  id: string;
  name: string;
  primaryArtists: string;
  image: string;
  album: string;
  albumId: string;
  duration: number;
  language: string;
  year: string;
  releaseDate?: string;
  streamUrl: string | null;
  downloadUrl: Array<{ quality: string; url: string }> | null;
  playCount: number;
  url: string;
}

export type JioSaavnSong = any;

const MUSIC_PROVIDER_URL = process.env.MUSIC_PROVIDER_URL || "http://127.0.0.1:4002";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "";

/**
 * Helper to call the Python Music Provider microservice
 */
async function callMusicProvider(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  try {
    const headers: Record<string, string> = {};
    if (SERVICE_TOKEN) {
      headers["X-Service-Token"] = SERVICE_TOKEN;
    }
    const { data } = await axios.get(`${MUSIC_PROVIDER_URL}/api/music${endpoint}`, {
      params,
      headers,
      timeout: 30000,
    });
    return data;
  } catch (err: any) {
    console.warn(`[youtubeMusicService] Proxy call to ${endpoint} failed:`, err.message);
    throw err;
  }
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export function getStreamProxyUrl(id: string, reqBaseUrl?: string): string {
  let base = reqBaseUrl;
  if (!base) {
    if (process.env.NODE_ENV === "development") {
      base = `http://localhost:${process.env.PORT || 4000}`;
    } else {
      base = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:4000";
    }
  }
  const formattedBase = base.startsWith("http") ? base : `https://${base}`;
  return `${formattedBase.replace(/\/+$/, "")}/api/search/stream?id=${id}`;
}

export async function resolveRealStreamUrl(id: string): Promise<string | null> {
  if (!isYouTubeId(id)) {
    return resolveJioSaavnStreamUrl(id);
  }
  try {
    const data = await callMusicProvider(`/song/${id}/stream`);
    return data.url || null;
  } catch (e: any) {
    console.error(`[resolveRealStreamUrl] Error resolving stream via Python provider for ${id}:`, e.message || e);
    return null;
  }
}

export function normalizeSongToCanonical(raw: any, reqBaseUrl?: string): Song | null {
  if (!raw) return null;
  const id = String(raw.id || raw.videoId || raw.video_id || "");
  if (!id) return null;

  const proxyUrl = getStreamProxyUrl(id, reqBaseUrl);

  if (raw.id && raw.name && typeof raw.primaryArtists === "string" && raw.image && typeof raw.duration === "number") {
    return {
      ...(raw as Song),
      streamUrl: proxyUrl,
      downloadUrl: [{ quality: "320kbps", url: proxyUrl }]
    };
  }
  let name = raw.title || raw.name || "Unknown";
  if (typeof name !== "string" && name?.text) {
    name = name.text;
  }
  let primaryArtists = "";
  if (Array.isArray(raw.artists)) {
    primaryArtists = raw.artists.map((a: any) => a.name || "").filter(Boolean).join(", ");
  } else if (Array.isArray(raw.authors)) {
    primaryArtists = raw.authors.map((a: any) => a.name || "").filter(Boolean).join(", ");
  } else if (raw.author) {
    primaryArtists = typeof raw.author === "string" ? raw.author : raw.author.name || "";
  }
  let image = "/placeholder.png";
  const thumbContents = raw.thumbnail?.contents || raw.thumbnails || raw.thumbnail || [];
  if (Array.isArray(thumbContents) && thumbContents.length > 0) {
    image = thumbContents[0].url || thumbContents[0].link || image;
  } else if (typeof thumbContents === "string") {
    image = thumbContents;
  } else if (raw.image && typeof raw.image === "string") {
    image = raw.image;
  }
  let album = "";
  let albumId = "";
  if (raw.album) {
    if (typeof raw.album === "object") {
      album = raw.album.name || raw.album.title || "";
      albumId = raw.album.id || "";
    } else if (typeof raw.album === "string") {
      album = raw.album;
    }
  }
  let duration = 0;
  if (raw.duration) {
    if (typeof raw.duration === "object") {
      duration = Number(raw.duration.seconds || 0);
    } else {
      duration = Number(raw.duration) || 0;
    }
  } else if (raw.duration_seconds) {
    duration = Number(raw.duration_seconds);
  }
  return {
    id,
    name: decodeHtmlEntities(name),
    primaryArtists: decodeHtmlEntities(primaryArtists.replace(/\s*-\s*Topic$/i, "")),
    image,
    album: decodeHtmlEntities(album || name),
    albumId,
    duration,
    language: (raw.language || "english").toLowerCase(),
    year: String(raw.year || ""),
    releaseDate: raw.releaseDate ? String(raw.releaseDate) : undefined,
    streamUrl: proxyUrl,
    downloadUrl: [{ quality: "320kbps", url: proxyUrl }],
    playCount: 0,
    url: raw.url || `https://music.youtube.com/watch?v=${id}`
  };
}

export function normalizeSongsToCanonical(raws: any[], reqBaseUrl?: string): Song[] {
  if (!Array.isArray(raws)) return [];
  return raws
    .map(raw => normalizeSongToCanonical(raw, reqBaseUrl))
    .filter((s): s is Song => s !== null);
}

export async function searchSongs(query: string, limit = 50, page = 1): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "songs", limit });
    return data.results || [];
  } catch (err: any) {
    console.error(`[youtubeMusicService] searchSongs failed for "${query}":`, err.message || err);
    return [];
  }
}

export async function searchSongsHybrid(query: string, limit = 50, knownArtist?: string | null): Promise<any[]> {
  return searchSongs(query, limit);
}

export async function searchAlbums(query: string, limit = 12): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "albums", limit });
    return (data.results || []).map((album: any) => {
      let image = "/placeholder.png";
      const thumbContents = album.thumbnails || [];
      if (thumbContents.length > 0) {
        image = thumbContents[0].url || image;
      }
      return {
        id: album.browseId,
        name: album.title || "",
        title: album.title || "",
        image,
        year: album.year || "",
        artist: album.artists?.map((a: any) => a.name).join(", ") || album.author || ""
      };
    });
  } catch (err: any) {
    console.error(`[youtubeMusicService] searchAlbums failed for "${query}":`, err.message || err);
    return [];
  }
}

export async function searchArtists(query: string, limit = 10): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "artists", limit });
    return (data.results || []).map((artist: any) => {
      let image = "/placeholder.png";
      const thumbContents = artist.thumbnails || [];
      if (thumbContents.length > 0) {
        image = thumbContents[0].url || image;
      }
      return {
        id: artist.browseId,
        name: artist.artist || artist.title || "",
        title: artist.artist || artist.title || "",
        image,
        subscribers: artist.subscribers || ""
      };
    });
  } catch (err: any) {
    console.error(`[youtubeMusicService] searchArtists failed for "${query}":`, err.message || err);
    return [];
  }
}

export async function searchPlaylists(query: string, limit = 10): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "playlists", limit });
    return (data.results || []).map((p: any) => {
      let image = "/placeholder.png";
      const thumbContents = p.thumbnails || [];
      if (thumbContents.length > 0) {
        image = thumbContents[0].url || image;
      }
      return {
        id: p.browseId || p.playlistId,
        name: p.title || "",
        title: p.title || "",
        image,
        songCount: p.songCount || ""
      };
    });
  } catch (err: any) {
    console.error(`[youtubeMusicService] searchPlaylists failed for "${query}":`, err.message || err);
    return [];
  }
}

export async function searchPodcasts(query: string, limit = 12): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "podcasts", limit });
    return (data.results || []).map((podcast: any) => {
      let image = "/placeholder.png";
      const thumbContents = podcast.thumbnails || [];
      if (thumbContents.length > 0) {
        image = thumbContents[0].url || image;
      }
      return {
        id: podcast.browseId,
        name: podcast.title || "",
        title: podcast.title || "",
        image,
        publisher: podcast.publisher || podcast.author || "",
      };
    });
  } catch (err: any) {
    console.error(`[youtubeMusicService] searchPodcasts failed for "${query}":`, err.message || err);
    return [];
  }
}

export async function searchEpisodes(query: string, limit = 50): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "episodes", limit });
    return data.results || [];
  } catch (err: any) {
    console.error(`[youtubeMusicService] searchEpisodes failed for "${query}":`, err.message || err);
    return [];
  }
}

export async function getPlaylistSongs(playlistId: string): Promise<any[]> {
  try {
    const data = await callMusicProvider(`/playlist/${playlistId}`);
    return data.tracks || [];
  } catch (err: any) {
    console.error(`[youtubeMusicService] getPlaylistSongs failed for ${playlistId}:`, err.message || err);
    return [];
  }
}

export async function getAlbumDetails(albumId: string): Promise<any> {
  try {
    const data = await callMusicProvider(`/album/${albumId}`);
    let image = "/placeholder.png";
    const thumbContents = data.thumbnails || [];
    if (thumbContents.length > 0) {
      image = thumbContents[0].url || image;
    }
    return {
      id: albumId,
      name: data.title || "",
      title: data.title || "",
      image,
      year: data.year || "",
      artists: data.artists || [],
      songs: data.tracks || []
    };
  } catch (err: any) {
    console.error(`[youtubeMusicService] getAlbumDetails failed for ${albumId}:`, err.message || err);
    return null;
  }
}

export async function getAlbumSongs(albumId: string): Promise<any[]> {
  try {
    const data = await callMusicProvider(`/album/${albumId}`);
    return data.tracks || [];
  } catch (err: any) {
    console.error(`[youtubeMusicService] getAlbumSongs failed for ${albumId}:`, err.message || err);
    return [];
  }
}

export async function fetchSongById(id: string, reqBaseUrl?: string): Promise<Song | null> {
  if (!isYouTubeId(id)) {
    return fetchJioSaavnSongById(id);
  }
  try {
    const data = await callMusicProvider(`/song/${id}`);
    const details = data.videoDetails || {};
    let image = "/placeholder.png";
    const thumbContents = details.thumbnail?.thumbnails || [];
    if (thumbContents.length > 0) {
      const sortedThumbs = [...thumbContents].sort((a, b) => (b.width || 0) - (a.width || 0));
      image = sortedThumbs[0].url || image;
    }
    const proxyUrl = getStreamProxyUrl(id, reqBaseUrl);
    return {
      id: id,
      name: decodeHtmlEntities(details.title || "Unknown"),
      primaryArtists: decodeHtmlEntities(details.author || "").replace(/\s*-\s*Topic$/i, ""),
      image,
      album: decodeHtmlEntities(details.title || ""),
      albumId: "",
      duration: Number(details.lengthSeconds) || 0,
      language: "english",
      year: "",
      streamUrl: proxyUrl,
      downloadUrl: [{ quality: "320kbps", url: proxyUrl }],
      playCount: 0,
      url: `https://music.youtube.com/watch?v=${id}`
    };
  } catch (err: any) {
    console.error(`[youtubeMusicService] fetchSongById failed for ${id}:`, err.message || err);
    return null;
  }
}

async function fetchYouTubeSongsByIds(ids: string[], reqBaseUrl?: string): Promise<Song[]> {
  if (!ids || ids.length === 0) return [];
  
  try {
    const response = await axios.post(`${MUSIC_PROVIDER_URL}/api/music/songs/batch`, {
      video_ids: ids
    }, {
      headers: SERVICE_TOKEN ? { "X-Service-Token": SERVICE_TOKEN } : {},
      timeout: 20000
    });

    const results = response.data?.results || [];
    const songs: Song[] = [];

    for (const res of results) {
      if (!res.success || !res.data) continue;
      const details = res.data.videoDetails || {};
      let image = "/placeholder.png";
      const thumbContents = details.thumbnail?.thumbnails || [];
      if (thumbContents.length > 0) {
        const sortedThumbs = [...thumbContents].sort((a, b) => (b.width || 0) - (a.width || 0));
        image = sortedThumbs[0].url || image;
      }
      const proxyUrl = getStreamProxyUrl(res.video_id, reqBaseUrl);
      songs.push({
        id: res.video_id,
        name: decodeHtmlEntities(details.title || "Unknown"),
        primaryArtists: decodeHtmlEntities(details.author || "").replace(/\s*-\s*Topic$/i, ""),
        image,
        album: decodeHtmlEntities(details.title || ""),
        albumId: "",
        duration: Number(details.lengthSeconds) || 0,
        language: "english",
        year: "",
        streamUrl: proxyUrl,
        downloadUrl: [{ quality: "320kbps", url: proxyUrl }],
        playCount: 0,
        url: `https://music.youtube.com/watch?v=${res.video_id}`
      });
    }

    if (songs.length > 0) {
      return songs;
    }
  } catch (err: any) {
    console.warn(`[youtubeMusicService] Batch fetch failed: ${err.message || err}, falling back to individual fetching...`);
  }

  const limit = pLimit(3);
  const songs = await Promise.all(
    ids.map(id => limit(() => fetchSongById(id, reqBaseUrl).catch(() => null)))
  );
  return songs.filter((s): s is Song => s !== null);
}

export async function fetchSongsByIds(ids: string[], reqBaseUrl?: string): Promise<Song[]> {
  if (!ids || ids.length === 0) return [];

  const ytIds = ids.filter(isYouTubeId);
  const saavnIds = ids.filter(id => !isYouTubeId(id));

  const [ytSongs, saavnSongs] = await Promise.all([
    fetchYouTubeSongsByIds(ytIds, reqBaseUrl),
    fetchJioSaavnSongsByIds(saavnIds)
  ]);

  const songMap = new Map<string, Song>();
  for (const s of [...ytSongs, ...saavnSongs]) {
    songMap.set(s.id, s);
  }

  return ids.map(id => songMap.get(id)).filter((s): s is Song => !!s);
}

export async function searchAll(query: string, reqBaseUrl?: string): Promise<{ songs: Song[]; artists: any[]; albums: any[]; podcasts: any[] }> {
  const [songs, artists, albums, podcasts, episodes] = await Promise.all([
    searchSongs(query, 15),
    searchArtists(query, 5),
    searchAlbums(query, 5),
    searchPodcasts(query, 6),
    searchEpisodes(query, 10)
  ]);
  const normalizedSongs = normalizeSongsToCanonical(songs, reqBaseUrl);
  const normalizedEpisodes = normalizeSongsToCanonical(episodes, reqBaseUrl);
  
  return {
    songs: [...normalizedSongs, ...normalizedEpisodes],
    artists,
    albums,
    podcasts
  };
}

export async function fetchArtistSongs(id: string, page = 0, pages = 1): Promise<Song[]> {
  try {
    const data = await callMusicProvider(`/artist/${id}`);
    const contents = data.songs?.results || [];
    return normalizeSongsToCanonical(contents);
  } catch (err: any) {
    console.error(`[youtubeMusicService] fetchArtistSongs failed for ${id}:`, err.message || err);
    return [];
  }
}

export async function fetchAlbumSongs(id: string): Promise<Song[]> {
  const songs = await getAlbumSongs(id);
  return normalizeSongsToCanonical(songs);
}

export async function getSuggestions(songId: string, limit = 20): Promise<any[]> {
  try {
    const data = await callMusicProvider(`/watch/${songId}`);
    const songs = data.tracks || [];
    const filtered = songs.filter((s: any) => s.videoId && s.videoId !== songId);
    return normalizeSongsToCanonical(filtered).slice(0, limit);
  } catch (err: any) {
    console.error(`[youtubeMusicService] getSuggestions failed for ${songId}:`, err.message || err);
    return [];
  }
}

export async function getTopSearches(): Promise<any[]> {
  return [
    { title: "Kesariya", name: "Kesariya" },
    { title: "Mankatha theme", name: "Mankatha theme" },
    { title: "Kabir Entry BGM War", name: "Kabir Entry BGM War" },
    { title: "Rocky Entry BGM KGF 2", name: "Rocky Entry BGM KGF 2" },
    { title: "Baahubali Climax BGM", name: "Baahubali Climax BGM" }
  ];
}

export async function getArtistDetails(id: string): Promise<any> {
  try {
    const data = await callMusicProvider(`/artist/${id}`);
    let image = "/placeholder.png";
    const thumbContents = data.thumbnails || [];
    if (thumbContents.length > 0) {
      image = thumbContents[0].url || image;
    }
    
    let rawSongs = data.songs?.results || [];
    const songsPlaylistId = data.songs?.browseId;
    if (songsPlaylistId) {
      try {
        const playlistData = await callMusicProvider(`/playlist/${songsPlaylistId}`);
        if (playlistData && Array.isArray(playlistData.tracks)) {
          rawSongs = playlistData.tracks;
        }
      } catch (err: any) {
        console.error(`[youtubeMusicService] Failed to load full artist songs playlist ${songsPlaylistId}:`, err.message || err);
      }
    }

    const normalizeAlbums = (items: any[]) => {
      if (!Array.isArray(items)) return [];
      return items.map((album: any) => {
        let albumImage = "/placeholder.png";
        const thumbContents = album.thumbnails || [];
        if (thumbContents.length > 0) {
          albumImage = thumbContents[0].url || albumImage;
        }
        return {
          id: album.browseId,
          name: album.title || "",
          title: album.title || "",
          image: albumImage,
          year: album.year || "",
          artist: data.name || ""
        };
      });
    };

    const albums = normalizeAlbums(data.albums?.results || []);
    const singles = normalizeAlbums(data.singles?.results || []);

    return {
      id,
      name: data.name || "",
      image,
      description: data.description || "",
      songs: normalizeSongsToCanonical(rawSongs),
      albums,
      singles
    };
  } catch (err: any) {
    console.error(`[youtubeMusicService] getArtistDetails failed for ${id}:`, err.message || err);
    return null;
  }
}

export async function getSongDetails(id: string): Promise<any> {
  return fetchSongById(id);
}

export async function getSongsDetailsBatch(ids: string[]): Promise<any[]> {
  return fetchSongsByIds(ids);
}

let activeQueries = 0;
export function markUserQueryStart(): void {
  activeQueries++;
}
export function markUserQueryEnd(): void {
  activeQueries = Math.max(0, activeQueries - 1);
}
export function hasActiveUserQueries(): boolean {
  return activeQueries > 0;
}
