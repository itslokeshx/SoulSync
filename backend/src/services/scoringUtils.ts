// ════════════════════════════════════════════════════════════════
// SOULSYNC SHARED SCORING UTILITIES
// Shared between search ranking and recommendation engines.
// ════════════════════════════════════════════════════════════════

// Major international artists (first name is often enough for matching)
export const MAJOR_INTERNATIONAL_ARTISTS = new Set([
  "ed sheeran",
  "taylor swift",
  "drake",
  "the weeknd",
  "billie eilish",
  "ariana grande",
  "post malone",
  "eminem",
  "rihanna",
  "beyonce",
  "justin bieber",
  "dua lipa",
  "bad bunny",
  "harry styles",
  "olivia rodrigo",
  "weeknd",
  "sheeran",
  "swift",
  "eilish",
  "coldplay",
  "adele",
  "bruno mars",
  "charlie puth",
  "selena gomez",
  "the chainsmokers",
  "imagine dragons",
  "maroon 5",
  "sia",
  "sam smith",
  "lewis capaldi",
]);

// Major Indian / Tamil / Hindi / Telugu artists
export const MAJOR_INDIAN_ARTISTS = new Set([
  // Tamil
  "anirudh",
  "anirudh ravichander",
  "ar rahman",
  "a.r. rahman",
  "a r rahman",
  "harris jayaraj",
  "d. imman",
  "d imman",
  "sid sriram",
  "yuvan shankar raja",
  "g.v. prakash",
  "gv prakash",
  "vijay antony",
  "devi sri prasad",
  "dsp",
  "thaman",
  "s thaman",
  "sean roldan",
  "santhosh narayanan",
  "ilaiyaraaja",
  "ilayaraja",
  "hiphop tamizha",
  // Hindi
  "arijit singh",
  "pritam",
  "vishal-shekhar",
  "shankar ehsaan loy",
  "amit trivedi",
  "sachet-parampara",
  "tanishk bagchi",
  "badshah",
  "yo yo honey singh",
  "nucleya",
  "divine",
  "jubin nautiyal",
  "darshan raval",
  "armaan malik",
  "shreya ghoshal",
  "neha kakkar",
  "sonu nigam",
  "lata mangeshkar",
  "kishore kumar",
  "kk",
  // Telugu
  "ss thaman",
  "thaman s",
  "mickey j meyer",
  "mani sharma",
  // Punjabi
  "diljit dosanjh",
  "ap dhillon",
  "sidhu moosewala",
  "karan aujla",
]);

export function popularityScore(playCount: number): number {
  if (!playCount || playCount <= 0) return 0;

  const p = playCount;
  if (p >= 500_000_000)
    return 80; // 500M+  (global mega hits)
  else if (p >= 100_000_000)
    return 72; // 100M+
  else if (p >= 50_000_000)
    return 64; // 50M+
  else if (p >= 10_000_000)
    return 56; // 10M+
  else if (p >= 5_000_000)
    return 48; // 5M+
  else if (p >= 1_000_000)
    return 38; // 1M+
  else if (p >= 500_000)
    return 28; // 500K+
  else if (p >= 100_000)
    return 18; // 100K+
  else if (p >= 10_000)
    return 8; // 10K+
  else if (p >= 1_000)
    return 2; // 1K+
  else return -10; // < 1K = almost certainly fake/cover
}

export function coverPenalty(title: string, rawQueryLower?: string): number {
  // HARD PENALTY — these words ALWAYS mean it's not the original.
  // Large enough to push below originals even with a perfect title match.
  const HARD_KEYWORDS = [
    "cover",
    "recreation",
    "recreated",
    "remake",
    "tribute",
    "karaoke",
    "fan made",
    "fan-made",
    "unofficial",
    "piano cover",
    "guitar cover",
    "lofi cover",
    "acoustic cover",
    "unplugged cover",
    "instrumental cover",
    "cover version",
    "recreated version",
    "unofficial cover",
    "reprise (cover)",
    "reprise cover",
    "piano version", // almost always a cover instrument
    "instrumental version", // almost always not the original
  ];

  for (const kw of HARD_KEYWORDS) {
    if (title.includes(kw)) return -100; // instant burial
  }

  // SOFT PENALTY — suspicious but might be original (e.g. an artist whose style IS lofi)
  const SOFT_KEYWORDS = [
    "lofi", // could be original lofi artist
    "slowed", // very rarely the original release
    "reverb", // never the original
    "8d audio", // never the original
    "nightcore", // never the original
    "sped up", // never the original
    "bass boosted", // never the original
    "remix", // might be official remix — soft, not hard
    "mashup", // not the original
    "medley", // compilation
  ];

  for (const kw of SOFT_KEYWORDS) {
    if (title.includes(kw)) {
      if (rawQueryLower && rawQueryLower.includes(kw)) continue;
      return -30;
    }
  }

  return 0;
}

export function originalIndicatorBonus(title: string): number {
  const MARKERS = [
    { kw: "official music video", pts: 20 },
    { kw: "official video", pts: 20 },
    { kw: "official audio", pts: 15 },
    { kw: "official", pts: 10 },
    { kw: "original", pts: 8 },
    { kw: "lyric video", pts: 5 },
    { kw: "full song", pts: 5 },
  ];

  for (const { kw, pts } of MARKERS) {
    if (title.includes(kw)) return pts; // only count the highest bonus (first match)
  }

  return 0;
}
