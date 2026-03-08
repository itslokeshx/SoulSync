import { ImportResult } from "./types.js";

/**
 * Scrapes Apple Music public playlist pages.
 * Looks for schema.org JSON-LD or server-rendered data.
 */
export async function importAppleMusicPlaylist(
    url: string,
): Promise<ImportResult> {
    const res = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "text/html",
        },
    });

    const html = await res.text();
    const songs: string[] = [];
    let playlistName = "Apple Music Playlist";
    let playlistImage: string | null = null;

    // Method 1: schema.org JSON-LD
    const jsonLdMatches = [
        ...html.matchAll(
            /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
        ),
    ];

    for (const match of jsonLdMatches) {
        try {
            const data = JSON.parse(match[1]);
            if (data["@type"] === "MusicPlaylist" || data["@type"] === "MusicAlbum") {
                playlistName = data.name || playlistName;
                playlistImage = data.image || null;
                const tracks = data.track || [];
                songs.push(
                    ...tracks.map(
                        (t: any) => `${t.name} ${t.byArtist?.name || ""}`.trim(),
                    ),
                );
            }
        } catch {
            continue;
        }
    }

    // Method 2: Server-rendered data
    if (songs.length === 0) {
        const serverDataMatch = html.match(
            /window\.digitalData\s*=\s*(\{[\s\S]*?\});/,
        );
        if (serverDataMatch) {
            try {
                const data = JSON.parse(serverDataMatch[1]);
                const tracks = data?.page?.pageInfo?.playlist?.tracks || [];
                songs.push(
                    ...tracks.map(
                        (t: any) => `${t.trackName} ${t.artistName || ""}`.trim(),
                    ),
                );
                playlistName =
                    data?.page?.pageInfo?.playlist?.name || playlistName;
            } catch {
                /* silent */
            }
        }
    }

    // Method 3: OG meta description (last resort)
    if (songs.length === 0) {
        const titleMatch = html.match(
            /<meta property="og:title" content="([^"]+)"/,
        );
        const descMatch = html.match(
            /<meta property="og:description" content="([^"]+)"/,
        );

        if (titleMatch) playlistName = titleMatch[1];
        if (descMatch) {
            const desc = descMatch[1];
            const parts = desc
                .split(/[·•,]/)
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 2 && s.length < 100);
            if (parts.length >= 2) songs.push(...parts);
        }
    }

    if (songs.length === 0) {
        throw new Error(
            "Could not extract tracks. Make sure the playlist is public.",
        );
    }

    return {
        platform: "apple_music",
        name: playlistName,
        image: playlistImage,
        songNames: songs,
        count: songs.length,
        success: true,
    };
}
