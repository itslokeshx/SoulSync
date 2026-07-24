// ════════════════════════════════════════════════════════════════
// SOULSYNC SHARED SCORING UTILITIES
// Shared between search ranking and recommendation engines.
// ════════════════════════════════════════════════════════════════

import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { RecentlyRecommended } from "../models/RecentlyRecommended.js";
import type { Song } from "./jiosaavn.js";

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

// ════════════════════════════════════════════════════════════════
// LANGUAGE RESOLVER & RECENTLY RECOMMENDED HELPERS
// ════════════════════════════════════════════════════════════════

export interface LanguageFilterResult {
  languages: string[];
  source: "explicit" | "taste_profile" | "global_fallback";
}

/**
 * Three-tier language resolution:
 * Tier 1: Explicit User Preference (HARD FILTER if set)
 * Tier 2: Recency-weighted UserTasteProfile language distribution
 * Tier 3: True cold-start global fallback across major languages
 */
export function resolveLanguageFilter(
  userPrefs?: { languages?: string[] } | null,
  tasteProfile?: IUserTasteProfile | null,
): LanguageFilterResult {
  // Tier 1: Explicit User Preference (HARD FILTER)
  if (userPrefs?.languages && userPrefs.languages.length > 0) {
    const explicit = userPrefs.languages
      .map((l) => l.toLowerCase().trim())
      .filter(Boolean);
    if (explicit.length > 0) {
      console.log(`[LANG] using: explicit preference (${explicit.join(", ")})`);
      return { languages: explicit, source: "explicit" };
    }
  }

  // Tier 2: Recency-weighted UserTasteProfile language distribution
  if (tasteProfile?.languages && tasteProfile.languages.length > 0) {
    const tasteLangs = tasteProfile.languages
      .map((l) => l.language.toLowerCase().trim())
      .filter(Boolean);
    if (tasteLangs.length > 0) {
      console.log(`[LANG] using: taste profile (${tasteLangs.join(", ")})`);
      return { languages: tasteLangs, source: "taste_profile" };
    }
  }

  // Tier 3: True cold-start global fallback (English and Hindi)
  console.log("[LANG] using: global fallback (english, hindi)");
  return {
    languages: ["english", "hindi"],
    source: "global_fallback",
  };
}

/**
 * Detect language of a song using explicit metadata, artist maps, title/album markers, and script inspection.
 */
export function detectSongLanguage(song: Song): string | null {
  // 1. Explicit song.language field (if non-empty and not unknown)
  const explicitLang = (song.language || "").toLowerCase().trim();
  if (explicitLang && explicitLang !== "unknown" && explicitLang !== "null" && explicitLang !== "undefined") {
    if (explicitLang === "harianvi" || explicitLang === "haryanvi") return "haryanvi";
    if (explicitLang === "odiya" || explicitLang === "odia") return "odia";
    return explicitLang;
  }

  const title = (song.name || "").toLowerCase();
  const artist = (song.primaryArtists || "").toLowerCase();
  const album = (song.album || "").toLowerCase();
  const combined = `${title} ${artist} ${album}`;

  // 2. Global & Indic Script detection
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(combined)) return "korean";
  if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(combined)) return "japanese";
  if (/[\u0600-\u06FF]/.test(combined)) return "arabic";
  if (/[\u0400-\u04FF]/.test(combined)) return "russian";
  if (/[\u0900-\u097F]/.test(combined)) return "hindi"; // Devanagari (Hindi/Marathi)
  if (/[\u0B80-\u0BFF]/.test(combined)) return "tamil"; // Tamil script
  if (/[\u0C00-\u0C7F]/.test(combined)) return "telugu"; // Telugu script
  if (/[\u0A00-\u0A7F]/.test(combined)) return "punjabi"; // Gurmukhi script
  if (/[\u0D00-\u0D7F]/.test(combined)) return "malayalam"; // Malayalam script
  if (/[\u0C80-\u0CFF]/.test(combined)) return "kannada"; // Kannada script
  if (/[\u0980-\u09FF]/.test(combined)) return "bengali"; // Bengali script

  // 3. Known language markers in title/album/artist
  if (/\b(k-pop|kpop|korean)\b/i.test(combined)) return "korean";
  if (/\b(j-pop|jpop|japanese|anime)\b/i.test(combined)) return "japanese";
  if (/\b(spanish|español|latino|reggaeton)\b/i.test(combined)) return "spanish";
  if (/\b(french|français)\b/i.test(combined)) return "french";
  if (/\b(german|deutsch)\b/i.test(combined)) return "german";
  if (/\b(portuguese|português)\b/i.test(combined)) return "portuguese";
  if (/\b(arabic)\b/i.test(combined)) return "arabic";
  if (/\b(tamil|kollywood)\b/i.test(combined)) return "tamil";
  if (/\b(telugu|tollywood)\b/i.test(combined)) return "telugu";
  if (/\b(punjabi)\b/i.test(combined)) return "punjabi";
  if (/\b(malayalam)\b/i.test(combined)) return "malayalam";
  if (/\b(kannada|sandalwood)\b/i.test(combined)) return "kannada";
  if (/\b(bollywood|hindi)\b/i.test(combined)) return "hindi";

  // 4. Known Artist Language Maps
  const KOREAN_ARTISTS = [
    "bts", "blackpink", "stray kids", "twice", "newjeans", "seventeen",
    "exo", "iu", "txt", "enhypen", "red velvet", "le sserafim", "aespa",
    "itzy", "jungkook", "jimin", "v", "suga"
  ];
  for (const ka of KOREAN_ARTISTS) if (artist.includes(ka)) return "korean";

  const JAPANESE_ARTISTS = [
    "yoasobi", "kenshi yonezu", "fujii kaze", "one ok rock", "ado",
    "lisa", "official hige dandism", "hikaru utada", "radwimps", "vaundy"
  ];
  for (const ja of JAPANESE_ARTISTS) if (artist.includes(ja)) return "japanese";

  const SPANISH_ARTISTS = [
    "bad bunny", "rosalía", "rosalia", "j balvin", "karol g", "rauw alejandro",
    "daddy yankee", "maluma", "ozuna", "luis fonsi", "enrique iglesias",
    "peso pluma", "shakira", "camilo"
  ];
  for (const sa of SPANISH_ARTISTS) if (artist.includes(sa)) return "spanish";

  const FRENCH_ARTISTS = [
    "stromae", "indila", "gims", "maître gims", "aya nakamura", "jul",
    "ninho", "soolking", "angèle", "angele", "zaz", "david guetta", "daft punk"
  ];
  for (const fa of FRENCH_ARTISTS) if (artist.includes(fa)) return "french";

  const GERMAN_ARTISTS = [
    "rammstein", "apache 207", "bonez mc", "peter fox", "cro",
    "robin schulz", "zedd", "scorpions", "tokio hotel"
  ];
  for (const ga of GERMAN_ARTISTS) if (artist.includes(ga)) return "german";

  const PORTUGUESE_ARTISTS = [
    "anitta", "alok", "marília mendonça", "marilia mendonca", "gusttavo lima",
    "ludmilla", "roberto carlos", "jão", "jao", "luísa sonza", "luisa sonza"
  ];
  for (const pa of PORTUGUESE_ARTISTS) if (artist.includes(pa)) return "portuguese";

  const ARABIC_ARTISTS = [
    "amr diab", "nancy ajram", "elissa", "sherine", "saad lamjarred",
    "mohamed hamaki", "tamer hosny", "fairouz", "assala"
  ];
  for (const aa of ARABIC_ARTISTS) if (artist.includes(aa)) return "arabic";

  const TAMIL_ARTISTS = [
    "anirudh", "ar rahman", "harris jayaraj", "sid sriram", "yuvan shankar",
    "g.v. prakash", "gv prakash", "hiphop tamizha", "santhosh narayanan",
    "ilaiyaraaja", "ilayaraja", "vijay antony", "d. imman", "d imman",
    "sai abhyankkar", "paal dabba", "deepthi suresh", "bebhumika", "saNa"
  ];
  for (const ta of TAMIL_ARTISTS) {
    if (artist.includes(ta)) return "tamil";
  }

  const HINDI_ARTISTS = [
    "arijit singh", "mithoon", "pritam", "vishal-shekhar", "vishal shekhar",
    "jubin nautiyal", "badshah", "guru randhawa", "neha kakkar", "tanishk bagchi",
    "anuv jain", "navjot ahuja", "shashwat sachdev", "sachet-parampara",
    "sachet tandon", "parampara tandon", "shreya ghoshal", "sonu nigam",
    "sunidhi chauhan", "shaan", "kk", "atif aslam", "lata mangeshkar",
    "kishore kumar", "kumar sanu", "alka yagnik", "udit narayan", "hariharan", "lalit sen"
  ];
  for (const ha of HINDI_ARTISTS) {
    if (artist.includes(ha)) return "hindi";
  }

  const TELUGU_ARTISTS = [
    "devi sri prasad", "dsp", "thaman", "s. thaman", "s thaman", "keeravani",
    "m. m. keeravani", "jangi reddy", "kasarla shyam", "arjun chandy"
  ];
  for (const te of TELUGU_ARTISTS) {
    if (artist.includes(te)) return "telugu";
  }

  const ENGLISH_ARTISTS = [
    "ed sheeran", "taylor swift", "drake", "the weeknd", "billie eilish",
    "ariana grande", "post malone", "eminem", "rihanna", "beyonce",
    "justin bieber", "dua lipa", "bad bunny", "harry styles", "olivia rodrigo",
    "coldplay", "adele", "bruno mars", "charlie puth", "selena gomez",
    "the chainsmokers", "imagine dragons", "maroon 5", "sia", "sam smith",
    "sabrina carpenter", "tate mcrae", "diplo", "major lazer", "madonna",
    "becky g", "coi leray", "pitbull", "jennifer lopez", "alan walker",
    "alok", "shawn mendes", "camila cabello", "hugel", "prateek kuhad",
    "tsumyoki", "ramya pothuri", "noush"
  ];
  for (const ea of ENGLISH_ARTISTS) {
    if (artist.includes(ea)) return "english";
  }

  return null;
}

/**
 * Filter songs to ONLY those whose language matches the allowed languages list.
 */
export function filterByLanguages(
  candidates: Song[],
  allowedLanguages: string[],
): Song[] {
  if (!allowedLanguages || allowedLanguages.length === 0) return candidates;
  const allowedSet = new Set(allowedLanguages.map((l) => l.toLowerCase().trim()));

  return candidates.filter((song) => {
    const rawLang = (song.language || "").toLowerCase().trim();
    if (rawLang && rawLang !== "unknown" && rawLang !== "null" && rawLang !== "undefined") {
      if (allowedSet.has(rawLang)) return true;
    }
    const detectedLang = detectSongLanguage(song);
    if (detectedLang) {
      return allowedSet.has(detectedLang);
    }
    // If language is undetected/unknown and user context is regional (e.g. Tamil, Hindi),
    // strictly reject to prevent random English leakage
    const isPurelyRegional = !allowedSet.has("english");
    if (isPurelyRegional) {
      return false;
    }
    return true;
  });
}

/**
 * Fetch song IDs recently surfaced to user in Made For You, Up Next, etc.
 */
export async function getRecentlyRecommendedSongIds(
  userId: string,
  daysWindow: number = 7,
): Promise<string[]> {
  if (!userId || userId === "guest") return [];
  try {
    const sinceDate = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000);
    const records = await RecentlyRecommended.find({
      userId,
      surfacedAt: { $gte: sinceDate },
    })
      .select("songId")
      .lean();
    return Array.from(new Set(records.map((r) => r.songId)));
  } catch (err) {
    console.error("[RecentlyRecommended] Fetch error:", err);
    return [];
  }
}

/**
 * Record surfaced song IDs when a batch is actually served to the client.
 */
export async function recordRecentlyRecommended(
  userId: string,
  songIds: string[],
  surfacedIn: "made_for_you" | "up_next" | "discovery_mix" | "favorites_mix" | "new_music_mix",
): Promise<void> {
  if (!userId || userId === "guest" || !songIds || songIds.length === 0) return;
  try {
    const docs = songIds.map((songId) => ({
      userId,
      songId,
      surfacedIn,
      surfacedAt: new Date(),
    }));
    await RecentlyRecommended.insertMany(docs, { ordered: false });
  } catch (err) {
    // Ignore error
  }
}
