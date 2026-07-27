import { FALLBACK_IMG } from "./constants";
import type { Song } from "../types/song";

export const bestUrl = (urls: any): string | null => {
  if (!urls) return null;
  if (typeof urls === "string") return urls;
  if (!Array.isArray(urls) || !urls.length) return null;
  for (const q of ["320kbps", "160kbps", "96kbps", "48kbps", "12kbps"]) {
    const f = urls.find((u: any) => u.quality === q);
    if (f?.link) return f.link;
    if (f?.url) return f.url;
  }
  const last = urls[urls.length - 1];
  return last?.link || last?.url || null;
};

export const bestImg = (images: any, prefer = "500x500"): string | null => {
  if (!images) return null;
  if (typeof images === "string") return images;
  if (!Array.isArray(images)) return images?.link || images?.url || null;
  if (!images.length) return null;
  for (const q of [prefer, "500x500", "150x150", "50x50"]) {
    const f = images.find((i: any) => i.quality === q);
    if (f?.link) return f.link;
    if (f?.url) return f.url;
  }
  const last = images[images.length - 1];
  return last?.link || last?.url || null;
};

export const fmt = (s: number | undefined | null): string => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export const decodeHtml = (str: string): string => {
  if (typeof str !== "string") return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
};

export const getArtists = (song: any): string => {
  if (!song) return "—";
  let artistStr = "";
  if (
    Array.isArray(song.artist_map?.primary_artists) &&
    song.artist_map.primary_artists.length
  ) {
    artistStr = song.artist_map.primary_artists.map((a: any) => a.name).join(", ");
  } else if (Array.isArray(song.artists?.primary) && song.artists.primary.length) {
    artistStr = song.artists.primary.map((a: any) => a.name).join(", ");
  } else if (song.primary_artists || song.primaryArtists) {
    artistStr = song.primary_artists || song.primaryArtists;
  } else if (song.music) {
    artistStr = song.music;
  } else {
    artistStr = song.subtitle || "—";
  }
  return decodeHtml(artistStr);
};

export interface ArtistItem {
  name: string;
  id: string;
}

export const getArtistsList = (song: any): ArtistItem[] => {
  if (!song) return [];

  // 1. song.artists object with primary / featured arrays
  const primaryArr = Array.isArray(song.artists?.primary) ? song.artists.primary : [];
  const featuredArr = Array.isArray(song.artists?.featured) ? song.artists.featured : [];
  if (primaryArr.length > 0 || featuredArr.length > 0) {
    const combined = [...primaryArr, ...featuredArr];
    return combined
      .map((a: any) => ({
        name: decodeHtml(typeof a === "string" ? a : a.name || ""),
        id: typeof a === "string" ? "" : String(a.id || a.browseId || a.artistId || "")
      }))
      .filter((a: ArtistItem) => a.name.length > 0);
  }

  // 2. song.artist_map?.primary_artists
  if (Array.isArray(song.artist_map?.primary_artists) && song.artist_map.primary_artists.length > 0) {
    return song.artist_map.primary_artists
      .map((a: any) => ({
        name: decodeHtml(a.name || ""),
        id: String(a.id || a.browseId || a.artistId || "")
      }))
      .filter((a: ArtistItem) => a.name.length > 0);
  }

  // 3. song.artists array
  if (Array.isArray(song.artists) && song.artists.length > 0) {
    return song.artists
      .map((a: any) => ({
        name: decodeHtml(typeof a === "string" ? a : a.name || ""),
        id: typeof a === "string" ? "" : String(a.id || a.browseId || a.artistId || "")
      }))
      .filter((a: ArtistItem) => a.name.length > 0);
  }

  // 4. String fallback (primaryArtists, primary_artists, singers, artist, music, subtitle)
  const primary = decodeHtml(
    song.primaryArtists ||
    song.primary_artists ||
    song.singers ||
    song.artist ||
    song.music ||
    song.subtitle ||
    ""
  );

  if (primary && primary !== "—") {
    let ids: string[] = [];
    if (typeof song.primaryArtistsId === "string") {
      ids = song.primaryArtistsId.split(",").map((s: string) => s.trim());
    } else if (typeof song.primary_artists_id === "string") {
      ids = song.primary_artists_id.split(",").map((s: string) => s.trim());
    }

    const parts = String(primary).split(/,\s*|\s+&\s+|\s+and\s+|\s+x\s+|\s*\/\s*/i);
    return parts
      .map((name: string, idx: number) => ({
        name: name.trim(),
        id: ids[idx] || ""
      }))
      .filter((a: ArtistItem) => a.name.length > 0);
  }

  return [];
};

export const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

export const onImgErr = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const target = e.target as HTMLImageElement;
  target.onerror = null;
  target.src = FALLBACK_IMG;
};

const PRESET_COLORS = [
  "#1a3a2a",
  "#1a2847",
  "#47251a",
  "#2d1a47",
  "#1a3d47",
  "#3a3a1a",
  "#471a2d",
  "#1a3347",
  "#3d2a1a",
  "#1a473d",
];

export const hashColor = (id: string): string => {
  let h = 0;
  for (const c of id || "") h = c.charCodeAt(0) + ((h << 5) - h);
  return PRESET_COLORS[Math.abs(h) % PRESET_COLORS.length];
};

export const extractColor = (imgUrl: string): Promise<string | null> =>
  new Promise((resolve) => {
    if (!imgUrl) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = 20;
        cv.height = 20;
        const ctx = cv.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, 20, 20);
        const d = ctx.getImageData(0, 0, 20, 20).data;
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (lum < 20 || lum > 230) continue;
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
          n++;
        }
        if (!n) return resolve(null);
        const f = 0.42;
        resolve(
          `rgb(${Math.round((r / n) * f)},${Math.round((g / n) * f)},${Math.round((b / n) * f)})`,
        );
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
