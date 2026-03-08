export type Platform =
    | "spotify"
    | "youtube_music"
    | "apple_music"
    | "gaana"
    | "jiosaavn"
    | "text"
    | "csv"
    | "unknown";

export interface DetectedInput {
    platform: Platform;
    url?: string;
    rawText?: string;
    playlistId?: string;
}

export function detectPlatform(input: string): DetectedInput {
    const trimmed = input.trim();

    // ── Spotify ────────────────────────────────────────────────
    if (trimmed.includes("spotify.com/playlist/")) {
        const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
        return { platform: "spotify", url: trimmed, playlistId: match?.[1] };
    }

    // ── YouTube Music ──────────────────────────────────────────
    if (
        trimmed.includes("music.youtube.com") ||
        trimmed.includes("youtube.com/playlist") ||
        trimmed.includes("youtu.be/playlist")
    ) {
        const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
        return { platform: "youtube_music", url: trimmed, playlistId: match?.[1] };
    }

    // ── Apple Music ────────────────────────────────────────────
    if (trimmed.includes("music.apple.com")) {
        return { platform: "apple_music", url: trimmed };
    }

    // ── Gaana ──────────────────────────────────────────────────
    if (trimmed.includes("gaana.com")) {
        return { platform: "gaana", url: trimmed };
    }

    // ── JioSaavn ──────────────────────────────────────────────
    if (trimmed.includes("jiosaavn.com")) {
        return { platform: "jiosaavn", url: trimmed };
    }

    // ── CSV / TXT file content ─────────────────────────────────
    if (trimmed.includes(",") && trimmed.split("\n").length > 3) {
        return { platform: "csv", rawText: trimmed };
    }

    // ── Plain text (song names pasted directly) ────────────────
    if (trimmed.split("\n").length >= 2) {
        return { platform: "text", rawText: trimmed };
    }

    // Single line that's not a URL — treat as text
    if (trimmed.length > 0 && !trimmed.startsWith("http")) {
        return { platform: "text", rawText: trimmed };
    }

    return { platform: "unknown" };
}
