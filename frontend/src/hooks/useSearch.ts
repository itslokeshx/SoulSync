import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API =
  import.meta.env.VITE_BACKEND_URL ||
  "https://soulsync-backend-a5fs.onrender.com";

export interface SmartSearchResult {
  query: string;
  page: number;
  limit: number;
  hasMore: boolean;
  total: number;
  topResult: any | null;
  songs: any[];
  albums: any[];
  artists: any[];
  parsedIntent: {
    intent: string;
    artist?: string;
    mood?: string;
    language?: string;
    displayContext: string;
  };
  relatedSearches: string[];
  matchReason: string;
}

type SearchState = "idle" | "loading" | "results" | "no-results" | "error";

// ── Module-level session cache ───────────────────────────────────────
// stale-while-revalidate: instant display from cache, silent refresh
// if entry is older than CACHE_STALE_MS.
const resultCache = new Map<
  string,
  { result: SmartSearchResult; ts: number }
>();
const CACHE_STALE_MS = 5 * 60_000; // 5 min fresh window
const MAX_CACHE_ENTRIES = 80;

function cacheKey(q: string) {
  return q.trim().toLowerCase();
}
function cacheGet(q: string) {
  return resultCache.get(cacheKey(q));
}
function cacheSet(q: string, result: SmartSearchResult) {
  resultCache.set(cacheKey(q), { result, ts: Date.now() });
  if (resultCache.size > MAX_CACHE_ENTRIES) {
    resultCache.delete(resultCache.keys().next().value!);
  }
}

// Prefix hint: find the best cached entry whose key starts with q
// (e.g. user typed "arij" → find "arijit singh" in cache)
function cachePrefixHint(q: string): SmartSearchResult | null {
  const k = cacheKey(q);
  if (k.length < 2) return null;
  for (const [key, { result }] of resultCache) {
    if (key.startsWith(k) && key !== k) return result;
  }
  return null;
}

export function useSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const [isStale, setIsStale] = useState(false); // true while silently refreshing
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string, p = 1, append = false) => {
    if (!q || q.trim().length < 2) {
      setState("idle");
      setResult(null);
      setIsStale(false);
      return;
    }

    // ── Exact cache hit ──────────────────────────────────────────────
    if (p === 1 && !append) {
      const cached = cacheGet(q);
      if (cached) {
        setResult(cached.result);
        setState(
          cached.result.songs.length +
            cached.result.albums.length +
            cached.result.artists.length ===
            0
            ? "no-results"
            : "results",
        );
        if (Date.now() - cached.ts < CACHE_STALE_MS) {
          setIsStale(false);
          return; // fresh — no network needed
        }
        setIsStale(true); // stale — refresh silently, keep showing current
      } else {
        // ── Prefix hint: show cached superset results while loading ──
        const hint = cachePrefixHint(q);
        if (hint) {
          setResult(hint);
          setState("results");
          setIsStale(true);
        } else {
          setState("loading");
          setIsStale(false);
        }
      }
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    if (append) setLoadingMore(true);

    try {
      const { data } = await axios.get<SmartSearchResult>(
        `${API}/api/search/smart`,
        {
          params: { q: q.trim(), page: p, limit: 20 },
          signal: abortRef.current.signal,
          withCredentials: true,
        },
      );

      if (p === 1 && !append) cacheSet(q, data);

      setResult((prev) =>
        append && prev
          ? {
              ...data,
              songs: [...prev.songs, ...data.songs],
              albums: prev.albums,
              artists: prev.artists,
            }
          : data,
      );
      setState(
        data.songs.length + data.albums.length + data.artists.length === 0
          ? "no-results"
          : "results",
      );
      setIsStale(false);
    } catch (err: any) {
      if (err.code === "ERR_CANCELED") return;
      // If we had a cached/hint result, keep showing it rather than erroring
      setIsStale(false);
      if (state !== "results") setState("error");
    } finally {
      setLoadingMore(false);
    }
  }, []); // eslint-disable-line

  // ── Debounced live search: 120ms for new, 0ms for cache hits ────────
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!query || query.trim().length < 2) {
      setState("idle");
      setResult(null);
      setIsStale(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    setPage(1);

    // If exact cache hit exists → fire immediately (zero debounce)
    if (cacheGet(query)) {
      doSearch(query, 1, false);
      return;
    }

    // Otherwise debounce 220ms to avoid hammering on fast typing
    debounceTimer.current = setTimeout(() => doSearch(query, 1, false), 220);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, doSearch]);

  const loadMore = useCallback(() => {
    if (!result?.hasMore || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch(query, nextPage, true);
  }, [result, page, query, loadingMore, doSearch]);

  const reset = useCallback(() => {
    setQuery("");
    setState("idle");
    setResult(null);
    setIsStale(false);
    setPage(1);
    if (abortRef.current) abortRef.current.abort();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  return {
    query,
    setQuery,
    state,
    isStale,
    result,
    loadingMore,
    loadMore,
    reset,
  };
}
