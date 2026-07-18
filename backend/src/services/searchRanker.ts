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

    const artistMatches = qWords.filter((w) => artist.includes(w));
    score += artistMatches.length * 20;

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
  return { queries: [q], knownArtist: null };
}

export function getKnownSongIds(q: string): string[] {
  return [];
}
