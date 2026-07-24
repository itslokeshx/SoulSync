// ════════════════════════════════════════════════════════════════
// SOULSYNC SEARCH ENTITY DICTIONARY & RELATIONSHIP GRAPH
// Complete entity mapping: Director → Movie → Soundtrack → Songs
// Actor → Movies → Composers | Artist → Albums → Songs
// ════════════════════════════════════════════════════════════════

export interface DirectorEntity {
  name: string;
  movies: string[];
  topComposers: string[];
}

export interface ActorEntity {
  name: string;
  movies: string[];
  associatedArtists: string[];
}

export interface MovieEntity {
  name: string;
  director?: string;
  actors?: string[];
  composer?: string;
  releaseYear?: number;
}

// ── Directors Graph ──────────────────────────────────────────────
export const DIRECTOR_DICT: Record<string, DirectorEntity> = {
  nolan: {
    name: "Christopher Nolan",
    movies: ["The Odyssey", "Oppenheimer", "Interstellar", "Inception", "Tenet", "Dunkirk", "The Dark Knight"],
    topComposers: ["Ludwig Goransson", "Hans Zimmer"],
  },
  "christopher nolan": {
    name: "Christopher Nolan",
    movies: ["The Odyssey", "Oppenheimer", "Interstellar", "Inception", "Tenet", "Dunkirk", "The Dark Knight"],
    topComposers: ["Ludwig Goransson", "Hans Zimmer"],
  },
  lokesh: {
    name: "Lokesh Kanagaraj",
    movies: ["Coolie", "Leo", "Vikram", "Master", "Kaithi"],
    topComposers: ["Anirudh Ravichander"],
  },
  "lokesh kanagaraj": {
    name: "Lokesh Kanagaraj",
    movies: ["Coolie", "Leo", "Vikram", "Master", "Kaithi"],
    topComposers: ["Anirudh Ravichander"],
  },
  nelson: {
    name: "Nelson Dilipkumar",
    movies: ["Jailer", "Beast", "Doctor", "Kolamaavu Kokila"],
    topComposers: ["Anirudh Ravichander"],
  },
  "nelson dilipkumar": {
    name: "Nelson Dilipkumar",
    movies: ["Jailer", "Beast", "Doctor", "Kolamaavu Kokila"],
    topComposers: ["Anirudh Ravichander"],
  },
  atlee: {
    name: "Atlee",
    movies: ["Jawan", "Mersal", "Bigil", "Raja Rani", "Theri"],
    topComposers: ["Anirudh Ravichander", "A.R. Rahman"],
  },
  "mani ratnam": {
    name: "Mani Ratnam",
    movies: ["Ponniyin Selvan", "Dil Se", "Guru", "Bombay", "Roja", "Raavan", "Alaipayuthey"],
    topComposers: ["A.R. Rahman"],
  },
  rajamouli: {
    name: "S.S. Rajamouli",
    movies: ["RRR", "Baahubali", "Eega", "Magadheera"],
    topComposers: ["M.M. Keeravani"],
  },
  "ss rajamouli": {
    name: "S.S. Rajamouli",
    movies: ["RRR", "Baahubali", "Eega", "Magadheera"],
    topComposers: ["M.M. Keeravani"],
  },
  "prashanth neel": {
    name: "Prashanth Neel",
    movies: ["KGF", "KGF Chapter 2", "Salaar"],
    topComposers: ["Ravi Basrur"],
  },
  vanga: {
    name: "Sandeep Reddy Vanga",
    movies: ["Animal", "Kabir Singh", "Arjun Reddy"],
    topComposers: ["Harshavardhan Rameshwar", "Pritam", "Vishal Mishra"],
  },
};

// ── Actors Graph ─────────────────────────────────────────────────
export const ACTOR_GRAPH: Record<string, ActorEntity> = {
  rajinikanth: {
    name: "Rajinikanth",
    movies: ["Coolie", "Vettaiyan", "Jailer", "Darbar", "Petta", "Kaala", "Kabali", "Enthiran", "Sivaji", "Padayappa", "Baashha"],
    associatedArtists: ["Anirudh Ravichander", "A.R. Rahman", "Deva", "Ilaiyaraaja", "SPB"],
  },
  rajini: {
    name: "Rajinikanth",
    movies: ["Coolie", "Vettaiyan", "Jailer", "Darbar", "Petta", "Kaala", "Kabali", "Enthiran", "Sivaji", "Padayappa", "Baashha"],
    associatedArtists: ["Anirudh Ravichander", "A.R. Rahman", "Deva", "Ilaiyaraaja", "SPB"],
  },
  vijay: {
    name: "Thalapathy Vijay",
    movies: ["GOAT", "Leo", "Varisu", "Beast", "Master", "Bigil", "Sarkar", "Mersal", "Theri", "Kaththi", "Ghilli"],
    associatedArtists: ["Anirudh Ravichander", "A.R. Rahman", "Yuvan Shankar Raja", "Vidyasagar", "G.V. Prakash Kumar"],
  },
  thalapathy: {
    name: "Thalapathy Vijay",
    movies: ["GOAT", "Leo", "Varisu", "Beast", "Master", "Bigil", "Sarkar", "Mersal", "Theri", "Kaththi", "Ghilli"],
    associatedArtists: ["Anirudh Ravichander", "A.R. Rahman", "Yuvan Shankar Raja", "Vidyasagar", "G.V. Prakash Kumar"],
  },
  ajith: {
    name: "Ajith Kumar",
    movies: ["Good Bad Ugly", "Vidaamuyarchi", "Thunivu", "Valimai", "Viswasam", "Vedalam", "Mankatha", "Billa"],
    associatedArtists: ["Anirudh Ravichander", "Yuvan Shankar Raja", "G.V. Prakash Kumar", "D. Imman"],
  },
  srk: {
    name: "Shah Rukh Khan",
    movies: ["Jawan", "Pathaan", "Dunki", "Zero", "Raees", "Dilwale", "Chennai Express", "Jab Tak Hai Jaan", "Don 2", "Om Shanti Om", "Swades", "DDLJ"],
    associatedArtists: ["Anirudh Ravichander", "Vishal-Shekhar", "Pritam", "Arijit Singh", "A.R. Rahman"],
  },
  "shah rukh khan": {
    name: "Shah Rukh Khan",
    movies: ["Jawan", "Pathaan", "Dunki", "Zero", "Raees", "Dilwale", "Chennai Express", "Jab Tak Hai Jaan", "Don 2", "Om Shanti Om", "Swades", "DDLJ"],
    associatedArtists: ["Anirudh Ravichander", "Vishal-Shekhar", "Pritam", "Arijit Singh", "A.R. Rahman"],
  },
  ranbir: {
    name: "Ranbir Kapoor",
    movies: ["Animal", "Tu Jhoothi Main Makkaar", "Brahmastra", "Sanju", "Ae Dil Hai Mushkil", "Tamasha", "Yeh Jawaani Hai Deewani", "Barfi", "Rockstar"],
    associatedArtists: ["Pritam", "Arijit Singh", "A.R. Rahman", "Mohit Chauhan"],
  },
  "allu arjun": {
    name: "Allu Arjun",
    movies: ["Pushpa 2", "Pushpa", "Ala Vaikunthapurramuloo", "Naa Peru Surya", "DJ", "Sarrainodu", "Race Gurram", "Arya 2", "Arya"],
    associatedArtists: ["Devi Sri Prasad", "S. Thaman", "Sid Sriram"],
  },
  prabhas: {
    name: "Prabhas",
    movies: ["The Raja Saab", "Kalki 2898 AD", "Salaar", "Adipurush", "Radhe Shyam", "Saaho", "Baahubali 2", "Baahubali"],
    associatedArtists: ["Santhosh Narayanan", "Ravi Basrur", "M.M. Keeravani", "Devi Sri Prasad"],
  },
  suriya: {
    name: "Suriya",
    movies: ["Kanguva", "Etharkkum Thunindhavan", "Soorarai Pottru", "Kaappaan", "24", "Singam", "Vaaranam Aayiram", "Ghajini"],
    associatedArtists: ["Devi Sri Prasad", "G.V. Prakash Kumar", "Harris Jayaraj", "Yuvan Shankar Raja"],
  },
  kamal: {
    name: "Kamal Haasan",
    movies: ["Indian 2", "Thug Life", "Vikram", "Vishwaroopam", "Dasavathaaram", "Anbe Sivam", "Hey Ram", "Indian", "Nayakan"],
    associatedArtists: ["Anirudh Ravichander", "Ilaiyaraaja", "A.R. Rahman", "Kamal Haasan"],
  },
  dq: {
    name: "Dulquer Salmaan",
    movies: ["Lucky Baskhar", "King of Kotha", "Sita Ramam", "Kurup", "Hey Sinamika", "Mahanati", "Charlie", "OK Kanmani"],
    associatedArtists: ["G.V. Prakash Kumar", "Sushin Shyam", "A.R. Rahman"],
  },
  fahadh: {
    name: "Fahadh Faasil",
    movies: ["Aavesham", "Pushpa", "Malik", "Joji", "Trance", "Kumbalangi Nights"],
    associatedArtists: ["Sushin Shyam", "A.R. Rahman"],
  },
  mohanlal: {
    name: "Mohanlal",
    movies: ["Barroz", "Malaikottai Vaaliban", "Neru", "Jailer", "Lucifer", "Drishyam", "Pulimurugan"],
    associatedArtists: ["Sushin Shyam", "Deepak Dev"],
  },
};

// ── Known Movie Details Graph ─────────────────────────────────────
export const MOVIE_DICT: Record<string, MovieEntity> = {
  odyssey: { name: "The Odyssey", director: "Christopher Nolan", composer: "Ludwig Goransson", releaseYear: 2026 },
  "the odyssey": { name: "The Odyssey", director: "Christopher Nolan", composer: "Ludwig Goransson", releaseYear: 2026 },
  coolie: { name: "Coolie", director: "Lokesh Kanagaraj", actors: ["Rajinikanth"], composer: "Anirudh Ravichander", releaseYear: 2025 },
  leo: { name: "Leo", director: "Lokesh Kanagaraj", actors: ["Thalapathy Vijay"], composer: "Anirudh Ravichander", releaseYear: 2023 },
  jailer: { name: "Jailer", director: "Nelson Dilipkumar", actors: ["Rajinikanth"], composer: "Anirudh Ravichander", releaseYear: 2023 },
  vettaiyan: { name: "Vettaiyan", director: "T.J. Gnanavel", actors: ["Rajinikanth"], composer: "Anirudh Ravichander", releaseYear: 2024 },
  devara: { name: "Devara", director: "Koratala Siva", actors: ["Jr NTR"], composer: "Anirudh Ravichander", releaseYear: 2024 },
  "pushpa 2": { name: "Pushpa 2", director: "Sukumar", actors: ["Allu Arjun"], composer: "Devi Sri Prasad", releaseYear: 2024 },
  pushpa: { name: "Pushpa", director: "Sukumar", actors: ["Allu Arjun"], composer: "Devi Sri Prasad", releaseYear: 2021 },
  aavesham: { name: "Aavesham", director: "Jithu Madhavan", actors: ["Fahadh Faasil"], composer: "Sushin Shyam", releaseYear: 2024 },
  oppenheimer: { name: "Oppenheimer", director: "Christopher Nolan", composer: "Ludwig Goransson", releaseYear: 2023 },
  interstellar: { name: "Interstellar", director: "Christopher Nolan", composer: "Hans Zimmer", releaseYear: 2014 },
  jawan: { name: "Jawan", director: "Atlee", actors: ["Shah Rukh Khan"], composer: "Anirudh Ravichander", releaseYear: 2023 },
  animal: { name: "Animal", director: "Sandeep Reddy Vanga", actors: ["Ranbir Kapoor"], composer: "Pritam", releaseYear: 2023 },
  kalki: { name: "Kalki 2898 AD", director: "Nag Ashwin", actors: ["Prabhas"], composer: "Santhosh Narayanan", releaseYear: 2024 },
  "kalki 2898 ad": { name: "Kalki 2898 AD", director: "Nag Ashwin", actors: ["Prabhas"], composer: "Santhosh Narayanan", releaseYear: 2024 },
};

// ── Extended Phonetic / Typo Corrections ──────────────────────────
export const EXTENDED_PHONETIC_MAP: Record<string, string> = {
  // Songs
  odessy: "the odyssey",
  odysey: "the odyssey",
  hukm: "hukum",
  huk: "hukum",
  "katci sera": "katchi sera",
  katch: "katchi sera",
  illu: "illuminati",
  illuminaty: "illuminati",
  puspha: "pushpa",
  arab: "arabic kuthu",
  "shape of u": "shape of you",
  "tumhi ho": "tum hi ho",
  // Artists
  anrudh: "anirudh",
  anirudha: "anirudh",
  "tailor swift": "taylor swift",
  "brono mars": "bruno mars",
  "brono marz": "bruno mars",
  arjit: "arijit",
  arjith: "arijit",
  "arjit singh": "arijit singh",
  "a r rahman": "ar rahman",
  "ar rehman": "ar rahman",
  "diljeet dosanjh": "diljit dosanjh",
  badsha: "badshah",
  shreyaghoshal: "shreya ghoshal",
  // Natural language aliases
  "nolan movie": "the odyssey",
  "nolan new movie": "the odyssey",
  "new rajini movie": "coolie",
  "rajini new movie": "coolie",
  "that pushpa song": "pushpa 2",
  "that new bruno song": "bruno mars latest",
  "viral malayalam song": "illuminati",
};

/**
 * Compute Damerau-Levenshtein edit distance for fast typo matching
 */
export function computeEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Correct typos using phonetic map + Levenshtein distance against known vocabulary
 */
export function correctTypoEnhanced(query: string): string {
  const lower = query.trim().toLowerCase();

  // 1. Direct map lookup
  if (EXTENDED_PHONETIC_MAP[lower]) {
    return EXTENDED_PHONETIC_MAP[lower];
  }

  // 2. Multi-word phrase replacement
  for (const [wrong, correct] of Object.entries(EXTENDED_PHONETIC_MAP)) {
    if (lower.includes(wrong)) {
      return lower.replace(wrong, correct).trim();
    }
  }

  // 3. Word-by-word fuzzy matching against target vocabulary
  const vocab = [
    "anirudh", "arijit", "rahman", "taylor", "swift", "bruno", "mars",
    "odyssey", "hukum", "katchi", "illuminati", "pushpa", "coolie", "jailer",
    "rajinikanth", "nolan", "oppenheimer", "interstellar", "aavesham", "kesariya",
    "diljit", "badshah", "shreya", "lokesh", "atlee", "pritam"
  ];

  const words = lower.split(/\s+/);
  let changed = false;

  const correctedWords = words.map((word) => {
    if (word.length <= 3) return word;

    for (const target of vocab) {
      if (Math.abs(word.length - target.length) <= 2) {
        const dist = computeEditDistance(word, target);
        if (dist === 1 || (dist === 2 && word.length >= 6)) {
          changed = true;
          return target;
        }
      }
    }
    return word;
  });

  return changed ? correctedWords.join(" ") : query;
}
