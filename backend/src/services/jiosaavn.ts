// ════════════════════════════════════════════════════════════════
// JIOSAAVN SERVICE — Ultra-fast parallel fetching (Rich Results)
// ════════════════════════════════════════════════════════════════
const JIOSAAVN_BASE =
  process.env.JIOSAAVN_API || "https://jiosavan-api2.vercel.app/api";
const REQUEST_TIMEOUT = 3500; // 3.5 seconds max

// JioSaavnSong definition used by other files that import it
export interface JioSaavnSong {
  id: string;
  name: string;
  type: string;
  year: string;
  duration: number;
  language: string;
  image: { quality: string; url: string }[];
  downloadUrl: { quality: string; url: string }[];
  artists: {
    primary: {
      id: string;
      name: string;
      image: { quality: string; url: string }[];
    }[];
    featured: { id: string; name: string }[];
    all: { id: string; name: string; role: string }[];
  };
  album: { id: string; name: string; url: string };
  url: string;
  hasLyrics: boolean;
  label: string;
  artist_map?: {
    primary_artists: { id: string; name: string; url: string; image: any[] }[];
    featured_artists: any[];
    artists: any[];
  };
}

// Tracks active user queries to prioritize user searches over background tasks/warmups
let activeUserQueries = 0;
export function markUserQueryStart() {
  activeUserQueries++;
}
export function markUserQueryEnd() {
  activeUserQueries = Math.max(0, activeUserQueries - 1);
}
export function hasActiveUserQueries() {
  return activeUserQueries > 0;
}

// ── HTML Entity Decoder ────────────────────────────────────────
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  const entities: Record<string, string> = {
    "&quot;": '"',
    "&amp;": "&",
    "&#039;": "'",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
  };
  return text.replace(
    /&quot;|&amp;|&#039;|&lt;|&gt;|&nbsp;/g,
    (match) => entities[match] || match,
  );
}

// ── Shared fetcher with Retry (Handles 429, 500) ──────────────────
async function fetchWithRetry(
  url: string,
  attempts = 3,
  timeout = REQUEST_TIMEOUT,
): Promise<any> {
  const isUserQuery = hasActiveUserQueries();
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      i === 0 ? timeout : timeout + 1000,
    );

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      clearTimeout(timer);

      if (res.status === 429) {
        const wait = isUserQuery ? 800 : 1500 * (i + 1);
        console.warn(
          `[JioSaavn] 429, waiting ${wait}ms (attempt ${i + 1}/${attempts})`,
        );
        await delay(wait);
        continue;
      }

      if (!res.ok) {
        if (res.status >= 500 && i < attempts - 1) {
          console.warn(`[JioSaavn] ${res.status} on ${url}, retrying...`);
          await delay(500 * (i + 1));
          continue;
        }
        return null;
      }

      return await res.json();
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        if (i < attempts - 1) continue;
        return null;
      }
      console.error(
        `[JioSaavn API Error] Request failed: ${err.message} on ${url}`,
      );
      return null;
    }
  }
}

// Shared fetchSafe wrapper that extracts the subpath and attempts all configured wrappers sequentially
const fetchSafe = async (urlOrPath: string, attempts = 2): Promise<any> => {
  let subpath = urlOrPath;
  const knownBases = [
    "https://jiosavan-api2.vercel.app/api",
    "https://saavn.sumit.co/api",
    JIOSAAVN_BASE
  ];

  for (const base of knownBases) {
    if (subpath.startsWith(base)) {
      subpath = subpath.slice(base.length);
      break;
    }
  }

  // Ensure subpath starts with a slash
  if (!subpath.startsWith("/")) {
    subpath = "/" + subpath;
  }

  // Define candidate wrappers in order of priority (filtering duplicates and falsy entries)
  const wrappers = Array.from(
    new Set(
      [
        process.env.JIOSAAVN_API,
        process.env.JIOSAAVN_API_PRIMARY,
        process.env.JIOSAAVN_API_FALLBACK,
        "https://jiosavan-api2.vercel.app/api",
        "https://saavn.sumit.co/api",
      ]
        .filter(Boolean)
        .map((w) => w!.replace(/\/$/, ""))
    )
  );

  // Attempt each wrapper until one yields a successful response
  for (let w = 0; w < wrappers.length; w++) {
    const wrapperBase = wrappers[w];
    const fullUrl = `${wrapperBase}${subpath}`;

    try {
      const res = await fetchWithRetry(fullUrl, attempts);
      if (res) {
        if (res.success !== false) {
          return res;
        }
        console.warn(
          `[JioSaavn Wrapper] Wrapper ${wrapperBase} returned error payload for ${subpath}: ${res.message || "Unknown error"}`
        );
      }
    } catch (err: any) {
      console.error(
        `[JioSaavn Wrapper] Error requesting ${subpath} from wrapper ${wrapperBase}: ${err.message}`
      );
    }
  }

  console.error(`[JioSaavn API Failure] All JioSaavn wrappers failed for subpath: ${subpath}`);
  return null;
};

// ── Direct jiosaavn.com fetcher (needs Referer header) ─────────────────
const JIOSAAVN_DIRECT = "https://www.jiosaavn.com/api.php";
async function fetchDirect(url: string, timeout = 3000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.jiosaavn.com/",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    // Cloudflare challenge pages return very large HTML — detect by size
    // jiosaavn.com returns text/html even for valid JSON responses, so we
    // can't rely on content-type; instead try parsing and catch failures.
    const text = await res.text();
    if (text.length < 20) return null; // empty / too short
    try {
      return JSON.parse(text);
    } catch {
      return null; // was an HTML challenge page, not JSON
    }
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────
// HYBRID SEARCH — two-tier fallback for correct results everywhere
//
// Tier 1 — direct jiosaavn.com: best ranking, may be geo-blocked on Render US
// Tier 2 — wrapper API (JIOSAAVN_BASE): accessible everywhere, good fallback
//
// Both fire in PARALLEL — zero extra latency.
// normalizeSongToCanonical handles both direct and wrapper response formats.
// ───────────────────────────────────────────────────────────────
export async function searchSongsHybrid(
  query: string,
  limit = 20,
  knownArtist?: string | null,
): Promise<any[]> {
  const q = query.trim();
  if (!q) return [];

  const n = Math.min(limit, 50);

  // Fire Tier 1 (direct jiosaavn.com) and Tier 2 (wrapper) in PARALLEL.
  const [directSettled, wrapperSettled] = await Promise.allSettled([
    fetchDirect(
      `${JIOSAAVN_DIRECT}?__call=search.getResults&_format=json&_marker=0&ctx=web6dot0` +
        `&n=${n}&p=1&q=${encodeURIComponent(q)}`,
    ),
    fetchSafe(
      `${JIOSAAVN_BASE}/search/songs?query=${encodeURIComponent(q)}&limit=${n}`,
    ),
  ]);

  const rawDirect: any[] =
    directSettled.status === "fulfilled"
      ? directSettled.value?.results || []
      : [];
  const rawWrapper: any[] =
    wrapperSettled.status === "fulfilled"
      ? wrapperSettled.value?.data?.results || wrapperSettled.value?.results || []
      : [];

  // ── TIER 1: direct jiosaavn.com returned results ────────────────────
  if (rawDirect.length > 0) {
    // Merge wrapper results for extra coverage (dedup by ID)
    const seen = new Set<string>(rawDirect.map((s: any) => String(s.id || "")));
    const combined = [...rawDirect];
    for (const s of rawWrapper) {
      const id = String(s.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        combined.push(s);
      }
    }
    return combined.slice(0, limit);
  }

  // ── TIER 2: wrapper fallback ────────────────────────────────────────
  if (rawWrapper.length > 0) {
    return rawWrapper.slice(0, limit);
  }

  // ── Last resort: enriched wrapper query with knownArtist ────────────
  if (knownArtist) {
    const enriched = (await fetchSafe(
      `${JIOSAAVN_BASE}/search/songs?query=${encodeURIComponent(`${q} ${knownArtist}`)}&limit=30`,
    )) as any;
    return (enriched?.data?.results || enriched?.results || []).slice(0, limit);
  }

  return [];
}

// Wrapper-based search (used by dashboardEngine, searchEnhancer, ai route, etc.)
// Note: broken for some international artists — use searchSongsHybrid in search route
export async function searchSongs(
  query: string,
  limit = 50,
  page = 1,
): Promise<any[]> {
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`,
  )) as any;
  const results = data?.data?.results || data?.results || [];
  return results.map((song: any) => ({
    ...song,
    name: decodeHtmlEntities(song.name || song.title),
    album:
      typeof song.album === "object"
        ? { ...song.album, name: decodeHtmlEntities(song.album?.name) }
        : song.album,
  }));
}

export async function searchAlbums(query: string, limit = 15): Promise<any[]> {
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/search/albums?query=${encodeURIComponent(query)}&limit=${limit}`,
  )) as any;
  const results = data?.data?.results || data?.results || [];
  return results.map((album: any) => ({
    ...album,
    name: decodeHtmlEntities(album.name || album.title),
  }));
}

export async function searchArtists(query: string, limit = 10): Promise<any[]> {
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/search/artists?query=${encodeURIComponent(query)}&limit=${limit}`,
  )) as any;
  const results = data?.data?.results || data?.results || [];
  return results.map((artist: any) => ({
    ...artist,
    name: decodeHtmlEntities(artist.name || artist.title),
  }));
}

export async function searchPlaylists(query: string, limit = 10): Promise<any[]> {
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/search/playlists?query=${encodeURIComponent(query)}&limit=${limit}`,
  )) as any;
  const results = data?.data?.results || data?.results || [];
  return results.map((playlist: any) => ({
    ...playlist,
    name: decodeHtmlEntities(playlist.name || playlist.title),
  }));
}

export async function getPlaylistSongs(playlistId: string): Promise<any[]> {
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/playlists?id=${playlistId}`,
  )) as any;
  return data?.data?.songs || data?.songs || [];
}

// ── Entity Details ─────────────────────────────────────────────
export async function getAlbumDetails(albumId: string): Promise<any> {
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/albums?id=${albumId}`,
  )) as any;
  return data?.data || data || null;
}

export async function getAlbumSongs(albumId: string): Promise<any[]> {
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/albums?id=${albumId}`,
  )) as any;
  return data?.data?.songs || data?.songs || [];
}

// ─── CANONICAL TYPE AND NORMALIZATION ───────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
// CANONICAL SONG TYPE — used by search route and searchRanker
// ═══════════════════════════════════════════════════════════════
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

// ─── Normalize any raw song shape (wrapper OR direct jiosaavn.com) ─
export function normalizeSongToCanonical(raw: any): Song | null {
  if (!raw?.id) return null;

  // ── Artists ──────────────────────────────────────────────────
  let primaryArtists = "";
  if (typeof raw.primaryArtists === "string" && raw.primaryArtists) {
    primaryArtists = raw.primaryArtists;
  } else if (typeof raw.primary_artists === "string" && raw.primary_artists) {
    primaryArtists = raw.primary_artists; // direct jiosaavn.com API
  } else if (typeof raw.singers === "string" && raw.singers) {
    primaryArtists = raw.singers; // direct API fallback
  } else if (Array.isArray(raw.artists?.primary)) {
    primaryArtists = raw.artists.primary
      .map((a: any) => (typeof a === "string" ? a : a.name || ""))
      .filter(Boolean)
      .join(", ");
  }

  // ── Stream URL ────────────────────────────────────────────────
  // Priority order:
  //   1. raw.streamUrl (already normalized upstream)
  //   2. downloadUrl[].url or .link (V1/V2 wrapper shape)
  //   3. more_info.encrypted_media_url (direct jiosaavn.com shape) ← NEW
  //   4. more_info.media_url fallback                              ← NEW
  let streamUrl: string | null = raw.streamUrl || null;

  if (!streamUrl && Array.isArray(raw.downloadUrl)) {
    const ORDER = ["320kbps", "160kbps", "96kbps", "48kbps", "12kbps"];
    for (const q of ORDER) {
      const entry = raw.downloadUrl.find((d: any) => d.quality === q);
      const u = entry?.url || entry?.link || "";
      if (u && u !== "null" && u.startsWith("http")) {
        streamUrl = u.replace(/&amp;/g, "&");
        break;
      }
    }
    // Last-resort: take whatever URL exists
    if (!streamUrl) {
      for (const entry of raw.downloadUrl) {
        const u = entry?.url || entry?.link || "";
        if (u && u.startsWith("http")) {
          streamUrl = u.replace(/&amp;/g, "&");
          break;
        }
      }
    }
  }

  // ✅ FIX: Direct jiosaavn.com songs carry stream URL in root or more_info
  // This fires when Tier 1 wins and no enrichment loop ran
  const encUrl = raw.encrypted_media_url || raw.more_info?.encrypted_media_url;
  if (!streamUrl && encUrl) {
    streamUrl = decodeHtmlEntities(encUrl);
  }
  const medUrl = raw.media_url || raw.more_info?.media_url;
  if (!streamUrl && medUrl) {
    streamUrl = decodeHtmlEntities(medUrl);
  }

  // ── Image: highest quality available ─────────────────────────
  let image = "/placeholder.png";
  const imgs: any[] = Array.isArray(raw.image) ? raw.image : [];
  if (imgs.length > 0) {
    const i500 = imgs.find((i: any) => i.quality === "500x500");
    const i150 = imgs.find((i: any) => i.quality === "150x150");
    const u =
      i500?.url ||
      i500?.link ||
      i150?.url ||
      i150?.link ||
      imgs[imgs.length - 1]?.url ||
      imgs[imgs.length - 1]?.link ||
      "";
    if (u) image = u;
  } else if (typeof raw.image === "string" && raw.image) {
    // Direct jiosaavn.com returns a string image URL — upscale it
    image = raw.image.replace(/\b(50|150|175)x\1\b/g, "500x500");
  }

  // ── Play count: handle string (direct API) or number (wrapper) ─
  const playCount = Math.max(
    0,
    parseInt(String(raw.play_count || raw.playCount || "0"), 10) || 0,
  );

  return {
    id: String(raw.id || raw.songId || ""),
    name: decodeHtmlEntities(raw.name || raw.title || raw.song || "Unknown"),
    primaryArtists: decodeHtmlEntities(primaryArtists.trim()),
    image,
    album:
      typeof raw.album === "object"
        ? decodeHtmlEntities(raw.album?.name || "")
        : decodeHtmlEntities(raw.album || ""),
    albumId:
      typeof raw.album === "object" ? raw.album?.id || "" : raw.albumId || "",
    duration: Number(raw.duration) || 0,
    language: (raw.language || "").toLowerCase(),
    year: String(raw.year || ""),
    releaseDate: raw.releaseDate ? String(raw.releaseDate) : undefined,
    streamUrl,
    downloadUrl:
      Array.isArray(raw.downloadUrl) && raw.downloadUrl.length > 0
        ? raw.downloadUrl
        : null,
    playCount,
    url: raw.url || "",
  };
}

export function normalizeSongsToCanonical(raws: any[]): Song[] {
  return (raws || [])
    .map((r) => {
      try {
        return normalizeSongToCanonical(r);
      } catch {
        return null;
      }
    })
    .filter((s): s is Song => s !== null && s.id !== "");
}

// ─── Fetch multiple songs by ID in parallel (wrapper) ─────────────
// Used to inject pinned songs (e.g. Ed Sheeran for "shape of you")
// that the wrapper search index never returns.
export async function fetchSongsByIds(ids: string[]): Promise<Song[]> {
  if (!ids.length) return [];
  const results = await Promise.allSettled(
    ids.map((id) => fetchSafe(`${JIOSAAVN_BASE}/songs/${id}`) as Promise<any>),
  );
  const songs: Song[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const raw = Array.isArray(r.value.data) ? r.value.data[0] : r.value.data;
    const s = normalizeSongToCanonical(raw);
    if (s) songs.push(s);
  }
  return songs;
}

// ─── SEARCH ALL — songs + artists + albums in one call ────────────
export async function searchAll(query: string): Promise<{
  songs: Song[];
  artists: any[];
  albums: any[];
}> {
  const q = query.trim();
  if (!q) return { songs: [], artists: [], albums: [] };
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/search?query=${encodeURIComponent(q)}`,
  )) as any;
  // wrapper returns { success, data: { songs: { results }, albums: { results }, artists: { results } } }
  // OR { data: { songs: { results }, ... } }
  const d = data?.data || data || {};
  const rawSongs = d?.songs?.results || [];
  const rawArtists = d?.artists?.results || [];
  const rawAlbums = d?.albums?.results || [];
  return {
    songs: normalizeSongsToCanonical(
      rawSongs.map((s: any) => ({
        ...s,
        name: s.name || s.title,
        primaryArtists: s.primaryArtists || s.artists?.primary?.[0]?.name || "",
      })),
    ),
    artists: rawArtists
      .slice(0, 8)
      .map((a: any) => ({
        id: String(a.id || ""),
        name: decodeHtmlEntities(a.name || a.title || ""),
        image: Array.isArray(a.image)
          ? a.image.find((i: any) => i.quality === "500x500")?.url ||
            a.image[a.image.length - 1]?.url ||
            "/placeholder.png"
          : typeof a.image === "string"
            ? a.image
            : "/placeholder.png",
        url: a.url || "",
      }))
      .filter((a: any) => a.id),
    albums: rawAlbums
      .slice(0, 10)
      .map((a: any) => ({
        id: String(a.id || ""),
        name: decodeHtmlEntities(a.name || a.title || ""),
        image: Array.isArray(a.image)
          ? a.image.find((i: any) => i.quality === "500x500")?.url ||
            a.image[a.image.length - 1]?.url ||
            "/placeholder.png"
          : typeof a.image === "string"
            ? a.image
            : "/placeholder.png",
        year: String(a.year || ""),
        // SearchPage AlbumCard reads .primaryArtists; /search endpoint has 'artist' (string)
        primaryArtists:
          a.primaryArtists || a.artist || a.artists?.primary?.[0]?.name || "",
        url: a.url || "",
      }))
      .filter((a: any) => a.id),
  };
}

const KNOWN_ARTIST_MAP: Record<string, { name: string; image: string }> = {
  "702776": { name: "Arijit Singh", image: "https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg" },
  "3799917": { name: "Taylor Swift", image: "https://c.saavncdn.com/artists/Taylor_Swift_500x500.jpg" },
  "1433699": { name: "The Weeknd", image: "https://c.saavncdn.com/artists/The_Weeknd_500x500.jpg" },
  "596989": { name: "Anirudh Ravichander", image: "https://c.saavncdn.com/artists/Anirudh_Ravichander_500x500.jpg" },
  "17063328": { name: "Drake", image: "https://c.saavncdn.com/artists/Drake_500x500.jpg" },
  "929381": { name: "Ed Sheeran", image: "https://c.saavncdn.com/artists/Ed_Sheeran_500x500.jpg" },
  "16568113": { name: "Shreya Ghoshal", image: "https://c.saavncdn.com/artists/Shreya_Ghoshal_500x500.jpg" },
};

// ─── Convenience wrappers (cleaner API for search route) ─────────
export async function fetchArtistSongs(
  id: string,
  page = 1,
  pages = 5,
): Promise<Song[]> {
  const startPage = Math.max(1, page);
  const pageNums = Array.from({ length: pages }, (_, i) => startPage + i);
  const results = await Promise.allSettled(
    pageNums.map(
      (p) =>
        fetchSafe(
          `${JIOSAAVN_BASE}/artists/${id}/songs?page=${p}&sortBy=popularity&sortOrder=desc`,
        ) as Promise<any>,
    ),
  );
  const raws: any[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const songs = r.value?.data?.songs || r.value?.songs || r.value?.data || [];
    for (const s of Array.isArray(songs) ? songs : []) {
      const sid = String(s.id || s.songId || "");
      if (sid && !seen.has(sid)) {
        seen.add(sid);
        raws.push(s);
      }
    }
  }
  let songs = normalizeSongsToCanonical(raws);

  // Robust Fallback: If wrapper ID returns < 20 songs, search artist top songs for 50 tracks
  if (songs.length < 20) {
    const known = KNOWN_ARTIST_MAP[id];
    const searchName = known?.name || id;
    try {
      const fallbackRaws = await searchSongs(searchName, 50);
      for (const s of fallbackRaws) {
        if (s?.id && !seen.has(s.id)) {
          seen.add(s.id);
          songs.push(s);
        }
      }
    } catch {}
  }

  return songs.slice(0, 50);
}

export async function fetchAlbumSongs(id: string): Promise<Song[]> {
  const data = (await fetchSafe(`${JIOSAAVN_BASE}/albums?id=${id}`)) as any;
  const raws = data?.data?.songs || data?.songs || [];
  return normalizeSongsToCanonical(raws);
}

export async function fetchSongById(id: string): Promise<Song | null> {
  const raw = await getSongDetails(id);
  const song = Array.isArray(raw) ? raw[0] : raw;
  return normalizeSongToCanonical(song);
}

export async function getSuggestions(
  songId: string,
  limit = 50,
): Promise<any[]> {
  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/songs/${songId}/suggestions?limit=${limit}`,
  )) as any;
  return data?.data || [];
}

export async function getTopSearches(): Promise<any[]> {
  const data = (await fetchSafe(`${JIOSAAVN_BASE}/search/top`)) as any;
  return data?.data || [];
}

export async function getArtistDetails(id: string): Promise<any> {
  try {
    const data = (await fetchSafe(`${JIOSAAVN_BASE}/artists?id=${id}`)) as any;
    const res = data?.data || data;
    if (res && res.name && res.name !== "null") return res;
  } catch {}

  const known = KNOWN_ARTIST_MAP[id];
  if (known) {
    return {
      id,
      name: known.name,
      image: [
        { quality: "500x500", link: known.image },
        { quality: "150x150", link: known.image },
      ],
      follower_count: "5000000",
      type: "artist",
    };
  }

  return { id, name: id, image: [], type: "artist" };
}

export async function getSongDetails(id: string): Promise<any> {
  const data = (await fetchSafe(`${JIOSAAVN_BASE}/songs/${id}`)) as any;
  return data?.data || data || null;
}

export async function getSongsDetailsBatch(ids: string[]): Promise<any[]> {
  if (ids.length === 0) return [];
  const data = (await fetchSafe(`${JIOSAAVN_BASE}/songs?ids=${encodeURIComponent(ids.join(","))}`)) as any;
  return data?.data || data || [];
}
