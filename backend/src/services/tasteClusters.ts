// ════════════════════════════════════════════════════════════════
// TASTE CLUSTERS & ARTIST ECOSYSTEMS — Step 4 & Step 5
// Groups user preferences into strict artist ecosystems & clusters
// ════════════════════════════════════════════════════════════════

export interface EcosystemCluster {
  clusterId: string;
  clusterName: string;
  primaryArtists: string[];
  peerEcosystem: string[];
  primaryLanguage: string;
}

export const KNOWN_ECOSYSTEMS: EcosystemCluster[] = [
  {
    clusterId: "modern_english_pop",
    clusterName: "Modern English Pop",
    primaryArtists: ["taylor swift", "olivia rodrigo", "gracie abrams", "sabrina carpenter", "conan gray", "billie eilish"],
    peerEcosystem: ["lorde", "phoebe bridgers", "clairo", "girl in red", "maisie peters", "tate mcrae", "dua lipa"],
    primaryLanguage: "english",
  },
  {
    clusterId: "male_acoustic_pop",
    clusterName: "Male Acoustic Pop",
    primaryArtists: ["ed sheeran", "shawn mendes", "charlie puth", "james arthur", "lewis capaldi"],
    peerEcosystem: ["bruno mars", "maroon 5", "onerepublic", "coldplay", "the fray", "john mayer", "alec benjamin"],
    primaryLanguage: "english",
  },
  {
    clusterId: "rnb_synth_pop",
    clusterName: "R&B / Synth Pop",
    primaryArtists: ["the weeknd", "post malone", "drake", "frank ocean", "sza", "khalid"],
    peerEcosystem: ["travis scott", "21 savage", "giveon", "daniel caesar", "brent faiyaz"],
    primaryLanguage: "english",
  },
  {
    clusterId: "hindi_romantic",
    clusterName: "Bollywood / Hindi Romantic",
    primaryArtists: ["arijit singh", "pritam", "mithoon", "sachin-jigar", "shreya ghoshal", "jubin nautiyal"],
    peerEcosystem: ["vishal-shekhar", "amit trivedi", "atif aslam", "anuv jain", "sonu nigam", "sunidhi chauhan", "kk"],
    primaryLanguage: "hindi",
  },
  {
    clusterId: "tamil_soundtrack",
    clusterName: "Tamil Contemporary",
    primaryArtists: ["anirudh ravichander", "a.r. rahman", "yuvan shankar raja", "g.v. prakash", "sid sriram"],
    peerEcosystem: ["harris jayaraj", "santhosh narayanan", "hiphop tamizha", "d. imman", "sai abhyankkar"],
    primaryLanguage: "tamil",
  },
  {
    clusterId: "punjabi_pop_hiphop",
    clusterName: "Punjabi Pop / Hip-Hop",
    primaryArtists: ["diljit dosanjh", "karan aujla", "sidhu moose wala", "ap dhillon", "b praak"],
    peerEcosystem: ["guru randhawa", "ammy virk", "harrdy sandhu", "honey singh", "jass manak"],
    primaryLanguage: "punjabi",
  },
];

/**
 * Detect active cluster based on active seed song artist or session context
 */
export function detectActiveEcosystemCluster(artistName: string, lang: string = "english"): EcosystemCluster | null {
  const cleanArtist = artistName.trim().toLowerCase();
  if (!cleanArtist) return null;

  for (const eco of KNOWN_ECOSYSTEMS) {
    if (eco.primaryArtists.includes(cleanArtist) || eco.peerEcosystem.includes(cleanArtist)) {
      return eco;
    }
  }

  // Fallback cluster matching primary language
  for (const eco of KNOWN_ECOSYSTEMS) {
    if (eco.primaryLanguage === lang.toLowerCase()) {
      return eco;
    }
  }

  return null;
}

/**
 * Get allowed ecosystem artists for a given primary artist
 */
export function getEcosystemArtists(artistName: string): Set<string> {
  const cleanArtist = artistName.trim().toLowerCase();
  const ecosystemSet = new Set<string>([cleanArtist]);

  for (const eco of KNOWN_ECOSYSTEMS) {
    if (eco.primaryArtists.includes(cleanArtist) || eco.peerEcosystem.includes(cleanArtist)) {
      eco.primaryArtists.forEach((a) => ecosystemSet.add(a));
      eco.peerEcosystem.forEach((a) => ecosystemSet.add(a));
      break;
    }
  }

  return ecosystemSet;
}
