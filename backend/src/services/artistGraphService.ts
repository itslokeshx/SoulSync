// ════════════════════════════════════════════════════════════════
// ARTIST GRAPH SERVICE — Step 6
// Graph-based artist similarity lookup & caching
// ════════════════════════════════════════════════════════════════

import { ArtistRelation } from "../models/ArtistRelation.js";
import { redisGet, redisSet } from "./redis.js";

export const CURATED_ARTIST_MAP: Record<string, string[]> = {
  "ed sheeran": ["shawn mendes", "charlie puth", "james arthur", "bruno mars", "maroon 5", "lewis capaldi", "onerepublic"],
  "taylor swift": ["olivia rodrigo", "sabrina carpenter", "gracie abrams", "lorde", "lana del rey", "conan gray"],
  "the weeknd": ["post malone", "drake", "frank ocean", "sza", "travis scott", "khalid"],
  "billie eilish": ["finneas", "lorde", "olivia rodrigo", "girl in red", "clairo", "lana del rey"],
  "dua lipa": ["ava max", "bebe rexha", "rita ora", "sabrina carpenter", "tate mcrae", "katy perry"],
  "ariana grande": ["selena gomez", "camila cabello", "normani", "doja cat", "halsey", "miley cyrus"],
  "post malone": ["the weeknd", "khalid", "21 savage", "drake", "juice wrld"],
  "drake": ["travis scott", "21 savage", "future", "the weeknd", "kendrick lamar"],
  "justin bieber": ["shawn mendes", "charlie puth", "zayn", "one direction", "the weeknd"],
  "coldplay": ["one republic", "imagine dragons", "the fray", "keane", "snow patrol"],
  "imagine dragons": ["one republic", "coldplay", "bastille", "fall out boy"],
  "sabrina carpenter": ["olivia rodrigo", "tate mcrae", "chappell roan", "dua lipa"],
  "bts": ["jungkook", "jimin", "v", "stray kids", "txt", "enhypen", "seventeen"],
  "blackpink": ["twice", "aespa", "itzy", "le sserafim", "newjeans", "jennie", "lisa"],
  "bad bunny": ["rauw alejandro", "karol g", "j balvin", "ozuna", "maluma", "daddy yankee"],
  "arijit singh": ["pritam", "mithoon", "sachin-jigar", "vishal-shekhar", "jubin nautiyal", "atif aslam", "anuv jain"],
  "pritam": ["arijit singh", "vishal-shekhar", "amit trivedi", "shreya ghoshal", "sachin-jigar"],
  "shreya ghoshal": ["arijit singh", "sunidhi chauhan", "shaan", "sonu nigam", "alka yagnik"],
  "anirudh ravichander": ["santhosh narayanan", "yuvan shankar raja", "g.v. prakash", "harris jayaraj", "hiphop tamizha", "sid sriram"],
  "a.r. rahman": ["harris jayaraj", "yuvan shankar raja", "g.v. prakash", "anirudh ravichander", "sid sriram"],
  "sid sriram": ["anirudh ravichander", "a.r. rahman", "yuvan shankar raja", "g.v. prakash"],
  "diljit dosanjh": ["karan aujla", "ap dhillon", "sidhu moose wala", "b praak", "guru randhawa"]
};

import { searchSongs } from "./jiosaavn.js";

/**
 * Get related artists for a given artist name (DB Graph -> Curated Map -> Dynamic Metadata Harvester)
 */
export async function getRelatedArtists(artistName: string, limit: number = 6): Promise<string[]> {
  const cleanName = artistName.trim().toLowerCase();
  if (!cleanName) return [];

  const cacheKey = `rec:artist_graph:${cleanName}`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const relatedList: string[] = [];

  // 1. Query DB graph
  try {
    const DBRelations = await ArtistRelation.find({ artistNameA: cleanName })
      .sort({ similarityScore: -1 })
      .limit(limit)
      .lean();
    for (const rel of DBRelations) {
      if (rel.artistNameB && !relatedList.includes(rel.artistNameB)) {
        relatedList.push(rel.artistNameB);
      }
    }
  } catch {}

  // 2. Fallback to curated map
  if (relatedList.length < limit) {
    const curated = CURATED_ARTIST_MAP[cleanName] || [];
    for (const c of curated) {
      if (!relatedList.includes(c)) {
        relatedList.push(c);
      }
    }
  }

  // 3. Dynamic Metadata Harvester: Extract real collaborators from artist's top tracks
  if (relatedList.length < limit) {
    try {
      const topTracks = await searchSongs(cleanName, 25);
      const coArtistCounts = new Map<string, number>();

      for (const track of topTracks) {
        if (!track || !track.primaryArtists) continue;
        const artists = track.primaryArtists
          .split(/[,/&]+/)
          .map((a: string) => a.trim().toLowerCase())
          .filter((a: string) => a && a !== cleanName && !cleanName.includes(a) && !a.includes(cleanName));

        for (const ca of artists) {
          coArtistCounts.set(ca, (coArtistCounts.get(ca) || 0) + 1);
        }
      }

      // Sort co-artists by frequency of collaboration
      const sortedCoArtists = Array.from(coArtistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([a]) => a);

      for (const ca of sortedCoArtists) {
        if (!relatedList.includes(ca)) {
          relatedList.push(ca);
          // Persist dynamic relation into MongoDB background
          ArtistRelation.updateOne(
            { artistNameA: cleanName, artistNameB: ca },
            { $set: { similarityScore: 80, source: "dynamic_harvester" } },
            { upsert: true }
          ).catch(() => {});
        }
        if (relatedList.length >= limit) break;
      }
    } catch (err) {
      console.warn(`[ArtistGraph] Dynamic harvester failed for "${cleanName}":`, err);
    }
  }

  const finalResult = relatedList.slice(0, limit);

  await redisSet(cacheKey, JSON.stringify(finalResult), 86400).catch(() => {});
  return finalResult;
}
