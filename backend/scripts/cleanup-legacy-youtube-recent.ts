/**
 * ═════════════════════════════════════════════════════════════════════════════
 * SoulSync - Recent Legacy YouTube User Data Safe Cleanup Script
 * ═════════════════════════════════════════════════════════════════════════════
 * 
 * Target:
 *   Removes ONLY legacy YouTube song references created/added/played within
 *   the last 72 hours (3 days).
 * 
 * SAFEGUARDS:
 *   - NEVER deletes users, user accounts, authentication data, settings, or JioSaavn songs.
 *   - NEVER deletes playlist documents (only removes YouTube song entries within playlists).
 *   - Supports --dry-run for safe previewing.
 *   - Supports --execute with atomic MongoDB bulk transactions in batches of 100.
 *   - Generates full backup snapshots (.cleanup-youtube-backup.json) for --rollback.
 * 
 * Usage:
 *   Dry Run:   npx tsx scripts/cleanup-legacy-youtube-recent.ts --dry-run
 *   Execute:   npx tsx scripts/cleanup-legacy-youtube-recent.ts --execute
 *   Rollback:  npx tsx scripts/cleanup-legacy-youtube-recent.ts --rollback
 * ═════════════════════════════════════════════════════════════════════════════
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const BACKUP_FILE = path.join(__dirname, ".cleanup-youtube-backup.json");

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
   --dry-run   : Preview what would be deleted without modifying MongoDB
   --execute   : Perform real deletions inside MongoDB transactions
   --rollback  : Revert changes made during previous execution
`);
  process.exit(1);
}

// 72 Hours Time Boundary Calculation
const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const CUTOFF_DATE = new Date(Date.now() - SEVENTY_TWO_HOURS_MS);

// Reporting Metrics
interface CleanupReportStats {
  collectionsInspected: string[];
  collectionsModified: Set<string>;
  documentsScanned: number;
  playlistEntriesRemoved: number;
  likedSongsRemoved: number;
  historyEntriesRemoved: number;
  duoSessionEntriesRemoved: number;
  cooccurrenceEntriesRemoved: number;
  usersAffected: Set<string>;
  startTime: number;
  endTime?: number;
}

const stats: CleanupReportStats = {
  collectionsInspected: [],
  collectionsModified: new Set<string>(),
  documentsScanned: 0,
  playlistEntriesRemoved: 0,
  likedSongsRemoved: 0,
  historyEntriesRemoved: 0,
  duoSessionEntriesRemoved: 0,
  cooccurrenceEntriesRemoved: 0,
  usersAffected: new Set<string>(),
  startTime: Date.now(),
};

// Backup Log Record
interface CleanupBackupRecord {
  collection: string;
  docId: string;
  originalDoc: any;
  deletedAt: string;
}

function saveBackupRecords(newRecords: CleanupBackupRecord[]) {
  if (!IS_EXECUTE || newRecords.length === 0) return;
  try {
    let records: CleanupBackupRecord[] = [];
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        records = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf-8"));
      } catch {}
    }
    records.push(...newRecords);
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(records, null, 2));
  } catch (err) {
    console.warn("[Backup Log] Failed to save backup records:", err);
  }
}

/**
 * STEP 2: YouTube Song Identification Logic
 */
export function isYouTubeSong(songId?: string, downloadUrl?: any[], albumArt?: string, provider?: string): boolean {
  if (provider === "youtube" || provider === "yt") return true;

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
 * Check if timestamp falls within the last 72 hours (Condition A)
 */
function isWithin72Hours(timestamp?: any, docFallbackDate?: any): boolean {
  let date: Date | null = null;
  if (timestamp) {
    date = new Date(timestamp);
  } else if (docFallbackDate) {
    date = new Date(docFallbackDate);
  }

  if (!date || isNaN(date.getTime())) {
    // If no explicit timestamp exists, assume recent for safety filtering
    return true;
  }

  return date.getTime() >= CUTOFF_DATE.getTime();
}

/**
 * STEP 7: Transactional Execution Helper using MongoDB sessions and bulkWrite
 */
async function executeBatchTransaction(
  db: mongoose.mongo.Db,
  bulkOps: any[],
  backupRecords: CleanupBackupRecord[],
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
// COLLECTION CLEANUP TASKS
// ─────────────────────────────────────────────────────────────────────────────

// 1. PLAYLIST SONGS (STEP 4) - Removes ONLY YouTube song entries, keeps playlist documents!
async function cleanupPlaylists(db: mongoose.mongo.Db) {
  console.log("\n📦 [1/6] Cleaning Playlists ('playlists' collection)...");
  stats.collectionsInspected.push("playlists");

  const playlists = await db.collection("playlists").find({ "songs.0": { $exists: true } }).toArray();
  stats.documentsScanned += playlists.length;

  let batchCount = 0;

  for (let i = 0; i < playlists.length; i += BATCH_SIZE) {
    const batch = playlists.slice(i, i + BATCH_SIZE);
    const bulkOps: any[] = [];
    const backupRecords: CleanupBackupRecord[] = [];

    for (const p of batch) {
      let playlistModified = false;
      const initialSongCount = (p.songs || []).length;

      const remainingSongs = (p.songs || []).filter((s: any) => {
        if (!s || typeof s !== "object") return true;

        const isYt = isYouTubeSong(s.songId, s.downloadUrl, s.albumArt, s.provider);
        const isRecent = isWithin72Hours(s.addedAt || s.createdAt, p.updatedAt || p.createdAt);

        if (isYt && isRecent) {
          playlistModified = true;
          stats.playlistEntriesRemoved++;
          if (p.userId) stats.usersAffected.add(String(p.userId));
          if (IS_VERBOSE) console.log(`  [playlists] Playlist "${p.name}" (${p._id}) | Removed YT Song: ${s.songId || s.title}`);
          return false; // Remove song entry
        }
        return true; // Keep song entry
      });

      if (playlistModified) {
        stats.collectionsModified.add("playlists");
        backupRecords.push({
          collection: "playlists",
          docId: String(p._id),
          originalDoc: p,
          deletedAt: new Date().toISOString(),
        });

        const songCount = remainingSongs.length;
        const totalDuration = remainingSongs.reduce((acc: number, item: any) => acc + (item.duration || 0), 0);
        let coverImage = p.coverImage;

        // Reset coverImage if it referenced a deleted YouTube song thumbnail
        if (coverImage && (coverImage.includes("ytimg") || coverImage.includes("youtube"))) {
          coverImage = remainingSongs.length > 0 ? remainingSongs[0].albumArt || "" : "";
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: {
              $set: {
                songs: remainingSongs,
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

// 2. LIKED SONGS (STEP 5) - Removes YouTube liked song entries from Users collection
async function cleanupLikedSongs(db: mongoose.mongo.Db) {
  console.log("\n📦 [2/6] Cleaning User Liked Songs ('users' collection)...");
  stats.collectionsInspected.push("users");

  const users = await db.collection("users").find({ "likedSongs.0": { $exists: true } }).toArray();
  stats.documentsScanned += users.length;

  let batchCount = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    const bulkOps: any[] = [];
    const backupRecords: CleanupBackupRecord[] = [];

    for (const u of batch) {
      let userModified = false;

      const remainingLikedSongs = (u.likedSongs || []).filter((s: any) => {
        if (!s || typeof s !== "object") return true;

        const isYt = isYouTubeSong(s.songId, s.downloadUrl, s.albumArt, s.provider);
        const isRecent = isWithin72Hours(s.likedAt || s.addedAt || s.createdAt, u.updatedAt || u.createdAt);

        if (isYt && isRecent) {
          userModified = true;
          stats.likedSongsRemoved++;
          stats.usersAffected.add(String(u._id));
          if (IS_VERBOSE) console.log(`  [users] User ${u._id} | Removed YT Liked Song: ${s.songId || s.title}`);
          return false; // Remove liked song entry
        }
        return true; // Keep liked song entry
      });

      if (userModified) {
        stats.collectionsModified.add("users");
        backupRecords.push({
          collection: "users",
          docId: String(u._id),
          originalDoc: u,
          deletedAt: new Date().toISOString(),
        });

        bulkOps.push({
          updateOne: {
            filter: { _id: u._id },
            update: {
              $set: {
                likedSongs: remainingLikedSongs,
                updatedAt: new Date(),
              },
            },
          },
        });
      }
    }

    await executeBatchTransaction(db, bulkOps, backupRecords, "users");
    batchCount += batch.length;
    console.log(`Progress: Users ${Math.min(batchCount, users.length)} / ${users.length}`);
  }
}

// 3. LISTENING HISTORY (STEP 6) - Deletes YouTube listening history documents from last 72 hours
async function cleanupListeningHistory(db: mongoose.mongo.Db) {
  console.log("\n📦 [3/6] Cleaning ListeningHistory ('listeninghistories' collection)...");
  stats.collectionsInspected.push("listeninghistories");

  const historyDocs = await db.collection("listeninghistories").find({
    $or: [
      { playedAt: { $gte: CUTOFF_DATE } },
      { createdAt: { $gte: CUTOFF_DATE } }
    ]
  }).toArray();
  stats.documentsScanned += historyDocs.length;

  let batchCount = 0;

  for (let i = 0; i < historyDocs.length; i += BATCH_SIZE) {
    const batch = historyDocs.slice(i, i + BATCH_SIZE);
    const bulkOps: any[] = [];
    const backupRecords: CleanupBackupRecord[] = [];

    for (const h of batch) {
      const isYt = isYouTubeSong(h.songId, undefined, h.albumArt, h.provider);
      const isRecent = isWithin72Hours(h.playedAt || h.createdAt);

      if (isYt && isRecent) {
        stats.collectionsModified.add("listeninghistories");
        stats.historyEntriesRemoved++;
        if (h.userId) stats.usersAffected.add(String(h.userId));
        if (IS_VERBOSE) console.log(`  [listeninghistories] Doc ${h._id} | Deleted YT History: ${h.songId} ("${h.title}")`);

        backupRecords.push({
          collection: "listeninghistories",
          docId: String(h._id),
          originalDoc: h,
          deletedAt: new Date().toISOString(),
        });

        bulkOps.push({
          deleteOne: {
            filter: { _id: h._id },
          },
        });
      }
    }

    await executeBatchTransaction(db, bulkOps, backupRecords, "listeninghistories");
    batchCount += batch.length;
    console.log(`Progress: ListeningHistory ${Math.min(batchCount, historyDocs.length)} / ${historyDocs.length}`);
  }
}

// 4. DUO SESSIONS - Cleans active YouTube songs from Duo Session history & current song
async function cleanupDuoSessions(db: mongoose.mongo.Db) {
  console.log("\n📦 [4/6] Cleaning Duo Sessions ('duosessions' collection)...");
  stats.collectionsInspected.push("duosessions");

  const duos = await db.collection("duosessions").find({
    $or: [
      { updatedAt: { $gte: CUTOFF_DATE } },
      { createdAt: { $gte: CUTOFF_DATE } }
    ]
  }).toArray();
  stats.documentsScanned += duos.length;

  for (const d of duos) {
    let docModified = false;

    let updatedCurrentSong = d.currentSong;
    if (d.currentSong && typeof d.currentSong === "object") {
      const isYt = isYouTubeSong(d.currentSong.id || d.currentSong.songId, d.currentSong.downloadUrl, d.currentSong.image || d.currentSong.albumArt, d.currentSong.provider);
      if (isYt && isWithin72Hours(d.updatedAt || d.createdAt)) {
        updatedCurrentSong = null;
        docModified = true;
        stats.duoSessionEntriesRemoved++;
      }
    }

    const remainingSongHistory = (d.songHistory || []).filter((item: any) => {
      if (!item || typeof item !== "object") return true;
      const isYt = isYouTubeSong(item.id || item.songId, item.downloadUrl, item.image || item.albumArt, item.provider);
      const isRecent = isWithin72Hours(item.playedAt || item.addedAt || d.updatedAt || d.createdAt);

      if (isYt && isRecent) {
        docModified = true;
        stats.duoSessionEntriesRemoved++;
        return false;
      }
      return true;
    });

    if (docModified) {
      stats.collectionsModified.add("duosessions");
      const backupRecords = [{
        collection: "duosessions",
        docId: String(d._id),
        originalDoc: d,
        deletedAt: new Date().toISOString(),
      }];

      const bulkOps = [{
        updateOne: {
          filter: { _id: d._id },
          update: {
            $set: {
              currentSong: updatedCurrentSong,
              songHistory: remainingSongHistory,
              updatedAt: new Date(),
            },
          },
        },
      }];

      await executeBatchTransaction(db, bulkOps, backupRecords, "duosessions");
    }
  }
}

// 5. SONG COOCCURRENCES - Removes YouTube pair cooccurrences updated in last 72 hours
async function cleanupSongCooccurrences(db: mongoose.mongo.Db) {
  console.log("\n📦 [5/6] Cleaning SongCooccurrence ('songcooccurrences' collection)...");
  stats.collectionsInspected.push("songcooccurrences");

  const coocs = await db.collection("songcooccurrences").find({
    $or: [
      { lastSeenAt: { $gte: CUTOFF_DATE } },
      { updatedAt: { $gte: CUTOFF_DATE } },
      { createdAt: { $gte: CUTOFF_DATE } }
    ]
  }).toArray();
  stats.documentsScanned += coocs.length;

  let batchCount = 0;

  for (let i = 0; i < coocs.length; i += BATCH_SIZE) {
    const batch = coocs.slice(i, i + BATCH_SIZE);
    const bulkOps: any[] = [];
    const backupRecords: CleanupBackupRecord[] = [];

    for (const c of batch) {
      const isYtA = isYouTubeSong(c.songIdA);
      const isYtB = isYouTubeSong(c.songIdB, undefined, c.songBImage);
      const isRecent = isWithin72Hours(c.lastSeenAt || c.updatedAt || c.createdAt);

      if ((isYtA || isYtB) && isRecent) {
        stats.collectionsModified.add("songcooccurrences");
        stats.cooccurrenceEntriesRemoved++;
        backupRecords.push({
          collection: "songcooccurrences",
          docId: String(c._id),
          originalDoc: c,
          deletedAt: new Date().toISOString(),
        });

        bulkOps.push({
          deleteOne: {
            filter: { _id: c._id },
          },
        });
      }
    }

    await executeBatchTransaction(db, bulkOps, backupRecords, "songcooccurrences");
    batchCount += batch.length;
    console.log(`Progress: SongCooccurrence ${Math.min(batchCount, coocs.length)} / ${coocs.length}`);
  }
}

// 6. USER MIX SETS & TASTE PROFILES - Removes recent YouTube IDs
async function cleanupUserMixesAndProfiles(db: mongoose.mongo.Db) {
  console.log("\n📦 [6/6] Cleaning User Mix Sets & Taste Profiles...");
  stats.collectionsInspected.push("usermixsets", "usertasteprofiles");

  // Mix Sets
  const mixDocs = await db.collection("usermixsets").find({
    $or: [{ generatedAt: { $gte: CUTOFF_DATE } }, { updatedAt: { $gte: CUTOFF_DATE } }]
  }).toArray();
  stats.documentsScanned += mixDocs.length;

  for (const m of mixDocs) {
    let modified = false;
    const updatedMixes = (m.mixes || []).map((mix: any) => {
      const filteredSongIds = (mix.songIds || []).filter((sid: string) => !isYouTubeSong(sid));
      if (filteredSongIds.length !== (mix.songIds || []).length) modified = true;
      return { ...mix, songIds: filteredSongIds };
    });

    if (modified) {
      stats.collectionsModified.add("usermixsets");
      const backupRecords = [{ collection: "usermixsets", docId: String(m._id), originalDoc: m, deletedAt: new Date().toISOString() }];
      const bulkOps = [{ updateOne: { filter: { _id: m._id }, update: { $set: { mixes: updatedMixes, updatedAt: new Date() } } } }];
      await executeBatchTransaction(db, bulkOps, backupRecords, "usermixsets");
    }
  }

  // Taste Profiles
  const tasteDocs = await db.collection("usertasteprofiles").find({
    $or: [{ updatedAt: { $gte: CUTOFF_DATE } }, { createdAt: { $gte: CUTOFF_DATE } }]
  }).toArray();
  stats.documentsScanned += tasteDocs.length;

  for (const t of tasteDocs) {
    const filteredRecentIds = (t.recentSongIds || []).filter((sid: string) => !isYouTubeSong(sid));
    if (filteredRecentIds.length !== (t.recentSongIds || []).length) {
      stats.collectionsModified.add("usertasteprofiles");
      const backupRecords = [{ collection: "usertasteprofiles", docId: String(t._id), originalDoc: t, deletedAt: new Date().toISOString() }];
      const bulkOps = [{ updateOne: { filter: { _id: t._id }, update: { $set: { recentSongIds: filteredRecentIds, updatedAt: new Date() } } } }];
      await executeBatchTransaction(db, bulkOps, backupRecords, "usertasteprofiles");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLLBACK FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
async function performRollback(db: mongoose.mongo.Db) {
  console.log("\n🔄 Initiating SoulSync YouTube Cleanup Rollback...");
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error("❌ Error: Backup log file (.cleanup-youtube-backup.json) not found! Cannot perform rollback.");
    process.exit(1);
  }

  const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
  const records: CleanupBackupRecord[] = JSON.parse(raw);
  console.log(`Found ${records.length} document backups to restore.`);

  let restored = 0;
  for (const rec of records) {
    const docId = new mongoose.Types.ObjectId(rec.docId);
    await db.collection(rec.collection).replaceOne({ _id: docId }, rec.originalDoc, { upsert: true });
    restored++;
  }

  console.log(`\n✅ Rollback Complete! Restored ${restored} documents to pre-cleanup state.`);
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
  console.log(`   SoulSync Recent Legacy YouTube Data Cleanup Engineer CLI   `);
  console.log(`   Mode: ${IS_DRY_RUN ? "DRY-RUN (Simulated)" : IS_EXECUTE ? "REAL EXECUTION (Transactions)" : "ROLLBACK"}`);
  console.log(`   72h Time Cutoff Boundary: ${CUTOFF_DATE.toISOString()}`);
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

  // Execute cleanup across collections
  await cleanupPlaylists(db);
  await cleanupLikedSongs(db);
  await cleanupListeningHistory(db);
  await cleanupDuoSessions(db);
  await cleanupSongCooccurrences(db);
  await cleanupUserMixesAndProfiles(db);

  stats.endTime = Date.now();
  const execTimeSec = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

  // STEP 10: Final Cleanup Report
  console.log("\n================================================================================");
  console.log("                       FINAL CLEANUP REPORT                                     ");
  console.log("================================================================================");
  console.log(`Collections Inspected       : ${stats.collectionsInspected.join(", ")}`);
  console.log(`Collections Modified        : ${[...stats.collectionsModified].join(", ") || "None"}`);
  console.log(`Documents Scanned           : ${stats.documentsScanned}`);
  console.log(`Playlist Entries Removed    : ${stats.playlistEntriesRemoved}`);
  console.log(`Liked Songs Removed         : ${stats.likedSongsRemoved}`);
  console.log(`History Entries Removed     : ${stats.historyEntriesRemoved}`);
  console.log(`Duo Session Songs Removed   : ${stats.duoSessionEntriesRemoved}`);
  console.log(`Cooccurrence Pairs Removed  : ${stats.cooccurrenceEntriesRemoved}`);
  console.log(`Users Affected              : ${stats.usersAffected.size}`);
  console.log(`Execution Time              : ${execTimeSec} seconds`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Rollback Instructions       : Run 'npx tsx scripts/cleanup-legacy-youtube-recent.ts --rollback'`);
  console.log("================================================================================\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
