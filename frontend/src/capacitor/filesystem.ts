/**
 * Native filesystem helpers – saves / reads / deletes audio files
 * on the device via @capacitor/filesystem.
 * Falls back to IndexedDB on web (existing offlineDB.ts).
 */
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { isNative } from "../utils/platform";
import {
  saveOfflineSong,
  getOfflineBlob,
  removeOfflineSong,
  getOfflineStorageSize,
  type OfflineSong,
} from "../utils/offlineDB";

// ── Save ────────────────────────────────────────────────────────

export async function saveAudioToDevice(
  songId: string,
  audioBlob: Blob,
  _fileName: string,
): Promise<string> {
  if (!isNative()) {
    // Web: persist in IndexedDB via existing helper
    // (caller should also call saveOfflineSong for metadata)
    return URL.createObjectURL(audioBlob);
  }

  const base64 = await blobToBase64(audioBlob);

  await Filesystem.writeFile({
    path: `downloads/${songId}.m4a`,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({
    path: `downloads/${songId}.m4a`,
    directory: Directory.Data,
  });

  return uri;
}

// ── Read ────────────────────────────────────────────────────────

export async function readAudioFromDevice(
  songId: string,
): Promise<string | null> {
  if (!isNative()) {
    const blob = await getOfflineBlob(songId);
    return blob ? URL.createObjectURL(blob) : null;
  }

  try {
    const { uri } = await Filesystem.getUri({
      path: `downloads/${songId}.m4a`,
      directory: Directory.Data,
    });
    return Capacitor.convertFileSrc(uri);
  } catch {
    return null;
  }
}

// ── Delete ──────────────────────────────────────────────────────

export async function deleteAudioFromDevice(songId: string): Promise<void> {
  if (!isNative()) {
    await removeOfflineSong(songId);
    return;
  }

  try {
    await Filesystem.deleteFile({
      path: `downloads/${songId}.m4a`,
      directory: Directory.Data,
    });
  } catch {
    // file may not exist — ignore
  }
}

// ── Storage info ────────────────────────────────────────────────

export async function getStorageInfo(): Promise<{
  used: number;
  usedFormatted: string;
}> {
  if (!isNative()) {
    const formatted = await getOfflineStorageSize();
    return { used: 0, usedFormatted: formatted };
  }

  try {
    const listing = await Filesystem.readdir({
      path: "downloads",
      directory: Directory.Data,
    });

    let totalBytes = 0;
    for (const file of listing.files) {
      const stat = await Filesystem.stat({
        path: `downloads/${file.name}`,
        directory: Directory.Data,
      });
      totalBytes += stat.size;
    }

    const mb = totalBytes / (1024 * 1024);
    const formatted =
      mb < 1 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
    return { used: totalBytes, usedFormatted: formatted };
  } catch {
    return { used: 0, usedFormatted: "0 KB" };
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:…;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export type { OfflineSong };
