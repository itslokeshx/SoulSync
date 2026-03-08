import { ImportResult } from "./types.js";

/**
 * Scrapes a public Spotify playlist using the EMBED page.
 * The embed page is always server-rendered and contains __NEXT_DATA__
 * with the full track list — unlike the main page which is a client-side SPA.
 *
 * Fallback chain: embed __NEXT_DATA__ → main page JSON-LD → main page OG tags
 * No API key needed.
 */
export async function importSpotifyPlaylist(
    url: string,
): Promise<ImportResult> {
    // Extract playlist ID
    const idMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
    if (!idMatch) throw new Error("Invalid Spotify playlist URL");
    const playlistId = idMatch[1];

    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    };

    // ── Method 1: Embed page (most reliable) ───────────────────────
    try {
        const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(embedUrl, { headers, signal: controller.signal });
        clearTimeout(timer);
        const html = await res.text();

        const nextDataMatch = html.match(
            /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
        );

        if (nextDataMatch) {
            const nextData = JSON.parse(nextDataMatch[1]);
            const entity =
                nextData?.props?.pageProps?.state?.data?.entity;

            if (entity) {
                const trackList: any[] = entity.trackList || [];
                const songNames = trackList
                    .map((t: any) => {
                        const title = t.title || t.name || "";
                        const artist = t.subtitle || t.artist || "";
                        return title ? `${title} ${artist}`.trim() : null;
                    })
                    .filter(Boolean) as string[];

                if (songNames.length > 0) {
                    return {
                        platform: "spotify",
                        name: entity.name || entity.title || "Spotify Playlist",
                        image: entity.coverArt?.sources?.[0]?.url ||
                            entity.images?.[0]?.url || null,
                        songNames,
                        count: songNames.length,
                        success: true,
                    };
                }
            }
        }
    } catch (err: any) {
        if (err.name === "AbortError") {
            throw new Error("Request timed out. Try again.");
        }
        console.warn("[Spotify] Embed method failed:", err.message);
        // Fall through to next method
    }

    // ── Method 2: Main page scrape ─────────────────────────────────
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timer);
        const html = await res.text();

        // Try JSON-LD
        const jsonLdMatch = html.match(
            /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
        );
        if (jsonLdMatch) {
            try {
                const data = JSON.parse(jsonLdMatch[1]);
                const tracks = data.track || [];
                if (tracks.length > 0) {
                    return {
                        platform: "spotify",
                        name: data.name || "Spotify Playlist",
                        image: data.image || null,
                        songNames: tracks.map(
                            (t: any) => `${t.name} ${t.byArtist?.name || ""}`.trim(),
                        ),
                        count: tracks.length,
                        success: true,
                    };
                }
            } catch {
                /* next */
            }
        }

        // Try __NEXT_DATA__ on main page
        const mainNextData = html.match(
            /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
        );
        if (mainNextData) {
            try {
                const parsed = JSON.parse(mainNextData[1]);
                const entity = parsed?.props?.pageProps?.state?.data?.entity;
                const trackList: any[] =
                    entity?.trackList || entity?.tracks?.items || [];

                const songNames = trackList
                    .map((item: any) => {
                        const t = item?.track || item;
                        const title = t?.title || t?.name || "";
                        const artist = t?.subtitle || t?.artists?.[0]?.name || "";
                        return title ? `${title} ${artist}`.trim() : null;
                    })
                    .filter(Boolean) as string[];

                if (songNames.length > 0) {
                    return {
                        platform: "spotify",
                        name: entity?.name || "Spotify Playlist",
                        image: null,
                        songNames,
                        count: songNames.length,
                        success: true,
                    };
                }
            } catch {
                /* next */
            }
        }

        // Try OG description (lists some tracks)
        const descMatch = html.match(
            /<meta property="og:description" content="([^"]+)"/,
        );
        const titleMatch = html.match(
            /<meta property="og:title" content="([^"]+)"/,
        );

        if (descMatch) {
            const desc = descMatch[1];
            const songNames = desc
                .split(/[·•|,]/)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 2 && s.length < 100);

            if (songNames.length >= 3) {
                return {
                    platform: "spotify",
                    name:
                        titleMatch?.[1]?.replace(" | Spotify", "") || "Spotify Playlist",
                    image: null,
                    songNames,
                    count: songNames.length,
                    success: true,
                };
            }
        }
    } catch (err: any) {
        if (err.name === "AbortError") {
            throw new Error("Request timed out. Try again.");
        }
        console.warn("[Spotify] Main page method failed:", err.message);
    }

    throw new Error(
        "Could not extract tracks. The playlist may be private or Spotify is blocking requests. Try pasting song names directly.",
    );
}
