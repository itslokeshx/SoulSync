import toast from "react-hot-toast";
import { getArtists, bestImg } from "../lib/helpers";

const BASE_URL = window.location.origin;

function slugify(text: string): string {
    return (text || "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase() || "track";
}

function generateSongUrl(song: any): string {
    const slug = slugify(song.name);
    return `${BASE_URL}/song/${slug}/${song.id || song.songId}`;
}

function generatePlaylistUrl(playlist: any): string {
    const slug = slugify(playlist.name);
    return `${BASE_URL}/playlist/${slug}/${playlist._id || playlist.id}`;
}

export async function shareSong(song: any) {
    const title = song.name || "Unknown";
    const artist = getArtists(song) || "";
    const url = generateSongUrl(song);

    await doShare({ title: `${title} - ${artist}`, text: url, url });
}

export async function sharePlaylist(playlist: any) {
    const url = generatePlaylistUrl(playlist);

    await doShare({ title: playlist.name, text: url, url });
}

async function doShare(data: { title: string; text: string; url: string }) {
    // Try native Web Share API first (mobile + some desktop)
    if (navigator.share) {
        try {
            await navigator.share({
                title: data.title,
                text: data.text,
                url: data.url,
            });
            return;
        } catch (err: any) {
            // AbortError = user cancelled, which is fine
            if (err.name === "AbortError") return;
            // Fall through to clipboard
        }
    }

    // Fallback: copy to clipboard
    try {
        await navigator.clipboard.writeText(data.url);
        toast.success("Link copied to clipboard!");
    } catch {
        // Last resort fallback
        const textarea = document.createElement("textarea");
        textarea.value = data.url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        toast.success("Link copied!");
    }
}
