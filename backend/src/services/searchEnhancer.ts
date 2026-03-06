import { searchSongs, searchSongsDirect, JioSaavnSong } from "./jiosaavn.js";
import { redisGet, redisSet } from "./redis.js";

// ─── ARTIST DICTIONARY (500+ entries) ────────────────────────────────────────
const ARTIST_DICT: Record<string, string> = {
  // ── Hindi/Bollywood ──
  arijit: "Arijit Singh",
  "arijit singh": "Arijit Singh",
  pritam: "Pritam",
  "pritam chakraborty": "Pritam",
  atif: "Atif Aslam",
  "atif aslam": "Atif Aslam",
  shreya: "Shreya Ghoshal",
  "shreya ghoshal": "Shreya Ghoshal",
  neha: "Neha Kakkar",
  "neha kakkar": "Neha Kakkar",
  sonu: "Sonu Nigam",
  "sonu nigam": "Sonu Nigam",
  kk: "KK",
  lata: "Lata Mangeshkar",
  "lata mangeshkar": "Lata Mangeshkar",
  kishore: "Kishore Kumar",
  "kishore kumar": "Kishore Kumar",
  rafi: "Mohammed Rafi",
  "mohammed rafi": "Mohammed Rafi",
  honey: "Yo Yo Honey Singh",
  "honey singh": "Yo Yo Honey Singh",
  badshah: "Badshah",
  "shankar mahadevan": "Shankar Mahadevan",
  shankar: "Shankar Mahadevan",
  "vishal shekhar": "Vishal-Shekhar",
  "shankar ehsaan loy": "Shankar-Ehsaan-Loy",
  mithoon: "Mithoon",
  "sachin jigar": "Sachin-Jigar",
  "salim sulaiman": "Salim-Sulaiman",
  "amit trivedi": "Amit Trivedi",
  trivedi: "Amit Trivedi",
  jubin: "Jubin Nautiyal",
  "jubin nautiyal": "Jubin Nautiyal",
  "b praak": "B Praak",
  bpraak: "B Praak",
  "vishal mishra": "Vishal Mishra",
  darshan: "Darshan Raval",
  "darshan raval": "Darshan Raval",
  "tanishk bagchi": "Tanishk Bagchi",
  tanishk: "Tanishk Bagchi",
  "sachet tandon": "Sachet Tandon",
  sachet: "Sachet Tandon",
  "stebin ben": "Stebin Ben",
  stebin: "Stebin Ben",
  armaan: "Armaan Malik",
  "armaan malik": "Armaan Malik",
  "mohit chauhan": "Mohit Chauhan",
  mohit: "Mohit Chauhan",
  papon: "Papon",
  sunidhi: "Sunidhi Chauhan",
  "sunidhi chauhan": "Sunidhi Chauhan",
  "alka yagnik": "Alka Yagnik",
  alka: "Alka Yagnik",
  "udit narayan": "Udit Narayan",
  udit: "Udit Narayan",
  "kumar sanu": "Kumar Sanu",
  "rahat fateh": "Rahat Fateh Ali Khan",
  rahat: "Rahat Fateh Ali Khan",
  nusrat: "Nusrat Fateh Ali Khan",
  "lucky ali": "Lucky Ali",
  raftaar: "Raftaar",
  divine: "DIVINE",
  "mc stan": "MC Stan",
  king: "King",
  "talha anjum": "Talha Anjum",
  "seedhe maut": "Seedhe Maut",

  // ── Punjabi ──
  diljit: "Diljit Dosanjh",
  "diljit dosanjh": "Diljit Dosanjh",
  "ap dhillon": "AP Dhillon",
  ap: "AP Dhillon",
  "guru randhawa": "Guru Randhawa",
  guru: "Guru Randhawa",
  "harrdy sandhu": "Harrdy Sandhu",
  harrdy: "Harrdy Sandhu",
  "jassie gill": "Jassie Gill",
  "jasmine sandlas": "Jasmine Sandlas",
  "sidhu moose wala": "Sidhu Moosewala",
  sidhu: "Sidhu Moosewala",
  "karan aujla": "Karan Aujla",
  "ammy virk": "Ammy Virk",
  "parmish verma": "Parmish Verma",
  "garry sandhu": "Garry Sandhu",
  "gippy grewal": "Gippy Grewal",
  "gurdas maan": "Gurdas Maan",
  "daler mehndi": "Daler Mehndi",

  // ── Tamil ──
  anirudh: "Anirudh Ravichander",
  "anirudh ravichander": "Anirudh Ravichander",
  "ar rahman": "A.R. Rahman",
  rahman: "A.R. Rahman",
  arr: "A.R. Rahman",
  yuvan: "Yuvan Shankar Raja",
  "yuvan shankar raja": "Yuvan Shankar Raja",
  "sid sriram": "Sid Sriram",
  sid: "Sid Sriram",
  imman: "D.Imman",
  "d imman": "D.Imman",
  "d.imman": "D.Imman",
  dimman: "D.Imman",
  "gv prakash": "G.V. Prakash Kumar",
  gv: "G.V. Prakash Kumar",
  ilaiyaraaja: "Ilaiyaraaja",
  ilayaraja: "Ilaiyaraaja",
  raja: "Ilaiyaraaja",
  spb: "S.P. Balasubrahmanyam",
  "sp balasubrahmanyam": "S.P. Balasubrahmanyam",
  hariharan: "Hariharan",
  chinmayi: "Chinmayi",
  haricharan: "Haricharan",
  srinivas: "Srinivas",
  unnikrishnan: "Unnikrishnan",
  karthik: "Karthik",
  "vijay antony": "Vijay Antony",
  "harris jayaraj": "Harris Jayaraj",
  harris: "Harris Jayaraj",
  "sean roldan": "Sean Roldan",
  "santhosh narayanan": "Santhosh Narayanan",
  santhosh: "Santhosh Narayanan",
  "hiphop tamizha": "Hiphop Tamizha",
  hiphop: "Hiphop Tamizha",
  dhanush: "Dhanush",
  andrea: "Andrea Jeremiah",
  "jonita gandhi": "Jonita Gandhi",
  jonita: "Jonita Gandhi",
  "pradeep kumar": "Pradeep Kumar",
  shakthisree: "Shakthisree Gopalan",
  "benny dayal": "Benny Dayal",
  benny: "Benny Dayal",
  "sai abhyankkar": "Sai Abhyankkar",

  // ── Telugu ──
  thaman: "S.Thaman",
  "s thaman": "S.Thaman",
  dsp: "Devi Sri Prasad",
  "devi sri prasad": "Devi Sri Prasad",
  manisharma: "Mani Sharma",
  "mani sharma": "Mani Sharma",
  "mickey j meyer": "Mickey J Meyer",

  // ── Malayalam ──
  "sushin shyam": "Sushin Shyam",
  sushin: "Sushin Shyam",
  "vineeth sreenivasan": "Vineeth Sreenivasan",
  vineeth: "Vineeth Sreenivasan",
  "hesham abdul wahab": "Hesham Abdul Wahab",

  // ── Kannada ──
  "arjun janya": "Arjun Janya",

  // ── Bengali ──
  "anupam roy": "Anupam Roy",
  "rupam islam": "Rupam Islam",
  nachiketa: "Nachiketa",

  // ── International ──
  weeknd: "The Weeknd",
  "the weeknd": "The Weeknd",
  drake: "Drake",
  taylor: "Taylor Swift",
  "taylor swift": "Taylor Swift",
  billie: "Billie Eilish",
  "billie eilish": "Billie Eilish",
  "dua lipa": "Dua Lipa",
  dua: "Dua Lipa",
  "bruno mars": "Bruno Mars",
  bruno: "Bruno Mars",
  ed: "Ed Sheeran",
  "ed sheeran": "Ed Sheeran",
  olivia: "Olivia Rodrigo",
  "olivia rodrigo": "Olivia Rodrigo",
  doja: "Doja Cat",
  "doja cat": "Doja Cat",
  "post malone": "Post Malone",
  "ariana grande": "Ariana Grande",
  ariana: "Ariana Grande",
  "justin bieber": "Justin Bieber",
  justin: "Justin Bieber",
  "selena gomez": "Selena Gomez",
  selena: "Selena Gomez",
  "charlie puth": "Charlie Puth",
  "shawn mendes": "Shawn Mendes",
  shawn: "Shawn Mendes",
  "sam smith": "Sam Smith",
  adele: "Adele",
  rihanna: "Rihanna",
  beyonce: "Beyoncé",
  eminem: "Eminem",
  coldplay: "Coldplay",
  "imagine dragons": "Imagine Dragons",
  "one direction": "One Direction",
  "maroon 5": "Maroon 5",
  "twenty one pilots": "Twenty One Pilots",
  "lana del rey": "Lana Del Rey",
  lana: "Lana Del Rey",
  "harry styles": "Harry Styles",
  harry: "Harry Styles",
  bts: "BTS",
  blackpink: "BLACKPINK",
  "travis scott": "Travis Scott",
  travis: "Travis Scott",
  kanye: "Kanye West",
  "kanye west": "Kanye West",
  kendrick: "Kendrick Lamar",
  "kendrick lamar": "Kendrick Lamar",
  sza: "SZA",
  "sabrina carpenter": "Sabrina Carpenter",
  sabrina: "Sabrina Carpenter",
  "chappell roan": "Chappell Roan",
  "tate mcrae": "Tate McRae",
  "gracie abrams": "Gracie Abrams",
  hozier: "Hozier",
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
];

// ─── INTENT TYPES ────────────────────────────────────────────────────────────
export type IntentType =
  | "specific_song"
  | "artist_songs"
  | "movie_songs"
  | "mood_playlist"
  | "era_songs"
  | "bgm_search"
  | "language_top"
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
  const expandedQueries: string[] = [originalQuery];

  // ── 1. Artist detection (multi-word first, then single-word) ──
  const sortedArtistKeys = Object.keys(ARTIST_DICT).sort(
    (a, b) => b.length - a.length,
  );
  for (const key of sortedArtistKeys) {
    if (lower.includes(key) && !artist) {
      artist = ARTIST_DICT[key];
      artistConfidence = key.split(" ").length > 1 ? 0.95 : 0.8;
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
        expandedQueries.push(
          `${artist} best songs${moodQ}`,
          `${artist}${moodQ} songs`,
          `${artist} hits${moodQ}`,
          `best of ${artist}`,
        );
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
      if (lower.includes("new") || lower.includes("latest")) {
        expandedQueries.push(`${originalQuery} ${new Date().getFullYear()}`);
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

  // Collect all artist names
  const primaryArtists =
    song.artists?.primary?.map((a) => a.name.toLowerCase()) || [];
  const mapArtists =
    song.artist_map?.primary_artists?.map((a) => a.name.toLowerCase()) || [];
  const allArtists = [...new Set([...primaryArtists, ...mapArtists])];
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

  // ═══ POPULARITY BOOST ═══
  const playCount = (song as any).play_count || (song as any).playCount || 0;
  if (playCount > 10_000_000) {
    score += 20;
    reasons.push("very_popular");
  } else if (playCount > 1_000_000) {
    score += 12;
  } else if (playCount > 100_000) {
    score += 5;
  }

  // ═══ ALBUM NAME HAS QUERY WORDS (original soundtrack) ═══
  if (
    albumLower &&
    queryWords.some((w) => albumLower.includes(w) && w.length > 2)
  ) {
    score += 15;
    reasons.push("album_word");
  }

  // ═══ PENALIZE COVERS ═══
  if (
    !parsed.normalizedQuery.includes("cover") &&
    !parsed.normalizedQuery.includes("unplugged")
  ) {
    if (COVER_KEYWORDS.some((kw) => titleLower.includes(kw))) {
      score -= 30;
      reasons.push("cover_penalty");
    }
  }

  return {
    ...song,
    relevanceScore: Math.max(score, 0),
    matchReasons: reasons,
    isTopResult: score > 80,
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
  limit = 25,
): Promise<{
  query: string;
  parsedIntent: ParsedQuery;
  topResult: ScoredSong | null;
  songs: ScoredSong[];
  total: number;
  displayContext: string;
}> {
  // Cache check — word-sorted key so "sad hindi" and "hindi sad" share one entry
  const ck = `search:v3:${normalizeSearchKey(query)}:${type}`;
  const cached = await redisGet(ck);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      /* ignore */
    }
  }

  const parsed = parseQuery(query);
  let allResults: JioSaavnSong[] = [];

  // ── Step 1: Fire primary queries in TRUE parallel (bypass throttle queue) ──
  const primaryQueries = parsed.expandedQueries.slice(0, 3);
  const primaryPromises = primaryQueries.map((q) =>
    searchSongsDirect(q, Math.min(limit, 20)),
  );
  const settled = await Promise.allSettled(primaryPromises);

  for (const res of settled) {
    if (res.status === "fulfilled") {
      allResults.push(...res.value.results);
    }
  }

  // ── Step 2: Score and check if top result is strong ──
  const seen = new Set<string>();
  const deduped: JioSaavnSong[] = [];
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
      moreQueries.map((q) => searchSongsDirect(q, 10)),
    );
    for (const res of moreSettled) {
      if (res.status === "fulfilled") {
        for (const s of res.value.results) {
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

  // ── Step 4: Filter out junk (score < 10) and limit ──
  const filtered = scored.filter((s) => s.relevanceScore >= 5).slice(0, limit);
  const topResult =
    filtered.length > 0 && filtered[0].relevanceScore > 70 ? filtered[0] : null;

  const result = {
    query,
    parsedIntent: parsed,
    topResult,
    songs: filtered,
    total: filtered.length,
    displayContext: parsed.displayContext,
  };

  // Cache 1 hour
  await redisSet(ck, JSON.stringify(result), 3600);
  return result;
}
