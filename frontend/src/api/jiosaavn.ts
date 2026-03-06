import axios from "axios";
import { Song, Album, Artist } from "../types/song";

// Use backend proxy for details to avoid 404s/500s from external API
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
const JIOSAAVN_EXTERNAL = import.meta.env.VITE_JIOSAAVN_API || "https://saavn.sumit.co/api";

const client = axios.create({
  baseURL: `${BACKEND_URL}/api/search`,
  timeout: 10000,
  withCredentials: true
});

export async function searchSongs(
  query: string,
  limit = 20,
  page = 1,
  signal?: AbortSignal,
): Promise<{ results: Song[]; total: number }> {
  // Use the smart endpoint for best results
  const { data } = await client.get("/smart", {
    params: { q: query },
    signal,
  });
  return { results: data?.songs || [], total: data?.total || 0 };
}

export async function searchAlbums(
  query: string,
  limit = 10,
): Promise<Album[]> {
  const { data } = await client.get("/smart", {
    params: { q: query },
  });
  return data?.albums || [];
}

export async function searchArtists(
  query: string,
  limit = 10,
): Promise<Artist[]> {
  const { data } = await client.get("/smart", {
    params: { q: query },
  });
  return data?.artists || [];
}

export const getSongById = async (id: string): Promise<Song | null> => {
  try {
    // Songs can still hit external or we can proxy them. 
    // For now, external is usually fine for direct ID lookup if it's stable.
    const res = await axios.get(`${JIOSAAVN_EXTERNAL}/songs`, {
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
  return data || null;
}

export async function getArtist(artistId: string): Promise<Artist | null> {
  const { data } = await client.get("/artist", { params: { id: artistId } });
  return data || null;
}

export async function getArtistSongs(
  artistId: string,
  page = 1,
): Promise<Song[]> {
  const { data } = await client.get("/artist/songs", {
    params: { id: artistId, page },
  });
  return data || [];
}

export async function getSuggestions(
  songId: string,
  limit = 10,
): Promise<Song[]> {
  try {
    const { data } = await client.get("/related", {
      params: { songId, limit }
    });
    return data?.songs || [];
  } catch {
    return [];
  }
}

export async function getTopSearch(): Promise<unknown[]> {
  const { data } = await client.get("/suggestions");
  return data?.suggestions || [];
}

export async function searchAll(query: string): Promise<{
  songs?: { results: Song[] };
  albums?: { results: Album[] };
  artists?: { results: Artist[] };
}> {
  const { data } = await client.get("/smart", { params: { q: query } });
  return {
    songs: { results: data?.songs || [] },
    albums: { results: data?.albums || [] },
    artists: { results: data?.artists || [] }
  };
}
