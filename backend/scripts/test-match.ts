import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { searchSongsHybrid, normalizeSongToCanonical, Song } from "../src/services/jiosaavn.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// Helper to normalize strings for comparison
function cleanStr(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\(from "[^"]+"\)/gi, "")
    .replace(/\(official audio\)/gi, "")
    .replace(/\(official video\)/gi, "")
    .replace(/\(lyrical\)/gi, "")
    .replace(/\(video\)/gi, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[^a-z0-9\s]/gi, "")
    .trim();
}

function calculateConfidence(
  target: { title: string; artist: string; album?: string; duration?: number },
  candidate: Song
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const tTitle = cleanStr(target.title);
  const cTitle = cleanStr(candidate.name);

  // 1. Title match (max 40 pts)
  if (tTitle === cTitle) {
    score += 40;
    reasons.push("Exact title");
  } else if (tTitle.includes(cTitle) || cTitle.includes(tTitle)) {
    score += 30;
    reasons.push("Partial title match");
  } else {
    // word overlap
    const tWords = new Set(tTitle.split(/\s+/).filter((w) => w.length > 2));
    const cWords = new Set(cTitle.split(/\s+/).filter((w) => w.length > 2));
    const intersection = [...tWords].filter((w) => cWords.has(w));
    if (intersection.length > 0 && tWords.size > 0) {
      const titleOverlapRatio = intersection.length / Math.max(tWords.size, cWords.size);
      score += Math.round(titleOverlapRatio * 25);
      reasons.push(`Title token overlap (${Math.round(titleOverlapRatio * 100)}%)`);
    }
  }

  // 2. Primary Artist match (max 35 pts)
  const tArtist = cleanStr(target.artist);
  const cArtist = cleanStr(candidate.primaryArtists);
  if (tArtist && cArtist) {
    if (tArtist === cArtist) {
      score += 35;
      reasons.push("Exact artist");
    } else {
      const tAWords = tArtist.split(/\s+/).filter((w) => w.length > 2);
      const cAWords = cArtist.split(/\s+/).filter((w) => w.length > 2);
      const matchedArtistWords = tAWords.filter((w) => cAWords.includes(w));
      if (matchedArtistWords.length > 0) {
        score += Math.min(30, matchedArtistWords.length * 15);
        reasons.push(`Artist overlap (${matchedArtistWords.join(", ")})`);
      }
    }
  }

  // 3. Album match (max 10 pts)
  if (target.album && candidate.album) {
    const tAlbum = cleanStr(target.album);
    const cAlbum = cleanStr(candidate.album);
    if (tAlbum && cAlbum && (tAlbum === cAlbum || tAlbum.includes(cAlbum) || cAlbum.includes(tAlbum))) {
      score += 10;
      reasons.push("Album match");
    }
  }

  // 4. Duration match (max 15 pts)
  if (target.duration && candidate.duration) {
    const diff = Math.abs(target.duration - candidate.duration);
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

  return { score, reasons };
}

async function testMatch() {
  const uri = process.env.MONGODB_URI;
  if (!uri) process.exit(1);

  await mongoose.connect(uri, { dbName: "soulsync" });
  const db = mongoose.connection.db;
  if (!db) process.exit(1);

  const sampleYtHist = await db.collection("listeninghistories").find({
    songId: { $regex: /^[a-zA-Z0-9_-]{11}$/ }
  }).limit(5).toArray();

  console.log(`Testing JioSaavn search & matching on ${sampleYtHist.length} songs...\n`);

  for (const h of sampleYtHist) {
    console.log(`Original YouTube Song: "${h.title}" by "${h.artist}" (id: ${h.songId}, duration: ${h.duration}s)`);
    const query = `${h.title} ${h.artist}`.trim();
    const rawResults = await searchSongsHybrid(query, 10, h.artist);
    const candidates = rawResults.map((r) => normalizeSongToCanonical(r)).filter((s): s is Song => s !== null);

    let bestMatch: Song | null = null;
    let bestScore = 0;
    let bestReasons: string[] = [];

    for (const cand of candidates) {
      const { score, reasons } = calculateConfidence({ title: h.title, artist: h.artist, duration: h.duration }, cand);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cand;
        bestReasons = reasons;
      }
    }

    if (bestMatch && bestScore >= 40) {
      console.log(`  -> BEST MATCH: "${bestMatch.name}" by "${bestMatch.primaryArtists}" (JioSaavn ID: ${bestMatch.id}, duration: ${bestMatch.duration}s)`);
      console.log(`     Confidence: ${bestScore}% | Reasons: ${bestReasons.join("; ")}`);
    } else {
      console.log(`  -> NO REASONABLE MATCH (highest score: ${bestScore}) -> Mark missing`);
    }
    console.log("--------------------------------------------------------------------------------");
  }

  await mongoose.disconnect();
}

testMatch().catch(console.error);
