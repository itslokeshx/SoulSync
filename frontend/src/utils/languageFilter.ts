const SPANISH_ARTISTS = [
  "bad bunny", "rosalía", "rosalia", "j balvin", "karol g", "rauw alejandro",
  "daddy yankee", "maluma", "ozuna", "luis fonsi", "enrique iglesias",
  "peso pluma", "shakira", "camilo", "sebastian yatra", "anuel aa"
];

const KOREAN_ARTISTS = [
  "bts", "blackpink", "stray kids", "twice", "newjeans", "seventeen",
  "exo", "iu", "txt", "enhypen", "red velvet", "le sserafim", "aespa",
  "itzy", "jungkook", "jimin", "v", "suga", "j-hope", "rm", "jin"
];

const JAPANESE_ARTISTS = [
  "yoasobi", "kenshi yonezu", "fujii kaze", "one ok rock", "ado",
  "lisa", "official hige dandism", "utada hikaru", "radwimps", "vaundy"
];

const FRENCH_ARTISTS = [
  "stromae", "indila", "gims", "maître gims", "aya nakamura", "jul",
  "ninho", "soolking", "angèle", "angele", "zaz", "david guetta", "daft punk"
];

const GERMAN_ARTISTS = [
  "rammstein", "apache 207", "bonez mc", "peter fox", "cro",
  "robin schulz", "zedd", "scorpions", "tokio hotel"
];

const PORTUGUESE_ARTISTS = [
  "anitta", "alok", "marília mendonça", "marilia mendonca", "gusttavo lima",
  "ludmilla", "roberto carlos", "jão", "jao", "luísa sonza", "luisa sonza"
];

const ARABIC_ARTISTS = [
  "amr diab", "nancy ajram", "elissa", "sherine", "saad lamjarred",
  "mohamed hamaki", "tamer hosny", "fairouz", "assala"
];

const TAMIL_ARTISTS = [
  "anirudh", "ar rahman", "harris jayaraj", "sid sriram", "yuvan shankar",
  "g.v. prakash", "gv prakash", "hiphop tamizha", "santhosh narayanan",
  "ilaiyaraaja", "ilayaraja", "vijay antony", "d. imman", "d imman",
  "sai abhyankkar", "paal dabba", "deepthi suresh", "bebhumika", "saNa"
];

const HINDI_ARTISTS = [
  "arijit singh", "mithoon", "pritam", "vishal-shekhar", "vishal shekhar",
  "jubin nautiyal", "badshah", "guru randhawa", "neha kakkar", "tanishk bagchi",
  "anuv jain", "navjot ahuja", "shashwat sachdev", "sachet-parampara",
  "sachet tandon", "parampara tandon", "shreya ghoshal", "sonu nigam",
  "sunidhi chauhan", "shaan", "kk", "atif aslam", "lata mangeshkar",
  "kishore kumar", "kumar sanu", "alka yagnik", "udit narayan", "hariharan", "lalit sen"
];

const TELUGU_ARTISTS = [
  "devi sri prasad", "dsp", "thaman", "s. thaman", "s thaman", "keeravani",
  "m. m. keeravani", "jangi reddy", "kasarla shyam", "arjun chandy"
];

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

export function detectLanguage(song: any): string | null {
  if (!song) return null;
  const explicit = (song.language || "").toLowerCase().trim();
  if (explicit) return explicit;

  const combined = `${song.name || ""} ${song.primaryArtists || song.artist || ""} ${song.album || ""}`.toLowerCase();

  // Scripts
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(combined)) return "korean";
  if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(combined)) return "japanese";
  if (/[\u0600-\u06FF]/.test(combined)) return "arabic";
  if (/[\u0400-\u04FF]/.test(combined)) return "russian";
  if (/[\u0900-\u097F]/.test(combined)) return "hindi";
  if (/[\u0B80-\u0BFF]/.test(combined)) return "tamil";
  if (/[\u0C00-\u0C7F]/.test(combined)) return "telugu";
  if (/[\u0A00-\u0A7F]/.test(combined)) return "punjabi";
  if (/[\u0D00-\u0D7F]/.test(combined)) return "malayalam";
  if (/[\u0C80-\u0CFF]/.test(combined)) return "kannada";
  if (/[\u0980-\u09FF]/.test(combined)) return "bengali";

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
  if (/\b(bollywood|hindi)\b/i.test(combined)) return "hindi";

  const artist = (song.primaryArtists || song.artist || "").toLowerCase();
  for (const ka of KOREAN_ARTISTS) if (artist.includes(ka)) return "korean";
  for (const ja of JAPANESE_ARTISTS) if (artist.includes(ja)) return "japanese";
  for (const sa of SPANISH_ARTISTS) if (artist.includes(sa)) return "spanish";
  for (const fa of FRENCH_ARTISTS) if (artist.includes(fa)) return "french";
  for (const ga of GERMAN_ARTISTS) if (artist.includes(ga)) return "german";
  for (const pa of PORTUGUESE_ARTISTS) if (artist.includes(pa)) return "portuguese";
  for (const aa of ARABIC_ARTISTS) if (artist.includes(aa)) return "arabic";
  for (const ta of TAMIL_ARTISTS) if (artist.includes(ta)) return "tamil";
  for (const ha of HINDI_ARTISTS) if (artist.includes(ha)) return "hindi";
  for (const te of TELUGU_ARTISTS) if (artist.includes(te)) return "telugu";
  for (const ea of ENGLISH_ARTISTS) if (artist.includes(ea)) return "english";

  return null;
}

export function filterByPreferredLanguages(songs: any[], preferredLanguages?: string[]): any[] {
  if (!preferredLanguages || preferredLanguages.length === 0) return songs;
  const allowedSet = new Set(preferredLanguages.map((l) => l.toLowerCase().trim()));

  return songs.filter((song) => {
    const lang = detectLanguage(song);
    if (lang) return allowedSet.has(lang);

    const hasEnglishOnly = allowedSet.has("english") && !allowedSet.has("hindi") && !allowedSet.has("tamil") && !allowedSet.has("telugu") && !allowedSet.has("punjabi");
    if (hasEnglishOnly) {
      const combined = `${song.name || ""} ${song.primaryArtists || song.artist || ""} ${song.album || ""}`.toLowerCase();
      const isIndian = /\b(aashiqui|raees|chalisa|dhurandhar|coke studio|dude|the paradise|peddi|jana nayagan|saiyaara|barbaad|fanniyar|apna bana le)\b/i.test(combined);
      if (isIndian) return false;
    }
    return true;
  });
}
