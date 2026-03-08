// ════════════════════════════════════════════════════════════════
// JIOSAAVN SERVICE — Ultra-fast parallel fetching (Rich Results)
// ════════════════════════════════════════════════════════════════

import { ParsedIntent, QueryWithWeight } from './intentParser.js'

const JIOSAAVN_BASE = process.env.VITE_JIOSAAVN_API || 'https://saavn.sumit.co/api'
const REQUEST_TIMEOUT = 3500  // 3.5 seconds max

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
  return text.replace(/&quot;|&amp;|&#039;|&lt;|&gt;|&nbsp;/g, (match) => entities[match] || match);
}

// ── Shared fetcher with Retry (Handles 429, 500) ──────────────────
async function fetchWithRetry(url: string, attempts = 3, timeout = REQUEST_TIMEOUT): Promise<any> {
  const isUserQuery = hasActiveUserQueries()
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), i === 0 ? timeout : timeout + 1000)

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      clearTimeout(timer)

      if (res.status === 429) {
        const wait = isUserQuery ? 800 : 1500 * (i + 1)
        console.warn(`[JioSaavn] 429, waiting ${wait}ms (attempt ${i + 1}/${attempts})`)
        await delay(wait)
        continue
      }

      if (!res.ok) {
        if (res.status >= 500 && i < attempts - 1) {
          console.warn(`[JioSaavn] ${res.status} on ${url}, retrying...`)
          await delay(500 * (i + 1))
          continue
        }
        return null
      }

      return await res.json()
    } catch (err: any) {
      clearTimeout(timer)
      if (err.name === 'AbortError') {
        if (i < attempts - 1) continue
        return null
      }
      console.error(`[JioSaavn API Error] Request failed: ${err.message} on ${url}`)
      return null
    }
  }
}

// Keep fetchSafe as a lightweight alias for non-critical calls
const fetchSafe = (url: string) => fetchWithRetry(url, 2)

// ── Search Functions ───────────────────────────────────────────
export async function searchSongs(query: string, limit = 50, page = 1): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=${page}`) as any
  const results = data?.data?.results || data?.results || [];
  return results.map((song: any) => ({
    ...song,
    name: decodeHtmlEntities(song.name || song.title),
    album: typeof song.album === 'object' ? { ...song.album, name: decodeHtmlEntities(song.album?.name) } : song.album
  }));
}

export async function searchAlbums(query: string, limit = 15): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/search/albums?query=${encodeURIComponent(query)}&limit=${limit}`) as any
  const results = data?.data?.results || data?.results || [];
  return results.map((album: any) => ({
    ...album,
    name: decodeHtmlEntities(album.name || album.title)
  }));
}

export async function searchArtists(query: string, limit = 10): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/search/artists?query=${encodeURIComponent(query)}&limit=${limit}`) as any
  const results = data?.data?.results || data?.results || [];
  return results.map((artist: any) => ({
    ...artist,
    name: decodeHtmlEntities(artist.name || artist.title)
  }));
}

// ── Entity Details ─────────────────────────────────────────────
export async function getAlbumDetails(albumId: string): Promise<any> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/albums?id=${albumId}`) as any
  return data?.data || data || null
}

export async function getAlbumSongs(albumId: string): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/albums?id=${albumId}`) as any
  return data?.data?.songs || data?.songs || []
}

// ════════════════════════════════════════════════════════════════
// MAIN SEARCH — Parallel execution: Songs + Albums + Artists
// ════════════════════════════════════════════════════════════════
export async function executeSearch(intent: ParsedIntent): Promise<SearchResult> {
  const queries = intent.expandedQueries.slice(0, 5)
  const mainQuery = intent.raw

  markUserQueryStart()

  try {
    // Fire ALL requests in parallel using Promise.allSettled
    const [officialAll, songResults, albumResults, artistResults] = await Promise.allSettled([
      // 0. Official "All" search (for Top Result and basic categories)
      fetchSafe(`${JIOSAAVN_BASE}/search?query=${encodeURIComponent(mainQuery)}`),
      // 1. All song variations (from intent parser)
      Promise.allSettled(
        queries.map(({ query, weight }) =>
          searchSongs(query, 50).then(songs => ({ songs, weight, query }))
        )
      ),
      // 2. Direct album search
      searchAlbums(mainQuery, 8),
      // 3. Direct artist search
      searchArtists(mainQuery, 5)
    ])

    const officialData = officialAll.status === 'fulfilled' ? officialAll.value?.data : null

    // Decode HTML entities for official mixed results
    const officialTop = officialData?.topQuery?.results?.[0] || null
    if (officialTop && officialTop.name) officialTop.name = decodeHtmlEntities(officialTop.name);

    const officialSongs = (officialData?.songs?.results || []).map((s: any) => ({ ...s, name: decodeHtmlEntities(s.name) }));
    const officialAlbums = (officialData?.albums?.results || []).map((a: any) => ({ ...a, name: decodeHtmlEntities(a.name) }));
    const officialArtists = (officialData?.artists?.results || []).map((a: any) => ({ ...a, name: decodeHtmlEntities(a.name) }));

    // ── Process Songs from parallel expansions ───────────────────
    const allSongs: any[] = [...officialSongs]
    const seenIds = new Set<string>(officialSongs.map((s: any) => s.id || s.songId))

    if (songResults.status === 'fulfilled') {
      for (const result of songResults.value) {
        if (result.status !== 'fulfilled') continue
        const { songs, weight } = result.value
        for (const song of songs) {
          const id = song.id || song.songId
          if (seenIds.has(id)) continue
          seenIds.add(id)
          allSongs.push({ ...song, _weight: weight })
        }
      }
    }

    // ── Process Albums & Artists ────────────────────────────────
    const albums = [...officialAlbums]
    const albumIds = new Set(officialAlbums.map((a: any) => a.id))

    if (albumResults.status === 'fulfilled' && albumResults.value) {
      for (const alb of albumResults.value) {
        if (!albumIds.has(alb.id)) {
          albums.push(alb)
          albumIds.add(alb.id)
        }
      }
    }

    const artists = [...officialArtists]
    const artistIds = new Set(officialArtists.map((a: any) => a.id))
    if (artistResults.status === 'fulfilled' && artistResults.value) {
      for (const art of artistResults.value) {
        if (!artistIds.has(art.id)) {
          artists.push(art)
          artistIds.add(art.id)
        }
      }
    }

    // ── Scoring ──────────────────────────────────────────────────
    const scoredSongs = allSongs
      .map(song => ({ ...song, _score: scoreResult(song, intent) }))
      .sort((a, b) => b._score - a._score)

    return {
      songs: scoredSongs,
      albums,
      artists,
      topResult: officialTop || scoredSongs[0] || null,
      total: scoredSongs.length,
      intent,
      parsedIntent: intent,
      relatedSearches: intent.relatedSearches,
    }
  } finally {
    markUserQueryEnd()
  }
}

// ════════════════════════════════════════════════════════════════
// SCORING
// ════════════════════════════════════════════════════════════════

function scoreResult(song: any, intent: ParsedIntent): number {
  let score = 0
  const title = (song.name || song.title || '').toLowerCase()
  const artist = (song.primaryArtists || song.primaryArtist || '').toLowerCase()
  const album = (song.album?.name || song.album || '').toLowerCase()
  const weightBonus = (song._weight || 0.5) * 20

  if (intent.entities.artist) {
    const artistLower = intent.entities.artist.toLowerCase()
    if (artist.includes(artistLower)) score += 40
  }
  if (intent.entities.movie) {
    const movieLower = intent.entities.movie.toLowerCase()
    if (album.includes(movieLower)) score += 50
    if (title.includes(movieLower)) score += 20
  }
  const playCount = parseInt(song.playCount || '0')
  if (playCount > 10_000_000) score += 20
  else if (playCount > 1_000_000) score += 10

  return score + weightBonus
}

// ════════════════════════════════════════════════════════════════
// COMPATIBILITY EXPORTS
// ════════════════════════════════════════════════════════════════

export async function searchSongsDirect(q: string, limit = 20) {
  return await searchSongs(q, limit);
}

export async function searchAlbumsDirect(q: string, limit = 5) {
  return await searchAlbums(q, limit)
}

export async function getSuggestions(songId: string, limit = 50): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/songs/${songId}/suggestions?limit=${limit}`) as any
  return data?.data || []
}

export async function getTopSearches(): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/search/top`) as any
  return data?.data || []
}

export async function getArtistDetails(id: string): Promise<any> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/artists?id=${id}`) as any
  return data?.data || null
}

export async function getSongDetails(id: string): Promise<any> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/songs/${id}`) as any
  return data?.data || data || null
}

export async function getArtistSongs(id: string, page = 1): Promise<any[]> {
  // If page 1, fetch 5 pages in parallel to provide 50 songs (Premium Discovery)
  if (page === 1) {
    const pages = [1, 2, 3, 4, 5];
    const results = await Promise.allSettled(
      pages.map(p => fetchSafe(`${JIOSAAVN_BASE}/artists/${id}/songs?page=${p}`))
    );

    const allSongs: any[] = [];
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        const data = res.value as any;
        const songs = data?.data?.songs || data?.songs || [];
        allSongs.push(...songs);
      }
    }
    return allSongs;
  }

  const data = await fetchSafe(`${JIOSAAVN_BASE}/artists/${id}/songs?page=${page}`) as any
  return data?.data?.songs || data?.songs || []
}
