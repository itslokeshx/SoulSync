import { ImportResult } from "./types.js";

/**
 * Plain text importer — one song per line.
 */
export function importFromText(rawText: string): ImportResult {
    const lines = rawText
        .split("\n")
        .map((line) =>
            line
                .trim()
                .replace(/^[\d#]+[.):\-\s]+/, "") // "1. Song" → "Song"
                .replace(/^["']|["']$/g, "")
                .replace(/\s+\d+:\d+$/, "") // remove timestamps
                .trim(),
        )
        .filter((line) => line.length > 1);

    return {
        platform: "text",
        name: "Imported Playlist",
        image: null,
        songNames: lines,
        count: lines.length,
        success: lines.length > 0,
    };
}

/**
 * CSV importer — expects header row, then "Song Name, Artist" or "Track, Artist, Album".
 */
export function importFromCSV(csvText: string): ImportResult {
    const lines = csvText.split("\n").slice(1); // skip header

    const songs = lines
        .map((line) => {
            const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
            const name = cols[0];
            const artist = cols[1] || "";
            return name ? `${name} ${artist}`.trim() : null;
        })
        .filter(Boolean) as string[];

    return {
        platform: "csv",
        name: "Imported from CSV",
        image: null,
        songNames: songs,
        count: songs.length,
        success: songs.length > 0,
    };
}
