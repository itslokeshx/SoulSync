import {
  searchSongs,
  searchAlbums,
  searchArtists,
  YTMusicSong,
} from "./youtubeMusicService.js";
import { redisGet, redisSet } from "./redis.js";
import { ARTIST_DICT } from "../data/artistDictionary.js";
import { BLACKLISTED_LABELS } from "./scoringUtils.js";

// ── L1 in-memory cache (process-level, survives Redis blips) ────────────────
// Checked before Redis to skip even the ~5 ms Redis round-trip.
const L1_TTL_MS = 45_000; // 45 s
const L1_MAX = 120;
const l1Cache = new Map<string, { result: any; ts: number }>();
function l1Get(key: string) {
  const entry = l1Cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > L1_TTL_MS) {
    l1Cache.delete(key);
    return null;
  }
  return entry.result;
}
function l1Set(key: string, result: any) {
  if (l1Cache.size >= L1_MAX) l1Cache.delete(l1Cache.keys().next().value!);
  l1Cache.set(key, { result, ts: Date.now() });
}

// ─── ARTIST DICTIONARY ──────────────────────────────────────────────────────
// Imported from ../data/artistDictionary.ts (single source of truth).
// See import at top of file.


// ── Actor to Artist/Keyword Mapping ──
const ACTOR_DICT: Record<string, string[]> = {
  vijay: ["Anirudh Ravichander", "Thalapathy Vijay", "A.R. Rahman"],
  thalapathy: ["Anirudh Ravichander", "Thalapathy Vijay", "A.R. Rahman"],
  "thalapathy vijay": ["Anirudh Ravichander", "Thalapathy Vijay"],
  ajith: ["Anirudh Ravichander", "Yuvan Shankar Raja", "Ajith Kumar"],
  "ajith kumar": ["Anirudh Ravichander", "Yuvan Shankar Raja", "Ajith Kumar"],
  rajinikanth: ["A.R. Rahman", "Anirudh Ravichander", "Rajinikanth"],
  rajini: ["A.R. Rahman", "Anirudh Ravichander", "Rajinikanth"],
  kamal: ["Kamal Haasan", "Anirudh Ravichander", "Ilayaraaja"],
  "kamal haasan": ["Kamal Haasan"],
  surya: ["Suriya", "Harris Jayaraj", "G.V. Prakash Kumar"],
  suriya: ["Suriya", "Harris Jayaraj", "G.V. Prakash Kumar"],
  karthi: ["Yuvan Shankar Raja"],
  dhanush: ["Anirudh Ravichander", "Dhanush"],
  str: ["Silambarasan TR", "Yuvan Shankar Raja", "A.R. Rahman"],
  simbu: ["Silambarasan TR", "Yuvan Shankar Raja", "A.R. Rahman"],
  "allu arjun": ["Devi Sri Prasad", "S.Thaman", "Allu Arjun"],
  peeps: ["Allu Arjun"],
  "ram charan": ["S.Thaman", "Devi Sri Prasad", "Ram Charan"],
  jrntr: ["Jr NTR", "Anirudh Ravichander"],
  "jr ntr": ["Jr NTR", "Anirudh Ravichander"],
  prabhas: ["Prabhas", "Ravi Basrur"],
  yash: ["Ravi Basrur", "Yash"],
  srk: ["Shah Rukh Khan", "Pritam", "Vishal-Shekhar", "Arijit Singh"],
  "shah rukh khan": ["Shah Rukh Khan", "Pritam", "Vishal-Shekhar"],
  "salman khan": ["Salman Khan", "Sajid-Wajid"],
  salman: ["Salman Khan"],
  "aamir khan": ["Aamir Khan", "Pritam", "A.R. Rahman"],
  hrithik: ["Hrithik Roshan", "Vishal-Shekhar"],
  "hrithik roshan": ["Hrithik Roshan"],
  "ranbir kapoor": ["Ranbir Kapoor", "Pritam", "Arijit Singh"],
  ranbir: ["Ranbir Kapoor", "Pritam", "Arijit Singh"],
  "ranveer singh": ["Ranveer Singh"],
  "akshay kumar": ["Akshay Kumar"],
  dq: ["Dulquer Salmaan", "Gopi Sundar"],
  "dulquer salmaan": ["Dulquer Salmaan"],
  fahadh: ["Fahadh Faasil", "Sushin Shyam"],
  "fahadh faasil": ["Fahadh Faasil"],
  mohanlal: ["Mohanlal"],
  mammootty: ["Mammootty"],
};

// ── Project Code Dictionary ──
const PROJECT_DICT: Record<
  string,
  { movie?: string; actor?: string; isRecent?: boolean }
> = {
  aa23: { movie: "pushpa 2", actor: "allu arjun", isRecent: true },
  "pushpa 2": { movie: "pushpa 2", actor: "allu arjun", isRecent: true },
  t69: { actor: "vijay", isRecent: true },
  "thalapathy 69": { actor: "vijay", isRecent: true },
  t68: { movie: "goat", actor: "vijay", isRecent: true },
  "thalapathy 68": { movie: "goat", actor: "vijay", isRecent: true },
  ssmb29: { actor: "mahesh babu", isRecent: true },
  rc16: { actor: "ram charan", isRecent: true },
  "game changer": {
    movie: "game changer",
    actor: "ram charan",
    isRecent: true,
  },
  ntr31: { actor: "jr ntr", isRecent: true },
  devara: { movie: "devara", actor: "jr ntr", isRecent: true },
  toxic: { movie: "toxic", actor: "yash", isRecent: true },
  kanguva: { movie: "kanguva", actor: "suriya", isRecent: true },
  vidaamuyarchi: { movie: "vidaamuyarchi", actor: "ajith", isRecent: true },
  "good bad ugly": { movie: "good bad ugly", actor: "ajith", isRecent: true },
  kalki: { movie: "kalki 2898 ad", actor: "prabhas", isRecent: true },
  "kalki 2898 ad": { movie: "kalki 2898 ad", actor: "prabhas", isRecent: true },
};

// ── Mood tokens ──
const MOOD_MAP: Record<string, string> = {
  sad: "sad",
  dukhi: "sad",
  heartbreak: "sad",
  broken: "sad",
  emotional: "sad",
  cry: "sad",
  crying: "sad",
  pain: "sad",
  miss: "sad",
  happy: "happy",
  khush: "happy",
  celebration: "happy",
  fun: "happy",
  romantic: "romantic",
  love: "romantic",
  pyaar: "romantic",
  ishq: "romantic",
  romance: "romantic",
  party: "party",
  dance: "party",
  club: "party",
  bass: "party",
  chill: "chill",
  relax: "chill",
  calm: "chill",
  peaceful: "chill",
  lofi: "chill",
  "lo-fi": "chill",
  sleep: "chill",
  workout: "workout",
  gym: "workout",
  motivation: "workout",
  motivational: "workout",
  pump: "workout",
  energy: "workout",
  devotional: "devotional",
  bhakti: "devotional",
  prayer: "devotional",
  angry: "angry",
  rage: "angry",
  drive: "drive",
  road: "drive",
  travel: "drive",
  rain: "rain",
  monsoon: "rain",
  barish: "rain",
  mazhai: "rain",
};

const BGM_KEYWORDS = [
  "bgm",
  "background",
  "instrumental",
  "theme",
  "ost",
  "score",
  "ringtone",
  "karaoke",
  "no vocals",
  "music only",
];
const VERSION_KEYWORDS: Record<string, string> = {
  remix: "remix",
  lofi: "lofi",
  "lo-fi": "lofi",
  mashup: "mashup",
  unplugged: "unplugged",
  acoustic: "acoustic",
  live: "live",
  reprise: "reprise",
  cover: "cover",
  slowed: "slowed",
  reverb: "reverb",
  "slowed reverb": "slowed reverb",
};

const LANGUAGE_MAP: Record<string, string> = {
  hindi: "Hindi",
  bollywood: "Hindi",
  tamil: "Tamil",
  kollywood: "Tamil",
  telugu: "Telugu",
  tollywood: "Telugu",
  kannada: "Kannada",
  sandalwood: "Kannada",
  malayalam: "Malayalam",
  mollywood: "Malayalam",
  punjabi: "Punjabi",
  bengali: "Bengali",
  marathi: "Marathi",
  gujarati: "Gujarati",
  english: "English",
  bhojpuri: "Bhojpuri",
  rajasthani: "Rajasthani",
  odia: "Odia",
  oriya: "Odia",
};

const JUNK_KEYWORDS = [
  "slowed",
  "reverb",
  "sped up",
  "mashup",
  "dj",
  "remix",
  "lofi",
  "8d",
  "3d",
  "instrumental",
  "type beat",
  "ringtone",
  "bass boosted",
  "tiktok version",
  "bass boosted",
  "mix",
  "dj mix",
  "instrumental version",
  "lofi version",
];

const COVER_KEYWORDS = [
  "cover",
  "fan version",
  "karaoke",
  "female version",
  "male version",
  "recreated",
  "rendition",
  "tribute",
  "acoustic cover",
  "studio version",
  "vocal cover",
  "piano cover",
  "recreation",
  "unofficial",
  "fan made",
  "remake",
  "reprise (cover)",
  "piano version",
];
const OFFICIAL_LABELS = [
  "warner",
  "universal",
  "sony",
  "atlantic",
  "columbia",
  "republic",
  "interscope",
  "rca",
  "epic",
  "capitol",
  "emi",
  "bmg",
  "t-series",
  "zee music",
  "yash raj",
  "saregama",
  "tips",
  "eros",
  "venus",
  "asylum",
  "big machine",
  "harvest",
  "island",
  "polydor",
  "virgin",
  "arista",
  "bad boy",
  "def jam",
  "geffen",
  "motown",
  "pavement",
  "rhino",
  "syco",
  "v2",
  "wind-up",
];
// BLACKLISTED_LABELS imported from scoringUtils.ts (single source of truth)

const WORLD_CLASS_HITS: Record<string, string> = {
  "shape of you": "Ed Sheeran",
  despacito: "Luis Fonsi",
  stay: "Justin Bieber",
  "blinding lights": "The Weeknd",
  perfect: "Ed Sheeran",
  believer: "Imagine Dragons",
  lovely: "Billie Eilish",
  faded: "Alan Walker",
  "let me love you": "Justin Bieber",
  closer: "The Chainsmokers",
};

// ─── INTENT TYPES ────────────────────────────────────────────────────────────
export type IntentType =
  | "specific_song"
  | "artist_songs"
  | "movie_songs"
  | "mood_playlist"
  | "era_songs"
  | "bgm_search"
  | "language_top"
  | "actor_songs"
  | "mixed";

export interface ParsedQuery {
  originalQuery: string;
  normalizedQuery: string;
  intent: IntentType;
  expandedQueries: string[];
  entities: {
    artist: string | null;
    artistConfidence: number;
    movie: string | null;
    year: number | null;
    yearRange: [number, number] | null;
    mood: string | null;
    language: string | null;
    format: string | null; // 'bgm'|'remix'|'lofi' etc
    songName: string | null;
    isRecent: boolean;
    actor: string | null;
  };
  displayContext: string;
}

export function parseQuery(raw: string): ParsedQuery {
  const originalQuery = raw.trim();
  const lower = originalQuery
    .toLowerCase()
    .replace(/[^a-z0-9\s\-'.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = lower.split(/\s+/);

  let artist: string | null = null;
  let artistConfidence = 0;
  let movie: string | null = null;
  let year: number | null = null;
  let yearRange: [number, number] | null = null;
  let mood: string | null = null;
  let language: string | null = null;
  let format: string | null = null;
  let isRecent: boolean = false;
  let actor: string | null = null;
  let actorExpansion: string[] = [];
  const expandedQueries: string[] = [originalQuery];

  // ── 0. Project Code Interception ──
  // If the query contains a known project code like "aa23" or "thalapathy 69",
  // forcibly inject the properties so the rest of the parsing engine generates beautiful specific expansions.
  for (const [code, props] of Object.entries(PROJECT_DICT)) {
    if (lower.includes(code)) {
      if (props.movie) movie = props.movie;
      if (props.actor) {
        actor = props.actor;
        actorExpansion = ACTOR_DICT[props.actor] || [];
      }
      if (props.isRecent) isRecent = true;
      break; // Stop after first match to prevent conflicting overwrites
    }
  }

  // ── 0.5. Recency Detection ──
  if (
    words.some((w) =>
      ["recent", "new", "latest", "trending", "fresh"].includes(w),
    )
  ) {
    isRecent = true;
  }

  // ── 1. Artist detection (multi-word first, then single-word) ──
  const sortedArtistKeys = Object.keys(ARTIST_DICT).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of sortedArtistKeys) {
    const pattern = new RegExp(
      `\\b${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
      "i",
    );
    if (pattern.test(lower) && !artist) {
      artist = ARTIST_DICT[key];
      artistConfidence = key.split(" ").length > 1 ? 0.95 : 0.8;
      break;
    }
  }

  // ── 1.5. Actor detection ──
  const sortedActorKeys = Object.keys(ACTOR_DICT).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of sortedActorKeys) {
    const pattern = new RegExp(
      `\\b${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
      "i",
    );
    if (pattern.test(lower) && !actor && !artist) {
      actor = key;
      actorExpansion = ACTOR_DICT[key];
      break;
    }
  }

  // ── 2. Language detection ──
  for (const [kw, lang] of Object.entries(LANGUAGE_MAP)) {
    if (words.includes(kw)) {
      language = lang;
      break;
    }
  }

  // ── 3. Mood detection ──
  for (const [kw, m] of Object.entries(MOOD_MAP)) {
    if (words.includes(kw)) {
      mood = m;
      break;
    }
  }

  // ── 4. BGM / version detection ──
  for (const kw of BGM_KEYWORDS) {
    if (lower.includes(kw)) {
      format = "bgm";
      break;
    }
  }
  if (!format) {
    for (const [kw, ver] of Object.entries(VERSION_KEYWORDS)) {
      if (lower.includes(kw)) {
        format = ver;
        break;
      }
    }
  }

  // ── 5. Number detection (movie or year) ──
  const numberMatch = lower.match(/\b(\d{2,4})\b/);
  if (numberMatch) {
    const num = parseInt(numberMatch[1], 10);
    const curYear = new Date().getFullYear();
    if (num >= 1950 && num <= curYear + 1) {
      // If accompanied by "songs", "hits", "music" → year; else → movie
      const hasYearContext = words.some((w) =>
        ["songs", "hits", "music", "trending", "best"].includes(w),
      );
      if (hasYearContext) {
        year = num;
      } else {
        movie = numberMatch[1];
      }
    } else if (num >= 10 && num < 1950) {
      movie = numberMatch[1]; // short number like "96", "173"
    }
  }

  // ── 6. Era detection ──
  const eraMatch = lower.match(/\b(60s|70s|80s|90s|2000s|2010s|2020s)\b/);
  if (eraMatch) {
    const eraMap: Record<string, [number, number]> = {
      "60s": [1960, 1969],
      "70s": [1970, 1979],
      "80s": [1980, 1989],
      "90s": [1990, 1999],
      "2000s": [2000, 2009],
      "2010s": [2010, 2019],
      "2020s": [2020, 2029],
    };
    yearRange = eraMap[eraMatch[1]] || null;
  }
  if (
    lower.includes("old songs") ||
    lower.includes("classics") ||
    lower.includes("classic") ||
    lower.includes("retro") ||
    lower.includes("purana")
  ) {
    yearRange = yearRange || [1970, 1999];
  }

  // ── 7. Movie name (from pattern) ──
  const fromMatch = lower.match(
    /(?:from|song from|songs from|from movie|from film)\s+(.+)/,
  );
  if (fromMatch && !movie) {
    movie = fromMatch[1].trim();
  }

  // ── 8. Extract song name (remaining tokens after removing known entities) ──
  let songTokens = words.filter((w) => {
    if (
      artist &&
      artist
        .toLowerCase()
        .split(/\s+/)
        .some((a) => w === a.toLowerCase().replace(/[^a-z]/g, ""))
    )
      return false;
    if (movie && w === movie.toLowerCase()) return false;
    if (language && LANGUAGE_MAP[w]) return false;
    if (mood && MOOD_MAP[w]) return false;
    if (BGM_KEYWORDS.includes(w)) return false;
    if (VERSION_KEYWORDS[w]) return false;
    if (eraMatch && w === eraMatch[1]) return false;
    if (
      [
        "songs",
        "song",
        "hits",
        "hit",
        "best",
        "top",
        "new",
        "latest",
        "recent",
        "trending",
        "music",
        "from",
        "movie",
        "film",
      ].includes(w)
    )
      return false;
    return true;
  });
  const songName = songTokens.join(" ").trim() || null;

  // ── 9. Intent classification ──
  let intent: IntentType = "mixed";
  if (format === "bgm") intent = "bgm_search";
  else if (movie && songName) intent = "specific_song";
  else if (movie && !songName) intent = "movie_songs";
  else if (artist && songName) intent = "specific_song";
  else if (artist && mood) intent = "artist_songs";
  else if (artist && !songName) intent = "artist_songs";
  else if (actor) intent = "actor_songs";
  else if (mood && !songName) intent = "mood_playlist";
  else if (yearRange || year) intent = "era_songs";
  else if (language && !songName) intent = "language_top";
  else if (songName) intent = "specific_song";

  // ── 10. Query expansion ──
  switch (intent) {
    case "specific_song":
      if (movie) {
        expandedQueries.push(
          `${songName || ""} ${movie}`.trim(),
          `${songName || ""} from ${movie}`.trim(),
          `${movie} movie songs`,
          artist
            ? `${songName || ""} ${artist} ${movie}`
            : `${movie} ${songName || ""}`,
        );
      }
      if (artist) {
        expandedQueries.push(
          `${songName || ""} ${artist}`.trim(),
          `${artist} ${songName || ""}`.trim(),
        );
      }
      if (!movie && !artist && songName) {
        expandedQueries.push(`${songName} song`, `${songName} official`);
      }
      break;

    case "artist_songs":
      if (artist) {
        const moodQ = mood ? ` ${mood}` : "";
        const timeQ = isRecent ? ` ${new Date().getFullYear()}` : "";
        expandedQueries.push(
          `${artist} best songs${moodQ}${timeQ}`,
          `${artist}${moodQ} songs${timeQ}`,
          `${artist} hits${moodQ}`,
          `best of ${artist}`,
        );
      }
      break;

    case "actor_songs":
      if (actor) {
        const timeQ = isRecent ? ` ${new Date().getFullYear()}` : "";
        expandedQueries.push(
          `${actor} hits${timeQ}`,
          `${actor} movie songs${timeQ}`,
          `${actor} trending${timeQ}`,
        );

        if (movie) {
          expandedQueries.push(`${movie} ${actor}`, `${movie} songs`);
        }

        // Add searches combining the actor name with their frequent artists
        actorExpansion.forEach((a) => {
          expandedQueries.push(`${a} ${actor}${timeQ}`);
          if (movie) expandedQueries.push(`${a} ${movie}`);
        });
      }
      break;

    case "movie_songs":
      if (movie) {
        expandedQueries.push(
          `${movie} movie songs`,
          `${movie} album`,
          `${movie} all songs`,
          `${movie} soundtrack`,
        );
      }
      break;

    case "mood_playlist":
      if (mood) {
        const langQ = language ? ` ${language.toLowerCase()}` : "";
        expandedQueries.push(
          `${mood}${langQ} songs`,
          `${mood}${langQ} songs ${new Date().getFullYear()}`,
          `best ${mood}${langQ} songs`,
          `${mood} playlist${langQ}`,
        );
      }
      break;

    case "era_songs":
      if (yearRange) {
        const langQ = language ? ` ${language.toLowerCase()}` : "";
        expandedQueries.push(
          `${yearRange[0]}s${langQ} songs hits`,
          `${langQ} songs ${yearRange[0]} ${yearRange[1]}`.trim(),
          `classic${langQ} ${yearRange[0]}s`,
        );
      } else if (year) {
        expandedQueries.push(`songs ${year}`, `${year} hits`);
      }
      break;

    case "bgm_search":
      const cleanBGM = lower
        .replace(/bgm|background|instrumental|theme|ost|score|ringtone/g, "")
        .trim();
      expandedQueries.push(
        `${cleanBGM} bgm`,
        `${cleanBGM} background score`,
        `${cleanBGM} instrumental`,
        `${cleanBGM} theme music`,
      );
      break;

    case "language_top":
      if (language) {
        expandedQueries.push(
          `${language.toLowerCase()} trending songs`,
          `${language.toLowerCase()} top hits ${new Date().getFullYear()}`,
          `best ${language.toLowerCase()} songs`,
        );
      }
      break;

    default:
      if (isRecent) {
        expandedQueries.push(
          `${originalQuery.replace(/latest|new|recent/g, "").trim()} ${new Date().getFullYear()}`,
        );
      }
  }

  // Deduplicate
  const uniqueQueries = [...new Set(expandedQueries)]
    .filter(Boolean)
    .slice(0, 6);

  // Build display context
  let displayContext = `Results for "${originalQuery}"`;
  if (artist && movie)
    displayContext = `Results for "${songName || originalQuery}" from movie "${movie}" · ${artist}`;
  else if (movie) displayContext = `Songs from "${movie}"`;
  else if (artist && mood) displayContext = `${mood} songs by ${artist}`;
  else if (artist) displayContext = `Songs by ${artist}`;
  else if (mood && language) displayContext = `${mood} ${language} songs`;
  else if (mood) displayContext = `${mood} songs`;

  return {
    originalQuery,
    normalizedQuery: lower,
    intent,
    expandedQueries: uniqueQueries,
    entities: {
      artist,
      artistConfidence,
      movie,
      year,
      yearRange,
      mood,
      language,
      format,
      songName,
      isRecent,
      actor,
    },
    displayContext,
  };
}

// ─── RESULT SCORER ───────────────────────────────────────────────────────────

export interface ScoredSong extends YTMusicSong {
  relevanceScore: number;
  matchReasons: string[];
  isTopResult: boolean;
}

export function scoreSong(song: YTMusicSong, parsed: ParsedQuery): ScoredSong {
  let score = 0;
  const reasons: string[] = [];
  const titleLower = (song.name || "").toLowerCase();
  const albumLower = (song.album?.name || "").toLowerCase();
  const queryLower = parsed.normalizedQuery;
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1);

  // Collect all artist names (Robust extraction from multiple possible API formats)
  const getArtistsFromField = (field: any): string[] => {
    if (!field) return [];
    if (typeof field === "string")
      return field
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    if (Array.isArray(field)) {
      return field
        .map((a) => (typeof a === "string" ? a : a.name || "").toLowerCase())
        .filter(Boolean);
    }
    return [];
  };

  const primaryArtists = [
    ...getArtistsFromField(song.artists?.primary),
    ...getArtistsFromField((song as any).primaryArtists),
  ];
  const featuredArtists = [
    ...getArtistsFromField(song.artists?.featured),
    ...getArtistsFromField((song as any).featuredArtists),
  ];
  const mapArtists = getArtistsFromField(song.artist_map?.primary_artists);

  const allArtists = [
    ...new Set([...primaryArtists, ...featuredArtists, ...mapArtists]),
  ];
  const allArtistStr = allArtists.join(" ");

  // ═══ TITLE MATCHING ═══
  const cleanedTitle = titleLower
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s*-\s*single$/i, "")
    .replace(/\s*-\s*ep$/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const cleanedQuery = queryLower
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  if (titleLower === queryLower) {
    score += 100;
    reasons.push("exact_title");
  } else if (cleanedTitle === cleanedQuery) {
    score += 95;
    reasons.push("cleaned_exact_title");
  } else {
    const songNameTokens =
      parsed.entities.songName?.toLowerCase().split(/\s+/).filter(Boolean) ||
      queryWords;
    const allWordsMatch =
      songNameTokens.length > 0 &&
      songNameTokens.every((t) => titleLower.includes(t));
    if (allWordsMatch) {
      score += 80;
      reasons.push("all_words_title");
    } else {
      const matched = songNameTokens.filter((t) => titleLower.includes(t));
      if (matched.length > 0) {
        score += Math.round(
          (matched.length / Math.max(songNameTokens.length, 1)) * 40,
        );
        reasons.push("partial_title");
      }
    }
  }

  // ═══ ARTIST MATCHING ═══
  if (parsed.entities.artist) {
    const intentArtistLower = parsed.entities.artist.toLowerCase();
    const intentArtistFirst = intentArtistLower.split(" ")[0];
    if (
      allArtists.some(
        (a) => a === intentArtistLower || a.includes(intentArtistLower),
      )
    ) {
      score += 90;
      reasons.push("exact_artist");
    } else if (allArtistStr.includes(intentArtistFirst)) {
      score += 50;
      reasons.push("partial_artist");
    }
  }

  // ═══ MOVIE/ALBUM MATCHING ═══
  if (parsed.entities.movie) {
    const movieLower = parsed.entities.movie.toLowerCase();
    if (albumLower.includes(movieLower)) {
      score += 85;
      reasons.push("movie_album");
    }
    if (titleLower.includes(movieLower)) {
      score += 30;
      reasons.push("movie_in_title");
    }
  }

  // ═══ LANGUAGE MATCHING ═══
  if (parsed.entities.language) {
    const songLang = (song.language || "").toLowerCase();
    if (songLang === parsed.entities.language.toLowerCase()) {
      score += 25;
      reasons.push("language");
    }
  }

  // ═══ FORMAT / BGM MATCHING ═══
  if (parsed.entities.format === "bgm") {
    const bgmKeys = ["bgm", "theme", "instrumental", "score", "background"];
    if (bgmKeys.some((k) => titleLower.includes(k))) {
      score += 60;
      reasons.push("bgm_format");
    }
  }
  if (
    parsed.entities.format === "lofi" &&
    (titleLower.includes("lofi") || titleLower.includes("lo-fi"))
  ) {
    score += 50;
    reasons.push("lofi_format");
  }
  if (parsed.entities.format === "remix" && titleLower.includes("remix")) {
    score += 50;
    reasons.push("remix_format");
  }

  // ═══ YEAR MATCHING ═══
  if (parsed.entities.year && song.year) {
    const songYear = parseInt(song.year, 10);
    if (songYear === parsed.entities.year) {
      score += 40;
      reasons.push("year_exact");
    } else if (Math.abs(songYear - parsed.entities.year) <= 1) {
      score += 20;
      reasons.push("year_near");
    }
  }
  if (parsed.entities.yearRange && song.year) {
    const songYear = parseInt(song.year, 10);
    if (
      songYear >= parsed.entities.yearRange[0] &&
      songYear <= parsed.entities.yearRange[1]
    ) {
      score += 35;
      reasons.push("year_range");
    }
  }

  // ═══ RECENT BOOST ═══
  if (parsed.entities.isRecent && song.year) {
    const songYear = parseInt(song.year, 10);
    const curYear = new Date().getFullYear();
    if (songYear === curYear || songYear === curYear - 1) {
      score += 45; // Massive boost for "recent"
      reasons.push("recent_boost");
    } else if (songYear === curYear - 2) {
      score += 20;
      reasons.push("recent_near_boost");
    }
  }

  // ═══ ACTOR BOOST ═══
  if (parsed.entities.actor) {
    const actorQueryLower = parsed.entities.actor.toLowerCase();
    // If the actor name actually appears in the album or title, massive boost
    if (
      albumLower.includes(actorQueryLower) ||
      titleLower.includes(actorQueryLower)
    ) {
      score += 60;
      reasons.push("actor_exact");
    } else {
      // If none of those hit, check if the song belongs to an artist frequently associated with the actor
      const actorExpansionLowerArr = parsed.expandedQueries
        .join(" ")
        .toLowerCase();
      if (
        allArtists.some((a) => actorExpansionLowerArr.includes(a.toLowerCase()))
      ) {
        score += 25;
        reasons.push("actor_associated_artist");
      }
    }
  }

  // ═══ POPULARITY BOOST ═══
  const playCount = (song as any).play_count || (song as any).playCount || 0;
  if (playCount > 50_000_000) {
    score += 50;
    reasons.push("mega_hit");
  } else if (playCount > 10_000_000) {
    score += 35;
    reasons.push("very_popular");
  } else if (playCount > 1_000_000) {
    score += 15;
  } else if (playCount > 100_000) {
    score += 5;
  } else if (playCount > 0 && playCount < 10_000) {
    score -= 15; // Low plays = likely cover/fake
    reasons.push("low_plays_penalty");
  }

  // ═══ WORLD CLASS HIT VALIDATION ═══
  const worldHitEntry = Object.entries(WORLD_CLASS_HITS).find(([h]) =>
    titleLower.includes(h),
  );
  if (worldHitEntry) {
    const hitTitle = worldHitEntry[0];
    const hitArtist = worldHitEntry[1].toLowerCase();

    // Duration check (if it's a snippet < 2min, it's garbage for a full hit)
    if (song.duration && song.duration < 120) {
      score -= 200;
      reasons.push("hit_snippet_penalty");
    }

    // Artist check for world-class hits
    if (
      !allArtists.some((a) => a.includes(hitArtist) || hitArtist.includes(a))
    ) {
      // If none of the artists match the world-class artist, it's a cover
      score -= 150;
      reasons.push("world_hit_artist_mismatch_penalty");
    } else {
      score += 100;
      reasons.push("world_hit_official_artist_boost");
    }

    if (playCount < 1_000_000) {
      score -= 150;
      reasons.push("world_hit_low_plays_penalty");
    }
  }

  // ═══ GENERAL DURATION SNIPPET PENALTY ═══
  if (song.duration && song.duration > 0 && song.duration < 120) {
    score -= 180;
    reasons.push("general_snippet_penalty");
  }

  // ═══ OFFICIAL SOUNDTRACK BOOST ═══
  if (
    albumLower &&
    (albumLower.includes("original motion picture") ||
      albumLower.includes("soundtrack") ||
      albumLower.includes("original score") ||
      albumLower.includes("ost"))
  ) {
    score += 55;
    reasons.push("official_soundtrack_boost");
  }

  // ═══ ALBUM NAME HAS QUERY WORDS (original soundtrack) ═══
  if (
    albumLower &&
    queryWords.some((w) => albumLower.includes(w) && w.length > 2)
  ) {
    score += 15;
    reasons.push("album_word");
  }

  // ═══ LABEL MATCHING (POWERFUL) ═══
  const labelLower = (song.label || "").toLowerCase();

  if (BLACKLISTED_LABELS.some((l) => labelLower.includes(l))) {
    score -= 250;
    reasons.push("blacklisted_label_penalty");
  } else if (OFFICIAL_LABELS.some((l) => labelLower.includes(l))) {
    score += 80;
    reasons.push("official_label_boost");
  }

  if (labelLower.includes("original") && !labelLower.includes("cover")) {
    score += 40;
    reasons.push("label_original_boost");
  }
  if (COVER_KEYWORDS.some((kw) => labelLower.includes(kw))) {
    score -= 150;
    reasons.push("label_cover_penalty");
  }

  // ═══ YEAR VALIDATION (ELIMINATE FAKES) ═══
  if (song.year) {
    const songYear = parseInt(song.year, 10);
    const curYear = new Date().getFullYear();
    if (songYear > curYear) {
      score -= 200; // Future years are fakes/gaming
      reasons.push("future_year_penalty");
    }
  }

  // ═══ PENALIZE COVERS & JUNK (AGRESSIVE) ═══
  const isExplicitFormat = parsed.entities.format !== null;
  const isExplicitCover =
    parsed.normalizedQuery.includes("cover") ||
    parsed.normalizedQuery.includes("unplugged") ||
    parsed.normalizedQuery.includes("karaoke");

  const hasCoverKeyword = COVER_KEYWORDS.some(
    (kw) =>
      titleLower.includes(kw) ||
      albumLower.includes(kw) ||
      allArtistStr.includes(kw) ||
      labelLower.includes(kw),
  );
  const hasJunkKeyword = JUNK_KEYWORDS.some(
    (kw) =>
      titleLower.includes(kw) ||
      albumLower.includes(kw) ||
      allArtistStr.includes(kw) ||
      labelLower.includes(kw),
  );
  // Also explicitly penalize artist names that look like generic cover makers
  const hasGenericArtist = allArtists.some(
    (a) =>
      a.includes("karaoke") ||
      a.includes("tribute") ||
      a.includes("cover") ||
      a.includes("recreation") ||
      a.includes("originally performed") ||
      a.includes("version") ||
      a.includes("workout") ||
      a.includes("music therapy") ||
      a.includes("relaxing") ||
      a.includes("instrumental") ||
      a.includes("lullaby") ||
      a.includes("fitness") ||
      a.includes("remix") ||
      a.includes("mashup"),
  );

  if (
    hasCoverKeyword ||
    hasGenericArtist ||
    titleLower.includes("originally performed by") ||
    titleLower.includes("originally performed by")
  ) {
    score -= 500; // Nuclear penalty
    reasons.push("aggressive_cover_penalty");
  } else if (hasJunkKeyword) {
    score -= 150;
    reasons.push("junk_version_penalty");
  } else if (titleLower === queryLower) {
    // If it's an exact title match AND it survived the junk filter, give it a massive clean boost
    score += 60;
    reasons.push("original_clean_title_boost");
  }

  // ═══ EXACT TITLE + OFFICIAL LABEL COMBO ═══
  if (
    titleLower === queryLower &&
    OFFICIAL_LABELS.some((l) => labelLower.includes(l))
  ) {
    score += 80;
    reasons.push("official_match_combo");
  }

  return {
    ...song,
    relevanceScore: Math.max(score, 0),
    matchReasons: reasons,
    isTopResult: score > 120, // Increased threshold for top result since we boosted scores
  };
}
// ─── KEY HELPERS ────────────────────────────────────────────────────────────

/**
 * Normalise a query string for Redis key generation.
 * Sorts words alphabetically so "sad hindi songs" and "hindi sad songs"
 * resolve to the same cache entry.
 */
export function normalizeSearchKey(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join("_");
}
// ─── ENHANCED SEARCH (main export) ──────────────────────────────────────────

export async function enhancedSearch(
  query: string,
  type: string = "all",
  limit = 50, // Default to 50 results (world-class limit)
): Promise<{
  query: string;
  parsedIntent: ParsedQuery;
  topResult: ScoredSong | null;
  songs: ScoredSong[];
  albums: any[];
  artists: any[];
  total: number;
  displayContext: string;
}> {
  // Cache check — word-sorted key so "sad hindi" and "hindi sad" share one entry
  const ck = `search:v12:${normalizeSearchKey(query)}:${type}`;

  const l1 = l1Get(ck);
  if (l1) return l1;
  const cached = await redisGet(ck);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      l1Set(ck, parsed);
      return parsed;
    } catch {}
  }

  const parsed = parseQuery(query);
  let allResults: YTMusicSong[] = [];
  let albums: any[] = [];
  let artists: any[] = [];

  // ── Step 1: Fire primary queries + Albums + Artists + GLOBAL in parallel ──
  // Uses searchSongs (bg queue) so warmup never competes with live user
  let primaryQueries = [...parsed.expandedQueries.slice(0, 3)];

  // Inject hit artist if missing
  for (const [hit, art] of Object.entries(WORLD_CLASS_HITS)) {
    if (query.toLowerCase().includes(hit) && !parsed.entities.artist) {
      primaryQueries.push(`${hit} ${art}`);
      break;
    }
  }

  const [songSettled, albumSettled, artistSettled] =
    await Promise.allSettled([
      Promise.allSettled(
        primaryQueries.map((q) => searchSongs(q, Math.min(limit, 30))),
      ),
      searchAlbums(query, 12),
      searchArtists(query, 10),
    ]);

  // Process songs
  if (songSettled.status === "fulfilled") {
    for (const res of songSettled.value) {
      if (res.status === "fulfilled") {
        allResults.push(...(res.value as any));
      }
    }
  }

  // Process albums & artists
  if (albumSettled.status === "fulfilled") albums = albumSettled.value || [];
  if (artistSettled.status === "fulfilled") artists = artistSettled.value || [];

  // ── Step 2: Score and check if top result is strong ──
  const seen = new Set<string>();
  const deduped: YTMusicSong[] = [];
  for (const s of allResults) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      deduped.push(s);
    }
  }
  let scored = deduped.map((s) => scoreSong(s, parsed));
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // ── Step 3: If weak results, fire more queries (also in parallel) ──
  if (
    (scored.length === 0 || scored[0].relevanceScore < 60) &&
    parsed.expandedQueries.length > 3
  ) {
    const moreQueries = parsed.expandedQueries.slice(3, 6);
    const moreSettled = await Promise.allSettled(
      moreQueries.map((q) => searchSongs(q, 15)),
    );
    for (const res of moreSettled) {
      if (res.status === "fulfilled") {
        for (const s of res.value as any) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            deduped.push(s);
          }
        }
      }
    }
    scored = deduped.map((s) => scoreSong(s, parsed));
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // ── Step 4: Filter out junk (score < 5) and limit ──
  const filtered = scored.filter((s) => s.relevanceScore >= 5).slice(0, limit);

  // Intelligence: If we have a very strong song match (>110), it's the top result.
  // Otherwise, if we have a perfect artist/album match in the query, they could be top.
  let topResult =
    filtered.length > 0 && filtered[0].relevanceScore > 80 ? filtered[0] : null;

  const result = {
    query,
    parsedIntent: parsed,
    topResult,
    songs: filtered,
    albums,
    artists,
    total: filtered.length,
    displayContext: parsed.displayContext,
  };

  // Cache 1 hour in Redis, 45 s in L1
  l1Set(ck, result);
  await redisSet(ck, JSON.stringify(result), 3600);
  return result;
}
