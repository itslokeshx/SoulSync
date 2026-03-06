import axios from "axios";
import { Song, Album, Artist } from "../types/song";

const API =
  import.meta.env.VITE_JIOSAAVN_API || "https://jiosaavn.rajputhemant.dev";

const client = axios.create({
  baseURL: API,
  timeout: 10000,
});

// retry with exponential backoff on 429 rate-limit
client.interceptors.response.use(undefined, async (err) => {
  const cfg = err.config;
  if (!cfg || err.response?.status !== 429) return Promise.reject(err);
  cfg.__retryCount = cfg.__retryCount || 0;
  if (cfg.__retryCount >= 3) return Promise.reject(err);
  cfg.__retryCount += 1;
  const delay = Math.pow(2, cfg.__retryCount) * 500; // 1s, 2s, 4s
  await new Promise((r) => setTimeout(r, delay));
  return client(cfg);
});

export async function searchSongs(
  query: string,
  limit = 20,
  page = 1,
  signal?: AbortSignal,
): Promise<{ results: Song[]; total: number }> {
  const { data } = await client.get("/search/songs", {
    params: { q: query, n: limit, page },
    signal,
  });
  return { results: data?.data?.results || [], total: data?.data?.total || 0 };
}

export async function searchAlbums(
  query: string,
  limit = 10,
): Promise<Album[]> {
  const { data } = await client.get("/search/albums", {
    params: { q: query, n: limit },
  });
  return data?.data?.results || [];
}

export async function searchArtists(
  query: string,
  limit = 10,
): Promise<Artist[]> {
  const { data } = await client.get("/search/artists", {
    params: { q: query, n: limit },
  });
  return data?.data?.results || [];
}

export const getSongById = async (id: string): Promise<Song | null> => {
  try {
    const res = await axios.get(`${API}/songs`, {
      params: { ids: id },
    });
    return res.data?.data?.[0] || null;
  } catch (error) {
    console.error("Error fetching song by ID:", error);
    return null;
  }
};

export async function getAlbum(albumId: string): Promise<Album | null> {
  const { data } = await client.get("/album", { params: { id: albumId } });
  return data?.data || null;
}

export async function getArtist(artistId: string): Promise<Artist | null> {
  const { data } = await client.get("/artist", { params: { id: artistId } });
  return data?.data || null;
}

export async function getArtistSongs(
  artistId: string,
  page = 1,
): Promise<Song[]> {
  const { data } = await client.get("/artist/songs", {
    params: { id: artistId, page },
  });
  return data?.data?.songs || data?.data?.results || [];
}

export async function getSuggestions(
  songId: string,
  limit = 10,
): Promise<Song[]> {
  const res = await axios.get(
    `${API}/songs/${songId}/suggestions`,
    {
      params: { limit },
    },
  );
  return res.data?.data || [];
}

export async function getTopSearch(): Promise<unknown[]> {
  const { data } = await client.get("/search/top");
  return data?.data || [];
}

export async function searchAll(query: string): Promise<{
  songs?: { results: Song[] };
  albums?: { results: Album[] };
  artists?: { results: Artist[] };
}> {
  const { data } = await client.get("/search", { params: { q: query } });
  return data?.data || {};
}
