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
  fileName: string,
): Promise<string> {
  if (!isNative()) {
    // Web: persist in IndexedDB via existing helper
    // (caller should also call saveOfflineSong for metadata)
    return URL.createObjectURL(audioBlob);
  }

  // Request permissions if needed
  try {
    const permStatus = await Filesystem.checkPermissions();
    if (permStatus.publicStorage !== "granted") {
      await Filesystem.requestPermissions();
    }
  } catch (e) {
    console.warn("Permission check/request failed:", e);
  }

  const base64 = await blobToBase64(audioBlob);
  const cleanFileName = fileName.replace(/[/\\?%*:|"<>]/g, "_"); // sanitize filename

  await Filesystem.writeFile({
    path: `SoulSync/${cleanFileName}`,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({
    path: `SoulSync/${cleanFileName}`,
    directory: Directory.Documents,
  });

  // Convert file:// URI to a WebView-safe URL (https://localhost/_capacitor_file_/...)
  return Capacitor.convertFileSrc(uri);
}

// ── Read ────────────────────────────────────────────────────────

export async function readAudioFromDevice(
  songId: string,
): Promise<string | null> {
  if (!isNative()) {
    const blob = await getOfflineBlob(songId);
    return blob ? URL.createObjectURL(blob) : null;
  }

  // NOTE: On native, the app reads directly using the uri stored in the store.
  // This function is kept for compatibility but shouldn't be relied upon without a filename map.
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

export async function deleteAudioFromDevice(filePath: string): Promise<void> {
  if (!isNative() || !filePath) {
    return;
  }

  try {
    // Attempt deleting the full path URI
    await Filesystem.deleteFile({
      path: filePath,
    });
  } catch {
    try {
      // Fallback: delete by extracting name
      const filename = filePath.split("/").pop() || "";
      await Filesystem.deleteFile({
        path: `SoulSync/${filename}`,
        directory: Directory.Documents,
      });
    } catch (e) {
      console.warn("Failed to delete file from device:", e);
    }
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
      path: "SoulSync",
      directory: Directory.Documents,
    });

    let totalBytes = 0;
    for (const file of listing.files) {
      const stat = await Filesystem.stat({
        path: `SoulSync/${file.name}`,
        directory: Directory.Documents,
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
