import { Song } from "../types/song";
import { getBestAudioUrl } from "./getBestAudioUrl";
import { isOfflineSaved, saveOfflineSong } from "./offlineDB";
import { bestImg, getArtists } from "../lib/helpers";
import { useDownloadStore } from "../store/downloadStore";
import { useOfflineStore } from "../store/offlineStore";
import { isNative } from "./platform";
import { saveAudioToDevice } from "../capacitor/filesystem";
import { impactFeedback, notificationFeedback } from "../capacitor/haptics";
import toast from "react-hot-toast";
import { analytics } from "../services/analytics";
import { embedAudioMetadata } from "./audioMetadata";

export async function downloadSong(
  song: Song,
  saveOffline = true,
  playlistName?: string,
): Promise<void> {
  analytics.track("download_song", {
    song_id: song.id,
    song_title: song.name,
    artist: getArtists(song),
  });
  // Check if already in library
  if (saveOffline) {
    const saved = await isOfflineSaved(song.id);
    if (saved) {
      toast.success(`${song.name || "Song"} already downloaded!`, { icon: "✅" });
      return;
    }
  }

  let url = getBestAudioUrl(song.downloadUrl || song.download_url);
  if (!url && song.id) {
    try {
      const BACKEND = (
        import.meta.env.VITE_BACKEND_URL ||
        "https://soulsync-backend-a5fs.onrender.com"
      ).replace(/\/$/, "");
      const resp = await fetch(`${BACKEND}/api/search/stream-url?id=${song.id}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.downloadUrl?.length) {
          song.downloadUrl = data.downloadUrl;
          url = getBestAudioUrl(song.downloadUrl);
        }
      }
    } catch (e) {
      console.warn("[Download] Failed to fetch missing URL", e);
    }
  }

  if (!url) {
    toast.error(`Download URL not available for ${song.name || 'song'}`);
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

    let rawBytes: Uint8Array;
    if (reader && contentLength > 0) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        const progress = Math.round((receivedBytes / contentLength) * 100);
        store.updateProgress(song.id, progress);
        if (progress === 25 || progress === 50 || progress === 75) {
          impactFeedback("light");
        }
      }
      const combined = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        const arr = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer);
        combined.set(arr, offset);
        offset += arr.length;
      }
      rawBytes = combined;
    } else {
      const blob = await response.blob();
      rawBytes = new Uint8Array(await blob.arrayBuffer());
      store.updateProgress(song.id, 100);
    }

    const albumName = typeof song.album === "string" ? song.album : (song.album?.name || "");
    const coverUrl = bestImg(song.image) || (song as any).albumArt || "";

    const taggedBytes = await embedAudioMetadata(rawBytes, {
      title,
      artist,
      album: albumName,
      albumArtUrl: coverUrl,
    });

    const blob = new Blob([taggedBytes.buffer as ArrayBuffer], { type: "audio/mp4" });
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
            playlistName,
          },
          blob,
        );

        let finalFilePath = "";

        // On native, also write to device filesystem for lock-screen / background playback
        if (isNative()) {
          try {
            finalFilePath = await saveAudioToDevice(song.id, blob, filename);
          } catch (e) {
            console.warn("Failed to write to native filesystem (fallback to IDB):", e);
          }
        }

        // Save metadata to offlineStore for UI rendering (Native + Web)
        useOfflineStore.getState().addDownloadedSong({
          songId: song.id,
          title,
          artist,
          albumArt: bestImg(song.image) || "",
          duration: Number(song.duration) || 0,
          filePath: finalFilePath,
          downloadedAt: Date.now(),
          fileSize: blob.size,
          playlistName: playlistName,
          songData: {
            ...song,
            downloadUrl: [{ quality: "320kbps", url: finalFilePath }]
          }
        });

      } catch (err) {
        console.error("Save to offlineDB failed:", err);
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

/**
 * Download an entire playlist with limited concurrency (3 songs at a time)
 */
export async function downloadPlaylist(
  songs: Song[],
  playlistName: string,
): Promise<void> {
  if (!songs.length) return;

  toast(`Starting download of ${songs.length} songs...`, { icon: "📥" });

  const concurrency = 3;
  const queue = [...songs];
  const active: Promise<void>[] = [];

  const runNext = async (): Promise<void> => {
    if (queue.length === 0) return;
    const song = queue.shift()!;
    await downloadSong(song, true, playlistName).catch(() => { });
    await runNext();
  };

  for (let i = 0; i < Math.min(concurrency, songs.length); i++) {
    active.push(runNext());
  }

  await Promise.all(active);
  toast.success(`Completed downloading ${playlistName}`, {
    icon: "✅",
    duration: 4000,
  });
}
