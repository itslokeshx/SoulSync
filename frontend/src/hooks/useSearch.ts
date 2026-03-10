import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useDebounce } from "use-debounce";

const API = (
  import.meta.env.VITE_BACKEND_URL || "http://localhost:4000"
).replace(/\/$/, "");

export interface SmartSearchResult {
  songs: any[];
  albums: any[];
  artists: any[];
  topResult: any | null;
  total: number;
  intent: {
    intent: string;
    entities: any;
  };
  parsedIntent?: {
    displayContext?: string;
  };
  relatedSearches?: string[];
  hasMore?: boolean;
}

type SearchState = "idle" | "loading" | "results" | "no-results" | "error";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 120);

  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) {
      setResult(null);
      setState("idle");
      return;
    }

    setState("loading");
    setResult(null); // Clear old results to avoid flicker

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const { data } = await axios.get<SmartSearchResult>(`${API}/api/search`, {
        params: { q: term },
        signal: abortRef.current.signal,
        withCredentials: true,
      });

      setResult(data);
      const hasResults =
        data.songs.length > 0 ||
        data.albums.length > 0 ||
        data.artists.length > 0;
      setState(hasResults ? "results" : "no-results");
    } catch (err: any) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
      console.error("Search error:", err);
      setState("error");
    }
  }, []);

  useEffect(() => {
    doSearch(debouncedQuery);
  }, [debouncedQuery, doSearch]);

  const loadMore = useCallback(() => {
    // Current backend returns full results for ultra-fast performance.
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setResult(null);
    setState("idle");
  }, []);

  return {
    query,
    setQuery,
    state,
    result,
    loadingMore: false,
    loadMore,
    reset,
  };
}
