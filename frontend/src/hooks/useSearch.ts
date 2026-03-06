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

// ── Module-level session cache (survives re-renders) ──────────────────────
// stale-while-revalidate: instant display from cache, silent refresh in bg.
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

// Prefix hint: find best cached entry whose key starts with q
// e.g. user typed "arij" → find "arijit singh" in cache as a sneak-peek
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
  const [isStale, setIsStale] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      esRef.current?.close();
    };
  }, []);

  const closeSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const doSearch = useCallback(
    async (q: string, p = 1, append = false) => {
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
            return; // still fresh — no network call needed
          }
          setIsStale(true); // stale — refresh silently
        } else {
          // ── Prefix hint: show cached superset while loading ──────────
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

      // Tear down any existing SSE + in-flight request
      closeSSE();
      if (abortRef.current) abortRef.current.abort();

      // ── Pagination (p > 1): plain fetch, no SSE ──────────────────────
      if (p > 1 || append) {
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
          if (!isMountedRef.current) return;
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
          if (!isMountedRef.current) return;
          setIsStale(false);
          setState((s) => (s !== "results" ? "error" : s));
        } finally {
          if (isMountedRef.current) setLoadingMore(false);
        }
        return;
      }

      // ── Initial search (p === 1): SSE streaming ──────────────────────
      // partial event  → show first songs fast (~400 ms TTFB)
      // complete event → show full results + albums/artists, cache them
      // error event    → fallback to regular /smart fetch
      let completed = false;

      const es = new EventSource(
        `${API}/api/search/stream?q=${encodeURIComponent(q.trim())}`,
        { withCredentials: true },
      );
      esRef.current = es;

      es.addEventListener("partial", (e: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(e.data);
          setResult((prev) => ({
            query: q,
            page: 1,
            limit: 20,
            hasMore: false,
            total: data.total ?? data.songs?.length ?? 0,
            topResult: null,
            songs: data.songs ?? [],
            albums: prev?.albums ?? [],
            artists: prev?.artists ?? [],
            parsedIntent: prev?.parsedIntent ?? {
              intent: "mixed",
              displayContext: "",
            },
            relatedSearches: prev?.relatedSearches ?? [],
            matchReason: prev?.matchReason ?? "",
          }));
          setState("results");
          setIsStale(true); // full results still incoming
        } catch {
          /* ignore malformed partial */
        }
      });

      es.addEventListener("complete", (e: MessageEvent) => {
        completed = true;
        const thisEs = es;
        if (!isMountedRef.current) {
          thisEs.close();
          return;
        }
        try {
          const data: SmartSearchResult = JSON.parse(e.data);
          cacheSet(q, data);
          setResult(data);
          setState(
            data.songs.length + data.albums.length + data.artists.length === 0
              ? "no-results"
              : "results",
          );
          setIsStale(false);
        } catch {
          /* ignore malformed complete */
        }
        thisEs.close();
        if (esRef.current === thisEs) esRef.current = null;
      });

      es.addEventListener("error", () => {
        if (completed) return; // server closed cleanly after `complete`
        const thisEs = es;
        thisEs.close();
        if (esRef.current === thisEs) esRef.current = null;
        if (!isMountedRef.current) return;

        // ── Fallback to plain /smart fetch ────────────────────────────
        abortRef.current = new AbortController();
        axios
          .get<SmartSearchResult>(`${API}/api/search/smart`, {
            params: { q: q.trim(), page: 1, limit: 20 },
            signal: abortRef.current.signal,
            withCredentials: true,
          })
          .then(({ data }) => {
            if (!isMountedRef.current) return;
            cacheSet(q, data);
            setResult(data);
            setState(
              data.songs.length + data.albums.length + data.artists.length === 0
                ? "no-results"
                : "results",
            );
            setIsStale(false);
          })
          .catch((err: any) => {
            if (err.code === "ERR_CANCELED") return;
            if (!isMountedRef.current) return;
            setIsStale(false);
            setState((s) => (s !== "results" ? "error" : s));
          });
      });
    },
    [closeSSE],
  );

  // ── Debounced live search: 0 ms for cache hits, 150 ms for new queries ──
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!query || query.trim().length < 2) {
      setState("idle");
      setResult(null);
      setIsStale(false);
      closeSSE();
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    setPage(1);

    // Exact cache hit → fire immediately (zero debounce)
    if (cacheGet(query)) {
      doSearch(query, 1, false);
      return;
    }

    // New query → debounce 150 ms to let the user finish typing
    debounceTimer.current = setTimeout(() => doSearch(query, 1, false), 150);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, doSearch, closeSSE]);

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
    closeSSE();
    if (abortRef.current) abortRef.current.abort();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, [closeSSE]);

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
