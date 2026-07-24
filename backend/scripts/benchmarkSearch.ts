// ════════════════════════════════════════════════════════════════
// SOULSYNC SEARCH ENGINE BENCHMARK SUITE (100+ REAL-WORLD QUERIES)
// Validates: Top-1 Accuracy, Top-3 Accuracy, Latency, Intent & Entity Parsing
// ════════════════════════════════════════════════════════════════

import { enhancedSearch, parseQuery } from "../src/services/searchEnhancer.js";
import { recordSearchClick, recordPlaybackTelemetry } from "../src/services/telemetryStore.js";

interface TestCase {
  query: string;
  category:
    | "Songs"
    | "Artists"
    | "Albums"
    | "Movies"
    | "Directors"
    | "Actors"
    | "Trending"
    | "Natural language"
    | "Typo queries"
    | "Mixed-language queries"
    | "Incomplete queries";
  expectedKeyword?: string;
  expectedArtist?: string;
}

const TEST_SUITE: TestCase[] = [
  // ── 1. Songs (15 queries) ───────────────────────────────────────
  { query: "shape of you", category: "Songs", expectedKeyword: "Shape of You", expectedArtist: "Ed Sheeran" },
  { query: "blinding lights", category: "Songs", expectedKeyword: "Blinding Lights", expectedArtist: "The Weeknd" },
  { query: "kesariya", category: "Songs", expectedKeyword: "Kesariya", expectedArtist: "Arijit Singh" },
  { query: "tum hi ho", category: "Songs", expectedKeyword: "Tum Hi Ho", expectedArtist: "Arijit Singh" },
  { query: "katchi sera", category: "Songs", expectedKeyword: "Katchi Sera", expectedArtist: "Sai Abhyankkar" },
  { query: "illuminati", category: "Songs", expectedKeyword: "Illuminati", expectedArtist: "Sushin Shyam" },
  { query: "hukum", category: "Songs", expectedKeyword: "Hukum", expectedArtist: "Anirudh Ravichander" },
  { query: "arabic kuthu", category: "Songs", expectedKeyword: "Arabic Kuthu", expectedArtist: "Anirudh Ravichander" },
  { query: "pasoori", category: "Songs", expectedKeyword: "Pasoori" },
  { query: "despacito", category: "Songs", expectedKeyword: "Despacito" },
  { query: "flowers", category: "Songs", expectedKeyword: "Flowers", expectedArtist: "Miley Cyrus" },
  { query: "stay", category: "Songs", expectedKeyword: "Stay", expectedArtist: "Justin Bieber" },
  { query: "believer", category: "Songs", expectedKeyword: "Believer", expectedArtist: "Imagine Dragons" },
  { query: "faded", category: "Songs", expectedKeyword: "Faded", expectedArtist: "Alan Walker" },
  { query: "peaches", category: "Songs", expectedKeyword: "Peaches", expectedArtist: "Justin Bieber" },

  // ── 2. Artists (15 queries) ──────────────────────────────────────
  { query: "anirudh", category: "Artists", expectedArtist: "Anirudh Ravichander" },
  { query: "arijit singh", category: "Artists", expectedArtist: "Arijit Singh" },
  { query: "ar rahman", category: "Artists", expectedArtist: "A.R. Rahman" },
  { query: "taylor swift", category: "Artists", expectedArtist: "Taylor Swift" },
  { query: "the weeknd", category: "Artists", expectedArtist: "The Weeknd" },
  { query: "bruno mars", category: "Artists", expectedArtist: "Bruno Mars" },
  { query: "diljit dosanjh", category: "Artists", expectedArtist: "Diljit Dosanjh" },
  { query: "sid sriram", category: "Artists", expectedArtist: "Sid Sriram" },
  { query: "shreya ghoshal", category: "Artists", expectedArtist: "Shreya Ghoshal" },
  { query: "sushin shyam", category: "Artists", expectedArtist: "Sushin Shyam" },
  { query: "ed sheeran", category: "Artists", expectedArtist: "Ed Sheeran" },
  { query: "ap dhillon", category: "Artists", expectedArtist: "AP Dhillon" },
  { query: "karan aujla", category: "Artists", expectedArtist: "Karan Aujla" },
  { query: "yo yo honey singh", category: "Artists", expectedArtist: "Honey Singh" },
  { query: "pritam", category: "Artists", expectedArtist: "Pritam" },

  // ── 3. Albums (10 queries) ───────────────────────────────────────
  { query: "coolie soundtrack", category: "Albums", expectedKeyword: "Coolie" },
  { query: "leo album", category: "Albums", expectedKeyword: "Leo" },
  { query: "jailer album", category: "Albums", expectedKeyword: "Jailer" },
  { query: "oppenheimer ost", category: "Albums", expectedKeyword: "Oppenheimer" },
  { query: "aavesham ost", category: "Albums", expectedKeyword: "Aavesham" },
  { query: "animal album", category: "Albums", expectedKeyword: "Animal" },
  { query: "rockstar album", category: "Albums", expectedKeyword: "Rockstar" },
  { query: "dune soundtrack", category: "Albums", expectedKeyword: "Dune" },
  { query: "interstellar ost", category: "Albums", expectedKeyword: "Interstellar" },
  { query: "rrr album", category: "Albums", expectedKeyword: "RRR" },

  // ── 4. Movies (12 queries) ───────────────────────────────────────
  { query: "coolie", category: "Movies", expectedKeyword: "Coolie" },
  { query: "leo", category: "Movies", expectedKeyword: "Leo" },
  { query: "jailer", category: "Movies", expectedKeyword: "Jailer" },
  { query: "the odyssey", category: "Movies", expectedKeyword: "Odyssey" },
  { query: "oppenheimer", category: "Movies", expectedKeyword: "Oppenheimer" },
  { query: "interstellar", category: "Movies", expectedKeyword: "Interstellar" },
  { query: "pushpa 2", category: "Movies", expectedKeyword: "Pushpa" },
  { query: "devara", category: "Movies", expectedKeyword: "Devara" },
  { query: "kalki 2898 ad", category: "Movies", expectedKeyword: "Kalki" },
  { query: "good bad ugly", category: "Movies", expectedKeyword: "Good Bad Ugly" },
  { query: "vidaamuyarchi", category: "Movies", expectedKeyword: "Vidaamuyarchi" },
  { query: "kanguva", category: "Movies", expectedKeyword: "Kanguva" },

  // ── 5. Directors (8 queries) ─────────────────────────────────────
  { query: "christopher nolan", category: "Directors", expectedKeyword: "Interstellar" },
  { query: "nolan", category: "Directors", expectedKeyword: "Interstellar" },
  { query: "lokesh kanagaraj", category: "Directors", expectedKeyword: "Coolie" },
  { query: "nelson dilipkumar", category: "Directors", expectedKeyword: "Jailer" },
  { query: "atlee", category: "Directors", expectedKeyword: "Jawan" },
  { query: "mani ratnam", category: "Directors", expectedKeyword: "Ponniyin" },
  { query: "ss rajamouli", category: "Directors", expectedKeyword: "RRR" },
  { query: "prashanth neel", category: "Directors", expectedKeyword: "KGF" },

  // ── 6. Actors (12 queries) ───────────────────────────────────────
  { query: "rajinikanth", category: "Actors", expectedKeyword: "Hukum" },
  { query: "rajini", category: "Actors", expectedKeyword: "Coolie" },
  { query: "thalapathy vijay", category: "Actors", expectedKeyword: "Leo" },
  { query: "ajith kumar", category: "Actors", expectedKeyword: "Vidaamuyarchi" },
  { query: "shah rukh khan", category: "Actors", expectedKeyword: "Jawan" },
  { query: "ranbir kapoor", category: "Actors", expectedKeyword: "Animal" },
  { query: "allu arjun", category: "Actors", expectedKeyword: "Pushpa" },
  { query: "prabhas", category: "Actors", expectedKeyword: "Kalki" },
  { query: "suriya", category: "Actors", expectedKeyword: "Kanguva" },
  { query: "kamal haasan", category: "Actors", expectedKeyword: "Vikram" },
  { query: "dulquer salmaan", category: "Actors", expectedKeyword: "Lucky" },
  { query: "fahadh faasil", category: "Actors", expectedKeyword: "Aavesham" },

  // ── 7. Trending & Recency (8 queries) ────────────────────────────
  { query: "latest anirudh", category: "Trending", expectedArtist: "Anirudh" },
  { query: "new rajini songs", category: "Trending", expectedKeyword: "Coolie" },
  { query: "viral tamil song", category: "Trending" },
  { query: "viral malayalam song", category: "Trending", expectedKeyword: "Illuminati" },
  { query: "new tamil hit", category: "Trending" },
  { query: "trending punjabi", category: "Trending" },
  { query: "latest ost", category: "Trending" },
  { query: "that new bruno song", category: "Trending", expectedArtist: "Bruno Mars" },

  // ── 8. Natural Language (10 queries) ─────────────────────────────
  { query: "songs from nolan movie", category: "Natural language", expectedKeyword: "Odyssey" },
  { query: "that pushpa song", category: "Natural language", expectedKeyword: "Pushpa" },
  { query: "new rajini movie", category: "Natural language", expectedKeyword: "Coolie" },
  { query: "best gym songs", category: "Natural language" },
  { query: "sad songs", category: "Natural language" },
  { query: "love songs", category: "Natural language" },
  { query: "background music", category: "Natural language" },
  { query: "movie bgm", category: "Natural language" },
  { query: "romantic hindi songs", category: "Natural language" },
  { query: "workout motivation music", category: "Natural language" },

  // ── 9. Typo Queries (11 queries) ─────────────────────────────────
  { query: "odessy", category: "Typo queries", expectedKeyword: "Odyssey" },
  { query: "hukm", category: "Typo queries", expectedKeyword: "Hukum" },
  { query: "katci sera", category: "Typo queries", expectedKeyword: "Katchi Sera" },
  { query: "anrudh", category: "Typo queries", expectedArtist: "Anirudh" },
  { query: "tailor swift", category: "Typo queries", expectedArtist: "Taylor Swift" },
  { query: "brono mars", category: "Typo queries", expectedArtist: "Bruno Mars" },
  { query: "illu", category: "Typo queries", expectedKeyword: "Illuminati" },
  { query: "illuminaty", category: "Typo queries", expectedKeyword: "Illuminati" },
  { query: "puspha", category: "Typo queries", expectedKeyword: "Pushpa" },
  { query: "katch", category: "Typo queries", expectedKeyword: "Katchi Sera" },
  { query: "huk", category: "Typo queries", expectedKeyword: "Hukum" },

  // ── 10. Mixed-language & Incomplete (10 queries) ─────────────────
  { query: "anirudh hindi hits", category: "Mixed-language queries", expectedArtist: "Anirudh" },
  { query: "ar rahman tamil melody", category: "Mixed-language queries", expectedArtist: "A.R. Rahman" },
  { query: "sad punjabi song", category: "Mixed-language queries" },
  { query: "romantic telugu track", category: "Mixed-language queries" },
  { query: "malayalam chill bgm", category: "Mixed-language queries" },
  { query: "anir", category: "Incomplete queries", expectedArtist: "Anirudh" },
  { query: "ariji", category: "Incomplete queries", expectedArtist: "Arijit" },
  { query: "tayl", category: "Incomplete queries", expectedArtist: "Taylor" },
  { query: "push", category: "Incomplete queries", expectedKeyword: "Pushpa" },
  { query: "cool", category: "Incomplete queries", expectedKeyword: "Coolie" },
];

async function runBenchmark() {
  console.log("\n==========================================================================");
  console.log("          SOULSYNC SEARCH QUALITY & LATENCY BENCHMARK SUITE               ");
  console.log("==========================================================================");

  let totalTop1Matches = 0;
  let totalTop3Matches = 0;
  let totalLatencyMs = 0;
  const failureCases: { query: string; category: string; reason: string }[] = [];

  const categoryStats: Record<string, { total: number; top1: number; top3: number; latency: number }> = {};

  for (const tc of TEST_SUITE) {
    const start = Date.now();
    let res: any;
    try {
      res = await enhancedSearch(tc.query, "all", 20);
    } catch (err: any) {
      failureCases.push({ query: tc.query, category: tc.category, reason: err.message });
      continue;
    }
    const elapsed = Date.now() - start;
    totalLatencyMs += elapsed;

    if (!categoryStats[tc.category]) {
      categoryStats[tc.category] = { total: 0, top1: 0, top3: 0, latency: 0 };
    }
    categoryStats[tc.category].total += 1;
    categoryStats[tc.category].latency += elapsed;

    const songs = res.songs || [];
    const top1 = songs[0];
    const top3 = songs.slice(0, 3);

    const matchesCondition = (song: any) => {
      // Check top artist card returned in result
      if (tc.expectedArtist && Array.isArray(res.artists) && res.artists.length > 0) {
        const artCardName = (res.artists[0].name || "").toLowerCase();
        if (artCardName.includes(tc.expectedArtist.toLowerCase())) return true;
      }

      if (!song) return false;
      const title = (song.name || "").toLowerCase();
      const artist = (song.primaryArtists || song.artist || "").toLowerCase();
      const album = (song.album?.name || (typeof song.album === "string" ? song.album : "")).toLowerCase();

      if (tc.expectedKeyword) {
        const kw = tc.expectedKeyword.toLowerCase();
        if (title.includes(kw) || album.includes(kw)) return true;
      }
      if (tc.expectedArtist) {
        const art = tc.expectedArtist.toLowerCase();
        if (artist.includes(art)) return true;
      }
      if (!tc.expectedKeyword && !tc.expectedArtist && song.name) {
        return true;
      }
      return false;
    };

    const isTop1Match = matchesCondition(top1);
    const isTop3Match = top3.some(matchesCondition);

    if (isTop1Match) {
      totalTop1Matches += 1;
      categoryStats[tc.category].top1 += 1;
    } else {
      failureCases.push({
        query: tc.query,
        category: tc.category,
        reason: `Top-1 result "${top1?.name || "None"}" by ${top1?.primaryArtists || "None"} did not match expected criteria`,
      });
    }

    if (isTop3Match) {
      totalTop3Matches += 1;
      categoryStats[tc.category].top3 += 1;
    }
  }

  const avgLatency = (totalLatencyMs / TEST_SUITE.length).toFixed(2);
  const top1Acc = ((totalTop1Matches / TEST_SUITE.length) * 100).toFixed(1);
  const top3Acc = ((totalTop3Matches / TEST_SUITE.length) * 100).toFixed(1);

  console.log("\n--------------------------------------------------------------------------");
  console.log(`TOTAL QUERIES BENCHMARKED: ${TEST_SUITE.length}`);
  console.log(`AVERAGE LATENCY:            ${avgLatency} ms  (Target: < 500 ms)`);
  console.log(`TOP-1 ACCURACY:             ${top1Acc} %`);
  console.log(`TOP-3 ACCURACY:             ${top3Acc} %`);
  console.log("--------------------------------------------------------------------------\n");

  console.log("CATEGORY BREAKDOWN:");
  console.table(
    Object.entries(categoryStats).map(([cat, stat]) => ({
      Category: cat,
      Total: stat.total,
      "Top-1 Acc (%)": ((stat.top1 / stat.total) * 100).toFixed(1),
      "Top-3 Acc (%)": ((stat.top3 / stat.total) * 100).toFixed(1),
      "Avg Latency (ms)": (stat.latency / stat.total).toFixed(1),
    }))
  );

  console.log("\nFAILURE / WEAKNESS ANALYSIS:");
  if (failureCases.length === 0) {
    console.log("Zero failure cases! All 100+ queries evaluated cleanly.");
  } else {
    failureCases.slice(0, 10).forEach((f, idx) => {
      console.log(`${idx + 1}. [${f.category}] Query: "${f.query}" → Reason: ${f.reason}`);
    });
    if (failureCases.length > 10) {
      console.log(`... and ${failureCases.length - 10} more remaining edge-case failures documented.`);
    }
  }

  console.log("==========================================================================\n");
}

runBenchmark().catch(console.error);
