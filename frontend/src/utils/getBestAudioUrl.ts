import { SongDownloadUrl } from "../types/song";

export function getBestAudioUrl(urls?: SongDownloadUrl[]): string | null {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return null;

  const qualities = ["320kbps", "160kbps", "96kbps", "48kbps", "12kbps"];

  for (const q of qualities) {
    const found = urls.find((u) => u.quality === q);
    const url = found?.url || found?.link;
    if (url) return url;
  }

  const last = urls[urls.length - 1];
  return last?.url || last?.link || null;
}

export function getBestImageUrl(
  images?: { quality?: string; url?: string; link?: string }[] | string,
  prefer = "500x500",
): string | null {
  if (!images) return null;
  if (typeof images === "string") return images;
  if (!Array.isArray(images) || images.length === 0) return null;

  const qualities = [prefer, "500x500", "150x150", "50x50"];

  for (const q of qualities) {
    const found = images.find((i) => i.quality === q);
    const url = found?.url || found?.link;
    if (url) return url;
  }

  const last = images[images.length - 1];
  return last?.url || last?.link || null;
}
