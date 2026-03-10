/**
 * Normalizes any JioSaavn song shape into a consistent format.
 * Call this on EVERY song before passing it to playSong() when
 * the source is external (liked songs from DB, playlists, etc.)
 */

export interface NormalizedSong {
    id: string;
    name: string;
    primaryArtists: string;
    image: Array<{ quality: string; url: string }> | string;
    album: { name?: string } | string;
    duration: number;
    language: string;
    year: string;
    downloadUrl: Array<{ quality: string; url: string }>;
    filePath?: string | null;
    _isOffline?: boolean;
}

export function normalizeSong(raw: any): NormalizedSong | null {
    if (!raw) return null;

    const id = String(raw.id || raw.songId || raw._id || "");
    if (!id) return null;

    // ── downloadUrl: ensure it's an array of { quality, url } ──────
    let downloadUrl: Array<{ quality: string; url: string }> = [];

    if (Array.isArray(raw.downloadUrl)) {
        downloadUrl = raw.downloadUrl
            .filter((entry: any) => entry?.url && entry.url !== "null" && entry.url !== "")
            .map((entry: any) => ({
                quality: entry.quality || "",
                // Decode HTML entities — JioSaavn encodes & as &amp;
                url: String(entry.url).replace(/&amp;/g, "&").replace(/&amp;/g, "&"),
            }));
    }

    // ── Image: normalize to array format ───────────────────────────
    let image = raw.image;
    if (typeof image === "string" && image) {
        image = [
            { quality: "500x500", url: image.replace("150x150", "500x500").replace("50x50", "500x500") },
        ];
    } else if (!Array.isArray(image)) {
        image = [];
    }

    // ── Artists ─────────────────────────────────────────────────────
    const primaryArtists =
        raw.primaryArtists ||
        raw.primary_artists ||
        raw.artist ||
        raw.singers ||
        raw.artistMap?.primaryArtists?.map((a: any) => a.name).join(", ") ||
        "";

    // ── Album ──────────────────────────────────────────────────────
    const album = raw.album && typeof raw.album === "object"
        ? raw.album
        : { name: raw.album || "" };

    return {
        id,
        name: raw.name || raw.title || raw.song || "Unknown Song",
        primaryArtists,
        image,
        album,
        duration: Number(raw.duration) || 0,
        language: (raw.language || "").toLowerCase(),
        year: String(raw.year || raw.releaseDate || ""),
        downloadUrl,
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
