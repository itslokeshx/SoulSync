import { Song } from "../types/song";

export function getArtists(song: Song | null): string {
  if (!song) return "—";
  if (
    Array.isArray(song.artist_map?.primary_artists) &&
    song.artist_map!.primary_artists.length
  )
    return song.artist_map!.primary_artists.map((a) => a.name).join(", ");
  if (Array.isArray(song.artists?.primary) && song.artists!.primary.length)
    return song.artists!.primary.map((a) => a.name).join(", ");
  if (song.music) return song.music;
  return song.primaryArtists || song.subtitle || "—";
}

// Smart Query Parser — client-side version
export interface ParsedQuery {
  originalQuery: string;
  cleanedQuery: string;
  intent: "song" | "artist" | "album" | "bgm" | "mood" | "year";
  expandedQueries: string[];
  isBGM: boolean;
  isRemix: boolean;
  movieName: string | null;
  extractedArtist: string | null;
  extractedYear: number | null;
  extractedLanguage: string | null;
}

const ARTIST_SHORTHANDS: Record<string, string> = {
  arijit: "Arijit Singh",
  "ar rahman": "A.R. Rahman",
  rahman: "A.R. Rahman",
  anirudh: "Anirudh Ravichander",
  yuvan: "Yuvan Shankar Raja",
  sid: "Sid Sriram",
  shreya: "Shreya Ghoshal",
  neha: "Neha Kakkar",
  pritam: "Pritam",
  atif: "Atif Aslam",
  sonu: "Sonu Nigam",
  "gv prakash": "G.V. Prakash Kumar",
  weeknd: "The Weeknd",
  taylor: "Taylor Swift",
  billie: "Billie Eilish",
  dua: "Dua Lipa",
  bruno: "Bruno Mars",
  ed: "Ed Sheeran",
  doja: "Doja Cat",
  drake: "Drake",
  badshah: "Badshah",
  "honey singh": "Honey Singh",
  diljit: "Diljit Dosanjh",
  "ap dhillon": "AP Dhillon",
};

const BGM_KEYWORDS = [
  "bgm",
  "background",
  "instrumental",
  "theme",
  "ost",
  "score",
];

const LANGUAGE_MAP: Record<string, string> = {
  hindi: "Hindi",
  tamil: "Tamil",
  telugu: "Telugu",
  kannada: "Kannada",
  malayalam: "Malayalam",
  punjabi: "Punjabi",
  bengali: "Bengali",
  english: "English",
  kollywood: "Tamil",
  bollywood: "Hindi",
};

export function parseQuery(raw: string): ParsedQuery {
  const originalQuery = raw.trim();
  const lower = originalQuery.toLowerCase();
  const words = lower.split(/\s+/);

  let intent: ParsedQuery["intent"] = "song";
  let isBGM = false;
  let isRemix = false;
  let movieName: string | null = null;
  let extractedArtist: string | null = null;
  let extractedYear: number | null = null;
  let extractedLanguage: string | null = null;
  const expandedQueries: string[] = [originalQuery];

  // BGM detection
  if (BGM_KEYWORDS.some((kw) => lower.includes(kw))) {
    isBGM = true;
    intent = "bgm";
  }

  // Remix detection
  if (
    ["remix", "mashup", "lofi", "slowed", "reverb"].some((kw) =>
      lower.includes(kw),
    )
  ) {
    isRemix = true;
  }

  // Number detection (movie reference)
  const numberMatch = lower.match(/\b(\d{2,4})\b/);
  if (numberMatch) {
    const num = parseInt(numberMatch[1], 10);
    if (num >= 50 && num < 2100) {
      movieName = numberMatch[1];
      const otherWords = words.filter((w) => w !== numberMatch[1]).join(" ");
      expandedQueries.push(
        `${otherWords} from ${numberMatch[1]}`.trim(),
        `${numberMatch[1]} movie songs`,
      );
    }
  }

  // Era detection
  const eraMatch = lower.match(/\b(60s|70s|80s|90s|2000s|2010s|2020s)\b/);
  if (eraMatch) {
    const eraMap: Record<string, number> = {
      "60s": 1960,
      "70s": 1970,
      "80s": 1980,
      "90s": 1990,
      "2000s": 2000,
      "2010s": 2010,
      "2020s": 2020,
    };
    extractedYear = eraMap[eraMatch[1]] || null;
    intent = "year";
  }

  // Artist detection
  for (const [shorthand, fullName] of Object.entries(ARTIST_SHORTHANDS)) {
    if (lower.includes(shorthand)) {
      extractedArtist = fullName;
      intent = "artist";
      const withoutArtist = lower.replace(shorthand, "").trim();
      if (withoutArtist) expandedQueries.push(`${fullName} ${withoutArtist}`);
      break;
    }
  }

  // Language detection
  for (const [keyword, lang] of Object.entries(LANGUAGE_MAP)) {
    if (lower.includes(keyword)) {
      extractedLanguage = lang;
      break;
    }
  }

  // Movie detection ("from X")
  const fromMatch = lower.match(/(?:from|songs? from)\s+(.+)/);
  if (fromMatch && !movieName) {
    movieName = fromMatch[1].trim();
    expandedQueries.push(`${movieName} songs`, `${movieName} album`);
  }

  return {
    originalQuery,
    cleanedQuery: originalQuery,
    intent,
    expandedQueries: [...new Set(expandedQueries)].filter(Boolean),
    isBGM,
    isRemix,
    movieName,
    extractedArtist,
    extractedYear,
    extractedLanguage,
  };
}
