import { logHistory } from "../api/backend";
import { getArtists, bestImg } from "../lib/helpers";

const RECENTLY_PLAYED_KEY = "ss_recently_played";
const MAX_RECENT_ITEMS = 30;

export function clearLocalRecentlyPlayed() {
  try {
    localStorage.removeItem(RECENTLY_PLAYED_KEY);
    window.dispatchEvent(new CustomEvent("soulsync:recently_played_updated", { detail: { updated: [] } }));
  } catch (err) {
    console.error("Failed to clear local recently played:", err);
  }
}

export function getRecentlyPlayedFromStorage(): any[] {
  try {
    const raw = localStorage.getItem(RECENTLY_PLAYED_KEY);
    if (!raw) return [];
    const list: any[] = JSON.parse(raw);
    return list.filter(
      (s) => s && !s._isOffline && !s.id?.startsWith("local_")
    );
  } catch (err) {
    console.error("Failed to parse local recently played:", err);
    return [];
  }
}

export function recordRecentlyPlayed(song: any) {
  if (!song || !song.id) return;
  // Ignore local offline/downloaded songs so Continue Listening across devices contains only online streamable tracks
  if (song._isOffline || song.id.startsWith("local_")) return;

  try {
    const existing = getRecentlyPlayedFromStorage();
    // Deduplicate by song ID or clean song name
    const cleanCurrentName = (song.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    const filtered = existing.filter((item: any) => {
      if (!item || item._isOffline || item.id?.startsWith("local_")) return false;
      if (item.id === song.id) return false;
      const cleanItemName = (item.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (cleanCurrentName && cleanCurrentName === cleanItemName) return false;
      return true;
    });

    const updated = [song, ...filtered].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(updated));

    // Dispatch event so UI hooks/components can update in real-time
    window.dispatchEvent(
      new CustomEvent("soulsync:recently_played_updated", {
        detail: { song, updated },
      })
    );
  } catch (err) {
    console.error("Failed to save local recently played:", err);
  }

  // Fire-and-forget backend history logging
  logHistory({
    songId: song.id,
    title: song.name || "Unknown Track",
    artist: getArtists(song) || "Unknown Artist",
    albumArt: bestImg(song.image) || "",
    duration: Number(song.duration) || 0,
    source: "app",
    language: song.language || "",
  }).catch(() => {});
}
