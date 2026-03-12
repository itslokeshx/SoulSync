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

export interface Suggestion {
  type: "song" | "artist" | "album" | "query";
  text: string;
  subtext?: string;
  id?: string;
  image?: string;
  query?: string;
}

type SearchState = "idle" | "loading" | "results" | "no-results" | "error";

// ── Subset of artist hints for instant local suggestions ────────────────────
const FRONTEND_ARTIST_HINTS: Record<string, string> = {
  ar: "A.R. Rahman",
  "ar rahman": "A.R. Rahman",
  arr: "A.R. Rahman",
  arijit: "Arijit Singh",
  "arijit singh": "Arijit Singh",
  anirudh: "Anirudh Ravichander",
  atif: "Atif Aslam",
  "atif aslam": "Atif Aslam",
  shreya: "Shreya Ghoshal",
  "shreya ghoshal": "Shreya Ghoshal",
  badshah: "Badshah",
  jubin: "Jubin Nautiyal",
  "jubin nautiyal": "Jubin Nautiyal",
  kk: "KK",
  pritam: "Pritam",
  neha: "Neha Kakkar",
  "neha kakkar": "Neha Kakkar",
  darshan: "Darshan Raval",
  armaan: "Armaan Malik",
  "armaan malik": "Armaan Malik",
  "sid sriram": "Sid Sriram",
  sid: "Sid Sriram",
  thaman: "S.Thaman",
  dsp: "Devi Sri Prasad",
  diljit: "Diljit Dosanjh",
  "diljit dosanjh": "Diljit Dosanjh",
  "ap dhillon": "AP Dhillon",
  "karan aujla": "Karan Aujla",
  sidhu: "Sidhu Moosewala",
  "sidhu moosewala": "Sidhu Moosewala",
  taylor: "Taylor Swift",
  "taylor swift": "Taylor Swift",
  weeknd: "The Weeknd",
  "the weeknd": "The Weeknd",
  drake: "Drake",
  billie: "Billie Eilish",
  "billie eilish": "Billie Eilish",
  "dua lipa": "Dua Lipa",
  dua: "Dua Lipa",
  "ed sheeran": "Ed Sheeran",
  ed: "Ed Sheeran",
  adele: "Adele",
  "post malone": "Post Malone",
  "harry styles": "Harry Styles",
  "olivia rodrigo": "Olivia Rodrigo",
  "sabrina carpenter": "Sabrina Carpenter",
  coldplay: "Coldplay",
  eminem: "Eminem",
  "bruno mars": "Bruno Mars",
  ilaiyaraaja: "Ilaiyaraaja",
  ilayaraja: "Ilaiyaraaja",
  yuvan: "Yuvan Shankar Raja",
  harris: "Harris Jayaraj",
  "gv prakash": "G.V. Prakash Kumar",
};

const QUERY_AUGMENTS = [
  "songs",
  "hits",
  "latest",
  "sad songs",
  "best songs",
  "playlist",
];

// ── Recent searches helpers ──────────────────────────────────────────────────
export function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem("ss_recent_searches") || "[]").slice(
      0,
      8,
    );
  } catch {
    return [];
  }
}

export function saveRecentSearch(q: string) {
  try {
    const hist = getRecentSearches().filter((h) => h !== q);
    localStorage.setItem(
      "ss_recent_searches",
      JSON.stringify([q, ...hist].slice(0, 10)),
    );
  } catch {}
}

export function removeRecentSearch(q: string) {
  try {
    const hist = getRecentSearches().filter((h) => h !== q);
    localStorage.setItem("ss_recent_searches", JSON.stringify(hist));
  } catch {}
}

export function useSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 80); // was 120ms
  const [debouncedSuggestion] = useDebounce(query, 50);

  const [state, setState] = useState<SearchState>("idle");
  const [result, setResult] = useState<SmartSearchResult | null>(null);
  const previousResultRef = useRef<SmartSearchResult | null>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const suggestionAbortRef = useRef<AbortController | null>(null);

  // ── Remote suggestions ──────────────────────────────────────────────────
  const fetchRemoteSuggestions = useCallback(async (q: string) => {
    if (suggestionAbortRef.current) suggestionAbortRef.current.abort();
    suggestionAbortRef.current = new AbortController();
    try {
      const res = await axios.get(`${API}/api/search/suggestions`, {
        params: { q },
        signal: suggestionAbortRef.current.signal,
        withCredentials: true,
      });
      const remote: Suggestion[] = (res.data.suggestions || []).map(
        (s: any) => ({
          type: (typeof s === "object"
            ? s.type
            : "query") as Suggestion["type"],
          text: typeof s === "string" ? s : s.text || s.name || "",
          subtext:
            typeof s === "object"
              ? s.subtext || s.primaryArtists || undefined
              : undefined,
          id: typeof s === "object" ? s.id : undefined,
          image:
            typeof s === "object"
              ? s.image || s.image?.[0]?.url || undefined
              : undefined,
          query: typeof s === "string" ? s : s.query || s.text || s.name || "",
        }),
      );
      setSuggestions((prev) => {
        const artists = prev.filter((s) => s.type === "artist");
        const queries = prev.filter((s) => s.type === "query");
        const merged = [
          ...artists,
          ...remote.filter((s) => s.type !== "artist").slice(0, 4),
          ...queries,
        ].slice(0, 7);
        return merged;
      });
    } catch (err: any) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
    }
  }, []);

  // ── Local + remote suggestions on debounced input ───────────────────────
  useEffect(() => {
    if (!debouncedSuggestion || debouncedSuggestion.trim().length < 2) {
      const recent = getRecentSearches();
      setSuggestions(
        recent.map((q) => ({ type: "query" as const, text: q, query: q })),
      );
      return;
    }

    const q = debouncedSuggestion.trim().toLowerCase();
    const localSuggestions: Suggestion[] = [];

    // Instant artist suggestions from local hints
    for (const [prefix, fullName] of Object.entries(FRONTEND_ARTIST_HINTS)) {
      if (prefix.startsWith(q) || fullName.toLowerCase().startsWith(q)) {
        if (!localSuggestions.find((s) => s.text === fullName)) {
          localSuggestions.push({
            type: "artist",
            text: fullName,
            subtext: "Artist",
            query: fullName,
          });
        }
        if (localSuggestions.filter((s) => s.type === "artist").length >= 2)
          break;
      }
    }

    // Query augmentations for short artist queries
    if (q.split(" ").length <= 2 && localSuggestions.length > 0) {
      QUERY_AUGMENTS.slice(0, 3).forEach((aug) => {
        localSuggestions.push({
          type: "query",
          text: `${q} ${aug}`,
          query: `${q} ${aug}`,
        });
      });
    }

    setSuggestions(localSuggestions.slice(0, 6));
    fetchRemoteSuggestions(q);
  }, [debouncedSuggestion, fetchRemoteSuggestions]);

  // ── Main search ─────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) {
      setResult(null);
      setState("idle");
      return;
    }

    // Stale-while-revalidate: keep previous result visible during load
    setState("loading");

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const { data } = await axios.get<SmartSearchResult>(`${API}/api/search`, {
        params: { q: term, limit: 60 },
        signal: abortRef.current.signal,
        withCredentials: true,
      });

      setResult(data);
      previousResultRef.current = data;
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

  // When loading, show previous result so page isn't blank
  const isFirstSearch = state === "loading" && !previousResultRef.current;
  const displayResult =
    state === "loading" && previousResultRef.current
      ? previousResultRef.current
      : result;

  return {
    query,
    setQuery,
    state,
    result,
    displayResult,
    isFirstSearch,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    loadingMore: false,
    loadMore,
    reset,
  };
}
