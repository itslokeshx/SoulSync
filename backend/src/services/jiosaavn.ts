// ════════════════════════════════════════════════════════════════
// JIOSAAVN SERVICE — Ultra-fast parallel fetching (Rich Results)
// ════════════════════════════════════════════════════════════════

import { ParsedIntent, QueryWithWeight } from "./intentParser.js";

const JIOSAAVN_BASE = process.env.JIOSAAVN_API || "https://saavn.sumit.co/api";
// V1 wrapper: older format (primaryArtists string, downloadUrl[].link)
// Hosted on Vercel — accessible from all servers including Render US.
// Critically, it has a CORRECT search index: Ed Sheeran / Weeknd / etc.
// come back as #1 unlike saavn.sumit.co which returns covers.
const JIOSAAVN_V1 =
  process.env.JIOSAAVN_API_V1 || "https://jiosaavn-api-privatecvc2.vercel.app";
const REQUEST_TIMEOUT = 3500; // 3.5 seconds max

export interface SearchResult {
  songs: any[];
  albums: any[];
  artists: any[];
  topResult: any | null;
  total: number;
  intent: ParsedIntent;
  parsedIntent?: any;
  relatedSearches?: string[];
}

// Keep the old song definition for other files that import it
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

// Priority flag: used primarily by searchEnhancer to yield warmup paths
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

// Keep fetchSafe as a lightweight alias for non-critical calls
const fetchSafe = (url: string) => fetchWithRetry(url, 2);

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
// HYBRID SEARCH — three-tier fallback for correct results everywhere
//
// Problem: saavn.sumit.co (V2 wrapper) has a broken search index for many
// international songs — covers dominate instead of the original.
//
// Solution:
//   Tier 1 — direct jiosaavn.com: best ranking, may be geo-blocked on Render US
//   Tier 2 — jiosaavn-api-privatecvc2.vercel.app (V1): correct results on ALL
//             servers (Vercel, not blocked). Ed Sheeran / Weeknd / etc. all #1.
//   Tier 3 — saavn.sumit.co (V2 wrapper): last resort, may return covers
//
// Tier 1 and Tier 2 fire in PARALLEL — zero extra latency on Render.
// ───────────────────────────────────────────────────────────────
export async function searchSongsHybrid(
  query: string,
  limit = 20,
  knownArtist?: string | null,
): Promise<any[]> {
  const q = query.trim();
  if (!q) return [];

  const n = Math.min(limit, 50);

  // Fire Tier 1 (direct jiosaavn.com) and Tier 2 (V1 Vercel) in PARALLEL.
  // On Render: Tier 1 times out (~3s), Tier 2 responds (~0.5s) — no net delay.
  // Locally: Tier 1 wins quickly with popularity-ranked results.
  const [directSettled, v1Settled] = await Promise.allSettled([
    fetchDirect(
      `${JIOSAAVN_DIRECT}?__call=search.getResults&_format=json&_marker=0&ctx=web6dot0` +
        `&n=${n}&p=1&q=${encodeURIComponent(q)}`,
    ),
    fetchSafe(
      `${JIOSAAVN_V1}/search/songs?query=${encodeURIComponent(q)}&limit=${n}`,
    ),
  ]);

  const rawDirect: any[] =
    directSettled.status === "fulfilled"
      ? directSettled.value?.results || []
      : [];
  const rawV1: any[] =
    v1Settled.status === "fulfilled"
      ? v1Settled.value?.data?.results || v1Settled.value?.results || []
      : [];

  // ── TIER 1: direct jiosaavn.com returned results ────────────────────
  if (rawDirect.length > 0) {
    // Merge V1 results in for extra coverage (dedup by ID)
    const seen = new Set<string>(rawDirect.map((s: any) => String(s.id || "")));
    const combined = [...rawDirect];
    for (const s of rawV1) {
      const id = String(s.id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        combined.push(s);
      }
    }
    // Enrich with stream URLs from V2 wrapper (direct results lack downloadUrl).
    // V1-sourced songs already carry downloadUrl[].link — skip them.
    const enriched = await Promise.allSettled(
      combined.slice(0, limit).map(async (song: any) => {
        if ((song.downloadUrl as any[])?.length > 0) return song;
        const id = String(song.id || "").trim();
        if (!id) return song;
        const wData = (await fetchSafe(`${JIOSAAVN_BASE}/songs/${id}`)) as any;
        const wSong = wData?.data?.[0];
        if (wSong?.downloadUrl?.length > 0)
          return { ...song, downloadUrl: wSong.downloadUrl };
        return song;
      }),
    );
    return enriched
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);
  }

  // ── TIER 2: V1 Vercel wrapper (production / Render) ─────────────────
  // V1 results include downloadUrl[].link — normalizeSongToCanonical handles it.
  if (rawV1.length > 0) {
    return rawV1.slice(0, limit);
  }

  // ── TIER 3: both blocked — V2 wrapper last resort ────────────────────
  const seen = new Set<string>();
  const combined: any[] = [];
  const addResults = (songs: any[]) => {
    for (const s of songs) {
      const id = String(s.id || s.songId || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        combined.push(s);
      }
    }
  };
  if (knownArtist) {
    const enrichedWrapper = (await fetchSafe(
      `${JIOSAAVN_BASE}/search/songs?query=${encodeURIComponent(`${q} ${knownArtist}`)}&limit=30`,
    )) as any;
    addResults(
      enrichedWrapper?.data?.results || enrichedWrapper?.results || [],
    );
  }
  const plain = (await fetchSafe(
    `${JIOSAAVN_BASE}/search/songs?query=${encodeURIComponent(q)}&limit=${n}`,
  )) as any;
  addResults(plain?.data?.results || plain?.results || []);
  return combined;
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

// ════════════════════════════════════════════════════════════════
// MAIN SEARCH — Parallel execution: Songs + Albums + Artists
// ════════════════════════════════════════════════════════════════
export async function executeSearch(
  intent: ParsedIntent,
): Promise<SearchResult> {
  const queries = intent.expandedQueries.slice(0, 5);
  const mainQuery = intent.raw;

  markUserQueryStart();

  try {
    // Fire ALL requests in parallel using Promise.allSettled
    const [officialAll, songResults, albumResults, artistResults] =
      await Promise.allSettled([
        // 0. Official "All" search (for Top Result and basic categories)
        fetchSafe(
          `${JIOSAAVN_BASE}/search?query=${encodeURIComponent(mainQuery)}`,
        ),
        // 1. All song variations (from intent parser)
        Promise.allSettled(
          queries.map(({ query, weight }) =>
            searchSongs(query, 50).then((songs) => ({ songs, weight, query })),
          ),
        ),
        // 2. Direct album search
        searchAlbums(mainQuery, 8),
        // 3. Direct artist search
        searchArtists(mainQuery, 5),
      ]);

    const officialData =
      officialAll.status === "fulfilled" ? officialAll.value?.data : null;

    // Decode HTML entities for official mixed results
    const officialTop = officialData?.topQuery?.results?.[0] || null;
    if (officialTop && officialTop.name)
      officialTop.name = decodeHtmlEntities(officialTop.name);

    const officialSongs = (officialData?.songs?.results || []).map(
      (s: any) => ({ ...s, name: decodeHtmlEntities(s.name) }),
    );
    const officialAlbums = (officialData?.albums?.results || []).map(
      (a: any) => ({ ...a, name: decodeHtmlEntities(a.name) }),
    );
    const officialArtists = (officialData?.artists?.results || []).map(
      (a: any) => ({ ...a, name: decodeHtmlEntities(a.name) }),
    );

    // ── Process Songs from parallel expansions ───────────────────
    const allSongs: any[] = [...officialSongs];
    const seenIds = new Set<string>(
      officialSongs.map((s: any) => s.id || s.songId),
    );

    if (songResults.status === "fulfilled") {
      for (const result of songResults.value) {
        if (result.status !== "fulfilled") continue;
        const { songs, weight } = result.value;
        for (const song of songs) {
          const id = song.id || song.songId;
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          allSongs.push({ ...song, _weight: weight });
        }
      }
    }

    // ── Process Albums & Artists ────────────────────────────────
    const albums = [...officialAlbums];
    const albumIds = new Set(officialAlbums.map((a: any) => a.id));

    if (albumResults.status === "fulfilled" && albumResults.value) {
      for (const alb of albumResults.value) {
        if (!albumIds.has(alb.id)) {
          albums.push(alb);
          albumIds.add(alb.id);
        }
      }
    }

    const artists = [...officialArtists];
    const artistIds = new Set(officialArtists.map((a: any) => a.id));
    if (artistResults.status === "fulfilled" && artistResults.value) {
      for (const art of artistResults.value) {
        if (!artistIds.has(art.id)) {
          artists.push(art);
          artistIds.add(art.id);
        }
      }
    }

    // ── Scoring ──────────────────────────────────────────────────
    const scoredSongs = allSongs
      .map((song) => ({ ...song, _score: scoreResult(song, intent) }))
      .sort((a, b) => b._score - a._score);

    return {
      songs: scoredSongs,
      albums,
      artists,
      topResult: officialTop || scoredSongs[0] || null,
      total: scoredSongs.length,
      intent,
      parsedIntent: intent,
      relatedSearches: intent.relatedSearches,
    };
  } finally {
    markUserQueryEnd();
  }
}

// ════════════════════════════════════════════════════════════════
// SCORING
// ════════════════════════════════════════════════════════════════

function scoreResult(song: any, intent: ParsedIntent): number {
  let score = 0;
  const title = (song.name || song.title || "").toLowerCase();
  const artist = (
    song.primaryArtists ||
    song.primaryArtist ||
    ""
  ).toLowerCase();
  const album = (song.album?.name || song.album || "").toLowerCase();
  const weightBonus = (song._weight || 0.5) * 20;

  if (intent.entities.artist) {
    const artistLower = intent.entities.artist.toLowerCase();
    if (artist.includes(artistLower)) score += 40;
  }
  if (intent.entities.movie) {
    const movieLower = intent.entities.movie.toLowerCase();
    if (album.includes(movieLower)) score += 50;
    if (title.includes(movieLower)) score += 20;
  }
  const playCount = parseInt(song.playCount || "0");
  if (playCount > 10_000_000) score += 20;
  else if (playCount > 1_000_000) score += 10;

  return score + weightBonus;
}

// ════════════════════════════════════════════════════════════════
// COMPATIBILITY EXPORTS
// ════════════════════════════════════════════════════════════════

export async function searchSongsDirect(q: string, limit = 20) {
  return await searchSongs(q, limit);
}

export async function searchAlbumsDirect(q: string, limit = 5) {
  return await searchAlbums(q, limit);
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
  const data = (await fetchSafe(`${JIOSAAVN_BASE}/artists?id=${id}`)) as any;
  return data?.data || null;
}

export async function getSongDetails(id: string): Promise<any> {
  const data = (await fetchSafe(`${JIOSAAVN_BASE}/songs/${id}`)) as any;
  return data?.data || data || null;
}

export async function getArtistSongs(id: string, page = 1): Promise<any[]> {
  // If page 1, fetch 5 pages in parallel to provide 50 songs (Premium Discovery)
  if (page === 1) {
    const pages = [1, 2, 3, 4, 5];
    const results = await Promise.allSettled(
      pages.map((p) =>
        fetchSafe(`${JIOSAAVN_BASE}/artists/${id}/songs?page=${p}`),
      ),
    );

    const allSongs: any[] = [];
    for (const res of results) {
      if (res.status === "fulfilled" && res.value) {
        const data = res.value as any;
        const songs = data?.data?.songs || data?.songs || [];
        allSongs.push(...songs);
      }
    }
    return allSongs;
  }

  const data = (await fetchSafe(
    `${JIOSAAVN_BASE}/artists/${id}/songs?page=${page}`,
  )) as any;
  return data?.data?.songs || data?.songs || [];
}

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

  // ── Stream URL: prefer .url (wrapper), fallback .link (direct) ─
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
    primaryArtists: primaryArtists.trim(),
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

// ─── Convenience wrappers (cleaner API for search route) ─────────
export async function fetchArtistSongs(
  id: string,
  page = 0,
  pages = 1,
): Promise<Song[]> {
  const pageNums = Array.from({ length: pages }, (_, i) => page + i);
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
  return normalizeSongsToCanonical(raws);
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
