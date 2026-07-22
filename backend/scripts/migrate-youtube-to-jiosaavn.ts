/**
 * ═════════════════════════════════════════════════════════════════════════════
 * SoulSync - Legacy YouTube to JioSaavn MongoDB Migration Script
 * High Performance Bulk-Transaction Executor
 * ═════════════════════════════════════════════════════════════════════════════
 * 
 * Usage:
 *   Dry Run Mode:   npx tsx scripts/migrate-youtube-to-jiosaavn.ts --dry-run
 *   Real Execution: npx tsx scripts/migrate-youtube-to-jiosaavn.ts --execute
 *   Rollback Mode:  npx tsx scripts/migrate-youtube-to-jiosaavn.ts --rollback
 * 
 * Configurable options:
 *   --batch-size <number>  (default: 100)
 *   --verbose              (print every individual song match detail)
 * ═════════════════════════════════════════════════════════════════════════════
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { searchSongsHybrid, normalizeSongToCanonical, decodeHtmlEntities, Song } from "../src/services/jiosaavn.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Cache & Backup paths
const CACHE_FILE = path.join(__dirname, ".migration-match-cache.json");
const BACKUP_FILE = path.join(__dirname, ".migration-backup.json");

// Command Line Flags
const args = process.argv.slice(2);
const IS_DRY_RUN = args.includes("--dry-run");
const IS_EXECUTE = args.includes("--execute");
const IS_ROLLBACK = args.includes("--rollback");
const IS_VERBOSE = args.includes("--verbose");
const BATCH_SIZE_ARG_INDEX = args.indexOf("--batch-size");
const BATCH_SIZE = BATCH_SIZE_ARG_INDEX !== -1 ? parseInt(args[BATCH_SIZE_ARG_INDEX + 1], 10) || 100 : 100;

if (!IS_DRY_RUN && !IS_EXECUTE && !IS_ROLLBACK) {
  console.error(`
❌ Error: Please specify a mode:
   --dry-run   : Test matching & simulate updates without modifying MongoDB
   --execute   : Perform real updates inside MongoDB transactions
   --rollback  : Revert changes made during previous execution
`);
  process.exit(1);
}

// Interfaces & Types
export interface MatchResult {
  matched: boolean;
  legacyYtId: string;
  jioSaavnId: string | null;
  jioSong: Song | null;
  confidence: number; // 0 - 100
  reasons: string[];
}

interface MigrationStats {
  collectionsMigrated: string[];
  documentsScanned: number;
  songsScanned: number;
  songsMigrated: number;
  songsSkipped: number;
  songsRequiringReview: number;
  totalConfidence: number;
  matchedCount: number;
  startTime: number;
  endTime?: number;
}

const stats: MigrationStats = {
  collectionsMigrated: [],
  documentsScanned: 0,
  songsScanned: 0,
  songsMigrated: 0,
  songsSkipped: 0,
  songsRequiringReview: 0,
  totalConfidence: 0,
  matchedCount: 0,
  startTime: Date.now(),
};

// Global YouTube ID Match Cache
const matchCache = new Map<string, MatchResult>();
if (fs.existsSync(CACHE_FILE)) {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    for (const [k, v] of Object.entries(parsed)) {
      matchCache.set(k, v as MatchResult);
    }
    console.log(`[Cache] Loaded ${matchCache.size} pre-cached song matches from disk.`);
  } catch {
    console.warn("[Cache] Failed to load cache file, starting fresh.");
  }
}

function saveCache() {
  try {
    const obj: Record<string, MatchResult> = {};
    for (const [k, v] of matchCache.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.warn("[Cache] Failed to save match cache:", err);
  }
}

function findCachedMatchByYtId(ytId: string): MatchResult | null {
  for (const [key, val] of matchCache.entries()) {
    if (key.startsWith(`${ytId}::`)) {
      return val;
    }
  }
  return null;
}

// Backup Log Handler
interface BackupRecord {
  collection: string;
  docId: string;
  originalDoc: any;
  migratedAt: string;
}

function saveBackupRecords(newRecords: BackupRecord[]) {
  if (!IS_EXECUTE || newRecords.length === 0) return;
  try {
    let records: BackupRecord[] = [];
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        records = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));
      } catch {}
    }
    records.push(...newRecords);
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(records, null, 2));
  } catch (err) {
    console.warn("[Backup] Failed to record document backup:", err);
  }
}

// Text Cleaning Helper
function cleanText(s: any): string {
  if (!s) return "";
  const str = typeof s === "string" ? s : typeof s === "object" ? (s.name || s.title || String(s)) : String(s);
  return decodeHtmlEntities(str)
    .toLowerCase()
    .replace(/\(from "[^"]+"\)/gi, "")
    .replace(/\(official audio\)/gi, "")
    .replace(/\(official video\)/gi, "")
    .replace(/\(lyrical video\)/gi, "")
    .replace(/\(lyrical\)/gi, "")
    .replace(/\(video\)/gi, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * YouTube Song Identification Helper
 */
export function isYouTubeSong(songId?: string, downloadUrl?: any[], albumArt?: string): boolean {
  if (!songId && (!downloadUrl || downloadUrl.length === 0) && !albumArt) return false;

  if (songId) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(songId)) return true;
    if (songId.includes("youtube") || songId.includes("youtu.be") || songId.startsWith("yt_") || songId.startsWith("yt:")) return true;
  }

  if (Array.isArray(downloadUrl)) {
    for (const d of downloadUrl) {
      const u = typeof d === "string" ? d : d?.url || "";
      if (u.includes("youtube") || u.includes("googlevideo") || u.includes("ytstream") || u.includes("api/search/stream?id=")) return true;
    }
  }

  if (albumArt) {
    if (albumArt.includes("ytimg.com") || albumArt.includes("ggpht.com") || albumArt.includes("googleusercontent.com")) return true;
  }

  return false;
}

/**
 * STEP 3 & STEP 4: Resolve YouTube Song to JioSaavn using internal JioSaavn service and confidence ranking
 */
export async function resolveSongToJioSaavn(
  ytId: string,
  title: string,
  artist: string,
  album?: string,
  duration?: number
): Promise<MatchResult> {
  const cacheKey = `${ytId}::${cleanText(title)}::${cleanText(artist)}`;
  if (matchCache.has(cacheKey)) {
    return matchCache.get(cacheKey)!;
  }

  const cached = findCachedMatchByYtId(ytId);
  if (cached && cached.matched) {
    matchCache.set(cacheKey, cached);
    return cached;
  }

  const cleanTitleStr = cleanText(title);
  const cleanArtistStr = cleanText(artist);
  const query = `${cleanTitleStr} ${cleanArtistStr}`.trim();

  let candidates: Song[] = [];
  try {
    const rawResults = await searchSongsHybrid(query, 15, artist);
    candidates = rawResults.map((r) => normalizeSongToCanonical(r)).filter((s): s is Song => s !== null);
  } catch (err) {
    // Silent fallback
  }

  if (candidates.length === 0 && cleanTitleStr) {
    try {
      const rawResults = await searchSongsHybrid(cleanTitleStr, 15, null);
      candidates = rawResults.map((r) => normalizeSongToCanonical(r)).filter((s): s is Song => s !== null);
    } catch {}
  }

  let bestMatch: Song | null = null;
  let maxScore = 0;
  let matchReasons: string[] = [];

  for (const cand of candidates) {
    let score = 0;
    const reasons: string[] = [];

    const cTitleStr = cleanText(cand.name);
    const cArtistStr = cleanText(cand.primaryArtists);

    // 1. Title matching (max 40 pts)
    if (cleanTitleStr === cTitleStr) {
      score += 40;
      reasons.push("Exact title match");
    } else if (cleanTitleStr.includes(cTitleStr) || cTitleStr.includes(cleanTitleStr)) {
      score += 30;
      reasons.push("Partial title match");
    } else {
      const tWords = new Set(cleanTitleStr.split(" ").filter((w) => w.length > 2));
      const cWords = new Set(cTitleStr.split(" ").filter((w) => w.length > 2));
      const common = [...tWords].filter((w) => cWords.has(w));
      if (common.length > 0 && tWords.size > 0) {
        const ratio = common.length / Math.max(tWords.size, cWords.size);
        score += Math.round(ratio * 25);
        reasons.push(`Title token overlap (${Math.round(ratio * 100)}%)`);
      }
    }

    // 2. Primary Artist matching (max 35 pts)
    if (cleanArtistStr && cArtistStr) {
      if (cleanArtistStr === cArtistStr) {
        score += 35;
        reasons.push("Exact primary artist match");
      } else {
        const tAWords = cleanArtistStr.split(" ").filter((w) => w.length > 2);
        const cAWords = cleanArtistStr.split(" ").filter((w) => w.length > 2);
        const commonA = tAWords.filter((w) => cAWords.includes(w));
        if (commonA.length > 0) {
          const ratioA = commonA.length / Math.max(tAWords.size, cAWords.size);
          score += Math.round(ratioA * 30);
          reasons.push(`Artist overlap (${commonA.join(", ")})`);
        }
      }
    }

    // 3. Album match (max 10 pts)
    if (album && cand.album) {
      const cleanAlbum = cleanText(album);
      const cleanCandAlbum = cleanText(cand.album);
      if (cleanAlbum && cleanCandAlbum && (cleanAlbum === cleanCandAlbum || cleanAlbum.includes(cleanCandAlbum) || cleanCandAlbum.includes(cleanAlbum))) {
        score += 10;
        reasons.push("Album match");
      }
    }

    // 4. Duration difference under 3 seconds (max 15 pts)
    if (duration && cand.duration) {
      const diff = Math.abs(duration - cand.duration);
      if (diff <= 1) {
        score += 15;
        reasons.push(`Duration diff ${diff}s <= 1s`);
      } else if (diff <= 3) {
        score += 10;
        reasons.push(`Duration diff ${diff}s <= 3s`);
      } else if (diff <= 5) {
        score += 5;
        reasons.push(`Duration diff ${diff}s <= 5s`);
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = cand;
      matchReasons = reasons;
    }
  }

  const isMatch = bestMatch !== null && maxScore >= 40;

  const result: MatchResult = {
    matched: isMatch,
    legacyYtId: ytId,
    jioSaavnId: isMatch ? bestMatch.id : null,
    jioSong: isMatch ? bestMatch : null,
    confidence: maxScore,
    reasons: matchReasons,
  };

  matchCache.set(cacheKey, result);
  saveCache();
  return result;
}

export async function resolveByYtIdOnly(db: mongoose.mongo.Db, ytId: string, hintTitle?: string): Promise<MatchResult> {
  const cached = findCachedMatchByYtId(ytId);
  if (cached) return cached;

  const lh = await db.collection("listeninghistories").findOne({ songId: ytId });
  if (lh && lh.title) {
    return resolveSongToJioSaavn(ytId, lh.title, lh.artist || "", lh.album, lh.duration);
  }

  const pl = await db.collection("playlists").findOne({ "songs.songId": ytId });
  if (pl && Array.isArray(pl.songs)) {
    const s = pl.songs.find((x: any) => x.songId === ytId);
    if (s && s.title) {
      return resolveSongToJioSaavn(ytId, s.title, s.artist || "", s.album, s.duration);
    }
  }

  if (hintTitle) {
    return resolveSongToJioSaavn(ytId, hintTitle, "");
  }

  return resolveSongToJioSaavn(ytId, ytId, "");
}

/**
 * Execute Batch Write inside an Atomic MongoDB Transaction with Automatic Retries
 */
async function executeBatchTransaction(
  db: mongoose.mongo.Db,
  bulkOps: any[],
  backupRecords: BackupRecord[],
  collectionName: string
) {
  if (!IS_EXECUTE || bulkOps.length === 0) return;

  saveBackupRecords(backupRecords);

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection(collectionName).bulkWrite(bulkOps, { session });
      });
      session.endSession();
      break;
    } catch (err: any) {
      session.endSession();
      attempts++;
      if (err?.errorLabels?.includes("TransientTransactionError") && attempts < maxAttempts) {
        console.warn(`[Transaction Retry] Retrying batch for ${collectionName} (attempt ${attempts}/${maxAttempts})...`);
        await new Promise((res) => setTimeout(res, 300 * attempts));
        continue;
      }
      // Fallback non-transactional bulkWrite if single-doc transactions encounter cluster locks
      try {
        await db.collection(collectionName).bulkWrite(bulkOps);
        break;
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION MIGRATIONS
// ─────────────────────────────────────────────────────────────────────────────

// 1. USER LIKED SONGS (`users` collection)
async function migrateUsers(db: mongoose.mongo.Db) {
  console.log("\n📦 [1/7] Migrating Users ('users' collection)...");
  stats.collectionsMigrated.push("users");

  const users = await db.collection("users").find({ "likedSongs.0": { $exists: true } }).toArray();
  stats.documentsScanned += users.length;

  let batchCount = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const bulkOps: any[] = [];
    const backupRecords: BackupRecord[] = [];

    for (const u of batch) {
      let docModified = false;

      const ytSongPromises = (u.likedSongs || []).map((s: any) => {
        if (!s || typeof s !== "object") return Promise.resolve({ s, match: null });
        stats.songsScanned++;
        if (isYouTubeSong(s.songId, s.downloadUrl, s.albumArt)) {
          return resolveSongToJioSaavn(s.songId, s.title, s.artist, s.album, s.duration).then((match) => ({ s, match }));
        }
        return Promise.resolve({ s, match: null });
      });

      const resolvedItems = await Promise.all(ytSongPromises);
      const updatedLikedSongs = [];

      for (const { s, match } of resolvedItems) {
        if (!s || typeof s !== "object") continue;

        if (match) {
          if (match.matched && match.jioSong) {
            stats.songsMigrated++;
            stats.totalConfidence += match.confidence;
            stats.matchedCount++;
            docModified = true;
            const jio = match.jioSong;
            updatedLikedSongs.push({
              songId: jio.id,
              title: jio.name,
              artist: jio.primaryArtists,
              albumArt: jio.image,
              duration: jio.duration || s.duration || 0,
              downloadUrl: jio.downloadUrl || (jio.streamUrl ? [{ quality: "320kbps", url: jio.streamUrl }] : s.downloadUrl),
              provider: "jiosaavn",
              migrationStatus: "migrated",
            });
            if (IS_VERBOSE) console.log(`  [users] ${u._id} | YT: ${s.songId} -> JioSaavn: ${jio.id} (${match.confidence}%)`);
          } else {
            stats.songsRequiringReview++;
            docModified = true;
            updatedLikedSongs.push({ ...s, migrationStatus: "missing" });
            if (IS_VERBOSE) console.log(`  [users] ${u._id} | YT: ${s.songId} -> UNMATCHED (marked missing)`);
          }
        } else {
          stats.songsSkipped++;
          updatedLikedSongs.push(s);
        }
      }

      if (docModified) {
        backupRecords.push({ collection: "users", docId: String(u._id), originalDoc: u, migratedAt: new Date().toISOString() });
        bulkOps.push({
          updateOne: {
            filter: { _id: u._id },
            update: { $set: { likedSongs: updatedLikedSongs, updatedAt: new Date() } },
          },
        });
      }
    }

    await executeBatchTransaction(db, bulkOps, backupRecords, "users");
    batchCount += batch.length;
    console.log(`Progress: Users ${Math.min(batchCount, users.length)} / ${users.length}`);
  }
}

// 2. PLAYLISTS (`playlists` collection)
async function migratePlaylists(db: mongoose.mongo.Db) {
  console.log("\n📦 [2/7] Migrating Playlists ('playlists' collection)...");
  stats.collectionsMigrated.push("playlists");

  const playlists = await db.collection("playlists").find({ "songs.0": { $exists: true } }).toArray();
  stats.documentsScanned += playlists.length;

  let batchCount = 0;

  for (let i = 0; i < playlists.length; i += BATCH_SIZE) {
    const batch = playlists.slice(i, i + BATCH_SIZE);
    const bulkOps: any[] = [];
    const backupRecords: BackupRecord[] = [];

    for (const p of batch) {
      let docModified = false;

      const ytSongPromises = (p.songs || []).map((s: any) => {
        if (!s || typeof s !== "object") return Promise.resolve({ s, match: null });
        stats.songsScanned++;
        if (isYouTubeSong(s.songId, s.downloadUrl, s.albumArt)) {
          return resolveSongToJioSaavn(s.songId, s.title, s.artist, s.album, s.duration).then((match) => ({ s, match }));
        }
        return Promise.resolve({ s, match: null });
      });

      const resolvedItems = await Promise.all(ytSongPromises);
      const updatedSongs = [];

      for (const { s, match } of resolvedItems) {
        if (!s || typeof s !== "object") continue;

        if (match) {
          if (match.matched && match.jioSong) {
            stats.songsMigrated++;
            stats.totalConfidence += match.confidence;
            stats.matchedCount++;
            docModified = true;
            const jio = match.jioSong;
            updatedSongs.push({
              songId: jio.id,
              title: jio.name,
              artist: jio.primaryArtists,
              albumArt: jio.image,
              duration: jio.duration || s.duration || 0,
              downloadUrl: jio.downloadUrl || (jio.streamUrl ? [{ quality: "320kbps", url: jio.streamUrl }] : s.downloadUrl),
              provider: "jiosaavn",
              migrationStatus: "migrated",
            });
            if (IS_VERBOSE) console.log(`  [playlists] ${p._id} ("${p.name}") | YT: ${s.songId} -> JioSaavn: ${jio.id} (${match.confidence}%)`);
          } else {
            stats.songsRequiringReview++;
            docModified = true;
            updatedSongs.push({ ...s, migrationStatus: "missing" });
            if (IS_VERBOSE) console.log(`  [playlists] ${p._id} ("${p.name}") | YT: ${s.songId} -> UNMATCHED (marked missing)`);
          }
        } else {
          stats.songsSkipped++;
          updatedSongs.push(s);
        }
      }

      if (docModified) {
        backupRecords.push({ collection: "playlists", docId: String(p._id), originalDoc: p, migratedAt: new Date().toISOString() });

        const songCount = updatedSongs.length;
        const totalDuration = updatedSongs.reduce((acc: number, item: any) => acc + (item.duration || 0), 0);
        let coverImage = p.coverImage;
        if ((!coverImage || coverImage.includes("ytimg") || coverImage.includes("youtube")) && updatedSongs.length > 0) {
          coverImage = updatedSongs[0].albumArt;
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: {
              $set: {
                songs: updatedSongs,
                songCount,
                totalDuration,
                coverImage,
                updatedAt: new Date(),
              },
            },
          },
        });
      }
    }

    await executeBatchTransaction(db, bulkOps, backupRecords, "playlists");
    batchCount += batch.length;
    console.log(`Progress: Playlists ${Math.min(batchCount, playlists.length)} / ${playlists.length}`);
  }
}

// 3. LISTENING HISTORY (`listeninghistories` collection)
async function migrateListeningHistory(db: mongoose.mongo.Db) {
  console.log("\n📦 [3/7] Migrating ListeningHistory ('listeninghistories' collection)...");
  stats.collectionsMigrated.push("listeninghistories");

  const historyDocs = await db.collection("listeninghistories").find({
    $or: [
      { songId: { $regex: /^[a-zA-Z0-9_-]{11}$/ } },
      { songId: { $regex: /youtube/i } },
      { albumArt: { $regex: /ytimg|ggpht/i } }
    ]
  }).toArray();
  stats.documentsScanned += historyDocs.length;

  let batchCount = 0;

  for (let i = 0; i < historyDocs.length; i += BATCH_SIZE) {
    const batch = historyDocs.slice(i, i + BATCH_SIZE);
    const bulkOps: any[] = [];
    const backupRecords: BackupRecord[] = [];

    const matchPromises = batch.map((h) => {
      stats.songsScanned++;
      return resolveByYtIdOnly(db, h.songId, h.title).then((match) => ({ h, match }));
    });

    const resolvedBatch = await Promise.all(matchPromises);

    for (const { h, match } of resolvedBatch) {
      backupRecords.push({ collection: "listeninghistories", docId: String(h._id), originalDoc: h, migratedAt: new Date().toISOString() });

      if (match.matched && match.jioSong) {
        stats.songsMigrated++;
        stats.totalConfidence += match.confidence;
        stats.matchedCount++;
        const jio = match.jioSong;
        if (IS_VERBOSE) console.log(`  [listeninghistories] ${h._id} | YT: ${h.songId} -> JioSaavn: ${jio.id} (${match.confidence}%)`);

        bulkOps.push({
          updateOne: {
            filter: { _id: h._id },
            update: {
              $set: {
                songId: jio.id,
                title: jio.name,
                artist: jio.primaryArtists,
                albumArt: jio.image,
                language: jio.language || h.language || "",
                migrationStatus: "migrated",
              },
            },
          },
        });
      } else {
        stats.songsRequiringReview++;
        if (IS_VERBOSE) console.log(`  [listeninghistories] ${h._id} | YT: ${h.songId} -> UNMATCHED (marked missing)`);

        bulkOps.push({
          updateOne: {
            filter: { _id: h._id },
            update: { $set: { migrationStatus: "missing" } },
          },
        });
      }
    }

    await executeBatchTransaction(db, bulkOps, backupRecords, "listeninghistories");
    batchCount += batch.length;
    console.log(`Progress: ListeningHistory ${Math.min(batchCount, historyDocs.length)} / ${historyDocs.length}`);
  }
}

// 4. DUO SESSIONS (`duosessions` collection)
async function migrateDuoSessions(db: mongoose.mongo.Db) {
  console.log("\n📦 [4/7] Migrating Duo Sessions ('duosessions' collection)...");
  stats.collectionsMigrated.push("duosessions");

  const duos = await db.collection("duosessions").find({}).toArray();
  stats.documentsScanned += duos.length;

  for (const d of duos) {
    let docModified = false;

    let updatedCurrentSong = d.currentSong;
    if (d.currentSong && typeof d.currentSong === "object" && isYouTubeSong(d.currentSong.id || d.currentSong.songId, d.currentSong.downloadUrl, d.currentSong.image || d.currentSong.albumArt)) {
      stats.songsScanned++;
      const match = await resolveSongToJioSaavn(
        d.currentSong.id || d.currentSong.songId,
        d.currentSong.name || d.currentSong.title,
        d.currentSong.primaryArtists || d.currentSong.artist,
        d.currentSong.album?.name || d.currentSong.album,
        d.currentSong.duration
      );

      if (match.matched && match.jioSong) {
        stats.songsMigrated++;
        stats.totalConfidence += match.confidence;
        stats.matchedCount++;
        docModified = true;
        const jio = match.jioSong;
        updatedCurrentSong = {
          ...d.currentSong,
          id: jio.id,
          songId: jio.id,
          name: jio.name,
          title: jio.name,
          primaryArtists: jio.primaryArtists,
          artist: jio.primaryArtists,
          image: jio.image,
          albumArt: jio.image,
          streamUrl: jio.streamUrl,
          downloadUrl: jio.downloadUrl || [{ quality: "320kbps", url: jio.streamUrl }],
          migrationStatus: "migrated",
        };
      } else {
        stats.songsRequiringReview++;
        docModified = true;
        updatedCurrentSong = { ...d.currentSong, migrationStatus: "missing" };
      }
    }

    const updatedSongHistory = [];
    for (const item of d.songHistory || []) {
      if (!item || typeof item !== "object") continue;

      stats.songsScanned++;
      const songId = item.id || item.songId;
      if (isYouTubeSong(songId, item.downloadUrl, item.image || item.albumArt)) {
        const match = await resolveSongToJioSaavn(songId, item.name || item.title, item.primaryArtists || item.artist, item.album?.name || item.album, item.duration);
        if (match.matched && match.jioSong) {
          stats.songsMigrated++;
          stats.totalConfidence += match.confidence;
          stats.matchedCount++;
          docModified = true;
          const jio = match.jioSong;
          updatedSongHistory.push({
            ...item,
            id: jio.id,
            songId: jio.id,
            name: jio.name,
            title: jio.name,
            primaryArtists: jio.primaryArtists,
            artist: jio.primaryArtists,
            image: jio.image,
            albumArt: jio.image,
            migrationStatus: "migrated",
          });
        } else {
          stats.songsRequiringReview++;
          docModified = true;
          updatedSongHistory.push({ ...item, migrationStatus: "missing" });
        }
      } else {
        stats.songsSkipped++;
        updatedSongHistory.push(item);
      }
    }

    if (docModified) {
      const backupRecords = [{ collection: "duosessions", docId: String(d._id), originalDoc: d, migratedAt: new Date().toISOString() }];
      const bulkOps = [{
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { currentSong: updatedCurrentSong, songHistory: updatedSongHistory, updatedAt: new Date() } },
        },
      }];
      await executeBatchTransaction(db, bulkOps, backupRecords, "duosessions");
    }
  }
}

// 5. SONG COOCCURRENCE (`songcooccurrences` collection)
async function migrateSongCooccurrences(db: mongoose.mongo.Db) {
  console.log("\n📦 [5/7] Migrating SongCooccurrence ('songcooccurrences' collection)...");
  stats.collectionsMigrated.push("songcooccurrences");

  const coocDocs = await db.collection("songcooccurrences").find({
    $or: [
      { songIdA: { $regex: /^[a-zA-Z0-9_-]{11}$/ } },
      { songIdB: { $regex: /^[a-zA-Z0-9_-]{11}$/ } }
    ]
  }).toArray();
  stats.documentsScanned += coocDocs.length;

  let batchCount = 0;

  for (let i = 0; i < coocDocs.length; i += BATCH_SIZE) {
    const batch = coocDocs.slice(i, i + BATCH_SIZE);
    const bulkOps: any[] = [];
    const backupRecords: BackupRecord[] = [];
    const docMap = new Map<number, any>();

    for (const c of batch) {
      if (!c || typeof c !== "object") continue;
      stats.songsScanned++;
      let docModified = false;
      let newSongIdA = c.songIdA;
      let newSongIdB = c.songIdB;
      let newBName = c.songBName;
      let newBArtist = c.songBArtist;
      let newBImage = c.songBImage;
      let newBLang = c.songBLanguage;

      if (/^[a-zA-Z0-9_-]{11}$/.test(c.songIdA)) {
        const matchA = await resolveByYtIdOnly(db, c.songIdA);
        if (matchA.matched && matchA.jioSaavnId) {
          newSongIdA = matchA.jioSaavnId;
          docModified = true;
          stats.songsMigrated++;
          stats.totalConfidence += matchA.confidence;
          stats.matchedCount++;
        }
      }

      if (/^[a-zA-Z0-9_-]{11}$/.test(c.songIdB) || isYouTubeSong(c.songIdB, undefined, c.songBImage)) {
        const matchB = await resolveByYtIdOnly(db, c.songIdB, c.songBName);
        if (matchB.matched && matchB.jioSong) {
          const jio = matchB.jioSong;
          newSongIdB = jio.id;
          newBName = jio.name;
          newBArtist = jio.primaryArtists;
          newBImage = jio.image;
          newBLang = jio.language || c.songBLanguage;
          docModified = true;
          stats.songsMigrated++;
          stats.totalConfidence += matchB.confidence;
          stats.matchedCount++;
        }
      }

      if (docModified) {
        backupRecords.push({ collection: "songcooccurrences", docId: String(c._id), originalDoc: c, migratedAt: new Date().toISOString() });
        const opIndex = bulkOps.length;
        docMap.set(opIndex, { c, newSongIdA, newSongIdB });
        bulkOps.push({
          updateOne: {
            filter: { _id: c._id },
            update: {
              $set: {
                songIdA: newSongIdA,
                songIdB: newSongIdB,
                songBName: newBName,
                songBArtist: newBArtist,
                songBImage: newBImage,
                songBLanguage: newBLang,
                updatedAt: new Date(),
              },
            },
          },
        });
      }
    }

    if (bulkOps.length > 0 && IS_EXECUTE) {
      saveBackupRecords(backupRecords);
      try {
        await db.collection("songcooccurrences").bulkWrite(bulkOps, { ordered: false });
      } catch (err: any) {
        if (err.writeErrors && Array.isArray(err.writeErrors)) {
          for (const we of err.writeErrors) {
            if (we.code === 11000) {
              const info = docMap.get(we.index);
              if (info) {
                await db.collection("songcooccurrences").updateOne(
                  { songIdA: info.newSongIdA, songIdB: info.newSongIdB },
                  { $inc: { count: info.c.count || 1 }, $set: { lastSeenAt: new Date() } }
                );
                await db.collection("songcooccurrences").deleteOne({ _id: info.c._id });
              }
            }
          }
        }
      }
    }

    batchCount += batch.length;
    console.log(`Progress: SongCooccurrence ${Math.min(batchCount, coocDocs.length)} / ${coocDocs.length}`);
  }
}

// 6. USER MIX SETS (`usermixsets` collection)
async function migrateUserMixSets(db: mongoose.mongo.Db) {
  console.log("\n📦 [6/7] Migrating UserMixSets ('usermixsets' collection)...");
  stats.collectionsMigrated.push("usermixsets");

  const mixDocs = await db.collection("usermixsets").find({
    "mixes.songIds": { $regex: /^[a-zA-Z0-9_-]{11}$/ }
  }).toArray();
  stats.documentsScanned += mixDocs.length;

  for (const m of mixDocs) {
    if (!m || typeof m !== "object") continue;
    let docModified = false;

    const updatedMixes = [];
    for (const mix of m.mixes || []) {
      const updatedSongIds = [];
      for (const sid of mix.songIds || []) {
        stats.songsScanned++;
        if (/^[a-zA-Z0-9_-]{11}$/.test(sid)) {
          const match = await resolveByYtIdOnly(db, sid, mix.seedInfo?.seedSongTitle);
          if (match.matched && match.jioSaavnId) {
            stats.songsMigrated++;
            stats.totalConfidence += match.confidence;
            stats.matchedCount++;
            updatedSongIds.push(match.jioSaavnId);
            docModified = true;
          } else {
            stats.songsSkipped++;
            updatedSongIds.push(sid);
          }
        } else {
          stats.songsSkipped++;
          updatedSongIds.push(sid);
        }
      }

      let updatedSeedInfo = mix.seedInfo;
      if (mix.seedInfo?.seedSongId && /^[a-zA-Z0-9_-]{11}$/.test(mix.seedInfo.seedSongId)) {
        const seedMatch = await resolveByYtIdOnly(db, mix.seedInfo.seedSongId, mix.seedInfo.seedSongTitle);
        if (seedMatch.matched && seedMatch.jioSaavnId) {
          updatedSeedInfo = { ...mix.seedInfo, seedSongId: seedMatch.jioSaavnId };
          docModified = true;
        }
      }

      updatedMixes.push({ ...mix, songIds: updatedSongIds, seedInfo: updatedSeedInfo });
    }

    if (docModified) {
      const backupRecords = [{ collection: "usermixsets", docId: String(m._id), originalDoc: m, migratedAt: new Date().toISOString() }];
      const bulkOps = [{
        updateOne: {
          filter: { _id: m._id },
          update: { $set: { mixes: updatedMixes, updatedAt: new Date() } },
        },
      }];
      await executeBatchTransaction(db, bulkOps, backupRecords, "usermixsets");
    }
  }
}

// 7. USER TASTE PROFILES (`usertasteprofiles` collection)
async function migrateUserTasteProfiles(db: mongoose.mongo.Db) {
  console.log("\n📦 [7/7] Migrating UserTasteProfiles ('usertasteprofiles' collection)...");
  stats.collectionsMigrated.push("usertasteprofiles");

  const tasteDocs = await db.collection("usertasteprofiles").find({
    recentSongIds: { $regex: /^[a-zA-Z0-9_-]{11}$/ }
  }).toArray();
  stats.documentsScanned += tasteDocs.length;

  for (const t of tasteDocs) {
    if (!t || typeof t !== "object") continue;
    let docModified = false;
    const updatedRecentSongIds = [];

    for (const sid of t.recentSongIds || []) {
      stats.songsScanned++;
      if (/^[a-zA-Z0-9_-]{11}$/.test(sid)) {
        const match = await resolveByYtIdOnly(db, sid);
        if (match.matched && match.jioSaavnId) {
          stats.songsMigrated++;
          stats.totalConfidence += match.confidence;
          stats.matchedCount++;
          updatedRecentSongIds.push(match.jioSaavnId);
          docModified = true;
        } else {
          stats.songsSkipped++;
          updatedRecentSongIds.push(sid);
        }
      } else {
        stats.songsSkipped++;
        updatedRecentSongIds.push(sid);
      }
    }

    if (docModified) {
      const backupRecords = [{ collection: "usertasteprofiles", docId: String(t._id), originalDoc: t, migratedAt: new Date().toISOString() }];
      const bulkOps = [{
        updateOne: {
          filter: { _id: t._id },
          update: { $set: { recentSongIds: updatedRecentSongIds, updatedAt: new Date() } },
        },
      }];
      await executeBatchTransaction(db, bulkOps, backupRecords, "usertasteprofiles");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLLBACK FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
async function performRollback(db: mongoose.mongo.Db) {
  console.log("\n🔄 Initiating SoulSync Migration Rollback...");
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error("❌ Error: Backup log file (.migration-backup.json) not found! Cannot perform rollback.");
    process.exit(1);
  }

  const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
  const records: BackupRecord[] = JSON.parse(raw);
  console.log(`Found ${records.length} document backups to restore.`);

  let restored = 0;
  for (const rec of records) {
    const docId = new mongoose.Types.ObjectId(rec.docId);
    await db.collection(rec.collection).replaceOne({ _id: docId }, rec.originalDoc, { upsert: true });
    restored++;
  }

  console.log(`\n✅ Rollback Complete! Restored ${restored} documents to their pre-migration state.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ Error: MONGODB_URI environment variable is not defined.");
    process.exit(1);
  }

  console.log("================================================================================");
  console.log(`   SoulSync YouTube -> JioSaavn MongoDB Data Migration Engineer CLI   `);
  console.log(`   Mode: ${IS_DRY_RUN ? "DRY-RUN (Simulated)" : IS_EXECUTE ? "REAL EXECUTION (Transactions)" : "ROLLBACK"}`);
  console.log("================================================================================");

  console.log("\nConnecting to MongoDB...");
  await mongoose.connect(uri, { dbName: "soulsync" });
  console.log("Connected to MongoDB successfully.");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ Error: MongoDB connection instance unavailable.");
    process.exit(1);
  }

  if (IS_ROLLBACK) {
    await performRollback(db);
    await mongoose.disconnect();
    process.exit(0);
  }

  // Run migrations across all 7 collections
  await migrateUsers(db);
  await migratePlaylists(db);
  await migrateListeningHistory(db);
  await migrateDuoSessions(db);
  await migrateSongCooccurrences(db);
  await migrateUserMixSets(db);
  await migrateUserTasteProfiles(db);

  stats.endTime = Date.now();
  const execTimeSec = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
  const avgConfidence = stats.matchedCount > 0 ? (stats.totalConfidence / stats.matchedCount).toFixed(2) : "0.00";

  // STEP 10: Final Migration Report
  console.log("\n================================================================================");
  console.log("                       FINAL MIGRATION REPORT                                   ");
  console.log("================================================================================");
  console.log(`Collections Migrated        : ${stats.collectionsMigrated.join(", ")}`);
  console.log(`Documents Scanned           : ${stats.documentsScanned}`);
  console.log(`Total Songs Scanned         : ${stats.songsScanned}`);
  console.log(`Songs Migrated (Matched)    : ${stats.songsMigrated}`);
  console.log(`Songs Skipped               : ${stats.songsSkipped}`);
  console.log(`Songs Requiring Manual Review: ${stats.songsRequiringReview}`);
  console.log(`Average Confidence Score    : ${avgConfidence}%`);
  console.log(`Execution Time              : ${execTimeSec} seconds`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Rollback Instructions       : Run 'npx tsx scripts/migrate-youtube-to-jiosaavn.ts --rollback'`);
  console.log("================================================================================\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
