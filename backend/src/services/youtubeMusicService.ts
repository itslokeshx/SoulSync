import axios from "axios";
import { pLimit } from "../utils/concurrency.js";
import { redisGet, redisSet } from "./redis.js";
import { User } from "../models/User.js";
import { Playlist } from "../models/Playlist.js";
import { ListeningHistory } from "../models/ListeningHistory.js";

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
  artists?: Array<{ name: string; id: string }>;
}

export type YTMusicSong = any;

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
      timeout: 35000,
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

export function upgradeYTImageQuality(url: string): string {
  if (!url) return url;
  if (url.includes("googleusercontent.com") || url.includes("ggpht.com")) {
    return url.replace(/=w\d+-h\d+-[a-z0-9-]+$/, "=w500-h500-l90-rj")
              .replace(/=w\d+-h\d+$/, "=w500-h500")
              .replace(/=s\d+-c$/, "=s500-c")
              .replace(/=s\d+$/, "=s500");
  }
  if (url.includes("ytimg.com")) {
    if (url.includes("/default.jpg")) {
      return url.replace("/default.jpg", "/hqdefault.jpg");
    }
  }
  return url;
}

export function getStreamProxyUrl(id: string, reqBaseUrl?: string): string {
  let base = reqBaseUrl;
  if (!base) {
    if (process.env.NODE_ENV === "development") {
      base = `http://localhost:${process.env.PORT || 4000}`;
    } else {
      base = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || "https://localhost:4000";
    }
  }
  if (base.startsWith("http://") && !base.includes("localhost") && !base.includes("127.0.0.1")) {
    base = base.replace("http://", "https://");
  }
  const formattedBase = base.startsWith("http") ? base : `https://${base}`;
  return `${formattedBase.replace(/\/+$/, "")}/api/search/stream?id=${id}`;
}

async function resolveCobaltStreamBackend(id: string): Promise<string | null> {
  const cobaltInstances = [
    "https://api.cobalt.tools",
    "https://cobalt-api.kwippy.com",
  ];
  for (const inst of cobaltInstances) {
    try {
      const resp = await axios.post(
        `${inst}/api/json`,
        {
          url: `https://www.youtube.com/watch?v=${id}`,
          downloadMode: "audio",
          audioFormat: "mp3",
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          timeout: 2500,
        }
      );
      if (resp.data && (resp.data.status === "redirect" || resp.data.status === "tunnel" || resp.data.status === "picker") && resp.data.url) {
        console.info(`[resolveRealStreamUrl] Resolved ${id} via Cobalt (${inst})`);
        return resp.data.url;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function resolvePipedStream(id: string): Promise<string | null> {
  const pipedInstances = [
    "https://pipedapi.tokhmi.xyz",
    "https://pipedapi.moomoo.me",
    "https://pipedapi.syncflix.org",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.mha.fi",
    "https://piped-api.lunar.icu",
  ];
  for (const inst of pipedInstances) {
    try {
      const resp = await axios.get(`${inst}/streams/${encodeURIComponent(id)}`, { timeout: 2500 });
      if (resp.data && Array.isArray(resp.data.audioStreams) && resp.data.audioStreams.length > 0) {
        const audio = resp.data.audioStreams.find((s: any) => s.mimeType?.includes("audio/mp4") || s.format === "M4A") || resp.data.audioStreams[0];
        if (audio?.url) {
          console.info(`[resolveRealStreamUrl] Resolved ${id} via Piped mirror: ${inst}`);
          return audio.url;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveInvidiousStream(id: string): Promise<string | null> {
  const instances = [
    "https://invidious.flokinet.to",
    "https://invidious.privacydev.net",
    "https://iv.melmac.space",
    "https://invidious.fdn.fr",
    "https://invidious.nerdvpn.de",
  ];
  for (const inst of instances) {
    try {
      const streamUrl = `${inst}/latest_version?id=${encodeURIComponent(id)}&itag=140`;
      const resp = await axios.get(streamUrl, { timeout: 2500, maxRedirects: 0, validateStatus: (status) => status < 400 });
      if (resp.status >= 200 && resp.status < 400) {
        console.info(`[resolveRealStreamUrl] Resolved ${id} via proxied stream mirror: ${inst}`);
        return streamUrl;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function resolveRealStreamUrl(id: string): Promise<string | null> {
  if (!isYouTubeId(id)) {
    return null;
  }
  try {
    const data = await callMusicProvider(`/song/${id}/stream`);
    if (data && data.url) return data.url;
  } catch (e: any) {
    console.error(`[resolveRealStreamUrl] Error resolving stream via Python provider for ${id}:`, e.message || e);
  }

  // Fallback 1: Resolve via Cobalt API
  const cobaltUrl = await resolveCobaltStreamBackend(id);
  if (cobaltUrl) return cobaltUrl;

  // Fallback 2: Resolve via Piped mirrors (extracts direct googlevideo stream URL)
  const pipedUrl = await resolvePipedStream(id);
  if (pipedUrl) return pipedUrl;

  // Fallback 3: Resolve via public Invidious instances
  return await resolveInvidiousStream(id);
}

function parseViews(viewsStr: any): number {
  if (!viewsStr) return 0;
  if (typeof viewsStr === "number") return viewsStr;
  const str = String(viewsStr).toLowerCase().trim();
  const match = str.match(/^([\d.]+)\s*([kmbt]?)/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2];
  if (unit === "k") return val * 1000;
  if (unit === "m") return val * 1000000;
  if (unit === "b") return val * 1000000000;
  if (unit === "t") return val * 1000000000000;
  return val;
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
  if (!primaryArtists && raw.podcast?.name) {
    primaryArtists = raw.podcast.name;
  }
  if (!primaryArtists && raw.publisher) {
    primaryArtists = raw.publisher;
  }

  let image = "/placeholder.png";
  const thumbContents = raw.thumbnail?.contents || raw.thumbnails || raw.thumbnail || [];
  if (Array.isArray(thumbContents) && thumbContents.length > 0) {
    const sorted = [...thumbContents].sort((a: any, b: any) => (Number(b.width) || 0) - (Number(a.width) || 0));
    image = sorted[0].url || sorted[0].link || image;
  } else if (typeof thumbContents === "string") {
    image = thumbContents;
  } else if (raw.image && typeof raw.image === "string") {
    image = raw.image;
  }
  image = upgradeYTImageQuality(image);

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
  if (!album && raw.podcast) {
    album = raw.podcast.name || "";
    albumId = raw.podcast.id || "";
  }

  let duration = 0;
  if (raw.duration_seconds) {
    duration = Number(raw.duration_seconds);
  } else if (raw.duration) {
    if (typeof raw.duration === "object") {
      duration = Number(raw.duration.seconds || 0);
    } else if (typeof raw.duration === "number") {
      duration = raw.duration;
    } else if (typeof raw.duration === "string") {
      const str = raw.duration.toLowerCase().trim();
      if (str.includes(":")) {
        const parts = str.split(":").map(Number);
        if (parts.every((p: number) => !isNaN(p))) {
          if (parts.length === 2) {
            duration = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }
      } else {
        // Handle human-readable patterns: e.g. "38 min", "1 hr 5 min", "2 hours"
        let parsedSecs = 0;
        const hourMatch = str.match(/(\d+)\s*(h|hr|hour|hours)/);
        const minMatch = str.match(/(\d+)\s*(m|min|minute|minutes)/);
        const secMatch = str.match(/(\d+)\s*(s|sec|second|seconds)/);

        if (hourMatch) parsedSecs += Number(hourMatch[1]) * 3600;
        if (minMatch) parsedSecs += Number(minMatch[1]) * 60;
        if (secMatch) parsedSecs += Number(secMatch[1]);

        duration = parsedSecs > 0 ? parsedSecs : (Number(str) || 0);
      }
    }
  }
  const artistsList = Array.isArray(raw.artists)
    ? raw.artists.map((a: any) => ({ name: a.name || "", id: a.id || a.browseId || "" }))
    : [{ name: primaryArtists.split(", ")[0] || "Unknown Show", id: String(raw.author?.id || raw.author?.browseId || raw.artistId || raw.podcast?.id || "") }];

  const cleanName = decodeHtmlEntities(name);
  const cleanArtists = decodeHtmlEntities(primaryArtists.replace(/\s*-\s*Topic$/i, ""));

  if (
    !cleanName ||
    cleanName.toLowerCase() === "unknown" ||
    cleanName.toLowerCase() === "null"
  ) {
    return null;
  }

  const finalArtists = cleanArtists && cleanArtists.toLowerCase() !== "unknown" && cleanArtists.toLowerCase() !== "null"
    ? cleanArtists
    : "Unknown Artist";

  const finalArtistsList = artistsList.filter((a: any) => a.name && a.name !== "Unknown Show").length > 0
    ? artistsList.filter((a: any) => a.name)
    : [{ name: finalArtists, id: "" }];

  return {
    id,
    name: cleanName,
    primaryArtists: finalArtists,
    artists: finalArtistsList,
    image,
    album: decodeHtmlEntities(album || name),
    albumId,
    duration,
    language: (raw.language || "").toLowerCase(),
    year: String(raw.year || ""),
    releaseDate: raw.releaseDate ? String(raw.releaseDate) : undefined,
    streamUrl: proxyUrl,
    downloadUrl: [{ quality: "320kbps", url: proxyUrl }],
    playCount: raw.playCount || parseViews(raw.views) || 0,
    url: raw.url || `https://music.youtube.com/watch?v=${id}`
  };
}

export function normalizeSongsToCanonical(raws: any[], reqBaseUrl?: string): Song[] {
  if (!Array.isArray(raws)) return [];
  return raws
    .map(raw => normalizeSongToCanonical(raw, reqBaseUrl))
    .filter((s): s is Song => s !== null);
}

export async function searchGeneral(query: string, limit = 20): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "", limit });
    return data.results || [];
  } catch (err: any) {
    console.error(`[youtubeMusicService] searchGeneral failed for "${query}":`, err.message || err);
    return [];
  }
}

export async function searchSongs(query: string, limit = 50, page = 1): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "songs", limit });
    const results = data.results || [];
    if (results.length > 0) return results;
    // Fallback: If strict song search yields 0 results (e.g. transliterated/phonetic search queries), perform general fuzzy search
    const fallbackData = await callMusicProvider("/search", { q: query, filter: "", limit });
    return fallbackData.results || [];
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
        const sorted = [...thumbContents].sort((a: any, b: any) => (Number(b.width) || 0) - (Number(a.width) || 0));
        image = sorted[0].url || image;
      }
      image = upgradeYTImageQuality(image);
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
        const sorted = [...thumbContents].sort((a: any, b: any) => (Number(b.width) || 0) - (Number(a.width) || 0));
        image = sorted[0].url || image;
      }
      image = upgradeYTImageQuality(image);
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
        const sorted = [...thumbContents].sort((a: any, b: any) => (Number(b.width) || 0) - (Number(a.width) || 0));
        image = sorted[0].url || image;
      }
      image = upgradeYTImageQuality(image);
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

export async function searchVideos(query: string, limit = 50): Promise<any[]> {
  try {
    const data = await callMusicProvider("/search", { q: query, filter: "videos", limit });
    return data.results || [];
  } catch (err: any) {
    console.error(`[youtubeMusicService] searchVideos failed for "${query}":`, err.message || err);
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
        const sorted = [...thumbContents].sort((a: any, b: any) => (Number(b.width) || 0) - (Number(a.width) || 0));
        image = sorted[0].url || image;
      }
      image = upgradeYTImageQuality(image);
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

export async function getPlaylistDetails(playlistId: string): Promise<any> {
  try {
    return await callMusicProvider(`/playlist/${playlistId}`);
  } catch (err: any) {
    console.error(`[youtubeMusicService] getPlaylistDetails failed for ${playlistId}:`, err.message || err);
    return null;
  }
}

export async function getAlbumDetails(albumId: string): Promise<any> {
  try {
    const data = await callMusicProvider(`/album/${albumId}`);
    let image = "/placeholder.png";
    const thumbContents = data.thumbnails || [];
    if (thumbContents.length > 0) {
      const sorted = [...thumbContents].sort((a: any, b: any) => (Number(b.width) || 0) - (Number(a.width) || 0));
      image = sorted[0].url || image;
    }
    image = upgradeYTImageQuality(image);
    const albumArtist = data.artists?.map((a: any) => a.name || "").filter(Boolean).join(", ") || data.artist || "";
    const songs = normalizeSongsToCanonical(data.tracks || []);
    songs.forEach((s: any) => {
      if (!s.image || s.image === "/placeholder.png" || (Array.isArray(s.image) && s.image.length === 0)) {
        s.image = image;
      }
      if (!s.primaryArtists || s.primaryArtists === "Unknown Artist") {
        s.primaryArtists = albumArtist || "Unknown Artist";
      }
    });
    return {
      id: albumId,
      name: data.title || "",
      title: data.title || "",
      image,
      year: data.year || "",
      artists: data.artists || [],
      songs
    };
  } catch (err: any) {
    console.error(`[youtubeMusicService] getAlbumDetails failed for ${albumId}:`, err.message || err);
    return null;
  }
}

export async function getAlbumSongs(albumId: string): Promise<any[]> {
  try {
    const data = await callMusicProvider(`/album/${albumId}`);
    let image = "/placeholder.png";
    const thumbContents = data.thumbnails || [];
    if (thumbContents.length > 0) {
      const sorted = [...thumbContents].sort((a: any, b: any) => (Number(b.width) || 0) - (Number(a.width) || 0));
      image = sorted[0].url || image;
    }
    image = upgradeYTImageQuality(image);
    const albumArtist = data.artists?.map((a: any) => a.name || "").filter(Boolean).join(", ") || data.artist || "";
    const songs = normalizeSongsToCanonical(data.tracks || []);
    songs.forEach((s: any) => {
      if (!s.image || s.image === "/placeholder.png" || (Array.isArray(s.image) && s.image.length === 0)) {
        s.image = image;
      }
      if (!s.primaryArtists || s.primaryArtists === "Unknown Artist") {
        s.primaryArtists = albumArtist || "Unknown Artist";
      }
    });
    return songs;
  } catch (err: any) {
    console.error(`[youtubeMusicService] getAlbumSongs failed for ${albumId}:`, err.message || err);
    return [];
  }
}

export async function fetchSongById(id: string, reqBaseUrl?: string): Promise<Song | null> {
  if (!isYouTubeId(id)) {
    return null;
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
      timeout: 35000
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
  if (ytIds.length === 0) return [];

  const ytSongs = await fetchYouTubeSongsByIds(ytIds, reqBaseUrl).catch(() => []);
  const songMap = new Map<string, Song>();
  for (const s of ytSongs) {
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
  if (!isYouTubeId(songId)) {
    return [];
  }
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

    const normalizeRelated = (items: any[]) => {
      if (!Array.isArray(items)) return [];
      return items.map((art: any) => {
        let artImage = "/placeholder.png";
        const thumbContents = art.thumbnails || [];
        if (thumbContents.length > 0) {
          artImage = thumbContents[0].url || artImage;
        }
        return {
          id: art.browseId || "",
          name: art.title || art.name || "",
          image: artImage
        };
      });
    };

    const albums = normalizeAlbums(data.albums?.results || []);
    const singles = normalizeAlbums(data.singles?.results || []);
    const related = normalizeRelated(data.related?.results || []);

    return {
      id,
      name: data.name || "",
      image,
      description: data.description || "",
      songs: normalizeSongsToCanonical(rawSongs),
      albums,
      singles,
      related
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

export async function getHomeFeed(limit = 10): Promise<any> {
  const cacheKey = `youtube_home_feed:${limit}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    // Ignore cache read error
  }

  try {
    const data = await callMusicProvider("/home", { limit });
    if (data && data.sections) {
      await redisSet(cacheKey, JSON.stringify(data), 1800).catch(() => {});
    }
    return data;
  } catch (err: any) {
    console.error("[youtubeMusicService] getHomeFeed failed:", err.message || err);
    return { sections: [], count: 0 };
  }
}

