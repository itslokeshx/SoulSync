import axios from "axios";

const JIOSAAVN_API =
  process.env.JIOSAAVN_API || "https://jiosaavn.rajputhemant.dev";

// ── rate-limit queue: throttle requests to avoid 429s ───────────
let lastReq = 0;
const REQ_GAP = 300; // ms between requests

async function throttledGet(url: string, opts: Record<string, any> = {}) {
  const now = Date.now();
  const wait = Math.max(0, REQ_GAP - (now - lastReq));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReq = Date.now();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await axios.get(url, { timeout: 8000, ...opts });
    } catch (err: any) {
      if (err?.response?.status === 429 && attempt < 2) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("max retries");
}

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
  // snake_case variants from API
  artist_map?: {
    primary_artists: {
      id: string;
      name: string;
      image: { quality: string; link: string }[];
    }[];
  };
  download_url?: { quality: string; link: string }[];
}

export async function searchSongs(
  query: string,
  limit = 20,
  page = 1,
): Promise<{ results: JioSaavnSong[]; total: number }> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search/songs`, {
      params: { q: query, n: limit, page },
    });
    return {
      results: data?.data?.results || [],
      total: data?.data?.total || 0,
    };
  } catch (err) {
    console.error("[JioSaavn] searchSongs error:", err);
    return { results: [], total: 0 };
  }
}

export async function searchAlbums(
  query: string,
  limit = 10,
): Promise<unknown[]> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search/albums`, {
      params: { q: query, n: limit },
    });
    return data?.data?.results || [];
  } catch {
    return [];
  }
}

export async function searchArtists(
  query: string,
  limit = 10,
): Promise<unknown[]> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search/artists`, {
      params: { q: query, n: limit },
    });
    return data?.data?.results || [];
  } catch {
    return [];
  }
}

export async function searchAll(query: string): Promise<unknown> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search`, {
      params: { q: query },
    });
    return data?.data || {};
  } catch {
    return {};
  }
}

export async function getSongById(id: string): Promise<JioSaavnSong | null> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/song`, {
      params: { id },
    });
    return data?.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function getAlbumById(id: string): Promise<unknown> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/album`, {
      params: { id },
    });
    return data?.data || null;
  } catch {
    return null;
  }
}

export async function getArtistById(id: string): Promise<unknown> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/artist`, {
      params: { id },
    });
    return data?.data || null;
  } catch {
    return null;
  }
}

export async function getSuggestions(
  songId: string,
  limit = 10,
): Promise<unknown[]> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/song/recommend`, {
      params: { id: songId, lang: "hindi,english,tamil" },
    });
    return data?.data || [];
  } catch {
    return [];
  }
}

export async function getTopSearches(): Promise<unknown[]> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search/top`);
    return data?.data || [];
  } catch {
    return [];
  }
}
