/**
 * Normalizes any JioSaavn song shape into a consistent format.
 * Handles both saavn.sumit.co wrapper format (downloadUrl[i].url)
 * and the older raw JioSaavn API format (downloadUrl[i].link).
 *
 * Call this on EVERY song before passing it to playSong() when
 * the source is external (liked songs from DB, playlists, etc.)
 */

export interface NormalizedSong {
  id: string;
  name: string;
  primaryArtists: string;
  image: Array<{ quality: string; url: string }> | string;
  album: { name?: string } | string;
  albumId?: string;
  duration: number;
  language: string;
  year: string;
  /** Pre-resolved best-quality stream URL (320kbps -> 160kbps -> fallback) */
  streamUrl: string | null;
  downloadUrl: Array<{ quality: string; url: string }>;
  playCount?: number;
  url?: string;
  filePath?: string | null;
  _isOffline?: boolean;
}

// Alias so callers can import as Song or NormalizedSong
export type Song = NormalizedSong;

export function normalizeSong(raw: any): NormalizedSong | null {
  if (!raw) return null;

  const id = String(raw.id || raw.songId || raw._id || "");
  if (!id) return null;

  // -- downloadUrl: ensure it is an array of { quality, url } ---------
  // The wrapper (saavn.sumit.co) uses .url; the raw JioSaavn API uses .link
  // Accept both -- but prefer .url
  let downloadUrl: Array<{ quality: string; url: string }> = [];
  if (Array.isArray(raw.downloadUrl)) {
    downloadUrl = raw.downloadUrl
      .filter(
        (entry: any) =>
          (entry?.url || entry?.link) &&
          (entry.url || entry.link) !== "null" &&
          (entry.url || entry.link) !== "",
      )
      .map((entry: any) => ({
        quality: entry.quality || "",
        // Prefer .url (wrapper), fall back to .link (direct API)
        url: String(entry.url || entry.link || "").replace(/&amp;/g, "&"),
      }));
  }

  // -- Stream URL: resolve best quality now ----------------------------
  // Already resolved by backend? Use it directly.
  let streamUrl: string | null = raw.streamUrl || null;

  if (!streamUrl && downloadUrl.length > 0) {
    const ORDER = ["320kbps", "160kbps", "96kbps", "48kbps", "12kbps"];
    for (const quality of ORDER) {
      const entry = downloadUrl.find((d) => d.quality === quality);
      if (entry?.url?.startsWith("http")) {
        streamUrl = entry.url;
        break;
      }
    }
    // Last-resort: take first valid URL
    if (!streamUrl) {
      const first = downloadUrl.find((d) => d.url?.startsWith("http"));
      if (first) streamUrl = first.url;
    }
  }

  // -- Image: normalize to array format --------------------------------
  let image: Array<{ quality: string; url: string }> | string = [];
  if (typeof raw.image === "string" && raw.image) {
    image = [
      {
        quality: "500x500",
        url: raw.image
          .replace("150x150", "500x500")
          .replace("50x50", "500x500"),
      },
    ];
  } else if (Array.isArray(raw.image)) {
    image = raw.image
      .filter((i: any) => i?.url || i?.link)
      .map((i: any) => ({
        quality: i.quality || "",
        url: String(i.url || i.link || ""),
      }));
  }

  // -- Artists ---------------------------------------------------------
  let primaryArtists: string =
    raw.primaryArtists ||
    raw.primary_artists ||
    raw.singers ||
    raw.artist ||
    "";
  // Wrapper also returns artists.primary as an array
  if (!primaryArtists && Array.isArray(raw.artists?.primary)) {
    primaryArtists = raw.artists.primary
      .map((a: any) => (typeof a === "string" ? a : a.name || ""))
      .filter(Boolean)
      .join(", ");
  }

  // -- Album -----------------------------------------------------------
  const album =
    raw.album && typeof raw.album === "object"
      ? raw.album
      : { name: raw.album || "" };
  const albumId =
    typeof raw.album === "object"
      ? raw.album?.id || raw.albumId || ""
      : raw.albumId || "";

  return {
    id,
    name: raw.name || raw.title || raw.song || "Unknown Song",
    primaryArtists: String(primaryArtists).trim(),
    image,
    album,
    albumId,
    duration: Number(raw.duration) || 0,
    language: (raw.language || "").toLowerCase(),
    year: String(raw.year || raw.releaseDate || ""),
    streamUrl,
    downloadUrl,
    playCount: Number(raw.playCount || raw.play_count || 0) || 0,
    url: raw.url || "",
    filePath: raw.filePath || null,
    _isOffline: raw._isOffline || false,
  };
}

/**
 * Normalizes an array of songs, filtering out any that fail.
 */
export function normalizeSongs(raws: any[]): NormalizedSong[] {
  return (raws || [])
    .map((r) => normalizeSong(r))
    .filter((s): s is NormalizedSong => s !== null && !!s.id);
}
