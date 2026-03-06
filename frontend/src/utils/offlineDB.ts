/** IndexedDB wrapper for offline song storage */

const DB_NAME = "soulsync_offline";
const DB_VERSION = 1;
const STORE_SONGS = "songs";
const STORE_BLOBS = "blobs";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SONGS))
        db.createObjectStore(STORE_SONGS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_BLOBS))
        db.createObjectStore(STORE_BLOBS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface OfflineSong {
  id: string;
  name: string;
  artist: string;
  albumArt: string;
  duration: number;
  downloadUrl: { quality: string; url: string }[];
  image: { quality: string; url: string }[];
  savedAt: number;
  playlistName?: string;
  order?: number;
}

export async function updateOfflineSongOrder(songIds: string[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_SONGS, "readwrite");
  const store = tx.objectStore(STORE_SONGS);
  for (let i = 0; i < songIds.length; i++) {
    const song = await new Promise<OfflineSong>((res) => {
      const getReq = store.get(songIds[i]);
      getReq.onsuccess = () => res(getReq.result);
    });
    if (song) {
      song.order = i;
      store.put(song);
    }
  }
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function saveOfflineSong(
  song: OfflineSong,
  audioBlob: Blob,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_SONGS, STORE_BLOBS], "readwrite");
  tx.objectStore(STORE_SONGS).put(song);
  tx.objectStore(STORE_BLOBS).put({ id: song.id, blob: audioBlob });
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getOfflineSongs(): Promise<OfflineSong[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_SONGS, "readonly");
    const req = tx.objectStore(STORE_SONGS).getAll();
    req.onsuccess = () => {
      const results = req.result || [];
      results.sort((a: OfflineSong, b: OfflineSong) => (a.order ?? 0) - (b.order ?? 0));
      res(results);
    };
    req.onerror = () => rej(req.error);
  });
}

export async function getOfflineBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE_BLOBS, "readonly");
    const req = tx.objectStore(STORE_BLOBS).get(id);
    req.onsuccess = () => res(req.result?.blob || null);
    req.onerror = () => rej(req.error);
  });
}

export async function removeOfflineSong(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_SONGS, STORE_BLOBS], "readwrite");
  tx.objectStore(STORE_SONGS).delete(id);
  tx.objectStore(STORE_BLOBS).delete(id);
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function isOfflineSaved(id: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((res) => {
    const tx = db.transaction(STORE_SONGS, "readonly");
    const req = tx.objectStore(STORE_SONGS).get(id);
    req.onsuccess = () => res(!!req.result);
    req.onerror = () => res(false);
  });
}

export async function getOfflineStorageSize(): Promise<string> {
  const db = await openDB();
  return new Promise((res) => {
    const tx = db.transaction(STORE_BLOBS, "readonly");
    const req = tx.objectStore(STORE_BLOBS).getAll();
    req.onsuccess = () => {
      const total = (req.result || []).reduce(
        (a: number, r: any) => a + (r.blob?.size || 0),
        0,
      );
      if (total < 1024 * 1024) res(`${(total / 1024).toFixed(1)} KB`);
      else res(`${(total / (1024 * 1024)).toFixed(1)} MB`);
    };
    req.onerror = () => res("0 KB");
  });
}
