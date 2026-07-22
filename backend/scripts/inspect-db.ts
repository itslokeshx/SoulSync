import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

async function inspectFull() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is missing");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: "soulsync" });
  const db = mongoose.connection.db;
  if (!db) process.exit(1);

  // 1. Users likedSongs
  console.log("\n=================== USERS LIKED SONGS ===================");
  const users = await db.collection("users").find({ "likedSongs.0": { $exists: true } }).toArray();
  let totalUserYt = 0;
  for (const u of users) {
    const ytSongs = u.likedSongs.filter((s: any) => /^[a-zA-Z0-9_-]{11}$/.test(s.songId || "") || s.songId?.includes("youtube") || s.downloadUrl?.some((d: any) => d.url?.includes("youtube") || d.url?.includes("googlevideo") || d.url?.includes("ytstream")));
    totalUserYt += ytSongs.length;
    if (ytSongs.length > 0) {
      console.log(`User ${u._id} (${u.email}) has ${ytSongs.length} YT songs out of ${u.likedSongs.length}`);
      console.log("Sample YT liked song:", JSON.stringify(ytSongs[0], null, 2));
    }
  }
  console.log(`Total YT songs in User.likedSongs: ${totalUserYt}`);

  // 2. Playlists
  console.log("\n=================== PLAYLISTS ===================");
  const playlists = await db.collection("playlists").find({ "songs.0": { $exists: true } }).toArray();
  let totalPlaylistYt = 0;
  for (const p of playlists) {
    const ytSongs = p.songs.filter((s: any) => /^[a-zA-Z0-9_-]{11}$/.test(s.songId || "") || s.songId?.includes("youtube") || s.downloadUrl?.some((d: any) => d.url?.includes("youtube") || d.url?.includes("googlevideo") || d.url?.includes("ytstream")));
    totalPlaylistYt += ytSongs.length;
    if (ytSongs.length > 0) {
      console.log(`Playlist "${p.name}" (${p._id}) has ${ytSongs.length} YT songs out of ${p.songs.length}`);
      console.log("Sample YT playlist song:", JSON.stringify(ytSongs[0], null, 2));
    }
  }
  console.log(`Total YT songs in Playlists: ${totalPlaylistYt}`);

  // 3. ListeningHistory
  console.log("\n=================== LISTENING HISTORY ===================");
  const lhCount = await db.collection("listeninghistories").countDocuments();
  const lhYt = await db.collection("listeninghistories").find({
    $or: [
      { songId: { $regex: /^[a-zA-Z0-9_-]{11}$/ } },
      { songId: { $regex: /youtube/i } }
    ]
  }).toArray();
  console.log(`Total ListeningHistory docs: ${lhCount}, YT docs: ${lhYt.length}`);
  if (lhYt.length > 0) {
    console.log("Sample YT ListeningHistory:", JSON.stringify(lhYt[0], null, 2));
  }

  // 4. DuoSession
  console.log("\n=================== DUO SESSIONS ===================");
  const duos = await db.collection("duosessions").find().toArray();
  console.log(`Total DuoSession docs: ${duos.length}`);
  for (const d of duos) {
    console.log(`Duo ${d._id} code: ${d.code}`);
    console.log("Current song:", d.currentSong);
    console.log("Song history count:", d.songHistory?.length);
    console.log("Notes count:", d.notes?.length);
  }

  // 5. SongCooccurrence
  console.log("\n=================== SONG COOCCURRENCE ===================");
  const coocCount = await db.collection("songcooccurrences").countDocuments();
  const coocYt = await db.collection("songcooccurrences").find({
    $or: [
      { songIdA: { $regex: /^[a-zA-Z0-9_-]{11}$/ } },
      { songIdB: { $regex: /^[a-zA-Z0-9_-]{11}$/ } }
    ]
  }).toArray();
  console.log(`Total SongCooccurrence docs: ${coocCount}, YT pairs: ${coocYt.length}`);
  if (coocYt.length > 0) {
    console.log("Sample YT SongCooccurrence:", JSON.stringify(coocYt[0], null, 2));
  }

  // 6. UserMixSet
  console.log("\n=================== USER MIX SETS ===================");
  const mixCount = await db.collection("usermixsets").countDocuments();
  const mixesYt = await db.collection("usermixsets").find({
    "mixes.songIds": { $regex: /^[a-zA-Z0-9_-]{11}$/ }
  }).toArray();
  console.log(`Total UserMixSet docs: ${mixCount}, YT mixes docs: ${mixesYt.length}`);
  if (mixesYt.length > 0) {
    console.log("Sample YT UserMixSet:", JSON.stringify(mixesYt[0], null, 2));
  }

  // 7. UserTasteProfile
  console.log("\n=================== USER TASTE PROFILE ===================");
  const tasteCount = await db.collection("usertasteprofiles").countDocuments();
  const tasteYt = await db.collection("usertasteprofiles").find({
    recentSongIds: { $regex: /^[a-zA-Z0-9_-]{11}$/ }
  }).toArray();
  console.log(`Total UserTasteProfile docs: ${tasteCount}, YT taste docs: ${tasteYt.length}`);
  if (tasteYt.length > 0) {
    console.log("Sample YT UserTasteProfile recentSongIds:", tasteYt[0].recentSongIds);
  }

  await mongoose.disconnect();
}

inspectFull().catch(console.error);
