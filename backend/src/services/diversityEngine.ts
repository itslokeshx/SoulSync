// ════════════════════════════════════════════════════════════════
// DIVERSITY & DISCOVERY ENGINE — Step 10, Step 11, Step 12
// Strict deduplication, max 1 per album, max 2 per artist, 80/20 discovery
// ════════════════════════════════════════════════════════════════

import { Song } from "./jiosaavn.js";
import { ScoredSong } from "./rankingEngine.js";
import { IUserTasteProfile } from "../models/UserTasteProfile.js";
import { SessionState } from "./sessionEngine.js";

export interface DiversityOptions {
  maxPerArtist?: number;        // Default: 2
  maxPerAlbum?: number;         // Default: 1 (Strictly prevent album monopolization!)
  targetCount?: number;         // Default: 24
  discoveryRatio?: number;      // Default: 0.20 (20% discovery)
}

function cleanSongNameForDeduplication(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/\s*\((?:super\s+)?slowed(?:\s+down)?(?:\s+version)?\)/i, "")
    .replace(/\s*\((?:super\s+)?sped\s+up(?:\s+version)?\)/i, "")
    .replace(/\s*\(remastered(?: \d+)?\)/i, "")
    .replace(/\s*\(live(?: version)?\)/i, "")
    .replace(/\s*\(lofi\)/i, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Apply Diversity Capping, Freshness Penalties, and Controlled Discovery Injection.
 * STRICTLY ENFORCED: Max 1 per album, Max 2 per artist, 0 duplicate names.
 */
export function applyDiversityAndDiscovery(
  scoredCandidates: ScoredSong[],
  tasteProfile: IUserTasteProfile | null,
  sessionState: SessionState | null,
  options: DiversityOptions = {},
): Song[] {
  const maxPerArtist = options.maxPerArtist ?? 2;
  const maxPerAlbum = options.maxPerAlbum ?? 1; // Strict 1 track per album default!
  const targetCount = options.targetCount ?? 24;
  const discoveryRatio = options.discoveryRatio ?? 0.20;

  const discoveryQuota = Math.round(targetCount * discoveryRatio);
  const mainQuota = targetCount - discoveryQuota;

  const artistCount = new Map<string, number>();
  const albumCount = new Map<string, number>();
  const seenSongNames = new Set<string>();

  const mainSelection: Song[] = [];
  const discoveryCandidates: Song[] = [];

  const userTopArtists = new Set(
    (tasteProfile?.artists || []).slice(0, 15).map((a) => a.artistName.toLowerCase())
  );

  for (const song of scoredCandidates) {
    const cleanName = cleanSongNameForDeduplication(song.name);
    if (cleanName && seenSongNames.has(cleanName)) continue;

    const primaryArtist = (song.primaryArtists || "").split(/[,/&]+/)[0].trim().toLowerCase();
    const albumName = (song.album || "").trim().toLowerCase();

    // Check artist cap
    const currArtCount = artistCount.get(primaryArtist) || 0;
    if (currArtCount >= maxPerArtist) continue;

    // Check album cap
    if (albumName) {
      const currAlbCount = albumCount.get(albumName) || 0;
      if (currAlbCount >= maxPerAlbum) continue;
    }

    const isDiscovery = primaryArtist && !userTopArtists.has(primaryArtist);

    if (isDiscovery) {
      discoveryCandidates.push(song);
    } else {
      if (mainSelection.length < mainQuota) {
        artistCount.set(primaryArtist, currArtCount + 1);
        if (albumName) albumCount.set(albumName, (albumCount.get(albumName) || 0) + 1);
        if (cleanName) seenSongNames.add(cleanName);
        mainSelection.push(song);
      }
    }
  }

  // Inject Discovery Candidates (strictly respecting artist, album, & deduplication limits)
  const finalSelection: Song[] = [...mainSelection];

  for (const discSong of discoveryCandidates) {
    if (finalSelection.length >= targetCount) break;

    const cleanName = cleanSongNameForDeduplication(discSong.name);
    if (cleanName && seenSongNames.has(cleanName)) continue;

    const primaryArtist = (discSong.primaryArtists || "").split(/[,/&]+/)[0].trim().toLowerCase();
    const albumName = (discSong.album || "").trim().toLowerCase();

    const currArtCount = artistCount.get(primaryArtist) || 0;
    if (currArtCount >= maxPerArtist) continue;

    if (albumName) {
      const currAlbCount = albumCount.get(albumName) || 0;
      if (currAlbCount >= maxPerAlbum) continue;
    }

    artistCount.set(primaryArtist, currArtCount + 1);
    if (albumName) albumCount.set(albumName, (albumCount.get(albumName) || 0) + 1);
    if (cleanName) seenSongNames.add(cleanName);
    (discSong as any).reason = "Discovered for your taste";
    finalSelection.push(discSong);
  }

  // Safety fill-up (STRICTLY respecting deduplication, artist caps, and album caps!)
  if (finalSelection.length < targetCount) {
    for (const song of scoredCandidates) {
      if (finalSelection.length >= targetCount) break;

      const cleanName = cleanSongNameForDeduplication(song.name);
      if (cleanName && seenSongNames.has(cleanName)) continue;

      const primaryArtist = (song.primaryArtists || "").split(/[,/&]+/)[0].trim().toLowerCase();
      const albumName = (song.album || "").trim().toLowerCase();

      const currArtCount = artistCount.get(primaryArtist) || 0;
      if (currArtCount >= maxPerArtist) continue;

      if (albumName) {
        const currAlbCount = albumCount.get(albumName) || 0;
        if (currAlbCount >= maxPerAlbum) continue;
      }

      artistCount.set(primaryArtist, currArtCount + 1);
      if (albumName) albumCount.set(albumName, (albumCount.get(albumName) || 0) + 1);
      if (cleanName) seenSongNames.add(cleanName);
      finalSelection.push(song);
    }
  }

  return finalSelection.map((s) => {
    const clean = { ...s };
    delete (clean as any)._totalScore;
    delete (clean as any)._scoreBreakdown;
    delete (clean as any)._sources;
    return clean;
  });
}
