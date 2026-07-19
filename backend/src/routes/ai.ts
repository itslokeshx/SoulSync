import { Router, Response } from "express";
import { groqManager } from "../services/groq.js";
import {
  searchSongs,
  searchSongsHybrid,
  normalizeSongsToCanonical,
  normalizeSongToCanonical,
  fetchSongsByIds,
} from "../services/youtubeMusicService.js";
import { parseQuery } from "../services/searchEnhancer.js";
import {
  rankSearchResults,
  getKnownSongIds,
} from "../services/searchRanker.js";
import { redisGet, redisSet } from "../services/redis.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { softAuth, SoftAuthRequest } from "../middleware/softAuth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import crypto from "crypto";

const router = Router();

const CHUNK_SIZE = 20;
const MAX_GROQ_CONCURRENT = 3;
const MAX_SEARCH_CONCURRENT = 10;
const MAX_TARGET_COUNT = 100;

interface AIQuery {
  original: string;
  searchQuery: string;
  artistHint: string | null;
  movieHint: string | null;
  languageHint: string | null;
}

interface MatchedSong {
  original: string;
  song: unknown;
  confidence: "high" | "partial" | "none";
  score: number;
}

// ─── Language detection from user input ─────────────────────────────────────
const LANGUAGE_KEYWORDS: Record<string, string> = {
  tamil: "tamil",
  tamizh: "tamil",
  kollywood: "tamil",
  english: "english",
  hindi: "hindi",
  bollywood: "hindi",
  telugu: "telugu",
  tollywood: "telugu",
  kannada: "kannada",
  malayalam: "malayalam",
  punjabi: "punjabi",
  bengali: "bengali",
  marathi: "marathi",
  gujarati: "gujarati",
  bhojpuri: "bhojpuri",
  korean: "korean",
  kpop: "korean",
  "k-pop": "korean",
  japanese: "japanese",
  spanish: "spanish",
  french: "french",
  arabic: "arabic",
};

function detectLanguage(text: string): string | null {
  const lower = text.toLowerCase();
  // Check multi-word keys first (longest match), then single words
  const sorted = Object.entries(LANGUAGE_KEYWORDS).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [keyword, lang] of sorted) {
    if (lower.includes(keyword)) return lang;
  }
  return null;
}

// ─── Helper: send SSE event ─────────────────────────────────────────────────
function sseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  // Flush if supported
  if (typeof (res as any).flush === "function") (res as any).flush();
}

// ─── Helper: parse song list string ─────────────────────────────────────────
function parseSongList(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.replace(/^\d+[\.\)\]]\s*/, "").trim())
    .filter((s) => s.length > 0 && s.length < 200);
}

function cleanSongTitleForSearch(title: string): string {
  return title
    .replace(/\s*\((?:super\s+)?slowed(?:\s+down)?(?:\s+version)?\)/i, "")
    .replace(/\s*\((?:super\s+)?sped\s+up(?:\s+version)?\)/i, "")
    .replace(/\s*\(remastered(?: \d+)?\)/i, "")
    .replace(/\s*\(live(?: version)?\)/i, "")
    .replace(/\s*\(acoustic(?: version)?\)/i, "")
    .replace(/\s*\(radio edit\)/i, "")
    .replace(/\s*\(lofi\)/i, "")
    .replace(/\s*\(slowed\s*\+\s*reverb\)/i, "")
    .trim();
}

function parseSongLine(line: string): { searchQuery: string; artistHint: string | null } {
  // Split by common separators: " - ", " – " (en dash), " — " (em dash), " by ", or " : "
  const parts = line.split(/\s*(?: - | – | — | by | : )\s*/i);
  if (parts.length >= 2) {
    const title = cleanSongTitleForSearch(parts[0].trim());
    const artist = parts.slice(1).join(" ").trim();
    return {
      searchQuery: `${title} ${artist}`,
      artistHint: artist,
    };
  }
  const parsed = parseQuery(line);
  return {
    searchQuery: cleanSongTitleForSearch(parsed.expandedQueries[0] || line),
    artistHint: parsed.entities.artist,
  };
}

// ─── Helper: chunk array ────────────────────────────────────────────────────
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── Helper: run promises with concurrency limit ────────────────────────────
async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function run() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, run));
  return results;
}

function deduplicateByVideoId(results: MatchedSong[]): MatchedSong[] {
  const seenVideoIds = new Set<string>();
  return results.map((r) => {
    if (!r.song || r.confidence === "none") return r;
    const videoId = String((r.song as any).id || "");
    if (!videoId) return r;
    if (seenVideoIds.has(videoId)) {
      return { ...r, confidence: "none" as const, score: 0 };
    }
    seenVideoIds.add(videoId);
    return r;
  });
}

// ─── Check if a song matches the requested language ─────────────────────────
function songMatchesLanguage(song: any, targetLang: string | null): boolean {
  if (!targetLang) return true; // no language constraint
  const songLang = (
    song.language ||
    song?.more_info?.language ||
    ""
  ).toLowerCase();
  if (!songLang) return true; // can't determine, allow it
  return songLang === targetLang;
}

// ─── Score a song's language relevance (for ranking, not filtering) ─────────
function languageBonus(song: any, targetLang: string | null): number {
  if (!targetLang) return 0;
  const songLang = (
    song.language ||
    song?.more_info?.language ||
    ""
  ).toLowerCase();
  if (!songLang) return 0;
  if (songLang === targetLang) return 50; // strong boost for matching language
  if (songLang === "english" && targetLang !== "english") return -10; // mild penalty
  return -30; // wrong language penalty
}

// ─── Search a single song with scoring (IMPROVED) ───────────────────────────
async function searchOneSong(
  original: string,
  searchQuery: string,
  artistHint?: string | null,
  targetLang?: string | null,
): Promise<MatchedSong> {
  try {
    // ── Inject pinned originals for known songs ─────────────────────────────
    const lookupKeys = [
      original.trim().toLowerCase(),
      searchQuery.trim().toLowerCase(),
    ];
    let pinnedSongs: any[] = [];
    for (const key of lookupKeys) {
      const ids = getKnownSongIds(key);
      if (ids.length > 0) {
        try {
          pinnedSongs = await fetchSongsByIds(ids);
        } catch {
          /* ignore */
        }
        break;
      }
    }

    // Use hybrid search for better quality results (fetches from both
    // direct jiosaavn.com AND wrapper API in parallel)
    let rawSongs = await searchSongsHybrid(searchQuery, 20, artistHint);

    // If hybrid didn't return enough, fall back to wrapper
    if (rawSongs.length < 3) {
      const fallback = await searchSongs(searchQuery, 20);
      const seenIds = new Set(rawSongs.map((s: any) => String(s.id || "")));
      for (const s of fallback) {
        if (!seenIds.has(String(s.id || ""))) {
          rawSongs.push(s);
        }
      }
    }

    if (pinnedSongs.length > 0) {
      const seen = new Set(rawSongs.map((s: any) => String(s.id || "")));
      for (const p of [...pinnedSongs].reverse())
        if (!seen.has(p.id)) rawSongs = [p, ...rawSongs];
    }
    if (rawSongs.length === 0)
      return { original, song: null, confidence: "none", score: 0 };

    // Normalize to canonical format for rankSearchResults
    const normalized = normalizeSongsToCanonical(rawSongs);
    const ranked = rankSearchResults(
      normalized,
      searchQuery,
      targetLang || undefined,
      artistHint || undefined,
    );

    // Map ranked IDs back to original raw songs (frontend expects JioSaavnSong shape)
    const rawById = new Map<string, any>(
      rawSongs.map((s: any) => [String(s.id || ""), s]),
    );
    const songs: any[] = ranked.map((r) => rawById.get(r.id)).filter(Boolean);

    // Safety: if mapping failed, fall back to original list
    if (songs.length === 0) songs.push(...rawSongs);

    const cleanOrig = original
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .trim();

    const queryWords = cleanOrig.split(/\s+/).filter((w) => w.length > 1);

    let bestSong = songs[0];
    let bestScore = -1;

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const songNameLower = (song.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .trim();
      
      const artistsList = Array.isArray(song.artists)
        ? song.artists
        : [];
      const artists = artistsList.map((a: any) =>
        (a.name || a || "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .trim(),
      );
      if (song.primaryArtists) {
        const prim = String(song.primaryArtists)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .trim();
        if (!artists.includes(prim)) {
          artists.push(prim);
        }
      }
      if (song.subtitle) {
        artists.push(
          song.subtitle
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .trim(),
        );
      }

      const combined = songNameLower + " " + artists.join(" ");
      let matchCount = queryWords.filter((w) => combined.includes(w)).length;
      let score =
        queryWords.length > 0 ? (matchCount / queryWords.length) * 100 : 50;

      // Exact title match bonus
      if (songNameLower === cleanOrig || cleanOrig.includes(songNameLower)) {
        score += 30;
      }

      // Artist hint bonus
      if (artistHint) {
        const hintLower = artistHint
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .trim();
        if (
          artists.some(
            (a: string) => a.includes(hintLower) || hintLower.includes(a),
          )
        ) {
          score += 40;
        }
      }

      // Language matching bonus/penalty — critical for fixing language mixing
      score += languageBonus(song, targetLang || null);

      // Cover-rank tiebreaker: songs ranked higher by rankSearchResults get a bonus
      const rankBonus = Math.max(0, ((songs.length - i) / songs.length) * 20);
      score += rankBonus;

      if (score > bestScore) {
        bestScore = score;
        bestSong = song;
      }
    }

    const finalSong = bestSong ? normalizeSongToCanonical(bestSong) : null;

    if (finalSong) {
      return { original, song: finalSong, confidence: "high", score: Math.max(bestScore, 80) };
    }

    // ── Fallback retry with raw original title ───────────────────────────
    if (searchQuery !== original && original.trim().length >= 3) {
      try {
        const fallbackRaw = await searchSongsHybrid(original, 15, artistHint);
        if (fallbackRaw.length > 0) {
          const fallbackNorm = normalizeSongsToCanonical(fallbackRaw);
          const fallbackRanked = rankSearchResults(
            fallbackNorm,
            original,
            targetLang || undefined,
            artistHint || undefined,
          );
          const fallbackById = new Map<string, any>(
            fallbackRaw.map((s: any) => [String(s.id || ""), s]),
          );
          const fallbackSongs = fallbackRanked
            .map((r) => fallbackById.get(r.id))
            .filter(Boolean);
          if (fallbackSongs.length > 0) {
            // Prefer a song that matches the target language
            let top = fallbackSongs[0];
            if (targetLang) {
              const langMatch = fallbackSongs.find((s: any) =>
                songMatchesLanguage(s, targetLang),
              );
              if (langMatch) top = langMatch;
            }
            return {
              original,
              song: normalizeSongToCanonical(top),
              confidence: "high",
              score: 85,
            };
          }
        }
      } catch {
        // retry failed — fall through to none
      }
    }

    return { original, song: null, confidence: "none", score: bestScore };
  } catch {
    return { original, song: null, confidence: "none", score: 0 };
  }
}

// ─── Process one chunk via Groq (IMPROVED with language awareness) ──────────
async function processChunkWithGroq(
  songList: string[],
  languageHint: string | null,
): Promise<AIQuery[]> {
  try {
    const langInstruction = languageHint
      ? `\nIMPORTANT: These songs are in ${languageHint}. Keep search queries in ${languageHint}. Do NOT translate to any other language. Preserve the original language of song titles and artist names.`
      : "";

    const groqResult = await groqManager.callWithFallback(
      "You are a music search optimizer for JioSaavn (Indian music platform). Return ONLY valid JSON. No explanation. No markdown.",
      `Convert these song inputs to optimized JioSaavn search queries. Each query should be the song title + artist name to find the EXACT original song (not covers or remixes).${langInstruction}\n\nSongs:\n${songList.join("\n")}\n\nReturn exactly:\n{"queries": [{"original": "input", "searchQuery": "optimized query with artist name", "artistHint": "primary artist name or null", "movieHint": "movie/album name or null", "languageHint": "${languageHint || "null"}"}]}`,
      1200,
    );
    const parsed = JSON.parse(groqResult);
    if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
      return parsed.queries.map((q: any) => ({
        ...q,
        languageHint: q.languageHint || languageHint,
      }));
    }
  } catch {
    // Fallback to parseQuery
  }
  return songList.map((s) => ({
    original: s,
    searchQuery: parseQuery(s).expandedQueries[0] || s,
    artistHint: null,
    movieHint: null,
    languageHint,
  }));
}

// ─── Build a high-quality Groq prompt for mood-based generation ─────────────
function buildMoodPrompt(
  mood: string,
  requestCount: number,
  detectedLang: string | null,
): string {
  const langConstraint = detectedLang
    ? `\n\nCRITICAL LANGUAGE RULE: You MUST suggest ONLY ${detectedLang} language songs. Every single song must be a ${detectedLang} song. Do NOT include songs from any other language (no Hindi if Tamil was asked, no Hindi if English was asked, no English if Tamil was asked). If you cannot find enough ${detectedLang} songs, suggest fewer songs rather than mixing languages.`
    : "";

  const langContext = detectedLang
    ? `\nAll songs must be ${detectedLang} language songs from well-known ${detectedLang} artists and albums.`
    : "";

  return `You are a world-class music curator with deep knowledge of music across all languages and genres. You must suggest EXACTLY ${requestCount} songs for this mood/vibe: "${mood}"

RULES:
1. Use REAL, well-known, popular song names with their CORRECT artist names
2. Format each entry as "Song Title - Artist Name" (include the real original artist)
3. Prioritize popular, critically acclaimed, and widely loved songs — NOT obscure or generic tracks
4. Vary artists (maximum 3 songs per artist) for diversity
5. STRONGLY prefer songs released in the last 2 years (2024-2026). At least 70% of songs should be recent chart-toppers and trending hits. Only include older classics if they perfectly match the mood and modern options are exhausted.
6. Every song should be a real track that exists on music platforms like YouTube Music, Spotify, etc.
7. Do NOT make up fake song names or pair wrong artists with songs
8. Include currently viral and streaming-chart songs that match the mood${langConstraint}${langContext}

Return JSON:
{"songs": ["Song Title - Artist Name", ...], "playlistName": "creative 4-word playlist name"}`;
}

// ─── POST /api/ai/build-playlist ─────────────────────────────────────────────
router.post(
  "/build-playlist",
  rateLimiter(15, 60000),
  softAuth,
  async (req: SoftAuthRequest, res: Response): Promise<void> => {
    const isSSE =
      (req.headers.accept || "").includes("text/event-stream") ||
      req.body.stream === true;

    try {
      const hasKeys = [
        process.env.GROQ_KEY_1,
        process.env.GROQ_KEY_2,
        process.env.GROQ_KEY_3,
      ].some(Boolean);
      if (!hasKeys) {
        res
          .status(503)
          .json({ error: "AI service not configured. Add GROQ_KEY env vars." });
        return;
      }

      const { songs, mood, targetCount } = req.body;
      const maxSongs = Math.min(parseInt(targetCount) || 20, MAX_TARGET_COUNT);

      if (!songs && !mood) {
        res
          .status(400)
          .json({ error: "Provide song names or a mood description" });
        return;
      }

      // ── Detect language from user's input ──
      const detectedLang = mood ? detectLanguage(mood) : null;

      // ── SSE setup ──
      if (isSSE) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();
      }

      const emit = (event: string, data: unknown) => {
        if (isSSE) sseEvent(res, event, data);
      };

      // ── Mood-based generation ──
      if (mood && !songs) {
        // Request 80% more songs than the user asked for so that search
        // failures and language-mismatch filtering don't shrink the final
        // playlist below the target count.
        const requestCount = Math.min(Math.ceil(maxSongs * 1.8), 180);
        const tokenBudget = Math.max(4000, requestCount * 60);

        emit("progress", {
          step: "thinking",
          message: detectedLang
            ? `Crafting ${maxSongs} ${detectedLang} songs for your mood...`
            : `Crafting ${maxSongs} songs for your mood...`,
          percent: 5,
        });

        const moodPrompt = buildMoodPrompt(mood, requestCount, detectedLang);
        const moodResult = await groqManager.callWithFallback(
          "You are a world-class music curator. Return ONLY valid JSON, no explanation.",
          moodPrompt,
          tokenBudget,
        );

        let songList: string[] = [];
        let playlistName = "AI Generated Mix";

        try {
          const parsed = JSON.parse(moodResult);
          songList = (parsed.songs || []).slice(0, requestCount);
          playlistName = parsed.playlistName || playlistName;
        } catch (err) {
          console.error(
            "[AI] Mood suggestion parsing failed:",
            err,
            moodResult,
          );
          if (res.headersSent) {
            sseEvent(res, "error", { error: "AI response parsing failed" });
            res.end();
          } else {
            res.status(500).json({ error: "AI response parsing failed" });
          }
          return;
        }

        if (songList.length === 0) {
          res
            .status(400)
            .json({ error: "Could not generate songs for this mood" });
          return;
        }

        emit("progress", {
          step: "searching",
          message: `Searching ${songList.length} songs...`,
          percent: 30,
        });

        const tasks = songList.map(
          (s, i) => () => {
            // Extract artist hint from "Song - Artist" format
            const parts = s.split(" - ");
            const songTitle = parts[0]?.trim() || s;
            const artistFromList = parts.length > 1 ? parts[1]?.trim() : null;
            const searchQ = artistFromList
              ? `${songTitle} ${artistFromList}`
              : parseQuery(s).expandedQueries[0] || s;

            return searchOneSong(
              s,
              searchQ,
              artistFromList,
              detectedLang,
            ).then((result) => {
              const pct = 30 + Math.round(((i + 1) / songList.length) * 60);
              emit("song", {
                ...result,
                index: i,
                total: songList.length,
                percent: pct,
              });
              return result;
            });
          },
        );

        const allResults = await withConcurrency(tasks, MAX_SEARCH_CONCURRENT);

        let filteredResults = deduplicateByVideoId(allResults);
        if (detectedLang) {
          filteredResults = filteredResults.map((r) => {
            if (r.confidence === "none" || !r.song) return r;
            const song = r.song as any;
            if (songMatchesLanguage(song, detectedLang)) return r;
            return { ...r, confidence: "none" as const, score: 0 };
          });
        }

        // Sort: high-confidence first, then partial. Trim to target count.
        const allFound = [
          ...filteredResults.filter((r) => r.confidence === "high"),
          ...filteredResults.filter((r) => r.confidence === "partial"),
        ].slice(0, maxSongs);
        const matched = allFound.filter((r) => r.confidence === "high");
        const partial = allFound.filter((r) => r.confidence === "partial");
        const unmatched = filteredResults
          .filter((r) => r.confidence === "none")
          .map((r) => r.original);

        const finalResult = {
          playlistName,
          matched,
          partial,
          unmatched,
          stats: {
            total: songList.length,
            found: matched.length + partial.length,
            notFound: unmatched.length,
          },
        };

        emit("progress", {
          step: "done",
          message: "Playlist ready!",
          percent: 100,
        });
        if (isSSE) {
          emit("done", finalResult);
          res.end();
        } else {
          res.json(finalResult);
        }
        return;
      }

      // ── Song-list based generation ──
      let songList: string[] = parseSongList(
        Array.isArray(songs) ? songs.join("\n") : songs,
      ).slice(0, maxSongs);

      if (songList.length === 0) {
        res.status(400).json({ error: "No songs provided" });
        return;
      }

      // Cache check
      const cacheKey = `ai:playlist:v3:${crypto
        .createHash("md5")
        .update(songList.join("|") + maxSongs + (detectedLang || ""))
        .digest("hex")}`;
      const cached = await redisGet(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          emit("progress", {
            step: "done",
            message: "Retrieved from cache!",
            percent: 100,
          });
          if (isSSE) {
            emit("done", parsed);
            res.end();
          } else res.json(parsed);
          return;
        } catch {}
      }

      emit("progress", {
        step: "thinking",
        message: `Parsing ${songList.length} songs...`,
        percent: 10,
      });

      // ── Process song queries programmatically without Groq to ensure 100% accuracy ──
      const allQueries: AIQuery[] = songList.map((s) => {
        const parsed = parseSongLine(s);
        return {
          original: s,
          searchQuery: parsed.searchQuery,
          artistHint: parsed.artistHint,
          movieHint: null,
          languageHint: null,
        };
      });

      // Generate playlist name in parallel
      const [playlistName] = await Promise.all([
        groqManager
          .callWithFallback(
            "Return ONLY a creative 4-word playlist name. No quotes, no explanation.",
            `Creative 4-word playlist name for: ${songList.slice(0, 5).join(", ")}`,
            60,
          )
          .then((n) => n.replace(/['"]/g, "").trim() || "My SoulSync Mix")
          .catch(() => "My SoulSync Mix"),
      ]);

      emit("progress", {
        step: "searching",
        message: `Searching ${allQueries.length} songs on JioSaavn...`,
        percent: 35,
      });

      // ── Parallel search with progress ──
      const searchTasks = allQueries.map(
        (q, i) => () =>
          searchOneSong(
            q.original,
            q.searchQuery || q.original,
            q.artistHint,
            q.languageHint || detectedLang,
          ).then((result) => {
            const pct = 35 + Math.round(((i + 1) / allQueries.length) * 55);
            emit("song", {
              ...result,
              index: i,
              total: allQueries.length,
              percent: pct,
            });
            return result;
          }),
      );

      const rawResults = await withConcurrency(
        searchTasks,
        MAX_SEARCH_CONCURRENT,
      );

      const allResults = deduplicateByVideoId(rawResults);

      const allFound = [
        ...allResults.filter((r) => r.confidence === "high"),
        ...allResults.filter((r) => r.confidence === "partial"),
      ].slice(0, maxSongs);
      const matched = allFound.filter((r) => r.confidence === "high");
      const partial = allFound.filter((r) => r.confidence === "partial");
      const unmatched = allResults
        .filter((r) => r.confidence === "none")
        .map((r) => r.original);

      const finalResult = {
        playlistName,
        matched,
        partial,
        unmatched,
        stats: {
          total: allQueries.length,
          found: matched.length + partial.length,
          notFound: unmatched.length,
        },
      };

      // Cache 30 min
      await redisSet(cacheKey, JSON.stringify(finalResult), 1800);

      emit("progress", {
        step: "done",
        message: `Found ${finalResult.stats.found} songs!`,
        percent: 100,
      });
      if (isSSE) {
        emit("done", finalResult);
        res.end();
      } else {
        res.json(finalResult);
      }
    } catch (err) {
      console.error("[AI] Build playlist error:", err);
      const errMsg = { error: "AI playlist generation failed" };
      if (res.headersSent) {
        sseEvent(res, "error", errMsg);
        res.end();
      } else {
        res.status(500).json(errMsg);
      }
    }
  },
);

export default router;
