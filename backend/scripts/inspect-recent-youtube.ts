import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: "soulsync" });
  const db = mongoose.connection.db!;

  const SeventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
  console.log("Checking records modified/created since:", SeventyTwoHoursAgo.toISOString());

  // 1. Users likedSongs
  const users = await db.collection("users").find({}).toArray();
  let ytLikedSongsTotal = 0;
  let ytLikedSongsRecent = 0;

  for (const u of users) {
    for (const s of u.likedSongs || []) {
      const isYt = s.provider === "youtube" || /^[a-zA-Z0-9_-]{11}$/.test(s.songId || "");
      if (isYt) {
        ytLikedSongsTotal++;
        const ts = new Date(s.addedAt || s.likedAt || s.createdAt || u.updatedAt || u.createdAt || 0);
        if (ts >= SeventyTwoHoursAgo) ytLikedSongsRecent++;
      }
    }
  }

  // 2. Playlists songs
  const playlists = await db.collection("playlists").find({}).toArray();
  let ytPlaylistSongsTotal = 0;
  let ytPlaylistSongsRecent = 0;

  for (const p of playlists) {
    for (const s of p.songs || []) {
      const isYt = s.provider === "youtube" || /^[a-zA-Z0-9_-]{11}$/.test(s.songId || "");
      if (isYt) {
        ytPlaylistSongsTotal++;
        const ts = new Date(s.addedAt || s.createdAt || p.updatedAt || p.createdAt || 0);
        if (ts >= SeventyTwoHoursAgo) ytPlaylistSongsRecent++;
      }
    }
  }

  // 3. ListeningHistory
  const lhTotal = await db.collection("listeninghistories").countDocuments({ songId: { $regex: /^[a-zA-Z0-9_-]{11}$/ } });
  const lhRecent = await db.collection("listeninghistories").countDocuments({
    songId: { $regex: /^[a-zA-Z0-9_-]{11}$/ },
    $or: [
      { playedAt: { $gte: SeventyTwoHoursAgo } },
      { createdAt: { $gte: SeventyTwoHoursAgo } }
    ]
  });

  // 4. DuoSessions
  const duoDocs = await db.collection("duosessions").find({}).toArray();
  let duoYtRecent = 0;
  for (const d of duoDocs) {
    const ts = new Date(d.updatedAt || d.createdAt || 0);
    if (ts >= SeventyTwoHoursAgo) {
      if (d.currentSong && (/^[a-zA-Z0-9_-]{11}$/.test(d.currentSong.id || d.currentSong.songId || "") || d.currentSong.migrationStatus === "missing")) duoYtRecent++;
    }
  }

  // 5. SongCooccurrence
  const coocRecent = await db.collection("songcooccurrences").countDocuments({
    $or: [{ songIdA: { $regex: /^[a-zA-Z0-9_-]{11}$/ } }, { songIdB: { $regex: /^[a-zA-Z0-9_-]{11}$/ } }],
    $or: [{ lastSeenAt: { $gte: SeventyTwoHoursAgo } }, { updatedAt: { $gte: SeventyTwoHoursAgo } }, { createdAt: { $gte: SeventyTwoHoursAgo } }]
  });

  console.log(`Users Liked Songs YT: Total=${ytLikedSongsTotal}, Recent 72h=${ytLikedSongsRecent}`);
  console.log(`Playlists Songs YT: Total=${ytPlaylistSongsTotal}, Recent 72h=${ytPlaylistSongsRecent}`);
  console.log(`ListeningHistory YT: Total=${lhTotal}, Recent 72h=${lhRecent}`);
  console.log(`DuoSessions YT Recent 72h=${duoYtRecent}`);
  console.log(`SongCooccurrence YT Recent 72h=${coocRecent}`);

  await mongoose.disconnect();
}

main().catch(console.error);
