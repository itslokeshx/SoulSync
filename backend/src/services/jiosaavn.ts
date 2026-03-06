import axios from "axios";

const JIOSAAVN_API =
  process.env.JIOSAAVN_API || "https://jiosaavn.rajputhemant.dev";

// ── Serialised request queue: JioSaavn API allows 1 req / second ────────
const REQ_GAP = 1100; // ms between requests (1.1s to stay safe)
let lastReq = 0;
let queueTail: Promise<void> = Promise.resolve();

/**
 * Enqueue a GET request so that only ONE request is in-flight at a time
 * and each request is spaced at least REQ_GAP ms from the previous one.
 * Retries up to 3 times on 429 with exponential back-off.
 */
async function throttledGet(url: string, opts: Record<string, any> = {}) {
  // Chain onto the queue so requests execute one-by-one
  const result = new Promise<any>((resolve, reject) => {
    queueTail = queueTail.then(async () => {
      // Wait until enough time has passed since the last request
      const now = Date.now();
      const wait = Math.max(0, REQ_GAP - (now - lastReq));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          lastReq = Date.now();
          const res = await axios.get(url, { timeout: 10000, ...opts });
          resolve(res);
          return;
        } catch (err: any) {
          if (err?.response?.status === 429 && attempt < 2) {
            // Read the retry-after header or use exponential backoff
            const retryAfter = err.response?.headers?.["retry-after"];
            const delay = retryAfter
              ? Math.max(parseInt(retryAfter, 10) * 1000, 1200)
              : (attempt + 1) * 1500;
            console.warn(
              `[JioSaavn] 429 rate limited, waiting ${delay}ms (attempt ${attempt + 1}/3)`,
            );
            await new Promise((r) => setTimeout(r, delay));
            lastReq = Date.now(); // update so next queued item also waits
            continue;
          }
          reject(err);
          return;
        }
      }
      reject(new Error("max retries exceeded"));
    });
  });

  return result;
}

// ── Direct (non-throttled) GET for parallel search ops ─────────────────
// Bypasses the global serial queue. Uses a 3 s timeout with one 429 retry.
// Safe for search calls because: (a) each user fires at most a few at once,
// (b) Redis caches results so repeat queries never hit JioSaavn.
async function directGet(url: string, opts: Record<string, any> = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await axios.get(url, { timeout: 3000, ...opts });
      return res;
    } catch (err: any) {
      if (err?.response?.status === 429 && attempt === 0) {
        console.warn("[JioSaavn] 429 on directGet — retrying in 800 ms");
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      throw err;
    }
  }
  throw new Error("[JioSaavn] directGet: max retries exceeded");
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

/** Parallel-safe search — bypasses global throttle queue. Use for user-facing search. */
export async function searchSongsDirect(
  query: string,
  limit = 20,
  page = 1,
): Promise<{ results: JioSaavnSong[]; total: number }> {
  try {
    const { data } = await directGet(`${JIOSAAVN_API}/search/songs`, {
      params: { q: query, n: limit, page },
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
      params: { q: query, n: limit },
    });
    return data?.data?.results || [];
  } catch {
    return [];
  }
}

/** Parallel-safe album search — bypasses global throttle queue. */
export async function searchAlbumsDirect(
  query: string,
  limit = 10,
): Promise<unknown[]> {
  try {
    const { data } = await directGet(`${JIOSAAVN_API}/search/albums`, {
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

/** Parallel-safe artist search — bypasses global throttle queue. */
export async function searchArtistsDirect(
  query: string,
  limit = 10,
): Promise<unknown[]> {
  try {
    const { data } = await directGet(`${JIOSAAVN_API}/search/artists`, {
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
