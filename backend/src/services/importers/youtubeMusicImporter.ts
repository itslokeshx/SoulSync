import { ImportResult } from "./types.js";

/**
 * YouTube / YouTube Music playlist importer.
 *
 * Strategy:
 * 1. Scrape the regular youtube.com/playlist page (which embeds `ytInitialData`)
 * 2. Parse the `playlistVideoListRenderer` to get video titles + channel names
 *
 * Works for both youtube.com and music.youtube.com playlist URLs.
 * No API key needed.
 */
export async function importYoutubeMusicPlaylist(
    url: string,
    playlistId: string,
): Promise<ImportResult> {
    // Always use regular youtube.com — it server-renders the playlist data
    const ytUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch(ytUrl, {
            signal: controller.signal,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                Accept: "text/html",
            },
        });
        clearTimeout(timer);

        const html = await res.text();

        // Extract ytInitialData
        const ytDataMatch = html.match(
            /var\s+ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
        );

        if (!ytDataMatch) {
            throw new Error(
                "Could not read playlist data. Make sure the playlist is public.",
            );
        }

        const ytData = JSON.parse(ytDataMatch[1]);
        const songs: string[] = [];
        let playlistName = "YouTube Playlist";

        // Navigate the nested YT structure
        const tabs =
            ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];

        for (const tab of tabs) {
            const content = tab?.tabRenderer?.content || {};
            const sections =
                content?.sectionListRenderer?.contents || [];

            for (const section of sections) {
                const items =
                    section?.itemSectionRenderer?.contents || [];

                for (const item of items) {
                    const plRenderer =
                        item?.playlistVideoListRenderer;
                    if (!plRenderer) continue;

                    const videos = plRenderer?.contents || [];
                    for (const v of videos) {
                        const vid = v?.playlistVideoRenderer;
                        if (!vid) continue;

                        const title =
                            vid?.title?.runs?.[0]?.text || "";
                        const artist =
                            vid?.shortBylineText?.runs?.[0]?.text || "";

                        if (title && !title.includes("[Deleted video]") && !title.includes("[Private video]")) {
                            // Strip things like "(Official Video)" etc for better matching
                            const cleanTitle = title
                                .replace(/\s*\(Official.*?\)/gi, "")
                                .replace(/\s*\[Official.*?\]/gi, "")
                                .replace(/\s*\(Lyric.*?\)/gi, "")
                                .replace(/\s*\[Lyric.*?\]/gi, "")
                                .replace(/\s*\(Audio.*?\)/gi, "")
                                .replace(/\s*\[Audio.*?\]/gi, "")
                                .replace(/\s*\(Music Video\)/gi, "")
                                .replace(/\s*\|.*$/, "")
                                .trim();

                            songs.push(
                                artist ? `${cleanTitle} ${artist}` : cleanTitle,
                            );
                        }
                    }
                }
            }
        }

        // Try to get playlist name from header
        const header =
            ytData?.metadata?.playlistMetadataRenderer?.title ||
            ytData?.microformat?.microformatDataRenderer?.title;
        if (header) playlistName = header;

        // Fallback: try the sidebar
        if (!header) {
            const sidebar =
                ytData?.sidebar?.playlistSidebarRenderer?.items?.[0]
                    ?.playlistSidebarPrimaryInfoRenderer?.title?.runs?.[0]?.text;
            if (sidebar) playlistName = sidebar;
        }

        // Get thumbnail
        const thumb =
            ytData?.microformat?.microformatDataRenderer?.thumbnail?.thumbnails?.slice(
                -1,
            )?.[0]?.url || null;

        if (songs.length === 0) {
            throw new Error(
                "No songs found. Make sure the playlist is public and not empty.",
            );
        }

        return {
            platform: "youtube_music",
            name: playlistName,
            image: thumb,
            songNames: songs,
            count: songs.length,
            success: true,
        };
    } catch (err: any) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
            throw new Error("Request timed out. YouTube may be slow — try again.");
        }
        throw err;
    }
}
