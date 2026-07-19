import { User } from "../models/User.js";
import { Playlist } from "../models/Playlist.js";
import { ListeningHistory } from "../models/ListeningHistory.js";
import { searchSongs } from "../services/youtubeMusicService.js";
import { redisGet, redisSet } from "../services/redis.js";

function isYouTubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

async function translateId(jioId: string, title: string, artist: string): Promise<string | null> {
  if (!jioId) return null;
  
  const cacheKey = `jio_to_yt:${jioId}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) return cached;
  } catch {}

  try {
    const query = `${title} ${artist}`;
    const ytSongs = await searchSongs(query, 5);
    if (ytSongs && ytSongs.length > 0) {
      const firstSong = ytSongs[0];
      const ytId = firstSong.id || firstSong.videoId || firstSong.video_id;
      if (ytId && isYouTubeId(ytId)) {
        await redisSet(cacheKey, ytId, 30 * 24 * 3600).catch(() => {});
        return ytId;
      }
    }
  } catch {}

  return null;
}

export async function runJioSaavnMigration() {
  try {
    console.log("[Migration] Running JioSaavn ID to YouTube ID migration...");

    const users = await User.find({ "likedSongs.songId": { $not: /^[a-zA-Z0-9_-]{11}$/ } });
    let migratedLikedCount = 0;
    for (const user of users) {
      let updated = false;
      for (const song of user.likedSongs) {
        if (!isYouTubeId(song.songId)) {
          const ytId = await translateId(song.songId, song.title, song.artist);
          if (ytId) {
            song.songId = ytId;
            updated = true;
            migratedLikedCount++;
          }
        }
      }
      if (updated) {
        await User.updateOne({ _id: user._id }, { $set: { likedSongs: user.likedSongs } });
      }
    }

    const playlists = await Playlist.find({ "songs.songId": { $not: /^[a-zA-Z0-9_-]{11}$/ } });
    let migratedPlaylistCount = 0;
    for (const playlist of playlists) {
      let updated = false;
      for (const song of playlist.songs) {
        if (!isYouTubeId(song.songId)) {
          const ytId = await translateId(song.songId, song.title || "", song.artist || "");
          if (ytId) {
            song.songId = ytId;
            updated = true;
            migratedPlaylistCount++;
          }
        }
      }
      if (updated) {
        await Playlist.updateOne({ _id: playlist._id }, { $set: { songs: playlist.songs } });
      }
    }

    const historyDocs = await ListeningHistory.find({ songId: { $not: /^[a-zA-Z0-9_-]{11}$/ } });
    let migratedHistoryCount = 0;
    for (const entry of historyDocs) {
      const ytId = await translateId(entry.songId, entry.title, entry.artist);
      if (ytId) {
        await ListeningHistory.updateOne({ _id: entry._id }, { $set: { songId: ytId } });
        migratedHistoryCount++;
      }
    }

    console.log(`[Migration] JioSaavn migration completed. Migrated: likedSongs=${migratedLikedCount}, playlistSongs=${migratedPlaylistCount}, historyEntries=${migratedHistoryCount}`);
  } catch (err) {
    console.error("[Migration] JioSaavn migration failed:", err);
  }
}
