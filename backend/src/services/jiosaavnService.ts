import { Song } from "./youtubeMusicService.js";

function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  const entities: Record<string, string> = {
    "&quot;": '"',
    "&amp;": "&",
    "&#039;": "'",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
  };
  return text.replace(
    /&quot;|&amp;|&#039;|&lt;|&gt;|&nbsp;/g,
    (match) => entities[match] || match,
  );
}

async function fetchSafe(path: string): Promise<any> {
  const wrappers = Array.from(
    new Set(
      [
        process.env.JIOSAAVN_API,
        process.env.JIOSAAVN_API_PRIMARY,
        process.env.JIOSAAVN_API_FALLBACK,
        "https://jiosavan-api2.vercel.app/api",
        "https://saavn.sumit.co/api",
      ]
        .filter(Boolean)
        .map((w) => w!.replace(/\/$/, ""))
    )
  );

  const subpath = path.startsWith("/") ? path : `/${path}`;

  for (const base of wrappers) {
    const url = `${base}${subpath}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const payload = (await res.json()) as any;
        if (payload && payload.success !== false) {
          return payload;
        }
      }
    } catch {
      // try next wrapper
    }
  }
  return null;
}

function normalizeJioSaavnSong(raw: any): Song | null {
  if (!raw) return null;
  const id = String(raw.id || raw.songId || "");
  if (!id) return null;

  let primaryArtists = "";
  if (Array.isArray(raw.artists?.primary)) {
    primaryArtists = raw.artists.primary.map((a: any) => a.name || "").join(", ");
  } else if (typeof raw.primaryArtists === "string") {
    primaryArtists = raw.primaryArtists;
  } else if (typeof raw.artist === "string") {
    primaryArtists = raw.artist;
  }

  let streamUrl = null;
  let downloadUrl: any[] = [];
  if (Array.isArray(raw.downloadUrl)) {
    downloadUrl = raw.downloadUrl.map((d: any) => ({
      quality: d.quality || "",
      url: d.url || d.link || ""
    }));
    const ORDER = ["320kbps", "160kbps", "96kbps"];
    for (const q of ORDER) {
      const entry = downloadUrl.find((d) => d.quality === q);
      if (entry?.url) {
        streamUrl = entry.url;
        break;
      }
    }
    if (!streamUrl && downloadUrl.length > 0) {
      streamUrl = downloadUrl[0].url;
    }
  }

  let image = "/placeholder.png";
  if (Array.isArray(raw.image) && raw.image.length > 0) {
    const best = raw.image.find((i: any) => i.quality === "500x500") || raw.image[raw.image.length - 1];
    image = best.url || best.link || image;
  } else if (typeof raw.image === "string") {
    image = raw.image;
  }

  return {
    id,
    name: decodeHtmlEntities(raw.name || raw.title || "Unknown"),
    primaryArtists: decodeHtmlEntities(primaryArtists || "Unknown"),
    image,
    album: typeof raw.album === "object" ? decodeHtmlEntities(raw.album?.name || "") : decodeHtmlEntities(raw.album || ""),
    albumId: typeof raw.album === "object" ? raw.album?.id || "" : raw.albumId || "",
    duration: Number(raw.duration) || 0,
    language: (raw.language || "english").toLowerCase(),
    year: String(raw.year || ""),
    streamUrl,
    downloadUrl,
    playCount: Number(raw.playCount || raw.play_count) || 0,
    url: raw.url || ""
  };
}

export async function fetchJioSaavnSongById(id: string): Promise<Song | null> {
  try {
    const data = await fetchSafe(`/songs/${id}`);
    const raw = Array.isArray(data?.data) ? data.data[0] : data?.data || data;
    return normalizeJioSaavnSong(raw);
  } catch {
    return null;
  }
}

export async function fetchJioSaavnSongsByIds(ids: string[]): Promise<Song[]> {
  if (!ids || ids.length === 0) return [];
  const songs = await Promise.all(
    ids.map(id => fetchJioSaavnSongById(id).catch(() => null))
  );
  return songs.filter((s): s is Song => s !== null);
}

export async function resolveJioSaavnStreamUrl(id: string): Promise<string | null> {
  const song = await fetchJioSaavnSongById(id);
  return song?.streamUrl || null;
}
