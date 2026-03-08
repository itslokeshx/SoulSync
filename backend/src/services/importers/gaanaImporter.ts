import { ImportResult } from "./types.js";

/**
 * Gaana public API — no auth needed.
 */
export async function importGaanaPlaylist(
    url: string,
): Promise<ImportResult> {
    const slugMatch = url.match(/playlist\/([^/?]+)/);
    if (!slugMatch) throw new Error("Invalid Gaana playlist URL");

    const slug = slugMatch[1];

    const res = await fetch("https://gaana.com/apiv2/playlist", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0",
        },
        body: new URLSearchParams({
            type: "playlist",
            seokey: slug,
            src: "_mweb",
        }).toString(),
    });

    const data: any = await res.json();
    const tracks = data?.playlist?.[0]?.child || [];

    const songs = tracks.map(
        (t: any) => `${t.title} ${t.singer || ""}`.trim(),
    );

    return {
        platform: "gaana",
        name: data?.playlist?.[0]?.title || "Gaana Playlist",
        image: data?.playlist?.[0]?.atw || null,
        songNames: songs,
        count: songs.length,
        success: songs.length > 0,
    };
}
