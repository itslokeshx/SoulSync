// ════════════════════════════════════════════════════════════════
// TASTE CLUSTERS & ARTIST ECOSYSTEMS
// ════════════════════════════════════════════════════════════════

import { CURATED_ARTIST_MAP } from "./artistGraphService.js";

// Ecosystems define musical neighborhoods — not genres.
// Songs within an ecosystem feel like a natural continuation.
// When you play Sai Abhyankkar, Govind Vasantha is the next step.
// When you play Arijit Singh, Anuv Jain is the next step.
// The engine stays inside ecosystems unless user behavior says otherwise.
// ════════════════════════════════════════════════════════════════

export interface EcosystemCluster {
  clusterId: string;
  clusterName: string;
  /** Core creators whose work defines the sound of this ecosystem */
  primaryArtists: string[];
  /** Natural neighbors — artists users transition to from primaryArtists */
  peerEcosystem: string[];
  primaryLanguage: string;
}

// ── TAMIL ECOSYSTEMS ─────────────────────────────────────────────
// Split Tamil into two real ecosystems. A user who plays Sai Abhyankkar
// is NOT in the same ecosystem as a user playing classic Ilaiyaraaja.

const TAMIL_CONTEMPORARY: EcosystemCluster = {
  clusterId: "tamil_contemporary",
  clusterName: "Tamil Contemporary / Indie / Cinematic",
  primaryArtists: [
    "anirudh ravichander",
    "sai abhyankkar",
    "sid sriram",
    "govind vasantha",
    "dhibu ninan thomas",
    "justin prabhakaran",
    "rex vijayan",
    "sean roldan",
    "vishal chandrashekhar",
    "santhosh narayanan",
  ],
  peerEcosystem: [
    "g.v. prakash",
    "gv prakash",
    "simon k. king",
    "leon james",
    "yuvan shankar raja",
    "harris jayaraj",
    "d. imman",
    "karthik",
    "haricharan",
    "antony jesudas",
    "deepthi suresh",
    "shakthisree gopalan",
    "saNa",
    "a.r. rahman",
    "andrea jeremiah",
    "sunita sarathy",
    "shashaa tirupati",
  ],
  primaryLanguage: "tamil",
};

const TAMIL_CLASSIC: EcosystemCluster = {
  clusterId: "tamil_classic",
  clusterName: "Tamil Classic / Golden Era",
  primaryArtists: [
    "ilaiyaraaja",
    "ilayaraja",
    "a.r. rahman",
    "s. p. balasubrahmanyam",
    "spb",
    "ks chithra",
    "k. s. chithra",
    "s. janaki",
  ],
  peerEcosystem: [
    "harris jayaraj",
    "yuvan shankar raja",
    "mano",
    "unni menon",
    "hariharan",
    "sujatha",
    "chitra",
    "vijay yesudas",
    "madhushree",
  ],
  primaryLanguage: "tamil",
};

// ── HINDI ECOSYSTEMS ─────────────────────────────────────────────

const HINDI_INDIE_SOFT: EcosystemCluster = {
  clusterId: "hindi_indie_soft",
  clusterName: "Hindi Indie / Soft Pop",
  primaryArtists: [
    "anuv jain",
    "prateek kuhad",
    "ritviz",
    "the local train",
    "when chai met toast",
    "shashwat sachdev",
    "armaan malik",
    "shreya ghoshal",
    "darshan raval",
    "jubin nautiyal",
    "sachet tandon",
    "parampara tandon",
  ],
  peerEcosystem: [
    "arijit singh",
    "mithoon",
    "kk",
    "mohit chauhan",
    "javed ali",
    "sunidhi chauhan",
    "sonu nigam",
    "siddharth mahadevan",
    "shankar mahadevan",
    "amit trivedi",
    "sachin-jigar",
    "anurag tiwari",
  ],
  primaryLanguage: "hindi",
};

const HINDI_ROMANTIC_CINEMATIC: EcosystemCluster = {
  clusterId: "hindi_romantic_cinematic",
  clusterName: "Bollywood Romantic / Cinematic",
  primaryArtists: [
    "arijit singh",
    "pritam",
    "mithoon",
    "vishal-shekhar",
    "sachin-jigar",
    "amit trivedi",
    "atif aslam",
  ],
  peerEcosystem: [
    "shreya ghoshal",
    "sunidhi chauhan",
    "sonu nigam",
    "kk",
    "shankar ehsaan loy",
    "shekhar ravjiani",
    "rahat fateh ali khan",
    "jubin nautiyal",
    "darshan raval",
    "armaan malik",
    "mohit chauhan",
    "hariharan",
  ],
  primaryLanguage: "hindi",
};

// ── ENGLISH ECOSYSTEMS ────────────────────────────────────────────

const MODERN_ENGLISH_POP: EcosystemCluster = {
  clusterId: "modern_english_pop",
  clusterName: "Modern English Pop",
  primaryArtists: [
    "taylor swift",
    "olivia rodrigo",
    "gracie abrams",
    "sabrina carpenter",
    "conan gray",
    "billie eilish",
    "chappell roan",
  ],
  peerEcosystem: [
    "lorde",
    "phoebe bridgers",
    "clairo",
    "girl in red",
    "maisie peters",
    "tate mcrae",
    "dua lipa",
    "carly rae jepsen",
    "haim",
    "renee rapp",
    "fletcher",
  ],
  primaryLanguage: "english",
};

const MALE_ACOUSTIC_POP: EcosystemCluster = {
  clusterId: "male_acoustic_pop",
  clusterName: "Male Acoustic / Soft Pop",
  primaryArtists: [
    "ed sheeran",
    "shawn mendes",
    "charlie puth",
    "james arthur",
    "lewis capaldi",
    "niall horan",
  ],
  peerEcosystem: [
    "bruno mars",
    "maroon 5",
    "onerepublic",
    "coldplay",
    "the fray",
    "john mayer",
    "alec benjamin",
    "adam melchor",
    "gnash",
    "ben&ben",
  ],
  primaryLanguage: "english",
};

const RNB_SYNTH_POP: EcosystemCluster = {
  clusterId: "rnb_synth_pop",
  clusterName: "R&B / Synth Pop",
  primaryArtists: [
    "the weeknd",
    "post malone",
    "frank ocean",
    "sza",
    "khalid",
    "giveon",
  ],
  peerEcosystem: [
    "daniel caesar",
    "brent faiyaz",
    "steve lacy",
    "partynextdoor",
    "6lack",
    "gallant",
    "cautious clay",
    "bryson tiller",
  ],
  primaryLanguage: "english",
};

// ── PUNJABI ECOSYSTEM ────────────────────────────────────────────

const PUNJABI_POP_HIPHOP: EcosystemCluster = {
  clusterId: "punjabi_pop_hiphop",
  clusterName: "Punjabi Pop / Hip-Hop",
  primaryArtists: [
    "diljit dosanjh",
    "karan aujla",
    "sidhu moose wala",
    "ap dhillon",
    "b praak",
    "shubh",
  ],
  peerEcosystem: [
    "guru randhawa",
    "ammy virk",
    "harrdy sandhu",
    "honey singh",
    "jass manak",
    "mankirt aulakh",
    "pav dharia",
    "maninder buttar",
    "satinder sartaaj",
  ],
  primaryLanguage: "punjabi",
};

// ── MALAYALAM ECOSYSTEM ──────────────────────────────────────────

const MALAYALAM_CINEMATIC: EcosystemCluster = {
  clusterId: "malayalam_cinematic",
  clusterName: "Malayalam Cinematic / Indie",
  primaryArtists: [
    "sushin shyam",
    "jakes bejoy",
    "gopi sundar",
    "hesham abdul wahab",
    "vineeth sreenivasan",
    "vishal dadlani",
  ],
  peerEcosystem: [
    "deepak dev",
    "m. jayachandran",
    "ouseppachan",
    "bijibal",
    "shaan rahman",
    "prashant pillai",
    "alphons joseph",
    "sujatha",
  ],
  primaryLanguage: "malayalam",
};

// ── TELUGU ECOSYSTEM ─────────────────────────────────────────────

const TELUGU_CINEMATIC: EcosystemCluster = {
  clusterId: "telugu_cinematic",
  clusterName: "Telugu Cinematic",
  primaryArtists: [
    "devi sri prasad",
    "s. thaman",
    "m.m. keeravani",
    "anirudh ravichander",
    "hesham abdul wahab",
  ],
  peerEcosystem: [
    "a.r. rahman",
    "mickey j meyer",
    "anup rubens",
    "a. r. rahman",
    "gopi sundar",
    "vijay yesudas",
    "sid sriram",
  ],
  primaryLanguage: "telugu",
};

// ════════════════════════════════════════════════════════════════
// MASTER ECOSYSTEM REGISTRY
// Ordered so more specific clusters are checked first.
// ════════════════════════════════════════════════════════════════
export const KNOWN_ECOSYSTEMS: EcosystemCluster[] = [
  // Tamil — specific first
  TAMIL_CONTEMPORARY,
  TAMIL_CLASSIC,
  // Hindi — specific first
  HINDI_INDIE_SOFT,
  HINDI_ROMANTIC_CINEMATIC,
  // English
  MODERN_ENGLISH_POP,
  MALE_ACOUSTIC_POP,
  RNB_SYNTH_POP,
  // Regional Indian
  PUNJABI_POP_HIPHOP,
  MALAYALAM_CINEMATIC,
  TELUGU_CINEMATIC,
];

/**
 * Detect active ecosystem cluster for a given artist name and language.
 * Returns the MOST SPECIFIC match — if an artist is in multiple clusters,
 * the first (more specific) one wins.
 */
export function detectActiveEcosystemCluster(
  artistName: string,
  lang: string = "english",
): EcosystemCluster | null {
  const cleanArtist = artistName.trim().toLowerCase();
  if (!cleanArtist) return null;

  // Exact membership check — specific cluster wins
  for (const eco of KNOWN_ECOSYSTEMS) {
    if (
      eco.primaryArtists.includes(cleanArtist) ||
      eco.peerEcosystem.includes(cleanArtist)
    ) {
      return eco;
    }
  }

  // Partial match fallback (e.g. "anirudh" matches "anirudh ravichander")
  for (const eco of KNOWN_ECOSYSTEMS) {
    const allArtists = [...eco.primaryArtists, ...eco.peerEcosystem];
    for (const a of allArtists) {
      if (a.includes(cleanArtist) || cleanArtist.includes(a)) {
        return eco;
      }
    }
  }

  return null;
}

/**
 * Return all ecosystem artists allowed for the given primary artist.
 * Used by Up Next to fetch candidates without language cold-starts.
 */
export function getEcosystemArtists(artistName: string): Set<string> {
  const cleanArtist = artistName.trim().toLowerCase();
  const ecosystemSet = new Set<string>([cleanArtist]);

  for (const eco of KNOWN_ECOSYSTEMS) {
    if (
      eco.primaryArtists.includes(cleanArtist) ||
      eco.peerEcosystem.includes(cleanArtist)
    ) {
      eco.primaryArtists.forEach((a) => ecosystemSet.add(a));
      eco.peerEcosystem.forEach((a) => ecosystemSet.add(a));
      break;
    }
  }

  // Partial match if exact didn't find a cluster
  if (ecosystemSet.size === 1) {
    for (const eco of KNOWN_ECOSYSTEMS) {
      const allArtists = [...eco.primaryArtists, ...eco.peerEcosystem];
      for (const a of allArtists) {
        if (a.includes(cleanArtist) || cleanArtist.includes(a)) {
          eco.primaryArtists.forEach((x) => ecosystemSet.add(x));
          eco.peerEcosystem.forEach((x) => ecosystemSet.add(x));
          break;
        }
      }
    }
  }

  // Check CURATED_ARTIST_MAP for dynamic graph peers
  const curated = CURATED_ARTIST_MAP[cleanArtist] || [];
  curated.forEach((c) => ecosystemSet.add(c));

  return ecosystemSet;
}

/**
 * Check if two artists are in the same ecosystem.
 * Used by Up Next to score transition relevance.
 */
export function areArtistsInSameEcosystem(
  artistA: string,
  artistB: string,
): boolean {
  const a = artistA.trim().toLowerCase();
  const b = artistB.trim().toLowerCase();
  if (a === b || a.includes(b) || b.includes(a)) return true;

  for (const eco of KNOWN_ECOSYSTEMS) {
    const all = [...eco.primaryArtists, ...eco.peerEcosystem];
    if (all.includes(a) && all.includes(b)) return true;
  }

  const curatedA = CURATED_ARTIST_MAP[a] || [];
  if (curatedA.includes(b)) return true;
  const curatedB = CURATED_ARTIST_MAP[b] || [];
  if (curatedB.includes(a)) return true;

  return false;
}
