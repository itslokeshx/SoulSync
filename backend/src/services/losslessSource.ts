import axios from "axios";

export interface LosslessStreamResult {
  streamUrl: string;
  quality: string;
  sourceName: string;
}

export async function resolveLosslessSource(
  title: string,
  artist: string
): Promise<LosslessStreamResult | null> {
  if (!title || !artist) return null;

  const query = `${title} ${artist}`.trim();
  const JIOSAAVN_BASE = process.env.JIOSAAVN_API || "https://saavn.sumit.co/api";
  const PRIMARY_BASE = process.env.JIOSAAVN_API_PRIMARY || "https://jiosaavn.rajputhemant.dev";

  try {
    const searchRes = await axios.get(`${JIOSAAVN_BASE}/search/songs`, {
      params: { query, limit: 5 },
      timeout: 5000,
    });

    const songs = searchRes.data?.data?.results || searchRes.data?.data || searchRes.data?.results || [];
    if (Array.isArray(songs) && songs.length > 0) {
      const match = songs.find((s: any) => {
        const sName = String(s.name || s.title || "").toLowerCase();
        const sArtist = String(s.primaryArtists || s.artist || "").toLowerCase();
        return sName.includes(title.toLowerCase().slice(0, 5)) || sArtist.includes(artist.toLowerCase().slice(0, 5));
      }) || songs[0];

      if (match) {
        const urls = match.downloadUrl || match.download_url || match.media_url || [];
        if (Array.isArray(urls) && urls.length > 0) {
          const highQual = urls.find((u: any) => u.quality === "320kbps" || u.quality === "320") || urls[urls.length - 1];
          const streamUrl = String(highQual?.url || highQual?.link || "").replace(/&amp;/g, "&");
          if (streamUrl && streamUrl.startsWith("http")) {
            return {
              streamUrl,
              quality: "320kbps Lossless Mirror",
              sourceName: "SoulSync Alternate Lossless",
            };
          }
        }
      }
    }
  } catch (e) {}

  try {
    const searchRes = await axios.get(`${PRIMARY_BASE}/search/songs`, {
      params: { query, limit: 3 },
      timeout: 5000,
    });
    const songs = searchRes.data?.data?.results || searchRes.data?.data || [];
    if (Array.isArray(songs) && songs.length > 0) {
      const match = songs[0];
      const urls = match.downloadUrl || [];
      if (Array.isArray(urls) && urls.length > 0) {
        const highQual = urls.find((u: any) => u.quality === "320kbps") || urls[urls.length - 1];
        const streamUrl = String(highQual?.url || highQual?.link || "").replace(/&amp;/g, "&");
        if (streamUrl && streamUrl.startsWith("http")) {
          return {
            streamUrl,
            quality: "320kbps Lossless Mirror",
            sourceName: "Primary Lossless Source",
          };
        }
      }
    }
  } catch (e) {}

  return null;
}
