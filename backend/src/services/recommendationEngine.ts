import {
  fetchAlbumSongs,
  fetchArtistSongs,
  normalizeSongsToCanonical,
  searchSongs,
  Song,
} from "./jiosaavn.js";
import { redisGet, redisSet } from "./redis.js";

const CACHE_TTL_SECONDS = 1800;
const MIN_RESULTS_BEFORE_FALLBACK = 10;
const RETURN_LIMIT = 15;
const CACHE_LIMIT = 50;

export interface SongMeta {
  id: string;
  title?: string;
  artist?: string;
  artistId?: string;
  language?: string;
  albumId?: string;
}

function filterSongs(
  songs: Song[],
  currentSongId: string,
  excludeIds: string[] = [],
): Song[] {
  const excluded = new Set(
    [currentSongId, ...excludeIds].map((id) => String(id || "")).filter(Boolean),
  );
  const seen = new Set<string>();
  const filtered: Song[] = [];

  for (const song of songs) {
    const id = String(song?.id || "");
    if (!id || excluded.has(id) || seen.has(id)) continue;
    seen.add(id);
    filtered.push(song);
  }

  return filtered;
}

function mergeSongs(base: Song[], incoming: any[]): Song[] {
  const seen = new Set(base.map((song) => String(song.id || "")));
  const normalized = normalizeSongsToCanonical(incoming);
  const merged = [...base];

  for (const song of normalized) {
    const id = String(song.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(song);
  }

  return merged;
}

function readCachedSongs(value: string): Song[] {
  const parsed = JSON.parse(value);
  const songs = Array.isArray(parsed) ? parsed : parsed?.songs;
  return normalizeSongsToCanonical(Array.isArray(songs) ? songs : []);
}

export async function getRecommendations(
  song: SongMeta,
  excludeIds: string[] = [],
): Promise<Song[]> {
  const songId = String(song.id || "");
  if (!songId) return [];

  const cacheKey = `rec:${songId}`;

  const cached = await redisGet(cacheKey).catch(() => null);
  if (cached) {
    try {
      return filterSongs(readCachedSongs(cached), songId, excludeIds).slice(
        0,
        RETURN_LIMIT,
      );
    } catch {
      // Bad cache payloads should not break playback.
    }
  }

  let candidates: Song[] = [];

  if (song.artistId) {
    const artistSongs = await fetchArtistSongs(String(song.artistId), 0, 3).catch(
      (err) => {
        console.warn("[RecommendationEngine] Artist strategy failed:", err);
        return [];
      },
    );
    candidates = mergeSongs(candidates, artistSongs);
  }

  if (
    filterSongs(candidates, songId, excludeIds).length <
    MIN_RESULTS_BEFORE_FALLBACK
  ) {
    const searchTerms = [song.language, song.artist]
      .map((part) => String(part || "").trim())
      .filter(Boolean);
    const query = searchTerms.length ? `${searchTerms.join(" ")} songs` : "";

    if (query) {
      const searchedSongs = await searchSongs(query, 40).catch((err) => {
        console.warn("[RecommendationEngine] Search strategy failed:", err);
        return [];
      });
      candidates = mergeSongs(candidates, searchedSongs);
    }
  }

  if (
    song.albumId &&
    filterSongs(candidates, songId, excludeIds).length <
      MIN_RESULTS_BEFORE_FALLBACK
  ) {
    const albumSongs = await fetchAlbumSongs(String(song.albumId)).catch((err) => {
      console.warn("[RecommendationEngine] Album strategy failed:", err);
      return [];
    });
    candidates = mergeSongs(candidates, albumSongs);
  }

  const cacheable = filterSongs(candidates, songId).slice(0, CACHE_LIMIT);
  await redisSet(cacheKey, JSON.stringify(cacheable), CACHE_TTL_SECONDS).catch(
    (err) => {
      console.warn("[RecommendationEngine] Redis cache write failed:", err);
    },
  );

  return filterSongs(cacheable, songId, excludeIds).slice(0, RETURN_LIMIT);
}
