import { Song } from "../types/song";
import { getBestAudioUrl } from "./getBestAudioUrl";
import { getArtists } from "./queryParser";
import { saveOfflineSong } from "./offlineDB";
import { bestImg } from "../lib/helpers";
import toast from "react-hot-toast";

export async function downloadSong(
  song: Song,
  saveOffline = true,
): Promise<void> {
  const url = getBestAudioUrl(song.downloadUrl || song.download_url);
  if (!url) {
    toast.error("Download URL not available");
    return;
  }

  const title = song.name || "Unknown";
  const artist = getArtists(song);
  const filename = `${artist} - ${title}.m4a`;

  const toastId = toast.loading(`Downloading ${title}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");

    const blob = await response.blob();

    // Save to IndexedDB for offline playback
    if (saveOffline) {
      try {
        await saveOfflineSong(
          {
            id: song.id,
            name: title,
            artist,
            albumArt: bestImg(song.image) || "",
            duration: song.duration || 0,
            downloadUrl: (song.downloadUrl || song.download_url || []).map(
              (u: any) => ({
                quality: u.quality || "",
                url: u.url || u.link || "",
              }),
            ),
            image: (song.image || []).map((i: any) => ({
              quality: i.quality || "",
              url: i.url || i.link || "",
            })),
            savedAt: Date.now(),
          },
          blob,
        );
      } catch {
        /* IndexedDB save failed, still download file */
      }
    }

    // Also trigger browser download
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);

    toast.success(`${title} saved!`, { id: toastId });
  } catch {
    toast.error(`Failed to download ${title}`, { id: toastId });
  }
}
