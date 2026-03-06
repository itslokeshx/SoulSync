import { create } from "zustand";

interface SearchState {
  recentSearches: string[];
  activeFilter: "all" | "songs" | "albums" | "artists" | "bgm";
}

interface SearchActions {
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
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
  recentSearches: loadRecent(),
  activeFilter: "all",

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

  setFilter: (f) => set({ activeFilter: f }),
}));
