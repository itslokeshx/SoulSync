import {
  fetchArtistSongs,
  normalizeSongsToCanonical,
  searchSongs,
  Song,
} from "./jiosaavn.js";
import { groqManager } from "./groq.js";
import { redisGet, redisSet } from "./redis.js";

const CACHE_TTL_SECONDS = 1800;
const RETURN_LIMIT = 15;
const SEARCH_LIMIT = 10;
const RECENT_RECOMMENDATION_LIMIT = 100;

const recentRecommendationIds = new Set<string>();

export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  language?: string;
  albumId?: string;
  album?: string;
}

const SYSTEM_PROMPT = `You are a music recommendation engine. Given a song's metadata, generate 
5 diverse JioSaavn search queries to find songs with a SIMILAR VIBE.

Rules:
- Query 1: Same artist, different era or style ("artist acoustic", "artist sad songs")
- Query 2: A DIFFERENT but sonically similar artist in same language
- Query 3: Mood/emotion based ("late night sad hindi", "hype tamil 2024", "chill lo-fi hindi")  
- Query 4: Genre + language combo ("indie hindi romantic", "punjabi dance beats")
- Query 5: Trending/popular in same language ("top hindi hits 2024", "viral tamil songs")

CRITICAL:
- Never repeat the song title in any query
- Never use generic queries like "hindi songs" alone — always add a modifier
- Queries must be diverse — if Query 1 uses the artist name, Query 2-5 must NOT
- Return ONLY a JSON array of 5 strings. No explanation. No markdown.
  Example: ["query one", "query two", "query three", "query four", "query five"]`;

function fallbackQueries(song: SongMeta): string[] {
  const artist = song.artist?.trim() || "popular";
  const language = song.language?.trim() || "hindi";

  return [
    `${artist} best songs`,
    `popular ${language} songs 2024`,
    `${language} trending music`,
    `${language} mood songs`,
    `${language} top hits`,
  ];
}

async function generateSearchQueries(song: SongMeta): Promise<string[]> {
  try {
    const result = await groqManager.callWithFallback(
      SYSTEM_PROMPT,
      `Song: ${song.title || ""}
Artist: ${song.artist || ""}
Language: ${song.language || ""}
Album: ${song.album || ""}

Generate 5 diverse search queries.`,
      500,
    );
    const parsed = JSON.parse(result);
    if (
      Array.isArray(parsed) &&
      parsed.length >= 5 &&
      parsed.every((q) => typeof q === "string" && q.trim().length > 0)
    ) {
      return parsed.slice(0, 5).map((q) => q.trim());
    }
  } catch (err) {
    console.warn("[RecommendationEngine] Groq query generation failed:", err);
  }

  return fallbackQueries(song);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleWords(song: Song): Set<string> {
  return new Set(
    normalizeText(song.name || "")
      .split(" ")
      .filter((word) => word.length > 1),
  );
}

function hasSimilarTitle(a: Song, b: Song): boolean {
  const aWords = titleWords(a);
  const bWords = titleWords(b);
  const smaller = Math.min(aWords.size, bWords.size);
  if (smaller === 0) return false;

  let shared = 0;
  for (const word of aWords) {
    if (bWords.has(word)) shared++;
  }

  return shared / smaller >= 0.7;
}

function isSameArtist(song: Song, currentArtist: string): boolean {
  const current = normalizeText(currentArtist).split(" ").filter(Boolean);
  if (!current.length) return false;

  const candidate = normalizeText(song.primaryArtists || "");
  if (!candidate) return false;

  const firstArtist = normalizeText(currentArtist.split(",")[0] || "");
  return (
    candidate === normalizeText(currentArtist) ||
    (!!firstArtist && candidate.includes(firstArtist)) ||
    current.every((word) => candidate.includes(word))
  );
}

function dedupeSongs(
  songs: Song[],
  currentSongId: string,
  excludeIds: string[] = [],
): Song[] {
  const excluded = new Set(
    [currentSongId, ...excludeIds].map((id) => String(id || "")).filter(Boolean),
  );
  const seenIds = new Set<string>();
  const deduped: Song[] = [];

  for (const song of songs) {
    const id = String(song?.id || "");
    if (!id || excluded.has(id) || seenIds.has(id)) continue;
    if (deduped.some((existing) => hasSimilarTitle(existing, song))) continue;

    seenIds.add(id);
    deduped.push(song);
  }

  return deduped;
}

function scoreSong(song: Song, current: SongMeta, poolSize: number): number {
  let score = 0;
  const sameLanguage =
    !!current.language &&
    normalizeText(song.language || "") === normalizeText(current.language);
  const sameArtist = isSameArtist(song, current.artist || "");

  if (sameLanguage) score += 3;
  if (!sameArtist) score += 2;
  if (sameArtist && poolSize >= 15) score -= 5;
  if (!recentRecommendationIds.has(song.id)) score += 1;

  return score;
}

function shuffleGroup<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function lightlyShuffle<T>(items: T[], groupSize = 5): T[] {
  const shuffled: T[] = [];
  for (let i = 0; i < items.length; i += groupSize) {
    shuffled.push(...shuffleGroup(items.slice(i, i + groupSize)));
  }
  return shuffled;
}

function rememberRecommendations(songs: Song[]): void {
  for (const song of songs) {
    if (recentRecommendationIds.size >= RECENT_RECOMMENDATION_LIMIT) {
      recentRecommendationIds.clear();
    }
    recentRecommendationIds.add(song.id);
  }
}

function readCachedSongs(value: string): Song[] {
  const parsed = JSON.parse(value);
  return normalizeSongsToCanonical(Array.isArray(parsed) ? parsed : []);
}

function filterExcluded(
  songs: Song[],
  currentSongId: string,
  excludeIds: string[],
): Song[] {
  const excluded = new Set(
    [currentSongId, ...excludeIds].map((id) => String(id || "")).filter(Boolean),
  );
  return songs.filter((song) => song.id && !excluded.has(song.id));
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
      const songs = filterExcluded(readCachedSongs(cached), songId, excludeIds);
      const selected = songs.slice(0, RETURN_LIMIT);
      rememberRecommendations(selected);
      return selected;
    } catch {
      // Bad cache payloads should not break playback.
    }
  }

  const queries = await generateSearchQueries(song);
  const searchPromises = queries.map((query) =>
    searchSongs(query, SEARCH_LIMIT).catch((err) => {
      console.warn("[RecommendationEngine] Search strategy failed:", err);
      return [];
    }),
  );
  const artistPromise = song.artistId
    ? fetchArtistSongs(String(song.artistId), 0, 3).catch((err) => {
        console.warn("[RecommendationEngine] Artist strategy failed:", err);
        return [];
      })
    : Promise.resolve([]);

  const results = await Promise.all([...searchPromises, artistPromise]);
  const pool = normalizeSongsToCanonical(results.flat());
  const deduped = dedupeSongs(pool, songId);
  const poolSize = deduped.length;
  const ranked = lightlyShuffle(
    deduped
      .map((candidate) => ({
        song: candidate,
        score: scoreSong(candidate, song, poolSize),
      }))
      .sort((a, b) => b.score - a.score)
      .map(({ song }) => song),
  );

  await redisSet(cacheKey, JSON.stringify(ranked), CACHE_TTL_SECONDS).catch(
    (err) => {
      console.warn("[RecommendationEngine] Redis cache write failed:", err);
    },
  );

  const selected = filterExcluded(ranked, songId, excludeIds).slice(
    0,
    RETURN_LIMIT,
  );
  rememberRecommendations(selected);
  return selected;
}
