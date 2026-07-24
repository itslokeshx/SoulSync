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
  decodeHtmlEntities,
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
import { SoftAuthRequest, softAuth } from "../middleware/softAuth.js";
import { getTasteProfile, getNextRecommendations } from "../services/recommendationEngine.js";
import { User } from "../models/User.js";
import { recordSearchClick, recordPlaybackTelemetry } from "../services/telemetryStore.js";

const router = Router();

router.get("/", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  const q = String(req.query.q || "").trim();
  const lang = String(req.query.lang || "").toLowerCase();
  const limit = Math.min(Number(req.query.limit || 60), 100);

  if (!q) {
    res.json({ songs: [], artists: [], albums: [], query: "" });
    return;
  }

  const userId = req.userId;
  const cacheKey = `search:v8:${q.toLowerCase()}:${lang}:${userId || "guest"}`;
  try {
    const hit = await redisGet(cacheKey);
    if (hit) {
      const cached = JSON.parse(hit);
      if (Array.isArray(cached.songs) && cached.songs.length > limit) {
        cached.songs = cached.songs.slice(0, limit);
        cached.total = cached.songs.length;
      }
      res.json(cached);
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
    // hybridRes     → direct jiosaavn.com (popularity-ranked)
    // fallbackRes   → wrapper /search/songs (covers, regional)
    // allRes        → wrapper /search (artists + albums + top query songs)
    // artistRes     → wrapper /search/artists (accurate artist IDs)
    // directAlbumRes→ wrapper /search/albums (50+ discography albums)
    const [hybridRes, fallbackRes, allRes, artistRes, directAlbumRes] =
      await Promise.allSettled([
        searchSongsHybrid(primaryQuery, 50, knownArtist),
        Promise.allSettled(
          fallbackQueries.slice(0, 2).map((fq) => searchSongs(fq, 30)),
        ),
        searchAll(q),
        searchArtists(q, 8),
        searchAlbums(q, 50),
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

    // Merge albums from searchAll + searchAlbums
    const albumMap = new Map<string, any>();
    const allResAlbums = allRes.status === "fulfilled" ? allRes.value.albums : [];
    const directAlbums = directAlbumRes.status === "fulfilled" ? directAlbumRes.value : [];

    for (const alb of [...allResAlbums, ...directAlbums]) {
      const id = String(alb.id || "");
      if (id && !albumMap.has(id)) {
        albumMap.set(id, {
          ...alb,
          name: decodeHtmlEntities(alb.name || alb.title || ""),
          primaryArtists: decodeHtmlEntities(alb.primaryArtists || alb.artist || "Various Artists")
        });
      }
    }

    const tempAlbums = Array.from(albumMap.values());

    // Enrich artists from top album & song primary artists first
    const extractedNames = new Set<string>();
    for (const alb of tempAlbums.slice(0, 5)) {
      const names = (alb.primaryArtists || alb.artist || "").split(",");
      for (const n of names) {
        const cleanN = n.trim();
        if (cleanN && cleanN !== "Various Artists" && cleanN !== "Unknown Artist") {
          extractedNames.add(cleanN);
        }
      }
    }
    for (const s of rawSongs.slice(0, 5)) {
      const names = (s.primaryArtists || s.artist || "").split(",");
      for (const n of names) {
        const cleanN = n.trim();
        if (cleanN && cleanN !== "Various Artists" && cleanN !== "Unknown Artist") {
          extractedNames.add(cleanN);
        }
      }
    }

    // Always fetch official artist cards for extracted soundtrack artists first
    const verifiedSoundtrackArtists: any[] = [];
    if (extractedNames.size > 0) {
      try {
        const extraArtistRes = await Promise.allSettled(
          Array.from(extractedNames).slice(0, 4).map((name) => searchArtists(name, 2))
        );
        for (const r of extraArtistRes) {
          if (r.status === "fulfilled" && Array.isArray(r.value) && r.value.length > 0) {
            const first = r.value[0];
            if (first && first.id) verifiedSoundtrackArtists.push(first);
          }
        }
      } catch {}
    }

    // Function to extract canonical base name (e.g. "Anirudh Ravichander" from "Anirudh Ravichander Feat. Dhanush")
    const getCanonicalArtistName = (name: string): string => {
      if (!name) return "";
      return decodeHtmlEntities(name)
        .replace(/\s*feat\..*$/i, "")
        .replace(/\s*ft\..*$/i, "")
        .replace(/\s*featuring.*$/i, "")
        .replace(/\s*&.*$/i, "")
        .replace(/\s*x\s+.*$/i, "")
        .replace(/\s*,.*$/i, "")
        .trim()
        .toLowerCase();
    };

    const artistMap = new Map<string, any>();
    const seenCanonicalArtists = new Set<string>();

    const addArtistIfClean = (a: any, isExtracted = false) => {
      const id = String(a.id || "");
      if (!id || artistMap.has(id)) return false;

      const rawName = decodeHtmlEntities(a.name || a.title || "").trim();
      if (!rawName) return false;

      const canonicalBase = getCanonicalArtistName(rawName);
      const isFeatVariant = /\b(feat|ft|featuring|&)\b/i.test(rawName);

      // Discard "Feat. X & Y" sub-variant junk cards if the main artist is already present
      if (isFeatVariant && seenCanonicalArtists.has(canonicalBase)) {
        return false;
      }

      // Check query relevance if not explicitly extracted
      if (!isExtracted) {
        const qLower = q.toLowerCase().trim();
        const aNameLower = rawName.toLowerCase();
        const isExactOrPrefix = aNameLower === qLower || aNameLower.startsWith(qLower) || qLower.startsWith(aNameLower);
        const isExtractedMatch = extractedNames.has(rawName) || extractedNames.has(canonicalBase);

        if (!isExactOrPrefix && !isExtractedMatch) {
          return false;
        }
      }

      seenCanonicalArtists.add(canonicalBase);
      artistMap.set(id, { ...a, name: rawName });
      return true;
    };

    // Add verified soundtrack primary artists FIRST
    for (const a of verifiedSoundtrackArtists) {
      addArtistIfClean(a, true);
    }

    const allResArtists =
      allRes.status === "fulfilled" ? allRes.value.artists : [];
    const directArtists: any[] =
      artistRes.status === "fulfilled" ? artistRes.value : [];

    for (const a of [...allResArtists, ...directArtists]) {
      addArtistIfClean(a, false);
    }

    // Fallback if strict filter yields < 2 artists
    if (artistMap.size < 2) {
      for (const a of [...allResArtists, ...directArtists]) {
        const id = String(a.id || "");
        if (id && !artistMap.has(id)) {
          artistMap.set(id, { ...a, name: decodeHtmlEntities(a.name || a.title || "") });
        }
      }
    }

    const artists = Array.from(artistMap.values()).slice(0, 8);

    // If top artist exists, fetch top artist's dedicated discography albums and merge them!
    if (artists.length > 0) {
      try {
        const topArtistDetails = await getArtistDetails(String(artists[0].id)).catch(() => null);
        const artistAlbums = topArtistDetails?.albums || topArtistDetails?.top_albums || [];
        for (const alb of artistAlbums) {
          const id = String(alb.id || "");
          if (id && !albumMap.has(id)) {
            albumMap.set(id, {
              id,
              name: decodeHtmlEntities(alb.name || alb.title || ""),
              image: Array.isArray(alb.image)
                ? alb.image.find((i: any) => i.quality === "500x500")?.url || alb.image[alb.image.length - 1]?.url || "/placeholder.png"
                : typeof alb.image === "string" ? alb.image : "/placeholder.png",
              year: String(alb.year || ""),
              primaryArtists: decodeHtmlEntities(alb.artist || alb.primaryArtists || artists[0].name || "Various Artists"),
              url: alb.url || ""
            });
          }
        }
      } catch {}
    }

    const albums = Array.from(albumMap.values()).slice(0, 50);

    let userContext: any = undefined;
    if (userId) {
      try {
        const [tasteProfile, userDoc] = await Promise.all([
          getTasteProfile(userId),
          User.findById(userId).select("likedSongs preferences").lean(),
        ]);
        userContext = {
          favoriteArtists: new Set((tasteProfile?.artists || []).map((a: any) => a.artistName.toLowerCase())),
          preferredLanguages: new Set([
            ...(tasteProfile?.languages || []).map((l: any) => l.language.toLowerCase()),
            ...(userDoc?.preferences?.languages || []).map((l: string) => l.toLowerCase()),
          ]),
          likedSongIds: new Set((userDoc?.likedSongs || []).map((s: any) => s.songId).filter(Boolean)),
        };
      } catch {}
    }

    const normalized = normalizeSongsToCanonical(rawSongs);
    const deduped = dedupSongs(normalized as RankedSong[]) as Song[];
    const ranked = rankSongs(
      deduped as RankedSong[],
      q,
      lang || undefined,
      knownArtist ?? undefined,
      userContext,
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
      topResult: allSongs[0] ?? null,
      total: allSongs.length,
      parsedIntent: { displayContext: `Results for "${q}"` },
      relatedSearches,
    };

    // Smart TTL: short queries cached longer (popular), long tail shorter
    const wordCount = q.trim().split(/\s+/).length;
    const ttl = wordCount <= 2 ? 3600 : wordCount >= 5 ? 180 : 600;
    await redisSet(cacheKey, JSON.stringify(result), ttl).catch(() => {});
    res.json({ ...result, songs, total: songs.length });
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

// ── POST /click — Log SearchClickEvent ───────────────────────────────────────
router.post("/click", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  try {
    const { searchQuery, songId, position = 0 } = req.body;
    if (!searchQuery || !songId) {
      res.status(400).json({ error: "searchQuery and songId required" });
      return;
    }
    await recordSearchClick(searchQuery, songId, position, req.userId);
    res.json({ success: true, message: "Search click telemetry recorded" });
  } catch (err) {
    console.error("[Search] Click telemetry error:", err);
    res.status(500).json({ error: "Failed to record click telemetry" });
  }
});

// ── POST /telemetry — Log PlaybackEvent ──────────────────────────────────────
router.post("/telemetry", softAuth, async (req: SoftAuthRequest, res: Response): Promise<void> => {
  try {
    const { songId, searchQuery, eventType = "finished", completionPercent = 100, durationSeconds = 0 } = req.body;
    if (!songId) {
      res.status(400).json({ error: "songId required" });
      return;
    }
    await recordPlaybackTelemetry({
      songId,
      searchQuery,
      eventType,
      completionPercent,
      durationSeconds,
      userId: req.userId,
    });
    res.json({ success: true, message: "Playback telemetry recorded" });
  } catch (err) {
    console.error("[Search] Playback telemetry error:", err);
    res.status(500).json({ error: "Failed to record playback telemetry" });
  }
});

export default router;
