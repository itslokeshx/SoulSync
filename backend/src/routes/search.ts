import { Router, Response } from "express";
import axios from "axios";
import { enhancedSearch } from "../services/searchEnhancer.js";
import {
  Song,
  normalizeSongToCanonical,
  normalizeSongsToCanonical,
  searchSongsHybrid,
  searchSongs,
  searchAll,
  searchAlbums,
  searchArtists,
  searchPodcasts,
  fetchArtistSongs,
  fetchAlbumSongs,
  fetchSongById,
  fetchSongsByIds,
  getSuggestions,
  getTopSearches,
  getArtistDetails,
  getAlbumDetails,
  markUserQueryStart,
  markUserQueryEnd,
  resolveRealStreamUrl,
  getStreamProxyUrl,
} from "../services/youtubeMusicService.js";
import { redisGet, redisSet } from "../services/redis.js";
import {
  rankSongs,
  dedupSongs,
  buildSearchQueries,
  getKnownSongIds,
  type RankedSong,
} from "../services/searchRanker.js";
import { softAuth } from "../middleware/softAuth.js";
import { getNextRecommendations } from "../services/recommendationEngine.js";

const router = Router();

router.get("/", async (req: any, res: Response): Promise<void> => {
  const q = String(req.query.q || "").trim();
  const lang = String(req.query.lang || "").toLowerCase();
  const filter = req.query.filter ? String(req.query.filter).toLowerCase() : undefined;
  const limit = Math.min(Number(req.query.limit || 60), 100);

  if (!q) {
    res.json({ songs: [], artists: [], albums: [], query: "" });
    return;
  }

  const t0 = performance.now();
  const timings: any = {};

  const cacheKey = `search:v8:${q.toLowerCase()}:${lang}:${filter || "all"}`;
  try {
    const tCache = performance.now();
    const hit = await redisGet(cacheKey);
    timings.redisCacheCheck = performance.now() - tCache;
    
    if (hit) {
      const cached = JSON.parse(hit);
      // Re-apply limit so a low-limit prefetch never poisons a high-limit request
      if (Array.isArray(cached.songs) && cached.songs.length > limit) {
        cached.songs = cached.songs.slice(0, limit);
        cached.total = cached.songs.length;
      }
      cached._timings = timings;
      res.json(cached);
      return;
    }
  } catch {
    /* miss */
  }

  const { queries, knownArtist } = buildSearchQueries(q);
  const [primaryQuery, ...fallbackQueries] = queries;

  const reqBaseUrl = `${req.protocol}://${req.get("host")}`;

  markUserQueryStart();
  try {
    const tParallel = performance.now();

    const pinnedIds = getKnownSongIds(q);
    const wordCount = q.trim().split(/\s+/).length;
    const hasArtistTrigger =
      /songs?|hits?|latest|recent|best|top|tracks?|music/i.test(q);
    const isArtistQuery = wordCount <= 3 || hasArtistTrigger;

    const parallelTasks: Promise<any>[] = [];
    const taskIndex: Record<string, number> = {};
    let idx = 0;

    const track = (name: string, promise: Promise<any>) => {
      taskIndex[name] = idx++;
      parallelTasks.push(promise);
    };

    if (pinnedIds.length) {
      track("pinned", fetchSongsByIds(pinnedIds, reqBaseUrl));
    }

    if (!filter || filter === "songs") {
      track("hybrid", searchSongsHybrid(primaryQuery, 50, knownArtist));
      track("fallbacks", Promise.allSettled(
        fallbackQueries.slice(0, 2).map((fq) => searchSongs(fq, 30)),
      ));
    }

    if (!filter) {
      track("all", searchAll(q, reqBaseUrl));
      track("artists", searchArtists(q, 5));
    } else if (filter === "artists") {
      track("artists", searchArtists(q, limit));
    } else if (filter === "albums") {
      track("albums", searchAlbums(q, limit));
    } else if (filter === "podcasts") {
      track("podcasts", searchPodcasts(q, limit));
    }

    const settled = await Promise.allSettled(parallelTasks);
    timings.parallelSearchFetch = performance.now() - tParallel;

    const get = (name: string): any => {
      const i = taskIndex[name];
      if (i === undefined) return null;
      const r = settled[i];
      return r.status === "fulfilled" ? r.value : null;
    };

    const rawSongs: any[] = [];
    const seenIds = new Set<string>();
    const addSongs = (songs: any[]) => {
      for (const s of songs) {
        const id = String(s.id || s.songId || "").trim();
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          rawSongs.push(s);
        }
      }
    };

    const pinnedSongs = get("pinned");
    if (pinnedSongs) addSongs(pinnedSongs);

    const hybridVal = get("hybrid");
    if (hybridVal) addSongs(hybridVal);

    const fallbackVal = get("fallbacks");
    if (fallbackVal) {
      for (const r of fallbackVal) {
        if (r.status === "fulfilled") addSongs(r.value);
      }
    }

    const allVal = get("all");
    if (allVal) addSongs(allVal.songs);

    const artistMap = new Map<string, any>();
    const allResArtists = allVal ? allVal.artists : [];
    const directArtists: any[] = get("artists") || [];
    for (const a of [...allResArtists, ...directArtists]) {
      const id = String(a.id || "");
      if (id && !artistMap.has(id)) artistMap.set(id, a);
    }
    const artists = Array.from(artistMap.values()).slice(0, 8);

    const tEnrich = performance.now();
    if (artists.length > 0 && isArtistQuery) {
      const topArtists = artists.slice(0, 2);
      const artistSongsRes = await Promise.allSettled(
        topArtists.map((a) => fetchArtistSongs(String(a.id || ""), 0)),
      );
      for (const r of artistSongsRes) {
        if (r.status === "fulfilled") addSongs(r.value);
      }
    }
    timings.artistEnrichment = performance.now() - tEnrich;

    const albums = allVal
      ? allVal.albums
      : get("albums") || (filter === "albums" ? [] : await searchAlbums(q, 5).catch(() => []));

    const podcasts = allVal
      ? allVal.podcasts
      : get("podcasts") || (filter === "podcasts" ? [] : await searchPodcasts(q, 5).catch(() => []));

    const normalized = normalizeSongsToCanonical(rawSongs, reqBaseUrl);
    const deduped = dedupSongs(normalized as RankedSong[]) as Song[];
    const ranked = rankSongs(
      deduped as RankedSong[],
      q,
      lang || undefined,
      knownArtist ?? undefined,
    ) as Song[];
    // Cache the full ranked pool (up to 100) so any future request can get its own limit
    const allSongs = ranked.slice(0, 100);
    const songs = allSongs.slice(0, limit);

    const relatedSearches = generateRelatedSearches(q, artists, songs);

    const result = {
      query: q,
      songs: allSongs, // cache full pool
      artists,
      albums,
      podcasts,
      topResult: allSongs[0] ?? null,
      total: allSongs.length,
      parsedIntent: { displayContext: `Results for "${q}"` },
      relatedSearches,
    };

    timings.totalTime = performance.now() - t0;
    
    // Smart TTL: short queries cached longer (popular), long tail shorter
    const ttl = wordCount <= 2 ? 3600 : wordCount >= 5 ? 180 : 600;
    
    const tCacheWrite = performance.now();
    await redisSet(cacheKey, JSON.stringify(result), ttl).catch(() => {});
    timings.cacheWrite = performance.now() - tCacheWrite;

    const trimSong = (s: any) => {
      const { downloadUrl, ...rest } = s;
      return rest;
    };
    const trimmedSongs = songs.map(trimSong);
    const trimmedTop = result.topResult ? trimSong(result.topResult) : null;
    
    res.json({ ...result, songs: trimmedSongs, topResult: trimmedTop, total: trimmedSongs.length, _timings: timings });
  } finally {
    markUserQueryEnd();
  }
});

router.get("/smart", async (req: any, res: Response): Promise<void> => {
  const { q } = req.query as { q: string };
  if (!q || q.trim().length < 1) {
    res.status(400).json({ error: "Query required" });
    return;
  }
  try {
    markUserQueryStart();
    const result = await enhancedSearch(q, "all", 50);
    res.json(result);
  } catch (err) {
    console.error("Search error:", err);
    res
      .status(500)
      .json({ error: "Search failed", songs: [], albums: [], artists: [] });
  } finally {
    markUserQueryEnd();
  }
});

router.get("/related", async (req: any, res: Response): Promise<void> => {
  try {
    markUserQueryStart();
    const songId = req.query.songId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    if (!songId) {
      res.status(400).json({ error: "Song ID required" });
      return;
    }
    const suggestions = await getSuggestions(songId, limit);
    res.json({ songId, limit, total: suggestions.length, songs: suggestions });
  } catch (err) {
    console.error("[Search] Related songs error:", err);
    res.status(500).json({ error: "Failed to fetch related songs" });
  } finally {
    markUserQueryEnd();
  }
});

// ── generateRelatedSearches ─────────────────────────────────────────────────
function generateRelatedSearches(
  q: string,
  artists: any[],
  songs: any[],
): string[] {
  const related: string[] = [];
  const base = q.trim().toLowerCase();

  // Artist-based: "<artist> best songs", "<artist> latest"
  const topArtist =
    artists[0]?.name || songs[0]?.primaryArtists?.split(", ")[0];
  if (topArtist) {
    related.push(`${topArtist} best songs`);
    related.push(`${topArtist} latest songs`);
  }

  // Mood/genre augmentations
  if (!/sad|party|chill|romantic|happy/i.test(base)) {
    related.push(`${base} sad songs`);
    related.push(`${base} party songs`);
  }
  if (!/hindi|english|punjabi|tamil/i.test(base)) {
    related.push(`${base} hindi`);
  }

  // De-dup and remove the original query
  return Array.from(new Set(related))
    .filter((r) => r.toLowerCase() !== base)
    .slice(0, 6);
}

router.get("/suggestions", async (req: any, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 2) {
      const top = await getTopSearches();
      res.json({
        suggestions: top.slice(0, 8).map((t: any) => ({
          type: "query",
          text: t.title || t.name || t,
          query: t.title || t.name || t,
        })),
      });
      return;
    }

    const cacheKey = `suggest:v2:${q.toLowerCase()}`;
    try {
      const hit = await redisGet(cacheKey);
      if (hit) {
        res.json(JSON.parse(hit));
        return;
      }
    } catch {
      /* miss */
    }

    // Parallel: songs + artists for rich suggestions
    const [songsRes, artistsRes] = await Promise.allSettled([
      searchSongs(q, 5),
      searchArtists(q, 3),
    ]);

    const suggestions: any[] = [];

    // Artist entries first (highest intent match)
    if (artistsRes.status === "fulfilled") {
      for (const a of (artistsRes.value as any[]).slice(0, 3)) {
        suggestions.push({
          type: "artist",
          text: a.name || a.title || "",
          subtext: "Artist",
          id: a.id || "",
          image: Array.isArray(a.image)
            ? a.image.find((i: any) => i.quality === "500x500")?.url ||
              a.image[0]?.url
            : a.image || "",
          query: a.name || a.title || "",
        });
      }
    }

    // Song entries
    if (songsRes.status === "fulfilled") {
      const normalized = normalizeSongsToCanonical(songsRes.value as any[]);
      for (const s of normalized.slice(0, 4)) {
        suggestions.push({
          type: "song",
          text: s.name || "",
          subtext: s.primaryArtists || "",
          id: s.id || "",
          image: Array.isArray(s.image)
            ? s.image.find((i: any) => i.quality === "500x500")?.url ||
              s.image[0]?.url
            : s.image || "",
          query: s.name || "",
        });
      }
    }

    const payload = { suggestions: suggestions.slice(0, 7) };
    await redisSet(cacheKey, JSON.stringify(payload), 30).catch(() => {});
    res.json(payload);
  } catch {
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

router.get("/stream", async (req: any, res: Response): Promise<void> => {
  const { id } = req.query;
  if (!id) {
    res.status(400).json({ error: "ID required" });
    return;
  }
  try {
    const realUrl = await resolveRealStreamUrl(id as string);
    if (!realUrl) {
      res.status(404).json({ error: "Stream not found" });
      return;
    }
    // Perform 302 redirection to the deciphered YouTube stream URL.
    // The browser will follow this redirect and stream it directly from Google Video.
    res.redirect(302, realUrl);
  } catch (err: any) {
    console.error("[Stream] Error redirecting to stream:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to resolve stream redirect" });
    }
  }
});

router.get("/stream-url", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const reqBaseUrl = `${req.protocol}://${req.get("host")}`;
    const song = await fetchSongById(id as string, reqBaseUrl);
    if (!song) return res.status(404).json({ error: "Song not found" });
    res.json({
      streamUrl: song.streamUrl,
      downloadUrl: song.downloadUrl,
      song,
    });
  } catch {
    res.status(500).json({ error: "Failed to resolve stream URL" });
  }
});

router.get("/song", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const reqBaseUrl = `${req.protocol}://${req.get("host")}`;
    res.json(await fetchSongById(id as string, reqBaseUrl));
  } catch {
    res.status(500).json({ error: "Failed to fetch song" });
  }
});

// Param-style artist routes (must come BEFORE query-param routes to avoid :id matching "songs")
router.get("/artist/songs", async (req: any, res: Response) => {
  const { id, page } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const startPage = parseInt(page as string) || 0;
    // Fetch 6 pages in parallel → ~60 songs (10 per page from wrapper API)
    res.json(await fetchArtistSongs(id as string, startPage, 6));
  } catch {
    res.status(500).json({ error: "Failed to fetch artist songs" });
  }
});

router.get("/artist/:id", async (req: any, res: Response) => {
  try {
    const startPage = Number(req.query.page ?? 0);
    // Fetch 6 pages in parallel → ~60 songs
    const songs = await fetchArtistSongs(req.params.id, startPage, 6);
    res.json({ songs, artistId: req.params.id });
  } catch (err: any) {
    console.error("[Search] artist songs error:", err.message);
    res.status(500).json({ error: err.message, songs: [] });
  }
});

router.get("/artist", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const cacheKey = `artist:v1:${id}`;
    const hit = await redisGet(cacheKey);
    if (hit) {
      return res.json(JSON.parse(hit));
    }
    const details = await getArtistDetails(id as string);
    if (details) {
      await redisSet(cacheKey, JSON.stringify(details), 86400).catch(() => {});
    }
    res.json(details);
  } catch {
    res.status(500).json({ error: "Failed to fetch artist" });
  }
});

// Album routes
router.get("/album/songs", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    res.json(await fetchAlbumSongs(id as string));
  } catch {
    res.status(500).json({ error: "Failed to fetch album songs" });
  }
});

router.get("/album/:id", async (req: any, res: Response) => {
  try {
    const songs = await fetchAlbumSongs(req.params.id);
    res.json({ songs, albumId: req.params.id });
  } catch (err: any) {
    console.error("[Search] album songs error:", err.message);
    res.status(500).json({ error: err.message, songs: [] });
  }
});

router.get("/album", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    res.json(await getAlbumDetails(id as string));
  } catch {
    res.status(500).json({ error: "Failed to fetch album" });
  }
});

// ── GET /autoplay/:songId ────────────────────────────────────────────────────
// Returns up to 10 suggested songs for a given song ID, using the taste-profile recommendation engine.
router.get("/autoplay/:songId", softAuth, async (req: any, res: Response): Promise<void> => {
  const { songId } = req.params;
  if (!songId) {
    res.status(400).json({ error: "Song ID required" });
    return;
  }

  try {
    const recommendedSongs = await getNextRecommendations(songId, req.userId);
    // Limit to 10 to match previous response size and fit preview UI
    const songs = recommendedSongs.slice(0, 10);
    res.json({ songs });
  } catch (err) {
    console.error("[Search] Autoplay error:", err);
    res.status(500).json({ error: "Failed to fetch autoplay suggestions", songs: [] });
  }
});

export default router;
