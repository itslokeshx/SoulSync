import { ListeningHistory } from "../models/ListeningHistory.js";
import { User, IUser } from "../models/User.js";
import { searchSongs, JioSaavnSong } from "./jiosaavn.js";
import { redisGet, redisSet } from "./redis.js";
import mongoose from "mongoose";

// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface DashboardSection {
  id: string;
  title: string;
  subtitle?: string;
  type:
  | "quick_grid"
  | "horizontal"
  | "artist_spotlight"
  | "mood_grid"
  | "continue";
  songs: JioSaavnSong[];
  meta?: Record<string, any>;
}

export interface DashboardResponse {
  greeting: string;
  subtitle: string;
  sections: DashboardSection[];
  generatedAt: number;
}

// ─── TIME-AWARE GREETING ─────────────────────────────────────────────────────
function getGreeting(name: string): {
  greeting: string;
  subtitle: string;
  timeMood: string;
} {
  const hr = new Date().getHours();
  let greeting: string, subtitle: string, timeMood: string;

  if (hr >= 5 && hr < 12) {
    greeting = `Good morning, ${name}`;
    subtitle = "Start your day with great music";
    timeMood = "morning";
  } else if (hr >= 12 && hr < 17) {
    greeting = `Good afternoon, ${name}`;
    subtitle = "Perfect tunes for the afternoon";
    timeMood = "afternoon";
  } else if (hr >= 17 && hr < 21) {
    greeting = `Good evening, ${name}`;
    subtitle = "Wind down with your favourites";
    timeMood = "evening";
  } else {
    greeting = `Good night, ${name}`;
    subtitle = "Late night vibes, just for you";
    timeMood = "night";
  }

  return { greeting, subtitle, timeMood };
}

// ─── LANGUAGE-AWARE MOOD QUERIES ─────────────────────────────────────────────
const MOOD_QUERY_TEMPLATES: Record<string, string[]> = {
  morning: [
    "morning vibes {lang} hits",
    "feel good {lang} hits {year}",
    "upbeat {lang} hits {year}",
    "happy {lang} songs {year}",
  ],
  afternoon: [
    "best {lang} songs {year}",
    "popular {lang} hits {year}",
    "top {lang} songs {year}",
    "trending {lang} songs",
  ],
  evening: [
    "romantic {lang} hits",
    "soothing {lang} melodies {year}",
    "evening {lang} hits",
    "melodious {lang} hits",
  ],
  night: [
    "late night {lang} hits",
    "midnight {lang} songs",
    "chill {lang} hits {year}",
    "relaxing {lang} hits",
  ],
};

function buildTimeMoodQuery(timeMood: string, languages: string[]): string {
  const templates =
    MOOD_QUERY_TEMPLATES[timeMood] || MOOD_QUERY_TEMPLATES.afternoon;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const lang =
    languages.length > 0
      ? languages[Math.floor(Math.random() * languages.length)]
      : "hindi";
  return template
    .replace("{lang}", lang)
    .replace("{year}", String(new Date().getFullYear()));
}

const MOOD_GRID_QUERIES: Record<string, string> = {
  "😊 Happy Vibes": "happy upbeat songs",
  "💔 Heartbreak": "sad heartbreak songs",
  "🎉 Party Mode": "party dance songs",
  "🧘 Chill & Relax": "chill relax songs",
  "💪 Workout": "workout pump songs",
  "🌧️ Rainy Day": "rain romantic songs",
};

// ─── FILTER SONGS BY LANGUAGE ────────────────────────────────────────────────
function filterByLanguage(
  songs: JioSaavnSong[],
  languages: string[],
): JioSaavnSong[] {
  if (!languages.length) return songs;
  const langSet = new Set(languages.map((l) => l.toLowerCase()));
  const filtered = songs.filter((s) => {
    const songLang = (s.language || "").toLowerCase();
    return !songLang || langSet.has(songLang);
  });
  // If filtering removes too many results, return what we have
  return filtered.length >= 3 ? filtered : songs;
}

// ─── USER PROFILE BUILDER ────────────────────────────────────────────────────
interface UserProfile {
  topArtists: { name: string; count: number; albumArt: string }[];
  topLanguages: string[];
  recentSongIds: string[];
  recentTitles: string[];
  hasHistory: boolean;
  preferences: { languages: string[]; eras: string[]; moods: string[] };
}

async function buildUserProfile(userId: string): Promise<UserProfile> {
  const userObjId = new mongoose.Types.ObjectId(userId);

  const [topArtistsAgg, recentHistory, user] = await Promise.all([
    ListeningHistory.aggregate([
      { $match: { userId: userObjId } },
      {
        $group: {
          _id: "$artist",
          count: { $sum: 1 },
          albumArt: { $first: "$albumArt" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    ListeningHistory.find({ userId: userObjId })
      .sort({ playedAt: -1 })
      .limit(30)
      .lean(),
    User.findById(userId).select("preferences").lean(),
  ]);

  const topArtists = topArtistsAgg.map((a: any) => ({
    name: a._id || "Unknown",
    count: a.count,
    albumArt: a.albumArt || "",
  }));

  // Derive top languages from history artist names (best effort)
  const langCount: Record<string, number> = {};
  for (const h of recentHistory) {
    // We don't have language on history, but we can infer from preferences
  }
  const topLanguages = (user as any)?.preferences?.languages?.length
    ? (user as any).preferences.languages
    : ["english"];

  return {
    topArtists,
    topLanguages: topLanguages.map((l: string) => l.toLowerCase()),
    recentSongIds: recentHistory.map((h) => h.songId),
    recentTitles: recentHistory.map((h) => h.title),
    hasHistory: recentHistory.length > 0,
    preferences: (user as any)?.preferences || {
      languages: [],
      eras: [],
      moods: [],
    },
  };
}

// ─── SECTION BUILDERS ────────────────────────────────────────────────────────

async function buildQuickGrid(
  profile: UserProfile,
): Promise<DashboardSection | null> {
  if (!profile.hasHistory) return null;

  // Get 6 most recently played (unique by songId)
  const seen = new Set<string>();
  const recent = await ListeningHistory.find({ userId: { $exists: true } })
    .sort({ playedAt: -1 })
    .limit(50)
    .lean();

  // We need user-specific, but this is called with profile, so use recentSongIds
  // Actually just return IDs — the frontend already has recently played
  return null; // Frontend handles this from its own history cache
}

async function buildContinueListening(
  userId: string,
): Promise<DashboardSection | null> {
  const userObjId = new mongoose.Types.ObjectId(userId);
  const recent = await ListeningHistory.find({ userId: userObjId })
    .sort({ playedAt: -1 })
    .limit(20)
    .lean();

  if (recent.length === 0) return null;

  // Deduplicate by songId, keep most recent
  const seen = new Set<string>();
  const uniqueRecent: any[] = [];
  for (const h of recent) {
    if (!seen.has(h.songId)) {
      seen.add(h.songId);
      uniqueRecent.push(h);
    }
  }

  // Convert history items to song-like objects
  const songs: JioSaavnSong[] = uniqueRecent.slice(0, 10).map((h) => ({
    id: h.songId,
    name: h.title,
    type: "song",
    year: "",
    duration: h.duration || 0,
    language: "",
    image: [{ quality: "500x500", url: h.albumArt }],
    downloadUrl: [],
    artists: {
      primary: [{ id: "", name: h.artist, image: [] }],
      featured: [],
      all: [],
    },
    album: { id: "", name: "", url: "" },
    url: "",
    hasLyrics: false,
    label: "",
  }));

  return {
    id: "continue_listening",
    title: "Continue Listening",
    subtitle: "Pick up where you left off",
    type: "continue",
    songs,
  };
}

async function buildArtistSpotlight(
  profile: UserProfile,
): Promise<DashboardSection | null> {
  if (profile.topArtists.length === 0) return null;

  // Pick a random top artist (from top 5)
  const pool = profile.topArtists.slice(0, 5);
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const result = await searchSongs(`${chosen.name} hits`, 15);
  if (result.length === 0) return null;

  const filtered = filterByLanguage(result, profile.topLanguages);

  return {
    id: `artist_spotlight_${chosen.name.replace(/\s+/g, "_").toLowerCase()}`,
    title: `${chosen.name} Spotlight`,
    subtitle: `Because you listen to ${chosen.name}`,
    type: "artist_spotlight",
    songs: filtered.slice(0, 10),
    meta: { artistName: chosen.name, artistImage: chosen.albumArt },
  };
}

async function buildLanguageSection(
  language: string,
  allLanguages: string[],
): Promise<DashboardSection | null> {
  const queries: Record<string, string[]> = {
    hindi: ["best hindi songs", "top bollywood songs", "popular hindi hits"],
    tamil: ["best tamil songs", "top tamil hits", "popular tamil songs"],
    telugu: ["best telugu songs", "top telugu hits", "popular telugu songs"],
    english: [
      "Ed Sheeran best songs",
      "The Weeknd top hits",
      "top english pop hits 2026",
      "best english songs 2026",
    ],
    punjabi: [
      "best punjabi songs",
      "top punjabi hits",
      "popular punjabi songs",
    ],
    kannada: [
      "best kannada songs",
      "top kannada hits",
      "popular kannada songs",
    ],
    malayalam: [
      "best malayalam songs",
      "top malayalam hits",
      "popular malayalam songs",
    ],
    bengali: [
      "best bengali songs",
      "top bengali hits",
      "popular bengali songs",
    ],
    marathi: [
      "best marathi songs",
      "top marathi hits",
      "popular marathi songs",
    ],
  };

  const langQueries = queries[language] || [`best ${language} songs`];
  const q = langQueries[Math.floor(Math.random() * langQueries.length)];
  const result = await searchSongs(q, 20);
  if (result.length === 0) return null;

  const filtered = filterByLanguage(result, [language]);
  if (filtered.length === 0) return null;

  const displayLang = language.charAt(0).toUpperCase() + language.slice(1);
  return {
    id: `lang_${language}`,
    title: `Top ${displayLang}`,
    subtitle: `Best in ${displayLang}`,
    type: "horizontal",
    songs: filtered.slice(0, 15),
  };
}

async function buildTimeMoodSection(
  timeMood: string,
  languages: string[],
): Promise<DashboardSection | null> {
  const q = buildTimeMoodQuery(timeMood, languages);

  const result = await searchSongs(q, 18);
  if (result.length === 0) return null;

  const filtered = filterByLanguage(result, languages);

  const titles: Record<string, string> = {
    morning: "Morning Picks",
    afternoon: "Afternoon Energy",
    evening: "Evening Melodies",
    night: "Late Night Vibes",
  };

  return {
    id: `time_mood_${timeMood}`,
    title: titles[timeMood] || "For You",
    subtitle: `Perfect for right now`,
    type: "horizontal",
    songs: filtered.slice(0, 12),
  };
}

async function buildBecauseYouListened(
  profile: UserProfile,
): Promise<DashboardSection | null> {
  if (profile.topArtists.length < 2) return null;

  // Pick the 2nd or 3rd top artist
  const idx = Math.min(
    1 + Math.floor(Math.random() * 2),
    profile.topArtists.length - 1,
  );
  const artist = profile.topArtists[idx];

  const result = await searchSongs(`${artist.name} best songs`, 15);
  if (result.length === 0) return null;

  const filtered = filterByLanguage(result, profile.topLanguages);

  return {
    id: `because_${artist.name.replace(/\s+/g, "_").toLowerCase()}`,
    title: `Because You Listened to ${artist.name}`,
    subtitle: "More from artists you love",
    type: "horizontal",
    songs: filtered.slice(0, 10),
  };
}

async function buildTrending(
  languages: string[],
): Promise<DashboardSection | null> {
  // Build a language-specific trending query
  const lang =
    languages.length > 0
      ? languages[Math.floor(Math.random() * languages.length)]
      : "english";
  const trendingQueries: Record<string, string> = {
    tamil: "trending tamil hits 2026",
    english: "trending english hits 2026",
    hindi: "trending bollywood hits 2026",
    telugu: "trending telugu hits 2026",
    punjabi: "trending punjabi hits 2026",
    kannada: "trending kannada hits 2026",
    malayalam: "trending malayalam hits 2026",
  };
  const result = await searchSongs(
    trendingQueries[lang] || `trending ${lang} hits 2026`,
    20,
  );
  if (result.length === 0) return null;

  const filtered = filterByLanguage(result, languages);

  return {
    id: "trending",
    title: "Trending Now",
    subtitle: "What everyone's listening to",
    type: "horizontal",
    songs: filtered.slice(0, 15),
  };
}

async function buildMoodGrid(): Promise<DashboardSection | null> {
  // For mood grid, we just send labels — frontend renders clickable tiles
  // Fetch one sample per mood for preview
  const moods = Object.keys(MOOD_GRID_QUERIES);
  return {
    id: "mood_grid",
    title: "Browse by Mood",
    subtitle: "What's your vibe?",
    type: "mood_grid",
    songs: [],
    meta: { moods },
  };
}

async function buildNewReleases(
  languages: string[],
): Promise<DashboardSection | null> {
  const lang = languages[0] || "english";
  const result = await searchSongs(
    `new ${lang} songs ${new Date().getFullYear()}`,
    18,
  );
  if (result.length === 0) return null;

  const filtered = filterByLanguage(result, languages);

  return {
    id: "new_releases",
    title: "New Releases",
    subtitle: "Fresh tracks just dropped",
    type: "horizontal",
    songs: filtered.slice(0, 12),
  };
}

// ─── MAIN DASHBOARD BUILDER ─────────────────────────────────────────────────
export async function buildDashboard(
  userId: string,
  userName: string,
): Promise<DashboardResponse> {
  const isGuest = userId === "guest";

  // Check cache
  const cacheKey = `dashboard:${userId}`;
  const cached = await redisGet(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Cache for 30 minutes
      if (Date.now() - parsed.generatedAt < 30 * 60 * 1000) return parsed;
    } catch {
      /* ignore */
    }
  }

  const { greeting, subtitle, timeMood } = getGreeting(userName);
  const sections: DashboardSection[] = [];

  // ── GUEST PATH ──
  if (isGuest) {
    const defaultLangs = ["tamil", "english", "telugu"];
    const [fallback1, fallback2, fallback3, timeSec] = await Promise.all([
      searchSongs("best tamil songs", 15).catch(() => []),
      searchSongs("best telugu songs", 15).catch(() => []),
      searchSongs("best english songs 2026", 15).catch(() => []),
      buildTimeMoodSection(timeMood, defaultLangs).catch(() => null),
    ]);
    if (timeSec) sections.push(timeSec);
    if (fallback1.length > 0) {
      const filtered = filterByLanguage(fallback1, ["tamil"]);
      sections.push({
        id: "popular_tamil",
        title: "Popular in Tamil",
        subtitle: "Kollywood's finest",
        type: "horizontal",
        songs: filtered.slice(0, 12),
      });
    }
    if (fallback2.length > 0) {
      const filtered = filterByLanguage(fallback2, ["telugu"]);
      sections.push({
        id: "popular_telugu",
        title: "Popular in Telugu",
        subtitle: "Tollywood's best",
        type: "horizontal",
        songs: filtered.slice(0, 12),
      });
    }
    if (fallback3.length > 0) {
      const filtered = filterByLanguage(fallback3, ["english"]);
      sections.push({
        id: "popular_english",
        title: "Popular in English",
        subtitle: "Global chart-toppers",
        type: "horizontal",
        songs: filtered.slice(0, 12),
      });
    }
    const moodGrid = await buildMoodGrid();
    if (moodGrid) sections.push(moodGrid);

    // Deduplicate songs across guest sections
    const guestSeen = new Set<string>();
    for (const section of sections) {
      if (section.type === "mood_grid") continue;
      section.songs = section.songs.filter((song: any) => {
        const id = (song.id || song.songId || "").toString().toLowerCase();
        if (!id || guestSeen.has(id)) return false;
        guestSeen.add(id);
        return true;
      });
    }

    const response: DashboardResponse = {
      greeting,
      subtitle,
      sections: sections.filter(
        (s) => s.type === "mood_grid" || s.songs.length > 0,
      ),
      generatedAt: Date.now(),
    };
    await redisSet(cacheKey, JSON.stringify(response), 1800);
    return response;
  }

  // ── AUTHENTICATED PATH ──
  const profile = await buildUserProfile(userId);
  const userLangs = profile.topLanguages;

  // Build sections in parallel where possible — but throttledGet limits us
  // So we build in small batches with sequential waits

  // Batch 1: User-specific
  const [continueListening, artistSpotlight] = await Promise.all([
    buildContinueListening(userId).catch(() => null),
    buildArtistSpotlight(profile).catch(() => null),
  ]);

  if (continueListening) sections.push(continueListening);

  // Batch 2: Time + language
  const [timeMoodSection, lang1Section] = await Promise.all([
    buildTimeMoodSection(timeMood, userLangs).catch(() => null),
    userLangs[0]
      ? buildLanguageSection(userLangs[0], userLangs).catch(() => null)
      : null,
  ]);

  if (timeMoodSection) sections.push(timeMoodSection);

  if (artistSpotlight) sections.push(artistSpotlight);

  if (lang1Section) sections.push(lang1Section);

  // Batch 3: More sections
  const [becauseSection, trendingSection] = await Promise.all([
    buildBecauseYouListened(profile).catch(() => null),
    buildTrending(userLangs).catch(() => null),
  ]);

  if (becauseSection) sections.push(becauseSection);

  // Batch 4: Remaining
  const [newReleases, lang2Section] = await Promise.all([
    buildNewReleases(userLangs).catch(() => null),
    userLangs[1]
      ? buildLanguageSection(userLangs[1], userLangs).catch(() => null)
      : null,
  ]);

  if (newReleases) sections.push(newReleases);

  if (trendingSection) sections.push(trendingSection);

  if (lang2Section) sections.push(lang2Section);

  // Mood grid (no API call needed)
  const moodGrid = await buildMoodGrid();
  if (moodGrid) sections.push(moodGrid);

  // If user has NO history, give them a curated new-user experience
  if (!profile.hasHistory && sections.length < 3) {
    // Build sections based on user's preferred languages
    const fallbackLangs =
      userLangs.length > 0 ? userLangs.slice(0, 3) : ["tamil", "english"];

    const fallbackResults = await Promise.all(
      fallbackLangs.map((lang) =>
        searchSongs(`best ${lang} songs`, 15).catch(() => []),
      ),
    );

    for (let i = 0; i < fallbackLangs.length; i++) {
      const lang = fallbackLangs[i];
      const res = fallbackResults[i];
      if (res.length > 0) {
        const filtered = filterByLanguage(res, [lang]);
        const displayLang = lang.charAt(0).toUpperCase() + lang.slice(1);
        sections.push({
          id: `popular_${lang}`,
          title: `Popular in ${displayLang}`,
          subtitle: `Top ${displayLang} tracks`,
          type: "horizontal",
          songs: filtered.slice(0, 12),
        });
      }
    }
  }

  // ── Deduplicate songs across sections ──
  // Track seen song IDs and remove duplicates, keeping the first occurrence
  const seenSongIds = new Set<string>();
  for (const section of sections) {
    if (section.type === "mood_grid") continue; // mood_grid has no songs
    section.songs = section.songs.filter((song: any) => {
      const id = (song.id || song.songId || "").toString().toLowerCase();
      if (!id || seenSongIds.has(id)) return false;
      seenSongIds.add(id);
      return true;
    });
  }
  // Remove sections that ended up empty after dedup
  const finalSections = sections.filter(
    (s) => s.type === "mood_grid" || s.songs.length > 0,
  );

  const response: DashboardResponse = {
    greeting,
    subtitle,
    sections: finalSections,
    generatedAt: Date.now(),
  };

  // Cache 30 minutes
  await redisSet(cacheKey, JSON.stringify(response), 1800);

  return response;
}
