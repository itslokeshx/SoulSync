import axios from "axios";

const JIOSAAVN_API =
  process.env.JIOSAAVN_API || "https://saavn.sumit.co/api";

// Removed background queue gaps as per user request to be instantaneous
const throttledGet = async (url: string, opts: Record<string, any> = {}) => {
  try {
    const res = await axios.get(url, { timeout: 10000, ...opts });
    return res;
  } catch (err: any) {
    console.warn(`[JioSaavn API Error] ${err.message} on ${url}`);
    throw err;
  }
};
const throttledGetUser = throttledGet;

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
      params: { query, limit, page },
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

/** Alias of searchSongs — kept for API compatibility. Routes through the throttle queue. */
export async function searchSongsDirect(
  query: string,
  limit = 20,
  page = 1,
): Promise<{ results: JioSaavnSong[]; total: number }> {
  try {
    const { data } = await throttledGetUser(`${JIOSAAVN_API}/search/songs`, {
      params: { query, limit, page },
    });
    return {
      results: data?.data?.results || [],
      total: data?.data?.total || 0,
    };
  } catch (err) {
    console.error("[JioSaavn] searchSongsDirect error:", err);
    return { results: [], total: 0 };
  }
}

export async function searchAlbums(
  query: string,
  limit = 10,
): Promise<unknown[]> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search/albums`, {
      params: { query, limit },
    });
    return data?.data?.results || [];
  } catch {
    return [];
  }
}

/** Alias of searchAlbums — kept for API compatibility. Routes through the throttle queue. */
export async function searchAlbumsDirect(
  query: string,
  limit = 10,
): Promise<unknown[]> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search/albums`, {
      params: { query, limit },
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
      params: { query, limit },
    });
    return data?.data?.results || [];
  } catch {
    return [];
  }
}

/** Alias of searchArtists — kept for API compatibility. Routes through the throttle queue. */
export async function searchArtistsDirect(
  query: string,
  limit = 10,
): Promise<unknown[]> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search/artists`, {
      params: { query, limit },
    });
    return data?.data?.results || [];
  } catch {
    return [];
  }
}

export async function searchAll(query: string): Promise<unknown> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/search`, {
      params: { query },
    });
    return data?.data || {};
  } catch {
    return {};
  }
}

export async function getSongById(id: string): Promise<JioSaavnSong | null> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/songs`, {
      params: { ids: id },
    });
    return data?.data?.[0] || null;
  } catch {
    return null;
  }
}

export async function getAlbumById(id: string): Promise<unknown> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/albums`, {
      params: { id },
    });
    return data?.data || null;
  } catch {
    return null;
  }
}

export async function getArtistById(id: string): Promise<unknown> {
  try {
    const { data } = await throttledGet(`${JIOSAAVN_API}/artists`, {
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
    const { data } = await throttledGet(
      `${JIOSAAVN_API}/songs/${songId}/suggestions`,
      {
        params: { limit },
      },
    );
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
