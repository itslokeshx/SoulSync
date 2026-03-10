// ════════════════════════════════════════════════════════════════
// SOULSYNC INTELLIGENT SEARCH RANKER
// Inspired by Spotify's popularity-first ranking + cover penalty
//
// Core idea: JioSaavn returns the right songs in the wrong order.
// This module re-ranks them so originals always beat covers.
// "shape of you" → Ed Sheeran at #1, every single time.
// ════════════════════════════════════════════════════════════════

export interface RankedSong {
  id: string;
  name: string;
  primaryArtists: string;
  image: string;
  album: string;
  duration: number;
  language: string;
  year: string;
  streamUrl: string | null;
  downloadUrl: any[] | null;
  playCount: number;
  _score?: number; // internal only, stripped before response
}

// ── THE MAIN RANKING FUNCTION ──────────────────────────────────
export function rankSearchResults(
  songs: RankedSong[],
  query: string,
  preferredLang?: string,
  knownArtist?: string | null,
): RankedSong[] {
  if (!songs || songs.length === 0) return [];

  const q = query.trim().toLowerCase();

  // Score every song
  const scored = songs.map((song) => ({
    ...song,
    _score: computeScore(song, q, preferredLang, knownArtist),
  }));

  // Sort descending by score
  scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

  // Remove internal score field before returning
  return scored.map(({ _score, ...song }) => song);
}

// ════════════════════════════════════════════════════════════════
// SCORING ENGINE
// Every factor is documented with WHY it exists
// ════════════════════════════════════════════════════════════════

function computeScore(
  song: RankedSong,
  query: string,
  preferredLang?: string,
  knownArtist?: string | null,
): number {
  let score = 0;

  const title = clean(song.name);
  const artist = clean(song.primaryArtists);
  const lang = clean(song.language);
  const q = query;

  // ── 1. POPULARITY SCORE (0–80 pts) ───────────────────────────
  score += popularityScore(song.playCount);

  // ── 2. COVER / FAKE / RECREATED PENALTY (−20 to −100 pts) ────
  score += coverPenalty(title);

  // ── 3. TITLE MATCH SCORE (0–60 pts) ──────────────────────────
  score += titleMatchScore(title, q);

  // ── 4. ARTIST MATCH BONUS (0–25 pts) ─────────────────────────
  score += artistMatchScore(artist, q);

  // ── 5. KNOWN ARTIST AUTHORITY (0–30 pts) ─────────────────────
  score += knownArtistBonus(artist, q);

  // ── 6. ORIGINAL INDICATOR BONUS (+10 to +20 pts) ─────────────
  score += originalIndicatorBonus(title);

  // ── 7. LANGUAGE PREFERENCE (0–15 pts) ────────────────────────
  score += languageScore(lang, preferredLang);

  // ── 8. STREAM URL PRESENCE (0 or −40 pts) ────────────────────
  if (!song.streamUrl) score -= 40;

  // ── 9. KNOWN ARTIST MATCH (+80 or −150) ──────────────────────
  // When we know exactly who sings this song (from KNOWN_SONGS map),
  // massively boost the correct artist and bury everyone else.
  // This is the fix for wrapper play counts being broken/near-zero:
  // even without reliable play counts, the right song still wins.
  if (knownArtist) {
    const knownLower = knownArtist.toLowerCase();
    const knownParts = knownLower.split(/\s+/).filter((p) => p.length > 2);
    const matchCount = knownParts.filter((part) =>
      artist.includes(part),
    ).length;
    if (matchCount >= 2)
      score += 80; // full name match — huge boost
    else if (matchCount === 1)
      score += 40; // partial name match — moderate boost
    else score -= 150; // wrong artist for a known song — buried
  }

  return score;
}

// ════════════════════════════════════════════════════════════════
// FACTOR 1 — POPULARITY
// Logarithmic-ish scale: each 10x jump adds ~8–16 pts.
// Prevents a 2B-play song from drowning out all title/artist signals
// while still letting popularity dominate over covers.
// ════════════════════════════════════════════════════════════════
function popularityScore(playCount: number): number {
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

// ════════════════════════════════════════════════════════════════
// FACTOR 2 — COVER PENALTY
// ════════════════════════════════════════════════════════════════
function coverPenalty(title: string): number {
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
    if (title.includes(kw)) return -30;
  }

  return 0;
}

// ════════════════════════════════════════════════════════════════
// FACTOR 3 — TITLE MATCH
// ════════════════════════════════════════════════════════════════
function titleMatchScore(title: string, query: string): number {
  // Strip common suffix noise that pollutes exact matching:
  // "shape of you (official music video)" → "shape of you"
  const cleanTitle = title
    .replace(/\(official.*?\)/gi, "")
    .replace(/\[official.*?\]/gi, "")
    .replace(/official (music |lyric |audio )?video/gi, "")
    .replace(/official audio/gi, "")
    .replace(/full song/gi, "")
    .trim();

  if (cleanTitle === query) return 60; // exact match
  if (cleanTitle.startsWith(query)) return 50; // starts with query
  if (cleanTitle.includes(query)) return 40; // contains exact phrase

  // Word-level matching: how many query words appear in title?
  const qWords = query.split(/\s+/).filter((w) => w.length > 1);
  const matches = qWords.filter((w) => cleanTitle.includes(w));
  const ratio = qWords.length > 0 ? matches.length / qWords.length : 0;

  if (ratio === 1) return 30; // all words match (different order)
  if (ratio >= 0.75) return 20; // 75%+ words match
  if (ratio >= 0.5) return 10; // 50%+ words match
  if (ratio >= 0.25) return 3; // some words match
  return 0;
}

// ════════════════════════════════════════════════════════════════
// FACTOR 4 — ARTIST MATCH
// ════════════════════════════════════════════════════════════════
function artistMatchScore(artist: string, query: string): number {
  if (!artist) return 0;

  // User typed the artist name in the query
  const firstArtist = artist.split(",")[0].trim().toLowerCase();
  if (query.includes(firstArtist)) return 25;

  // Check any listed artist (multi-artist songs)
  if (artist.split(",").some((a) => query.includes(a.trim().toLowerCase())))
    return 15;

  // Partial word match: individual artist words appear in query
  const qWords = query.split(/\s+/);
  const artistWords = artist.toLowerCase().split(/[\s,]+/);
  const matches = qWords.filter((w) => w.length > 2 && artistWords.includes(w));
  return matches.length * 8;
}

// ════════════════════════════════════════════════════════════════
// FACTOR 5 — KNOWN ARTIST AUTHORITY
// If the song artist is a major/known artist, it is almost certainly
// the original recording, not a cover.
// ════════════════════════════════════════════════════════════════

// Major international artists (first name is often enough for matching)
const MAJOR_INTERNATIONAL_ARTISTS = new Set([
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
  "ed sheeran",
  "lewis capaldi",
]);

// Major Indian / Tamil / Hindi / Telugu artists
const MAJOR_INDIAN_ARTISTS = new Set([
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

function knownArtistBonus(songArtist: string, query: string): number {
  const a = songArtist.toLowerCase();

  const isKnownInt = [...MAJOR_INTERNATIONAL_ARTISTS].some((ka) =>
    a.includes(ka),
  );
  const isKnownIndian = [...MAJOR_INDIAN_ARTISTS].some((ka) => a.includes(ka));

  if (!isKnownInt && !isKnownIndian) return 0;

  // Does the query also mention this artist's name?
  const artistFirstWord = a.split(/[\s,]+/)[0];
  const queryMentionsArtist = query.includes(artistFirstWord);

  // Known artist AND query mentions them = very high confidence it's the original
  if (queryMentionsArtist) return 30;
  // Known artist even without name in query = probably original
  return 15;
}

// ════════════════════════════════════════════════════════════════
// FACTOR 6 — ORIGINAL INDICATORS
// ════════════════════════════════════════════════════════════════
function originalIndicatorBonus(title: string): number {
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

// ════════════════════════════════════════════════════════════════
// FACTOR 7 — LANGUAGE PREFERENCE
// ════════════════════════════════════════════════════════════════
function languageScore(songLang: string, preferredLang?: string): number {
  if (!preferredLang || !songLang) return 0;
  if (songLang === preferredLang) return 15;
  if (songLang === "english") return 5; // universally acceptable
  return 0;
}

// ── HELPER ────────────────────────────────────────────────────
function clean(str: string): string {
  return (str || "").toLowerCase().trim();
}

// ════════════════════════════════════════════════════════════════
// DEDUPLICATION
// Removes duplicate songs (same title + same artist, slightly different
// names like "Shape of You" and "Shape of You (Official Audio)").
// When dupes are found, always keep the higher play-count version.
// ════════════════════════════════════════════════════════════════
export function deduplicateResults(songs: RankedSong[]): RankedSong[] {
  const seen = new Map<string, RankedSong>();

  for (const song of songs) {
    // Normalise title: strip parenthetical suffixes and "official" tails
    const titleKey = song.name
      .toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/official.*$/i, "")
      .trim();

    const artistKey = (song.primaryArtists || "")
      .split(",")[0]
      .toLowerCase()
      .trim();

    const key = `${titleKey}::${artistKey}`;

    if (!seen.has(key)) {
      seen.set(key, song);
    } else {
      // Keep the version with higher play count
      const existing = seen.get(key)!;
      if (song.playCount > existing.playCount) {
        seen.set(key, song);
      }
    }
  }

  return Array.from(seen.values());
}

// ════════════════════════════════════════════════════════════════
// KNOWN SONGS — song title → canonical artist
// When the user searches one of these, we inject the artist name
// into the JioSaavn query so the wrapper actually returns the
// original (it's buried without the artist name in the query).
// ════════════════════════════════════════════════════════════════
export const KNOWN_SONGS: Record<string, string> = {
  // English
  "shape of you": "Ed Sheeran",
  "blinding lights": "The Weeknd",
  stay: "Justin Bieber",
  "bad guy": "Billie Eilish",
  "drivers license": "Olivia Rodrigo",
  levitating: "Dua Lipa",
  "anti-hero": "Taylor Swift",
  "as it was": "Harry Styles",
  flowers: "Miley Cyrus",
  "easy on me": "Adele",
  hello: "Adele",
  "rolling in the deep": "Adele",
  "someone like you": "Adele",
  perfect: "Ed Sheeran",
  "thinking out loud": "Ed Sheeran",
  photograph: "Ed Sheeran",
  "castle on the hill": "Ed Sheeran",
  despacito: "Luis Fonsi",
  believer: "Imagine Dragons",
  faded: "Alan Walker",
  closer: "The Chainsmokers",
  peaches: "Justin Bieber",
  "good 4 u": "Olivia Rodrigo",
  "new rules": "Dua Lipa",
  "dont start now": "Dua Lipa",
  "watermelon sugar": "Harry Styles",
  butter: "BTS",
  dynamite: "BTS",
  // Hindi
  kesariya: "Arijit Singh",
  "tum hi ho": "Arijit Singh",
  "channa mereya": "Arijit Singh",
  "ae dil hai mushkil": "Arijit Singh",
  bekhayali: "Sachet Tandon",
  kabira: "Rekha Bhardwaj",
  // Tamil
  kannazhaga: "Sid Sriram",
  kuththu: "Anirudh Ravichander",
  "vaathi coming": "Anirudh Ravichander",
  mersalaayitten: "Anirudh Ravichander",
  "aalaporaan tamizhan": "Anirudh Ravichander",
  "beast mode": "Anirudh Ravichander",
  "naalo nagaram": "Anirudh Ravichander",
  "venpani malare": "Sid Sriram",
};

// Returns the known artist for a query, or null
export function getKnownArtist(query: string): string | null {
  return KNOWN_SONGS[query.trim().toLowerCase()] ?? null;
}

// ════════════════════════════════════════════════════════════════
// MULTI-QUERY BUILDER
// We fetch from multiple JioSaavn query strings and merge results.
// More raw material → better recall → better ranking output.
// ════════════════════════════════════════════════════════════════
export function buildSearchQueries(query: string): {
  queries: string[];
  knownArtist: string | null;
} {
  const q = query.trim();
  const qLower = q.toLowerCase();
  const queries: string[] = [q]; // always include original query first

  // ── KNOWN SONG: inject artist name ───────────────────────────
  // The wrapper buries originals without the artist name in the query.
  // "shape of you" → also search "shape of you Ed Sheeran"
  const knownArtist = getKnownArtist(qLower);
  if (
    knownArtist &&
    !qLower.includes(knownArtist.toLowerCase().split(" ")[0])
  ) {
    queries.push(`${q} ${knownArtist}`);
  }

  // ── Short queries: artist/song discovery ─────────────────────
  const wordCount = q.split(/\s+/).length;
  if (wordCount <= 2 && !knownArtist) {
    queries.push(`${q} songs`);
    queries.push(`${q} hits`);
  }

  return { queries, knownArtist };
}

// ════════════════════════════════════════════════════════════════
// NEW EXPORTS — used by the rewritten search route
// Uses the same canonical Song type from jiosaavn.ts
// ════════════════════════════════════════════════════════════════

// Generic rank that works with any object that has the RankedSong fields.
// Unified entry-point for the search route.
export function rankSongs<T extends RankedSong>(
  songs: T[],
  query: string,
  preferLang?: string,
  knownArtist?: string,
): T[] {
  return rankSearchResults(songs, query, preferLang, knownArtist) as T[];
}

// Deduplicate wrapper (alias with cleaner name)
export function dedupSongs<T extends RankedSong>(songs: T[]): T[] {
  return deduplicateResults(songs) as T[];
}
