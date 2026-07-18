import { Innertube } from "youtubei.js";

let yt: Innertube | null = null;

async function getYt(): Promise<Innertube> {
  if (!yt) {
    yt = await Innertube.create();
  }
  return yt;
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
  const yt = await getYt();
  try {
    const video = await yt.getInfo(id, { client: "IOS" });
    const format = video.chooseFormat({ type: "audio", quality: "best" });
    if (format) {
      return await format.decipher(yt.session.player);
    }
  } catch (e) {
    console.error(`[resolveRealStreamUrl] Error resolving for ${id}:`, e);
  }
  return null;
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
  const yt = await getYt();
  const searchResults = await yt.music.search(query, { type: "song" });
  const contents = searchResults.songs?.contents || [];
  return contents.slice(0, limit);
}

export async function searchSongsHybrid(query: string, limit = 50, knownArtist?: string | null): Promise<any[]> {
  return searchSongs(query, limit);
}

export async function searchAlbums(query: string, limit = 12): Promise<any[]> {
  const yt = await getYt();
  const searchResults = await yt.music.search(query, { type: "album" });
  const contents = searchResults.albums?.contents || [];
  return contents.slice(0, limit).map((album: any) => {
    let image = "/placeholder.png";
    const thumbContents = album.thumbnail?.contents || album.thumbnails || [];
    if (thumbContents.length > 0) {
      image = thumbContents[0].url || image;
    }
    return {
      id: album.id,
      name: album.title || album.name || "",
      title: album.title || album.name || "",
      image,
      year: album.year || "",
      artist: album.artists?.map((a: any) => a.name).join(", ") || album.author || ""
    };
  });
}

export async function searchArtists(query: string, limit = 10): Promise<any[]> {
  const yt = await getYt();
  const searchResults = await yt.music.search(query, { type: "artist" });
  const contents = searchResults.artists?.contents || [];
  return contents.slice(0, limit).map((artist: any) => {
    let image = "/placeholder.png";
    const thumbContents = artist.thumbnail?.contents || artist.thumbnails || [];
    if (thumbContents.length > 0) {
      image = thumbContents[0].url || image;
    }
    return {
      id: artist.id,
      name: artist.name || artist.title || "",
      title: artist.name || artist.title || "",
      image,
      subscribers: artist.subscribers || ""
    };
  });
}

export async function searchPlaylists(query: string, limit = 10): Promise<any[]> {
  const yt = await getYt();
  const searchResults = await yt.music.search(query, { type: "playlist" });
  const contents = searchResults.playlists?.contents || [];
  return contents.slice(0, limit).map((p: any) => {
    let image = "/placeholder.png";
    const thumbContents = p.thumbnail?.contents || p.thumbnails || [];
    if (thumbContents.length > 0) {
      image = thumbContents[0].url || image;
    }
    return {
      id: p.id,
      name: p.title || p.name || "",
      title: p.title || p.name || "",
      image,
      songCount: p.song_count || ""
    };
  });
}

export async function getPlaylistSongs(playlistId: string): Promise<any[]> {
  const yt = await getYt();
  const playlist = await yt.music.getPlaylist(playlistId);
  return playlist.items || [];
}

export async function getAlbumDetails(albumId: string): Promise<any> {
  const yt = await getYt();
  const album = await yt.music.getAlbum(albumId) as any;
  let image = "/placeholder.png";
  const thumbContents = album.header?.thumbnail?.contents || album.header?.thumbnails || [];
  if (thumbContents.length > 0) {
    image = thumbContents[0].url || image;
  }
  return {
    id: albumId,
    name: album.header?.title?.text || album.title || "",
    title: album.header?.title?.text || album.title || "",
    image,
    year: album.header?.year?.text || "",
    artists: album.header?.artists?.map((a: any) => ({ name: a.name, id: a.id })) || [],
    songs: album.items || []
  };
}

export async function getAlbumSongs(albumId: string): Promise<any[]> {
  const yt = await getYt();
  const album = await yt.music.getAlbum(albumId) as any;
  return album.items || [];
}

export async function fetchSongById(id: string, reqBaseUrl?: string): Promise<Song | null> {
  const yt = await getYt();
  try {
    const video = await yt.getInfo(id, { client: "IOS" });
    const info = video.basic_info || {};
    let image = "/placeholder.png";
    if (Array.isArray(info.thumbnail) && info.thumbnail.length > 0) {
      const sortedThumbs = [...info.thumbnail].sort((a, b) => (b.width || 0) - (a.width || 0));
      image = sortedThumbs[0].url || image;
    }
    const primaryArtists = (info.author || "").replace(/\s*-\s*Topic$/i, "");
    const proxyUrl = getStreamProxyUrl(id, reqBaseUrl);
    return {
      id: id,
      name: decodeHtmlEntities(info.title || "Unknown"),
      primaryArtists: decodeHtmlEntities(primaryArtists),
      image,
      album: decodeHtmlEntities(info.title || ""),
      albumId: "",
      duration: Number(info.duration) || 0,
      language: "english",
      year: "",
      streamUrl: proxyUrl,
      downloadUrl: [{ quality: "320kbps", url: proxyUrl }],
      playCount: 0,
      url: `https://music.youtube.com/watch?v=${id}`
    };
  } catch (e: any) {
    console.warn(`[youtubeMusicService] fetchSongById failed for ${id}: ${e.message || e}`);
    return null;
  }
}

export async function fetchSongsByIds(ids: string[], reqBaseUrl?: string): Promise<Song[]> {
  const songs = await Promise.all(
    ids.map(id => fetchSongById(id, reqBaseUrl).catch(() => null))
  );
  return songs.filter((s): s is Song => s !== null);
}

export async function searchAll(query: string, reqBaseUrl?: string): Promise<{ songs: Song[]; artists: any[]; albums: any[] }> {
  const [songs, artists, albums] = await Promise.all([
    searchSongs(query, 10),
    searchArtists(query, 5),
    searchAlbums(query, 5)
  ]);
  return {
    songs: normalizeSongsToCanonical(songs, reqBaseUrl),
    artists,
    albums
  };
}

export async function fetchArtistSongs(id: string, page = 0, pages = 1): Promise<Song[]> {
  const yt = await getYt();
  const artist = await yt.music.getArtist(id);
  const songsSection = artist.sections?.find((sec: any) => {
    const titleText = sec.title?.text || sec.title || "";
    return typeof titleText === "string" && titleText.toLowerCase().includes("song");
  });
  const contents = songsSection?.contents || artist.sections?.[0]?.contents || [];
  return normalizeSongsToCanonical(contents);
}

export async function fetchAlbumSongs(id: string): Promise<Song[]> {
  const songs = await getAlbumSongs(id);
  return normalizeSongsToCanonical(songs);
}

export async function getSuggestions(songId: string, limit = 20): Promise<any[]> {
  const yt = await getYt();
  const upNext = await yt.music.getUpNext(songId);
  const songs = upNext?.contents || [];
  const filtered = songs.filter((s: any) => s.video_id && s.video_id !== songId);
  return normalizeSongsToCanonical(filtered).slice(0, limit);
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
  const yt = await getYt();
  const artist = await yt.music.getArtist(id) as any;
  let image = "/placeholder.png";
  if (artist.header?.thumbnail?.contents?.[0]?.url) {
    image = artist.header.thumbnail.contents[0].url;
  }
  return {
    id,
    name: artist.header?.title?.text || artist.name || "",
    image,
    description: artist.header?.description?.text || "",
    songs: await fetchArtistSongs(id)
  };
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
