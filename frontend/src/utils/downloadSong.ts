import { Song } from "../types/song";
import { getBestAudioUrl } from "./getBestAudioUrl";
import { getArtists } from "./queryParser";
import { saveOfflineSong } from "./offlineDB";
import { bestImg } from "../lib/helpers";
import { useDownloadStore } from "../store/downloadStore";
import { useOfflineStore } from "../store/offlineStore";
import { isNative } from "./platform";
import { saveAudioToDevice } from "../capacitor/filesystem";
import { impactFeedback, notificationFeedback } from "../capacitor/haptics";
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

  const store = useDownloadStore.getState();

  // Prevent duplicate concurrent downloads
  if (store.isDownloading(song.id)) {
    toast("Already downloading this song", { icon: "⏳" });
    return;
  }

  // Register active download in the store
  store.startDownload({
    id: song.id,
    name: title,
    artist,
    albumArt: bestImg(song.image) || "",
  });

  // Haptic feedback on download start (native only)
  impactFeedback("medium");

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Download failed");

    // ── Stream-based progress tracking ──
    const contentLength = Number(response.headers.get("Content-Length") || 0);
    const reader = response.body?.getReader();

    let receivedBytes = 0;
    const chunks: BlobPart[] = [];

    if (reader && contentLength > 0) {
      // Read stream chunk-by-chunk for real progress
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        const progress = Math.round((receivedBytes / contentLength) * 100);
        store.updateProgress(song.id, progress);

        // Haptic milestones at 25%, 50%, 75%
        if (progress === 25 || progress === 50 || progress === 75) {
          impactFeedback("light");
        }
      }
    } else {
      // Fallback: no Content-Length or no readable stream
      const blob = await response.blob();
      chunks.push(new Uint8Array(await blob.arrayBuffer()));
      receivedBytes = blob.size;
      store.updateProgress(song.id, 100);
    }

    // Combine chunks into a single Blob
    const blob = new Blob(chunks, { type: "audio/mp4" });
    store.updateProgress(song.id, 100);

    // Save to IndexedDB + optionally native filesystem
    if (saveOffline) {
      store.setStatus(song.id, "saving");
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

        // On native, also write to device filesystem for lock-screen / background playback
        if (isNative()) {
          const nativePath = await saveAudioToDevice(song.id, blob, filename);
          // Save metadata to offlineStore for native offline mode
          useOfflineStore.getState().addDownloadedSong({
            songId: song.id,
            title,
            artist,
            albumArt: bestImg(song.image) || "",
            duration: Number(song.duration) || 0,
            filePath: nativePath,
            downloadedAt: Date.now(),
            fileSize: blob.size,
          });
        }
      } catch {
        /* IndexedDB / native save failed, still download file */
      }
    }

    // Trigger browser download only on web (not on native APK)
    if (!isNative()) {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    }

    store.setStatus(song.id, "done");
    notificationFeedback("success");
    toast.success(`${title} saved!`);

    // Auto-remove from active list after 2s
    setTimeout(() => {
      useDownloadStore.getState().removeDownload(song.id);
    }, 2000);
  } catch {
    store.setStatus(song.id, "error");
    notificationFeedback("error");
    toast.error(`Failed to download ${title}`);

    // Auto-remove error after 4s
    setTimeout(() => {
      useDownloadStore.getState().removeDownload(song.id);
    }, 4000);
  }
}
