// ════════════════════════════════════════════════════════════════
// SOULSYNC SHARED SCORING UTILITIES
// Shared between search ranking and recommendation engines.
// ════════════════════════════════════════════════════════════════

// Major international artists (first name is often enough for matching)
export const MAJOR_INTERNATIONAL_ARTISTS = [
  "ed sheeran", "taylor swift", "drake", "the weeknd", "billie eilish", "ariana grande",
  "post malone", "eminem", "rihanna", "beyonce", "justin bieber", "dua lipa", "bad bunny",
  "harry styles", "olivia rodrigo", "weeknd", "sheeran", "swift", "eilish", "coldplay",
  "adele", "bruno mars", "charlie puth", "selena gomez", "the chainsmokers", "imagine dragons",
  "maroon 5", "sia", "sam smith", "lewis capaldi", "sabrina carpenter", "tate mcrae", "billie",
  "swift", "bieber", "grande"
];

// Major Indian / Tamil / Hindi / Telugu / Punjabi artists
export const MAJOR_INDIAN_ARTISTS = [
  // Tamil / Telugu / Kannada / Malayalam
  "anirudh", "anirudh ravichander", "ar rahman", "a.r. rahman", "a r rahman", "arrahman", "a. r. rahman",
  "harris jayaraj", "d. imman", "d imman", "sid sriram", "yuvan shankar raja", "g.v. prakash", "g. v. prakash",
  "gv prakash", "vijay antony", "devi sri prasad", "dsp", "thaman", "s. thaman", "s thaman", "sean roldan",
  "santhosh narayanan", "saNa", "ilaiyaraaja", "ilayaraja", "hiphop tamizha", "sushin shyam", "jakes bejoy",
  "gopi sundar", "deepak dev", "m. m. keeravani", "mm keeravani", "keeravani", "hesaham abdul wahab",
  "hesham abdul wahab", "arjun janya", "harikrishna", "spb", "s. p. balasubrahmanyam", "s p balasubrahmanyam",
  "ks chithra", "k. s. chithra", "haricharan", "shweta mohan", "vijay yesudas", "karthik",
  // Hindi / Bollywood / Punjabi
  "arijit singh", "arijit s", "pritam", "vishal-shekhar", "vishal shekhar", "shankar ehsaan loy",
  "shankar-ehsaan-loy", "amit trivedi", "vishal dadlani", "jubin nautiyal", "darshan raval",
  "shekhar ravjiani", "atif aslam", "kk", "sunidhi chauhan", "sonu nigam", "alka yagnik",
  "kumar sanu", "udit narayan", "lata mangeshkar", "kishore kumar", "rd burman", "r. d. burman",
  "yoyo honey singh", "yo yo honey singh", "raftaar", "kr$na", "divine", "emiway bantai",
  "jass manak", "guru randhawa", "ammy virk", "karan aujla", "sharry maan", "sidhu moosewala",
  "sidhu moose wala", "harrdy sandhu", "hardy sandhu", "b praak", "jaani", "mankirt aulakh",
  "jassie gill", "neha kakkar", "tony kakkar", "ap dhillon", "neha bhasin", "kavita krishnamurthy",
  "sukhwinder singh", "mohit chauhan", "sachet-parampara", "sachet tandon", "parampara tandon",
  "tanishk bagchi", "mithoon", "amaal mallik", "arman mallik", "armaan malik", "siddharth mahadevan",
  "shankar mahadevan", "ehsaan noorani", "loy mendonsa", "sanjay leela bhansali", "javed ali",
  "alisha chinai", "kailash kher", "shaan", "adnan sami", "rahat fateh ali khan", "nusrat fateh ali khan",
  "sajid-wajid", "sajid khan", "wajid khan", "salim-sulaiman", "salim merchant", "sulaiman merchant",
  "meet bros", "anand-milind", "nadeem-shravan", "anu malik", "himesh reshammiya", "nehha sandhu",
  "sidhu", "mankirt", "pav dharia", "maninder buttar", "sharry", "parmish verma", "jass", "randhawa"
];

export const POPULAR_ARTISTS = [...MAJOR_INTERNATIONAL_ARTISTS, ...MAJOR_INDIAN_ARTISTS];

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

// ── Blacklisted labels — known cover/tribute publishers ─────────
// Shared by searchEnhancer.ts and recommendationEngine.ts.
export const BLACKLISTED_LABELS = [
  "magic records",
  "soave records",
  "vibe network",
  "vibes network",
  "luxebeats",
  "17diamonds",
  "cover kingdom",
  "acoustic hits",
  "tribute kingdom",
  "fanmade",
  "fan-made",
  "unofficial",
  "karaoke hits",
  "piano dreams",
  "relaxing covers",
];

// ── Original-release markers (title keywords) ──────────────────
// Bonus-eligible keywords that indicate the song is a legitimate release.
export const ORIGINAL_MARKERS = [
  "official music video",
  "official video",
  "official audio",
  "official",
  "original",
  "lyric video",
  "full song",
];
