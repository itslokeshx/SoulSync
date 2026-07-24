import {
  searchSongs,
  searchAlbums,
  searchArtists,
  normalizeSongsToCanonical,
  JioSaavnSong,
} from "./jiosaavn.js";
import { redisGet, redisSet } from "./redis.js";
import { ARTIST_DICT } from "../data/artistDictionary.js";
import { BLACKLISTED_LABELS } from "./scoringUtils.js";
import {
  DIRECTOR_DICT,
  ACTOR_GRAPH,
  MOVIE_DICT,
  correctTypoEnhanced,
} from "../data/entityDictionary.js";
import { getTelemetryScoreBoost } from "./telemetryStore.js";

// ── L1 in-memory cache (process-level, survives Redis blips) ────────────────
const L1_TTL_MS = 45_000; // 45 s
const L1_MAX = 150;
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

// ── Actor to Artist/Keyword Mapping ──
const ACTOR_DICT: Record<string, string[]> = {
  vijay: ["Anirudh Ravichander", "Thalapathy Vijay", "A.R. Rahman"],
  thalapathy: ["Anirudh Ravichander", "Thalapathy Vijay", "A.R. Rahman"],
  "thalapathy vijay": ["Anirudh Ravichander", "Thalapathy Vijay"],
  ajith: ["Anirudh Ravichander", "Yuvan Shankar Raja", "Ajith Kumar"],
  "ajith kumar": ["Anirudh Ravichander", "Yuvan Shankar Raja", "Ajith Kumar"],
  rajinikanth: ["A.R. Rahman", "Anirudh Ravichander", "Rajinikanth"],
  rajini: ["A.R. Rahman", "Anirudh Ravichander", "Rajinikanth"],
  kamal: ["Kamal Haasan", "Anirudh Ravichander", "Ilaiyaraaja"],
  "kamal haasan": ["Kamal Haasan"],
  surya: ["Suriya", "Harris Jayaraj", "G.V. Prakash Kumar"],
  suriya: ["Suriya", "Harris Jayaraj", "G.V. Prakash Kumar"],
  karthi: ["Yuvan Shankar Raja"],
  dhanush: ["Anirudh Ravichander", "Dhanush"],
  str: ["Silambarasan TR", "Yuvan Shankar Raja", "A.R. Rahman"],
  simbu: ["Silambarasan TR", "Yuvan Shankar Raja", "A.R. Rahman"],
  "allu arjun": ["Devi Sri Prasad", "S.Thaman", "Allu Arjun"],
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
  nolan: ["Ludwig Goransson", "Hans Zimmer"],
  "christopher nolan": ["Ludwig Goransson", "Hans Zimmer"],
  lokesh: ["Anirudh Ravichander"],
  "lokesh kanagaraj": ["Anirudh Ravichander"],
  nelson: ["Anirudh Ravichander"],
  "nelson dilipkumar": ["Anirudh Ravichander"],
  atlee: ["Anirudh Ravichander", "A.R. Rahman"],
  "mani ratnam": ["A.R. Rahman"],
};

// ── Project Code Dictionary ──
const PROJECT_DICT: Record<
  string,
  { movie?: string; actor?: string; isRecent?: boolean }
> = {
  odyssey: { movie: "The Odyssey", isRecent: true },
  "the odyssey": { movie: "The Odyssey", isRecent: true },
  "nolan movie": { movie: "The Odyssey", isRecent: true },
  "nolan new movie": { movie: "The Odyssey", isRecent: true },
  "christopher nolan": { movie: "The Odyssey", isRecent: true },
  coolie: { movie: "Coolie", actor: "rajinikanth", isRecent: true },
  leo: { movie: "Leo", actor: "vijay", isRecent: true },
  jailer: { movie: "Jailer", actor: "rajinikanth", isRecent: true },
  "hit 3": { movie: "HIT 3", isRecent: true },
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
  | "director_songs"
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
    director: string | null;
    actor: string | null;
    year: number | null;
    yearRange: [number, number] | null;
    mood: string | null;
    language: string | null;
    format: string | null; // 'bgm'|'remix'|'lofi' etc
    songName: string | null;
    isRecent: boolean;
  };
  displayContext: string;
}

export function parseQuery(raw: string): ParsedQuery {
  const originalQuery = raw.trim();

  // Run typo resilience and entity normalization
  const correctedRaw = correctTypoEnhanced(originalQuery);

  const lower = correctedRaw
    .toLowerCase()
    .replace(/[^a-z0-9\s\-'.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = lower.split(/\s+/);

  let artist: string | null = null;
  let artistConfidence = 0;
  let movie: string | null = null;
  let director: string | null = null;
  let year: number | null = null;
  let yearRange: [number, number] | null = null;
  let mood: string | null = null;
  let language: string | null = null;
  let format: string | null = null;
  let isRecent: boolean = false;
  let actor: string | null = null;
  let actorExpansion: string[] = [];
  const expandedQueries: string[] = [originalQuery];
  if (correctedRaw.toLowerCase() !== originalQuery.toLowerCase()) {
    expandedQueries.push(correctedRaw);
  }

  // ── 0. Director Detection ──
  for (const [key, d] of Object.entries(DIRECTOR_DICT)) {
    if (lower.includes(key)) {
      director = d.name;
      if (!movie && d.movies.length > 0) {
        movie = d.movies[0]; // primary latest movie
      }
      break;
    }
  }

  // ── 0.2. Project Code Interception ──
  for (const [code, props] of Object.entries(PROJECT_DICT)) {
    if (lower.includes(code)) {
      if (props.movie) movie = props.movie;
      if (props.actor) {
        actor = props.actor;
        actorExpansion = ACTOR_DICT[props.actor] || [];
      }
      if (props.isRecent) isRecent = true;
      break;
    }
  }

  // ── 0.5. Recency & Trending Detection ──
  if (
    words.some((w) =>
      ["recent", "new", "latest", "trending", "fresh", "viral", "top"].includes(w),
    )
  ) {
    isRecent = true;
  }

  // ── 1. Artist detection (multi-word first) ──
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
  for (const [key, aGraph] of Object.entries(ACTOR_GRAPH)) {
    const pattern = new RegExp(
      `\\b${key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
      "i",
    );
    if (pattern.test(lower) && !actor && !artist) {
      actor = aGraph.name;
      actorExpansion = aGraph.associatedArtists;
      if (!movie && aGraph.movies.length > 0 && (lower.includes("movie") || lower.includes("new") || lower.includes("song"))) {
        movie = aGraph.movies[0]; // Default to top/latest movie if movie context
      }
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

  // ── 5. Movie details lookup ──
  for (const [mKey, mVal] of Object.entries(MOVIE_DICT)) {
    if (lower.includes(mKey) && !movie) {
      movie = mVal.name;
      if (mVal.director && !director) director = mVal.director;
      if (mVal.composer && !artist) artist = mVal.composer;
      break;
    }
  }

  // ── 6. Number detection (movie or year) ──
  const numberMatch = lower.match(/\b(\d{2,4})\b/);
  if (numberMatch) {
    const num = parseInt(numberMatch[1], 10);
    const curYear = new Date().getFullYear();
    if (num >= 1950 && num <= curYear + 1) {
      const hasYearContext = words.some((w) =>
        ["songs", "hits", "music", "trending", "best"].includes(w),
      );
      if (hasYearContext) {
        year = num;
      } else if (!movie) {
        movie = numberMatch[1];
      }
    } else if (num >= 10 && num < 1950 && !movie) {
      movie = numberMatch[1];
    }
  }

  // ── 7. Era detection ──
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
    lower.includes("retro")
  ) {
    yearRange = yearRange || [1970, 1999];
  }

  // Extract song title residual
  let songTokens = words.filter((w) => {
    if (artist && artist.toLowerCase().includes(w)) return false;
    if (director && director.toLowerCase().includes(w)) return false;
    if (actor && actor.toLowerCase().includes(w)) return false;
    if (movie && movie.toLowerCase().includes(w)) return false;
    if (language && LANGUAGE_MAP[w]) return false;
    if (mood && MOOD_MAP[w]) return false;
    if (BGM_KEYWORDS.includes(w)) return false;
    if (VERSION_KEYWORDS[w]) return false;
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
        "viral",
        "music",
        "from",
        "movie",
        "film",
        "that",
      ].includes(w)
    )
      return false;
    return true;
  });
  const songName = songTokens.join(" ").trim() || null;

  // ── Intent classification ──
  let intent: IntentType = "mixed";
  if (format === "bgm") intent = "bgm_search";
  else if (director) intent = "director_songs";
  else if (movie && songName) intent = "specific_song";
  else if (movie && !songName) intent = "movie_songs";
  else if (artist && songName) intent = "specific_song";
  else if (artist && !songName) intent = "artist_songs";
  else if (actor) intent = "actor_songs";
  else if (mood && !songName) intent = "mood_playlist";
  else if (yearRange || year) intent = "era_songs";
  else if (language && !songName) intent = "language_top";
  else if (songName) intent = "specific_song";

  // ── Query expansion ──
  switch (intent) {
    case "director_songs":
      if (director) {
        const dObj = DIRECTOR_DICT[director.toLowerCase()] || Object.values(DIRECTOR_DICT).find(d => d.name === director);
        if (dObj) {
          dObj.movies.forEach(m => expandedQueries.push(`${m} soundtrack`, `${m} songs`));
          dObj.topComposers.forEach(c => expandedQueries.push(`${c} ${director}`));
        } else {
          expandedQueries.push(`${director} movie soundtrack`, `${director} songs`);
        }
      }
      break;

    case "specific_song":
      if (movie) {
        expandedQueries.push(
          `${songName || ""} ${movie}`.trim(),
          `${movie} ${songName || ""}`.trim(),
          `${movie} soundtrack`,
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
        const timeQ = isRecent ? ` ${new Date().getFullYear()}` : "";
        expandedQueries.push(
          `${artist} best songs${timeQ}`,
          `${artist} hits${timeQ}`,
          `best of ${artist}`,
        );
      }
      break;

    case "actor_songs":
      if (actor) {
        const timeQ = isRecent ? ` ${new Date().getFullYear()}` : "";
        expandedQueries.push(`${actor} hits${timeQ}`, `${actor} movie songs${timeQ}`);
        if (movie) expandedQueries.push(`${movie} songs`, `${movie} ${actor}`);
        actorExpansion.forEach((a) => expandedQueries.push(`${a} ${actor}${timeQ}`));
      }
      break;

    case "movie_songs":
      if (movie) {
        expandedQueries.push(
          `${movie} movie songs`,
          `${movie} soundtrack`,
          `${movie} album`,
          `${movie} bgm`,
        );
      }
      break;

    case "mood_playlist":
      if (mood) {
        const langQ = language ? ` ${language.toLowerCase()}` : "";
        expandedQueries.push(
          `${mood}${langQ} songs`,
          `best ${mood}${langQ} songs`,
          `${mood} playlist${langQ}`,
        );
      }
      break;

    case "bgm_search":
      const cleanBGM = lower
        .replace(/bgm|background|instrumental|theme|ost|score|ringtone|music/g, "")
        .trim();
      expandedQueries.push(
        `${cleanBGM} bgm`,
        `${cleanBGM} theme`,
        `${cleanBGM} background score`,
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
          `${originalQuery.replace(/latest|new|recent|viral/g, "").trim()} ${new Date().getFullYear()}`,
        );
      }
  }

  const uniqueQueries = [...new Set(expandedQueries)].filter(Boolean).slice(0, 6);

  let displayContext = `Results for "${originalQuery}"`;
  if (director) displayContext = `Soundtracks & songs from ${director} movies`;
  else if (artist && movie) displayContext = `Songs from "${movie}" · ${artist}`;
  else if (movie) displayContext = `Official soundtrack for "${movie}"`;
  else if (artist) displayContext = `Top songs by ${artist}`;
  else if (actor) displayContext = `Movies & songs featuring ${actor}`;
  else if (mood) displayContext = `${mood.toUpperCase()} playlist`;

  return {
    originalQuery,
    normalizedQuery: lower,
    intent,
    expandedQueries: uniqueQueries,
    entities: {
      artist,
      artistConfidence,
      movie,
      director,
      actor,
      year,
      yearRange,
      mood,
      language,
      format,
      songName,
      isRecent,
    },
    displayContext,
  };
}

// ─── RESULT SCORER ───────────────────────────────────────────────────────────

export interface ScoredSong extends JioSaavnSong {
  relevanceScore: number;
  matchReasons: string[];
  isTopResult: boolean;
}

export function scoreSong(song: JioSaavnSong, parsed: ParsedQuery): ScoredSong {
  let score = 0;
  const reasons: string[] = [];
  const titleLower = (song.name || "").toLowerCase();
  const albumLower = (song.album?.name || "").toLowerCase();
  const queryLower = parsed.normalizedQuery;
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1);

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
  if (titleLower === queryLower) {
    score += 100;
    reasons.push("exact_title");
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

  // ═══ DIRECTOR / MOVIE / ALBUM MATCHING ═══
  if (parsed.entities.director) {
    const dLower = parsed.entities.director.toLowerCase();
    if (albumLower.includes(dLower) || titleLower.includes(dLower)) {
      score += 95;
      reasons.push("director_match");
    }
  }

  if (parsed.entities.movie) {
    const movieLower = parsed.entities.movie.toLowerCase();
    if (albumLower.includes(movieLower)) {
      score += 85;
      reasons.push("official_movie_album");
    }
    if (titleLower.includes(movieLower)) {
      score += 35;
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
      score += 65;
      reasons.push("bgm_format");
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
  } else if (playCount > 0 && playCount < 10_000) {
    score -= 15;
    reasons.push("low_plays_penalty");
  }

  // ═══ LABEL MATCHING ═══
  const labelLower = (song.label || "").toLowerCase();
  if (BLACKLISTED_LABELS.some((l) => labelLower.includes(l))) {
    score -= 250;
    reasons.push("blacklisted_label_penalty");
  } else if (OFFICIAL_LABELS.some((l) => labelLower.includes(l))) {
    score += 80;
    reasons.push("official_label_boost");
  }

  // ═══ PENALIZE COVERS & JUNK ═══
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

  if (!isExplicitCover && (hasCoverKeyword || titleLower.includes("originally performed by"))) {
    score -= 500;
    reasons.push("aggressive_cover_penalty");
  } else if (!isExplicitCover && hasJunkKeyword) {
    score -= 150;
    reasons.push("junk_version_penalty");
  }

  // ═══ TELEMETRY ADAPTIVE BOOST ═══
  if (song.id) {
    const telemetryBoost = getTelemetryScoreBoost(parsed.originalQuery, song.id);
    if (telemetryBoost !== 0) {
      score += telemetryBoost;
      reasons.push(`telemetry_signal:${telemetryBoost}`);
    }
  }

  return {
    ...song,
    relevanceScore: Math.max(score, 0),
    matchReasons: reasons,
    isTopResult: score > 120,
  };
}

export function normalizeSearchKey(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join("_");
}

export async function enhancedSearch(
  query: string,
  type: string = "all",
  limit = 50,
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
  const ck = `search:v11:${normalizeSearchKey(query)}:${type}`;

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
  let allResults: JioSaavnSong[] = [];
  let albums: any[] = [];
  let artists: any[] = [];

  let primaryQueries = [...parsed.expandedQueries.slice(0, 3)];

  for (const [hit, art] of Object.entries(WORLD_CLASS_HITS)) {
    if (query.toLowerCase().includes(hit) && !parsed.entities.artist) {
      primaryQueries.push(`${hit} ${art}`);
      break;
    }
  }

  const [songSettled, albumSettled, artistSettled] = await Promise.allSettled([
    Promise.allSettled(
      primaryQueries.map((q) => searchSongs(q, Math.min(limit, 30))),
    ),
    searchAlbums(query, 12),
    searchArtists(query, 10),
  ]);

  if (songSettled.status === "fulfilled") {
    for (const res of songSettled.value) {
      if (res.status === "fulfilled") {
        allResults.push(...(res.value as any));
      }
    }
  }

  if (albumSettled.status === "fulfilled") albums = albumSettled.value || [];
  if (artistSettled.status === "fulfilled") artists = artistSettled.value || [];

  const seen = new Set<string>();
  const dedupedRaw: JioSaavnSong[] = [];
  for (const s of allResults) {
    if (s && s.id && !seen.has(s.id)) {
      seen.add(s.id);
      dedupedRaw.push(s);
    }
  }
  const deduped = (normalizeSongsToCanonical(dedupedRaw) as unknown) as JioSaavnSong[];
  let scored = deduped.map((s) => scoreSong(s, parsed));
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

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
          if (s && s.id && !seen.has(s.id)) {
            seen.add(s.id);
            deduped.push(s);
          }
        }
      }
    }
    scored = deduped.map((s) => scoreSong(s, parsed));
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  const filtered = scored.filter((s) => s.relevanceScore >= 5).slice(0, limit);

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

  l1Set(ck, result);
  await redisSet(ck, JSON.stringify(result), 3600);
  return result;
}
