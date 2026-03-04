import { create } from "zustand";

interface SearchState {
  query: string;
  recentSearches: string[];
  isSearching: boolean;
  activeFilter: "all" | "songs" | "albums" | "artists" | "bgm";
}

interface SearchActions {
  setQuery: (q: string) => void;
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  setIsSearching: (b: boolean) => void;
  setFilter: (f: SearchState["activeFilter"]) => void;
}

const loadRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem("ss_recent_searches") || "[]");
  } catch {
    return [];
  }
};

export const useSearchStore = create<SearchState & SearchActions>((set) => ({
  query: "",
  recentSearches: loadRecent(),
  isSearching: false,
  activeFilter: "all",

  setQuery: (q) => set({ query: q }),

  addRecentSearch: (q) =>
    set((s) => {
      const updated = [q, ...s.recentSearches.filter((r) => r !== q)].slice(
        0,
        10,
      );
      localStorage.setItem("ss_recent_searches", JSON.stringify(updated));
      return { recentSearches: updated };
    }),

  clearRecentSearches: () => {
    localStorage.removeItem("ss_recent_searches");
    set({ recentSearches: [] });
  },

  setIsSearching: (b) => set({ isSearching: b }),
  setFilter: (f) => set({ activeFilter: f }),
}));
