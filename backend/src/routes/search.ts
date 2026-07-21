import { Router, Response } from "express";
import axios from "axios";
import { enhancedSearch } from "../services/searchEnhancer.js";
import {
  Song,
  normalizeSongToCanonical,
  normalizeSongsToCanonical,
  searchSongsHybrid,
  searchSongs,
  searchGeneral,
  searchAll,
  searchAlbums,
  searchArtists,
  searchPodcasts,
  searchEpisodes,
  searchPlaylists,
  searchVideos,
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
  upgradeYTImageQuality,
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(fallback);
    }, timeoutMs);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }),
    timeoutPromise,
  ]);
}

router.get("/", async (req: any, res: Response): Promise<void> => {
  const q = String(req.query.q || "").trim();
  const lang = String(req.query.lang || "").toLowerCase();
  const filter = req.query.filter ? String(req.query.filter).toLowerCase() : undefined;
  const limit = Math.min(Number(req.query.limit || 50), 100);

  if (!q) {
    res.json({ songs: [], videos: [], artists: [], albums: [], playlists: [], podcasts: [], query: "" });
    return;
  }

  const t0 = performance.now();
  const timings: any = {};

  const cacheKey = `search:v12:${q.toLowerCase()}:${lang}:${filter || "all"}`;
  try {
    const tCache = performance.now();
    const hit = await redisGet(cacheKey);
    timings.redisCacheCheck = performance.now() - tCache;
    
    if (hit) {
      const cached = JSON.parse(hit);
      cached._timings = timings;
      console.log(`[PerfAudit] Search cache hit: q="${q}" filter="${filter || "all"}" | redisCacheCheck=${timings.redisCacheCheck.toFixed(2)}ms`);
      res.json(cached);
      return;
    }
  } catch {
  }

  const { queries, knownArtist } = buildSearchQueries(q);
  const [primaryQuery, ...fallbackQueries] = queries;
  const reqBaseUrl = `${req.protocol}://${req.get("host")}`;

  markUserQueryStart();
  try {
    const tParallel = performance.now();
    const pinnedIds = getKnownSongIds(q);

    const parallelTasks: Promise<any>[] = [];
    const taskIndex: Record<string, number> = {};
    let idx = 0;

    const track = (name: string, promise: Promise<any>) => {
      taskIndex[name] = idx++;
      parallelTasks.push(withTimeout(promise, 10000, []));
    };

    if (pinnedIds.length) {
      track("pinned", fetchSongsByIds(pinnedIds, reqBaseUrl));
    }

    if (!filter) {
      track("general", searchGeneral(primaryQuery, 15));
      track("songs", searchSongs(primaryQuery, 30));
      track("fallbacks", Promise.allSettled(
        fallbackQueries.slice(0, 1).map((fq) => searchSongs(fq, 20)),
      ));
      track("artists", searchArtists(q, 8));
      track("albums", searchAlbums(q, 8));
      track("playlists", searchPlaylists(q, 8));
      track("podcasts", searchPodcasts(q, 8));
      track("episodes", searchEpisodes(q, 12));
      track("videos", searchVideos(q, 15));
    } else if (filter === "songs") {
      track("songs", searchSongsHybrid(primaryQuery, limit, knownArtist));
      track("fallbacks", Promise.allSettled(
        fallbackQueries.slice(0, 2).map((fq) => searchSongs(fq, limit)),
      ));
    } else if (filter === "videos") {
      track("videos", searchVideos(q, limit));
    } else if (filter === "artists") {
      track("artists", searchArtists(q, limit));
    } else if (filter === "albums") {
      track("albums", searchAlbums(q, limit));
    } else if (filter === "playlists") {
      track("playlists", searchPlaylists(q, limit));
    } else if (filter === "podcasts") {
      track("podcasts", searchPodcasts(q, limit));
      track("episodes", searchEpisodes(q, limit));
    } else if (filter === "episodes") {
      track("episodes", searchEpisodes(q, limit));
    }

    const settled = await Promise.allSettled(parallelTasks);
    timings.parallelSearchFetch = performance.now() - tParallel;

    const get = (name: string): any => {
      const i = taskIndex[name];
      if (i === undefined) return null;
      const r = settled[i];
      return r.status === "fulfilled" ? r.value : null;
    };

    let songs: Song[] = [];
    if (!filter || filter === "songs") {
      const rawSongs: any[] = [];
      const seenIds = new Set<string>();
      const addSongs = (list: any[]) => {
        for (const s of list) {
          const id = String(s.id || s.songId || s.videoId || "").trim();
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            rawSongs.push(s);
          }
        }
      };

      const pinnedSongs = get("pinned");
      if (pinnedSongs) addSongs(pinnedSongs);

      const songsVal = get("songs");
      if (songsVal) addSongs(songsVal);

      const generalVal = get("general");
      if (generalVal) addSongs(generalVal);

      const fallbackVal = get("fallbacks");
      if (fallbackVal) {
        for (const r of fallbackVal) {
          if (r.status === "fulfilled") addSongs(r.value);
        }
      }

      const normalized = normalizeSongsToCanonical(rawSongs, reqBaseUrl);
      const deduped = dedupSongs(normalized as RankedSong[]) as Song[];
      const ranked = rankSongs(
        deduped as RankedSong[],
        q,
        lang || undefined,
        knownArtist ?? undefined,
      ) as Song[];

      songs = ranked.filter(s => !/reaction|review|interview|trailer|teaser|vlog|making\s*of|press\s*meet|behind\s*the\s*scenes/i.test(s.name || ""));
    }

    let videos: Song[] = [];
    if (!filter || filter === "videos") {
      const rawVideos = get("videos") || [];
      videos = normalizeSongsToCanonical(rawVideos, reqBaseUrl);
    }

    let artists: any[] = [];
    if (!filter || filter === "artists") {
      artists = get("artists") || [];
    }

    let albums: any[] = [];
    if (!filter || filter === "albums") {
      albums = get("albums") || [];
    }

    let playlists: any[] = [];
    if (!filter || filter === "playlists") {
      playlists = get("playlists") || [];
    }

    let podcasts: any[] = [];
    if (!filter || filter === "podcasts") {
      podcasts = get("podcasts") || [];
    }

    let episodes: Song[] = [];
    if (!filter || filter === "podcasts" || filter === "episodes") {
      const rawEpisodes = get("episodes") || [];
      episodes = normalizeSongsToCanonical(rawEpisodes, reqBaseUrl) as Song[];
    }

    let topResult: any = null;
    if (!filter) {
      const candidates: any[] = [];
      const generalResults = get("general") || [];
      const nativeTopRaw = generalResults.find((r: any) => r.category === "Top result");
      if (nativeTopRaw) {
        let nativeTopNormalized: any = null;
        if (nativeTopRaw.resultType === "song" || nativeTopRaw.resultType === "video") {
          nativeTopNormalized = normalizeSongToCanonical(nativeTopRaw, reqBaseUrl);
        } else if (nativeTopRaw.resultType === "artist") {
          nativeTopNormalized = {
            id: nativeTopRaw.browseId,
            name: nativeTopRaw.artist || nativeTopRaw.title || "",
            type: "artist",
            resultType: "artist",
            image: upgradeYTImageQuality(nativeTopRaw.thumbnails?.[0]?.url || "/placeholder.png"),
          };
        } else if (nativeTopRaw.resultType === "album") {
          nativeTopNormalized = {
            id: nativeTopRaw.browseId,
            name: nativeTopRaw.title || "",
            type: "album",
            resultType: "album",
            artist: nativeTopRaw.artist || "",
            image: upgradeYTImageQuality(nativeTopRaw.thumbnails?.[0]?.url || "/placeholder.png"),
          };
        } else if (nativeTopRaw.resultType === "playlist") {
          nativeTopNormalized = {
            id: nativeTopRaw.playlistId || nativeTopRaw.browseId,
            name: nativeTopRaw.title || "",
            type: "playlist",
            resultType: "playlist",
            image: upgradeYTImageQuality(nativeTopRaw.thumbnails?.[0]?.url || "/placeholder.png"),
          };
        }
        if (nativeTopNormalized) {
          nativeTopNormalized.isNativeTopResult = true;
          nativeTopNormalized.views = nativeTopRaw.views;
          candidates.push(nativeTopNormalized);
        }
      }
      const songCandidates = songs.slice(0, 3);
      for (const s of songCandidates) {
        candidates.push({ ...s, type: "song", resultType: "song" });
      }
      const videoCandidates = videos.slice(0, 3);
      for (const v of videoCandidates) {
        candidates.push({ ...v, type: "video", resultType: "video" });
      }
      const artistCandidates = artists.slice(0, 3);
      for (const a of artistCandidates) {
        candidates.push({ ...a, type: "artist", resultType: "artist" });
      }
      const albumCandidates = albums.slice(0, 3);
      for (const alb of albumCandidates) {
        candidates.push({ ...alb, type: "album", resultType: "album" });
      }
      const playlistCandidates = playlists.slice(0, 3);
      for (const p of playlistCandidates) {
        candidates.push({ ...p, type: "playlist", resultType: "playlist" });
      }
      const podcastCandidates = podcasts.slice(0, 3);
      for (const pod of podcastCandidates) {
        candidates.push({ ...pod, type: "podcast", resultType: "podcast" });
      }
      const episodeCandidates = episodes.slice(0, 3);
      for (const ep of episodeCandidates) {
        candidates.push({ ...ep, type: "episode", resultType: "episode" });
      }
      const scoreCandidate = (candidate: any): number => {
        let score = 0;
        const qLower = q.toLowerCase();
        const qWords = qLower.split(/\s+/).filter((w) => w.length > 1);
        const title = (candidate.name || candidate.title || "").toLowerCase();
        const artist = (
          candidate.primaryArtists ||
          (Array.isArray(candidate.artists) ? candidate.artists.map((a: any) => a.name).join(", ") : "") ||
          candidate.artist ||
          ""
        ).toLowerCase();
        const album = (
          candidate.album && typeof candidate.album === "object"
            ? candidate.album.name
            : candidate.album || ""
        ).toLowerCase();
        const titleMatches = qWords.filter((w) => title.includes(w));
        if (qWords.length > 0) {
          score += (titleMatches.length / qWords.length) * 100;
        }
        if (title === qLower) {
          score += 50;
        } else if (title.startsWith(qLower)) {
          score += 30;
        }
        const artistMatches = qWords.filter((w) => artist.includes(w));
        score += artistMatches.length * 20;
        if (candidate.isNativeTopResult) {
          score += 200;
        }
        const isArtistEntity = candidate.resultType === "artist" || candidate.type === "artist";
        if (isArtistEntity) {
          if (title === qLower) {
            score += 150;
          } else if (title.includes(qLower) || qLower.includes(title)) {
            score += 80;
          }
        }
        const hasOfficialArtist =
          Array.isArray(candidate.artists) &&
          candidate.artists.some(
            (a: any) => a.id && (a.id.startsWith("UC") || a.id.startsWith("FE") || a.id.length > 5)
          );
        if (hasOfficialArtist) {
          score += 40;
        }
        const hasAlbum = !!(candidate.album && candidate.album !== candidate.name && candidate.albumId);
        if (hasAlbum) {
          score += 30;
        }
        const parseViewsVal = (viewsStr: any): number => {
          if (!viewsStr) return 0;
          if (typeof viewsStr === "number") return viewsStr;
          const strVal = String(viewsStr).toLowerCase().trim();
          const match = strVal.match(/^([\d.]+)\s*([kmbt]?)/);
          if (!match) return 0;
          const val = parseFloat(match[1]);
          const unit = match[2];
          if (unit === "k") return val * 1000;
          if (unit === "m") return val * 1000000;
          if (unit === "b") return val * 1000000000;
          if (unit === "t") return val * 1000000000000;
          return val;
        };
        const views = candidate.playCount || parseViewsVal(candidate.views || candidate.playCount);
        if (views > 0) {
          score += Math.min(50, Math.log10(views) * 5);
        }
        const coverKeywords = [
          "cover",
          "unplugged",
          "remix",
          "type beat",
          "instrumental",
          "karaoke",
          "remake",
          "tribute",
          "fan made",
          "fan-made",
          "unofficial",
          "lofi",
          "slowed",
          "reverb",
          "sped up",
          "bass boosted",
          "mashup",
          "medley",
        ];
        for (const kw of coverKeywords) {
          if (!qLower.includes(kw)) {
            if (title.includes(kw)) {
              score -= 150;
            }
            if (artist.includes(kw)) {
              score -= 150;
            }
            if (album.includes(kw)) {
              score -= 150;
            }
          }
        }
        return score;
      };
      if (candidates.length > 0) {
        candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
        topResult = candidates[0];
      }
    } else {
      topResult = songs[0] || videos[0] || artists[0] || albums[0] || playlists[0] || podcasts[0] || null;
      if (episodes[0]) {
        const qLower = q.toLowerCase();
        const songTitle = (songs[0]?.name || "").toLowerCase();
        const epTitle = (episodes[0]?.name || "").toLowerCase();
        const qWords = qLower.split(/\s+/).filter((w) => w.length > 2);
        const songMatchCount = qWords.filter((w) => songTitle.includes(w)).length;
        const epMatchCount = qWords.filter((w) => epTitle.includes(w)).length;
        if (epMatchCount > songMatchCount || (!songs[0] && episodes[0])) {
          topResult = episodes[0];
        }
      }
    }

    const relatedSearches = generateRelatedSearches(q, artists, songs);

    const result = {
      query: q,
      filter: filter || "all",
      songs: songs.slice(0, filter === "songs" ? limit : 20),
      videos: videos.slice(0, filter === "videos" ? limit : 20),
      artists: artists.slice(0, filter === "artists" ? limit : 10),
      albums: albums.slice(0, filter === "albums" ? limit : 10),
      playlists: playlists.slice(0, filter === "playlists" ? limit : 10),
      podcasts: podcasts.slice(0, filter === "podcasts" ? limit : 10),
      episodes: episodes.slice(0, filter === "episodes" ? limit : 10),
      topResult,
      total: songs.length + videos.length + artists.length + albums.length + playlists.length + podcasts.length + episodes.length,
      parsedIntent: { displayContext: `Results for "${q}"` },
      relatedSearches,
    };

    timings.totalTime = performance.now() - t0;
    
    const wordCount = q.trim().split(/\s+/).length;
    const ttl = wordCount <= 2 ? 3600 : wordCount >= 5 ? 180 : 600;
    
    const tCacheWrite = performance.now();
    await redisSet(cacheKey, JSON.stringify(result), ttl).catch(() => {});
    timings.cacheWrite = performance.now() - tCacheWrite;

    console.log(`[PerfAudit] Search: q="${q}" filter="${filter || "all"}" | redisCacheCheck=${timings.redisCacheCheck.toFixed(2)}ms parallelSearchFetch=${timings.parallelSearchFetch.toFixed(2)}ms cacheWrite=${timings.cacheWrite.toFixed(2)}ms totalTime=${timings.totalTime.toFixed(2)}ms`);

    const trimSong = (s: any) => {
      const { downloadUrl, ...rest } = s;
      return rest;
    };

    const trimmedSongs = result.songs.map(trimSong);
    const trimmedVideos = result.videos.map(trimSong);
    const trimmedEpisodes = result.episodes.map(trimSong);
    const trimmedTop = result.topResult && (result.topResult.id ? trimSong(result.topResult) : result.topResult);

    res.json({
      ...result,
      songs: trimmedSongs,
      videos: trimmedVideos,
      episodes: trimmedEpisodes,
      topResult: trimmedTop,
      _timings: timings
    });
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
    // Proxy the audio stream directly to bypass client-side signature/IP checks
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    if (req.headers.range) {
      headers["Range"] = req.headers.range as string;
    }
    
    const response = await axios({
      method: "get",
      url: realUrl,
      headers: headers,
      responseType: "stream",
      timeout: 35000,
    });
    
    res.status(response.status);
    
    const headersToForward = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
    ];
    for (const h of headersToForward) {
      if (response.headers[h]) {
        res.setHeader(h, response.headers[h]);
      }
    }
    
    response.data.pipe(res);
    
    req.on("close", () => {
      response.data.destroy();
    });
  } catch (err: any) {
    console.error("[Stream] Error proxying stream:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to resolve stream" });
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
// Returns suggested songs based on filter: similar, popular, discover
router.get("/autoplay/:songId", softAuth, async (req: any, res: Response): Promise<void> => {
  const { songId } = req.params;
  const filter = String(req.query.type || "similar").toLowerCase();

  if (!songId) {
    res.status(400).json({ error: "Song ID required" });
    return;
  }

  try {
    let songs: any[] = [];

    if (filter === "popular") {
      const seedSong = await fetchSongById(songId).catch(() => null);
      const artistId = seedSong?.artists?.[0]?.id;
      if (artistId) {
        songs = await fetchArtistSongs(artistId).catch(() => []);
        // Exclude the seed song itself if present
        songs = songs.filter((s: any) => s.id !== songId);
      }
      // If we couldn't get popular songs, fallback to similar
      if (songs.length === 0) {
        songs = await getSuggestions(songId, 15);
      }
    } else if (filter === "discover") {
      const [similarSongs, tasteRecs] = await Promise.all([
        getSuggestions(songId, 15).catch(() => []),
        getNextRecommendations(songId, req.userId).catch(() => [])
      ]);

      const seen = new Set<string>([songId]);
      // Interleave similar songs and taste recommendations for discovery
      const maxLen = Math.max(similarSongs.length, tasteRecs.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < similarSongs.length) {
          const s = similarSongs[i];
          if (!seen.has(s.id)) {
            seen.add(s.id);
            songs.push(s);
          }
        }
        if (i < tasteRecs.length) {
          const s = tasteRecs[i];
          if (!seen.has(s.id)) {
            seen.add(s.id);
            songs.push(s);
          }
        }
      }
    } else {
      // "similar" (default) - uses native YouTube Music watch playlist
      songs = await getSuggestions(songId, 20);
    }

    res.json({ songs: songs.slice(0, 15) });
  } catch (err) {
    console.error("[Search] Autoplay error:", err);
    res.status(500).json({ error: "Failed to fetch autoplay suggestions", songs: [] });
  }
});

export default router;
