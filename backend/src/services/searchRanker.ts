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
  _score?: number;
}

/**
 * Calculates string similarity ratio between 0 and 1 using bigram (Sørensen-Dice) similarity.
 * Fast, accurate fuzzy matching for typo tolerance in search queries.
 */
export function fuzzySimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  if (s1.length < 2 || s2.length < 2) return 0.0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bigram = s1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bigram = s2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (s1.length + s2.length - 2);
}

export function rankSearchResults(
  songs: RankedSong[],
  query: string,
  preferredLang?: string,
  knownArtist?: string | null,
): RankedSong[] {
  if (!songs || songs.length === 0) return [];
  const q = query.trim().toLowerCase();
  const qWords = q.split(/\s+/).filter((w) => w.length > 1);

  const scored = songs.map((song) => {
    let score = 0;
    const title = (song.name || "").toLowerCase();
    const artist = (song.primaryArtists || "").toLowerCase();

    const titleMatches = qWords.filter((w) => title.includes(w));
    if (qWords.length > 0) {
      score += (titleMatches.length / qWords.length) * 100;
    }

    if (title === q) {
      score += 50;
    } else if (title.startsWith(q)) {
      score += 30;
    }

    // Fuzzy title matching for typo tolerance
    const titleFuzzy = fuzzySimilarity(title, q);
    if (titleFuzzy > 0.35) {
      score += titleFuzzy * 90;
    }

    const artistMatches = qWords.filter((w) => artist.includes(w));
    score += artistMatches.length * 20;

    // Fuzzy artist matching for typo tolerance
    const artistFuzzy = fuzzySimilarity(artist, q);
    if (artistFuzzy > 0.4) {
      score += artistFuzzy * 50;
    }

    const MAJOR_ARTISTS = [
      "arijit singh", "ar rahman", "anirudh ravichander", "sid sriram",
      "shreya ghoshal", "diljit dosanjh", "ed sheeran", "taylor swift",
      "the weeknd", "justin bieber", "billie eilish", "olivia rodrigo",
      "dua lipa", "coldplay", "bts"
    ];
    if (MAJOR_ARTISTS.some(ma => artist.includes(ma))) {
      score += 15;
    }

    if (knownArtist && artist.includes(knownArtist.toLowerCase())) {
      score += 40;
    }

    return { ...song, _score: score };
  });

  scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
  return scored.map(({ _score, ...song }) => song) as RankedSong[];
}

export function rankSongs<T extends RankedSong>(
  songs: T[],
  query: string,
  preferLang?: string,
  knownArtist?: string,
): T[] {
  return rankSearchResults(songs as any, query, preferLang, knownArtist) as any;
}

export function deduplicateResults<T extends RankedSong>(songs: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const song of songs) {
    const key = `${song.name.toLowerCase()}::${(song.primaryArtists || "").split(",")[0].toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(song);
    }
  }
  return result;
}

export function dedupSongs<T extends RankedSong>(songs: T[]): T[] {
  return deduplicateResults(songs);
}

export function buildSearchQueries(q: string): { queries: string[]; knownArtist: string | null } {
  const trimmed = q.trim();
  const queries = [trimmed];
  const lower = trimmed.toLowerCase();
  if (trimmed && !lower.includes("song") && !lower.includes("track") && !lower.includes("hit")) {
    queries.push(`${trimmed} song`);
  }
  return { queries, knownArtist: null };
}

export function getKnownSongIds(q: string): string[] {
  return [];
}
