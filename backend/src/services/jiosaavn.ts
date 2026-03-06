import axios from "axios";

const JIOSAAVN_API =
  process.env.JIOSAAVN_API || "https://jiosaavn.rajputhemant.dev";

// ── Two independent throttle queues ─────────────────────────────────────
//
// USER queue  — dedicated to live user song searches (/stream endpoint).
//               Nothing else (warmup, albums, artists) enters this queue,
//               so a user search ALWAYS fires within one gap interval.
//               Gap: 900 ms (≈ 1.1 req/s — slightly aggressive but 429-retry
//               logic handles rare failures gracefully).
//
// BG queue    — albums, artists, warmup, recommendations, and everything
//               else.  Gap: 1200 ms (conservative — these tasks tolerate
//               latency).  Runs fully independently of the user queue so
//               warmup never delays a live search.
//
// Net result  : songs + albums fire at t=0 on separate lanes and both
//               resolve in ~900–1200 ms instead of waiting serially.

const USER_REQ_GAP = 900;
let userLastReq = 0;
let userQueueTail: Promise<void> = Promise.resolve();

const BG_REQ_GAP = 1200;
let bgLastReq = 0;
let bgQueueTail: Promise<void> = Promise.resolve();

// Priority flag: warmup checks this and yields when user queries are running
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

function makeThrottledGet(gapRef: {
  gap: number;
  lastReq: number;
  queueTail: Promise<void>;
}) {
  return async function throttledGet(
    url: string,
    opts: Record<string, any> = {},
  ) {
    const result = new Promise<any>((resolve, reject) => {
      gapRef.queueTail = gapRef.queueTail.then(async () => {
        const now = Date.now();
        const wait = Math.max(0, gapRef.gap - (now - gapRef.lastReq));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            gapRef.lastReq = Date.now();
            const res = await axios.get(url, { timeout: 10000, ...opts });
            resolve(res);
            return;
          } catch (err: any) {
            if (err?.response?.status === 429 && attempt < 2) {
              const retryAfter = err.response?.headers?.["retry-after"];
              const delay = retryAfter
                ? Math.max(parseInt(retryAfter, 10) * 1000, 1200)
                : (attempt + 1) * 1500;
              console.warn(
                `[JioSaavn] 429, waiting ${delay}ms (attempt ${attempt + 1}/3)`,
              );
              await new Promise((r) => setTimeout(r, delay));
              gapRef.lastReq = Date.now();
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
  };
}

const userQueueRef = {
  gap: USER_REQ_GAP,
  lastReq: userLastReq,
  queueTail: userQueueTail,
};
const bgQueueRef = {
  gap: BG_REQ_GAP,
  lastReq: bgLastReq,
  queueTail: bgQueueTail,
};

const throttledGetUser = makeThrottledGet(userQueueRef);
const throttledGetBg = makeThrottledGet(bgQueueRef);
/** Backward-compat alias — routes through the background queue. */
const throttledGet = throttledGetBg;

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

/** Alias of searchSongs — kept for API compatibility. Routes through the throttle queue. */
export async function searchSongsDirect(
  query: string,
  limit = 20,
  page = 1,
): Promise<{ results: JioSaavnSong[]; total: number }> {
  try {
    const { data } = await throttledGetUser(`${JIOSAAVN_API}/search/songs`, {
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

/** Alias of searchAlbums — kept for API compatibility. Routes through the throttle queue. */
export async function searchAlbumsDirect(
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

/** Alias of searchArtists — kept for API compatibility. Routes through the throttle queue. */
export async function searchArtistsDirect(
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
