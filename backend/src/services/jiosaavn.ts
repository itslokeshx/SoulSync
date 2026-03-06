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

// ── Shared fetcher ─────────────────────────────────────────────
async function fetchSafe(url: string, timeout = REQUEST_TIMEOUT): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    clearTimeout(timer)
    return null
  }
}

// ── Search Functions ───────────────────────────────────────────
export async function searchSongs(query: string, limit = 50): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/search/songs?query=${encodeURIComponent(query)}&limit=${limit}&page=1`) as any
  return data?.data?.results || data?.results || []
}

export async function searchAlbums(query: string, limit = 15): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/search/albums?query=${encodeURIComponent(query)}&limit=${limit}`) as any
  return data?.data?.results || data?.results || []
}

export async function searchArtists(query: string, limit = 10): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/search/artists?query=${encodeURIComponent(query)}&limit=${limit}`) as any
  return data?.data?.results || data?.results || []
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
          searchSongs(query, 30).then(songs => ({ songs, weight, query }))
        )
      ),
      // 2. Direct album search
      searchAlbums(mainQuery, 8),
      // 3. Direct artist search
      searchArtists(mainQuery, 5)
    ])

    const officialData = officialAll.status === 'fulfilled' ? officialAll.value?.data : null
    const officialTop = officialData?.topQuery?.results?.[0] || null
    const officialSongs = officialData?.songs?.results || []
    const officialAlbums = officialData?.albums?.results || []
    const officialArtists = officialData?.artists?.results || []

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
  const songs = await searchSongs(q, limit)
  return { results: songs }
}

export async function searchAlbumsDirect(q: string, limit = 5) {
  return await searchAlbums(q, limit)
}

export async function getSuggestions(songId: string, limit = 10): Promise<any[]> {
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

export async function getArtistSongs(id: string, page = 1): Promise<any[]> {
  const data = await fetchSafe(`${JIOSAAVN_BASE}/artists/${id}/songs?page=${page}`) as any
  return data?.data?.songs || data?.songs || []
}
