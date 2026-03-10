import { Router, Response } from "express";
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
} from "../services/jiosaavn.js";
import { redisGet, redisSet } from "../services/redis.js";
import {
  rankSongs,
  dedupSongs,
  buildSearchQueries,
  getKnownSongIds,
  type RankedSong,
} from "../services/searchRanker.js";

const router = Router();

router.get("/", async (req: any, res: Response): Promise<void> => {
  const q = String(req.query.q || "").trim();
  const lang = String(req.query.lang || "").toLowerCase();
  const limit = Math.min(Number(req.query.limit || 60), 60);

  if (!q) {
    res.json({ songs: [], artists: [], albums: [], query: "" });
    return;
  }

  const cacheKey = `search:v8:${q.toLowerCase()}:${lang}`;
  try {
    const hit = await redisGet(cacheKey);
    if (hit) {
      res.json(JSON.parse(hit));
      return;
    }
  } catch {
    /* miss */
  }

  const { queries, knownArtist } = buildSearchQueries(q);
  const [primaryQuery, ...fallbackQueries] = queries;

  markUserQueryStart();
  try {
    // Phase 0: Inject pinned songs for known queries ───────────────
    // These are real JioSaavn IDs that wrapper search never surfaces
    // (e.g. Ed Sheeran's "Shape of You" is buried by covers).
    // Fetched directly by ID — always in the pool before ranking.
    const pinnedIds = getKnownSongIds(q);
    const pinnedSongs = pinnedIds.length
      ? await fetchSongsByIds(pinnedIds)
      : [];
    // Phase 1: all in parallel ─────────────────────────────────────
    // hybridRes  → direct jiosaavn.com (popularity-ranked, Ed Sheeran, Ranjini etc.)
    // fallbackRes→ wrapper /search/songs (covers, regional)
    // allRes     → wrapper /search (artists + albums + top query songs)
    // artistRes  → wrapper /search/artists (accurate artist IDs for enrichment)
    const [hybridRes, fallbackRes, allRes, artistRes] =
      await Promise.allSettled([
        searchSongsHybrid(primaryQuery, 50, knownArtist),
        Promise.allSettled(
          fallbackQueries.slice(0, 2).map((fq) => searchSongs(fq, 30)),
        ),
        searchAll(q),
        searchArtists(q, 5),
      ]);

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

    // Always add pinned songs first so they're guaranteed in the pool
    addSongs(pinnedSongs);

    if (hybridRes.status === "fulfilled") addSongs(hybridRes.value);
    if (fallbackRes.status === "fulfilled") {
      for (const r of fallbackRes.value) {
        if (r.status === "fulfilled") addSongs(r.value);
      }
    }
    if (allRes.status === "fulfilled") addSongs(allRes.value.songs);

    // Merge artists from /search + /search/artists, dedup by ID
    const artistMap = new Map<string, any>();
    const allResArtists =
      allRes.status === "fulfilled" ? allRes.value.artists : [];
    const directArtists: any[] =
      artistRes.status === "fulfilled" ? artistRes.value : [];
    for (const a of [...allResArtists, ...directArtists]) {
      const id = String(a.id || "");
      if (id && !artistMap.has(id)) artistMap.set(id, a);
    }
    const artists = Array.from(artistMap.values()).slice(0, 8);

    // Phase 2: Artist song enrichment ────────────────────────────
    // For queries that look like artist searches ("ranjini songs", "arijit singh hits",
    // "ed sheeran", short names etc.) fetch the artist's popularity-sorted songs
    // and add them to the pool so the user sees real songs, not just artist chips.
    const wordCount = q.trim().split(/\s+/).length;
    const hasArtistTrigger =
      /songs?|hits?|latest|recent|best|top|tracks?|music/i.test(q);
    const isArtistQuery = wordCount <= 3 || hasArtistTrigger;

    if (artists.length > 0 && isArtistQuery) {
      const topArtists = artists.slice(0, 2);
      const artistSongsRes = await Promise.allSettled(
        topArtists.map((a) => fetchArtistSongs(String(a.id || ""), 0)),
      );
      for (const r of artistSongsRes) {
        if (r.status === "fulfilled") addSongs(r.value);
      }
    }

    const albums =
      allRes.status === "fulfilled"
        ? allRes.value.albums
        : await searchAlbums(q, 5).catch(() => []);

    const normalized = normalizeSongsToCanonical(rawSongs);
    const deduped = dedupSongs(normalized as RankedSong[]) as Song[];
    const ranked = rankSongs(
      deduped as RankedSong[],
      q,
      lang || undefined,
      knownArtist ?? undefined,
    ) as Song[];
    const songs = ranked.slice(0, limit);

    const result = {
      query: q,
      songs,
      artists,
      albums,
      topResult: songs[0] ?? null,
      total: songs.length,
      parsedIntent: { displayContext: `Results for "${q}"` },
      relatedSearches: [],
    };

    await redisSet(cacheKey, JSON.stringify(result), 600).catch(() => {});
    res.json(result);
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

router.get("/suggestions", async (req: any, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim().length < 2) {
      const top = await getTopSearches();
      res.json({ suggestions: top.map((t: any) => t.title || t.name) });
      return;
    }
    const results = await searchSongs(q.trim(), 8);
    const normalized = normalizeSongsToCanonical(results);
    const suggestions = Array.from(
      new Set(normalized.flatMap((s) => [s.name, s.primaryArtists])),
    ).slice(0, 10);
    res.json({ suggestions });
  } catch {
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

router.get("/stream-url", async (req: any, res: Response) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "ID required" });
  try {
    const song = await fetchSongById(id as string);
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
    res.json(await fetchSongById(id as string));
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
    res.json(await getArtistDetails(id as string));
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

export default router;
