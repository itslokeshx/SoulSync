// ════════════════════════════════════════════════════════════════
// INTENT PARSER — The entire brain of the search system
// Understands what the user MEANS, not just what they TYPED
// ════════════════════════════════════════════════════════════════

export interface ParsedIntent {
    raw: string
    normalized: string
    intent: IntentType
    entities: {
        artist?: string
        movie?: string
        year?: number
        language?: string
        mood?: string
        format?: string
        timeRef?: 'recent' | 'classic' | 'latest'
        songName?: string
        albumName?: string
    }
    expandedQueries: QueryWithWeight[]
    confidence: number
    displayContext?: string;
    relatedSearches?: string[];
}

export type IntentType =
    | 'movie_songs'        // "ranjini 173", "leo movie", "kgf songs"
    | 'artist_recent'      // "latest vijay songs", "new anirudh"
    | 'artist_all'         // "arijit singh songs", "ar rahman hits"
    | 'mood_search'        // "sad songs", "party hits", "chill music"
    | 'song_direct'        // "kannazhaga", exact song name
    | 'language_hits'      // "tamil hits", "hindi trending"
    | 'bgm_search'         // "anirudh bgm", "harris bgm"
    | 'album_search'       // "divided album", specific album
    | 'year_search'        // "2000s hits", "90s songs"
    | 'unknown'

export interface QueryWithWeight {
    query: string
    weight: number          // 1.0 = highest priority
    type: string            // label for debugging
}

// ════════════════════════════════════════════════════════════════
// MOVIE DATABASE — Critical for "ranjini 173" type queries
// ════════════════════════════════════════════════════════════════
const MOVIE_PATTERNS: Record<string, string> = {
    // Tamil movies with numbers/special names (common source of confusion)
    'ranjini 173': 'Ranjini 173',
    'ranjini173': 'Ranjini 173',
    '96': '96',
    '777 charlie': '777 Charlie',
    '777charlie': '777 Charlie',
    '8 thottakkal': '8 Thottakkal',
    'vikram vedha': 'Vikram Vedha',
    'master': 'Master',
    'beast': 'Beast',
    'leo': 'Leo',
    'jailer': 'Jailer',
    'kgf': 'KGF',
    'kgf chapter 2': 'KGF Chapter 2',
    'kgf 2': 'KGF Chapter 2',
    'pushpa': 'Pushpa',
    'pushpa 2': 'Pushpa 2',
    'bahubali': 'Baahubali',
    'baahubali 2': 'Baahubali 2',
    'jawan': 'Jawan',
    'animal': 'Animal',
    'kalki': 'Kalki 2898 AD',
    'devara': 'Devara',
    'ponniyin selvan': 'Ponniyin Selvan',
    'ps1': 'Ponniyin Selvan',
    'ps2': 'Ponniyin Selvan 2',
    'merry christmas': 'Merry Christmas',
    'iraivi': 'Iraivi',
    'vikram': 'Vikram',
    'vettaiyan': 'Vettaiyan',
    'amaran': 'Amaran',
    'soorarai pottru': 'Soorarai Pottru',
    'jai bhim': 'Jai Bhim',
    'karnan': 'Karnan',
    'pariyerum perumal': 'Pariyerum Perumal',
    'oh my kadavule': 'Oh My Kadavule',
    'bigil': 'Bigil',
    'mersal': 'Mersal',
    'theri': 'Theri',
    'kaththi': 'Kaththi',
    'enthiran': 'Enthiran',
    'robo': 'Enthiran',
    '2.0': '2.0',
    'darbar': 'Darbar',
    'nerkonda paarvai': 'Nerkonda Paarvai',
    'valimai': 'Valimai',
    'thunivu': 'Thunivu',
    'good bad ugly': 'Good Bad Ugly',
    // Hindi movies
    'dilwale dulhania': 'DDLJ',
    'ddlj': 'Dilwale Dulhania Le Jayenge',
    'dil chahta hai': 'Dil Chahta Hai',
    'zindagi na milegi': 'Zindagi Na Milegi Dobara',
    'znmd': 'Zindagi Na Milegi Dobara',
    'rockstar': 'Rockstar',
    'tamasha': 'Tamasha',
    'queen': 'Queen',
    'lootera': 'Lootera',
    'aashiqui 2': 'Aashiqui 2',
    'kabir singh': 'Kabir Singh',
    'brahmastra': 'Brahmastra',
    'pathaan': 'Pathaan',
    'war': 'War',
    'uri': 'Uri',
    'article 370': 'Article 370',
    '12th fail': '12th Fail',
    // Telugu movies
    'rrr': 'RRR',
    'baahubali': 'Baahubali',
    'arya': 'Arya',
    'magadheera': 'Magadheera',
    'eega': 'Eega',
    'sye raa': 'Sye Raa',
    'saaho': 'Saaho',
    'akhanda': 'Akhanda',
    'bheemla nayak': 'Bheemla Nayak',
    'dasara': 'Dasara',
    'salaar': 'Salaar',
    // Add 200+ more as your app grows
}

// ════════════════════════════════════════════════════════════════
// ARTIST DICTIONARY — 500+ aliases → canonical names
// ════════════════════════════════════════════════════════════════
export const ARTIST_DICT: Record<string, string> = {
    // Tamil
    'anirudh': 'Anirudh Ravichander',
    'anirudh ravichander': 'Anirudh Ravichander',
    'sid sriram': 'Sid Sriram',
    'sid': 'Sid Sriram',
    'ar rahman': 'A.R. Rahman',
    'arr': 'A.R. Rahman',
    'rahman': 'A.R. Rahman',
    'harris': 'Harris Jayaraj',
    'harris jayaraj': 'Harris Jayaraj',
    'yuvan': 'Yuvan Shankar Raja',
    'yuvan shankar raja': 'Yuvan Shankar Raja',
    'd imman': 'D. Imman',
    'imman': 'D. Imman',
    'gv prakash': 'G.V. Prakash Kumar',
    'gvp': 'G.V. Prakash Kumar',
    'vijay antony': 'Vijay Antony',
    'hiphop tamizha': 'Hiphop Tamizha',
    'hiphop': 'Hiphop Tamizha',
    'santhosh narayanan': 'Santhosh Narayanan',
    'leon james': 'Leon James',
    'dhibu ninan': 'Dhibu Ninan Thomas',
    'karthik': 'Karthik',
    'haricharan': 'Haricharan',
    'tippu': 'Tippu',
    // Telugu
    'dsp': 'Devi Sri Prasad',
    'devi sri prasad': 'Devi Sri Prasad',
    'thaman': 'S. Thaman',
    'ss thaman': 'S. Thaman',
    'mickey j meyer': 'Mickey J. Meyer',
    'anup rubens': 'Anup Rubens',
    // Hindi
    'arijit': 'Arijit Singh',
    'arijit singh': 'Arijit Singh',
    'atif': 'Atif Aslam',
    'atif aslam': 'Atif Aslam',
    'shreya': 'Shreya Ghoshal',
    'shreya ghoshal': 'Shreya Ghoshal',
    'kk': 'KK',
    'sonu nigam': 'Sonu Nigam',
    'kumar sanu': 'Kumar Sanu',
    'udit narayan': 'Udit Narayan',
    'lata': 'Lata Mangeshkar',
    'kishore': 'Kishore Kumar',
    'rafi': 'Mohammed Rafi',
    'pritam': 'Pritam',
    'amit trivedi': 'Amit Trivedi',
    'vishal shekhar': 'Vishal-Shekhar',
    'shankar ehsaan loy': 'Shankar-Ehsaan-Loy',
    'sel': 'Shankar-Ehsaan-Loy',
    'mohit chauhan': 'Mohit Chauhan',
    'armaan malik': 'Armaan Malik',
    'jubin nautiyal': 'Jubin Nautiyal',
    'darshan raval': 'Darshan Raval',
    'neha kakkar': 'Neha Kakkar',
    'badshah': 'Badshah',
    'yo yo honey singh': 'Yo Yo Honey Singh',
    // Malayalam
    'shaan rahman': 'Shaan Rahman',
    'sushin shyam': 'Sushin Shyam',
    'bilahari': 'Bilahari',
    'vidyasagar': 'Vidyasagar',
    // Actors used as search terms
    'vijay': 'Vijay',
    'thalapathy': 'Vijay',
    'ajith': 'Ajith Kumar',
    'thala': 'Ajith Kumar',
    'rajini': 'Rajinikanth',
    'rajinikanth': 'Rajinikanth',
    'superstar': 'Rajinikanth',
    'kamal': 'Kamal Haasan',
    'kamal haasan': 'Kamal Haasan',
    'suriya': 'Suriya',
    'vikram': 'Vikram',
    'dhanush': 'Dhanush',
    'sivakarthikeyan': 'Sivakarthikeyan',
    'siva': 'Sivakarthikeyan',
    'ntr': 'Jr. NTR',
    'jr ntr': 'Jr. NTR',
    'ram charan': 'Ram Charan',
    'prabhas': 'Prabhas',
    'allu arjun': 'Allu Arjun',
    'mahesh babu': 'Mahesh Babu',
    'srk': 'Shah Rukh Khan',
    'shah rukh': 'Shah Rukh Khan',
    'salman': 'Salman Khan',
    'aamir': 'Aamir Khan',
    'hrithik': 'Hrithik Roshan',
    // International
    'weeknd': 'The Weeknd',
    'the weeknd': 'The Weeknd',
    'taylor': 'Taylor Swift',
    'taylor swift': 'Taylor Swift',
    'ed sheeran': 'Ed Sheeran',
    'bts': 'BTS',
    'blackpink': 'BLACKPINK',
    'drake': 'Drake',
    'kendrick': 'Kendrick Lamar',
    'post malone': 'Post Malone',
    'billie': 'Billie Eilish',
    'billie eilish': 'Billie Eilish',
}

// ════════════════════════════════════════════════════════════════
// MOOD DICTIONARY
// ════════════════════════════════════════════════════════════════
const MOOD_MAP: Record<string, string[]> = {
    'sad': ['sad songs', 'emotional songs', 'heartbreak songs', 'melancholy'],
    'happy': ['happy songs', 'feel good songs', 'upbeat songs', 'cheerful'],
    'romantic': ['romantic songs', 'love songs', 'couple songs'],
    'party': ['party songs', 'dance songs', 'club hits', 'celebration'],
    'workout': ['workout songs', 'gym songs', 'motivational songs', 'energy'],
    'chill': ['chill songs', 'relaxing songs', 'lofi', 'calm music'],
    'morning': ['morning songs', 'fresh songs', 'energetic morning'],
    'night': ['night songs', 'late night', 'midnight vibes'],
    'heartbreak': ['heartbreak songs', 'breakup songs', 'sad love songs'],
    'devotional': ['devotional songs', 'bhakti songs', 'spiritual'],
    'folk': ['folk songs', 'village songs', 'traditional'],
    'kuthu': ['kuthu songs', 'folk dance', 'celebration songs'],
    'melody': ['melody songs', 'melodious', 'soft songs'],
    'mass': ['mass songs', 'intro songs', 'bgm mass'],
    'bgm': ['bgm', 'background music', 'instrumental', 'theme music'],
    'lofi': ['lofi', 'lo-fi', 'chill beats', 'study music'],
    'classical': ['classical music', 'carnatic', 'hindustani'],
    'rap': ['rap songs', 'hip hop', 'tamil rap'],
    'peppy': ['peppy songs', 'energetic songs', 'dance numbers'],
}

// ════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION
// ════════════════════════════════════════════════════════════════
const LANGUAGE_KEYWORDS: Record<string, string[]> = {
    'tamil': ['tamil', 'kollywood', 'thala', 'thalapathy', 'kamal', 'rajini', 'kuthu'],
    'hindi': ['hindi', 'bollywood', 'hindi songs', 'filmi'],
    'telugu': ['telugu', 'tollywood', 'ntr', 'prabhas', 'allu'],
    'malayalam': ['malayalam', 'mollywood', 'kerala'],
    'kannada': ['kannada', 'sandalwood'],
    'english': ['english', 'western', 'pop', 'rock', 'edm'],
    'punjabi': ['punjabi', 'bhangra'],
}

// ════════════════════════════════════════════════════════════════
// YEAR / TIME DETECTION
// ════════════════════════════════════════════════════════════════
const TIME_KEYWORDS = {
    recent: ['recent', 'latest', 'new', 'newest', 'current', '2024', '2025'],
    classic: ['old', 'classic', 'throwback', 'vintage', 'evergreen', '90s', '80s', '2000s'],
}

// ════════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTION
// ════════════════════════════════════════════════════════════════
export function parseIntent(rawQuery: string): ParsedIntent {
    const normalized = rawQuery.toLowerCase().trim()
    const tokens = normalized.split(/\s+/)
    const currentYear = new Date().getFullYear()

    const intent: ParsedIntent = {
        raw: rawQuery,
        normalized,
        intent: 'unknown',
        entities: {},
        expandedQueries: [],
        confidence: 0,
    }

    // ── STEP 1: Check movie database FIRST ─────────────────────────
    // This is what catches "ranjini 173", "kgf 2", "777 charlie" etc.
    const movieMatch = findMovieMatch(normalized)
    if (movieMatch) {
        intent.intent = 'movie_songs'
        intent.entities.movie = movieMatch
        intent.confidence = 95
        intent.expandedQueries = buildMovieQueries(movieMatch)
        return intent
    }

    // ── STEP 2: Detect language ────────────────────────────────────
    for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
        if (keywords.some(k => tokens.includes(k) || normalized.includes(k))) {
            intent.entities.language = lang
            break
        }
    }

    // ── STEP 3: Detect time reference ─────────────────────────────
    if (TIME_KEYWORDS.recent.some(k => tokens.includes(k) || normalized.includes(k))) {
        intent.entities.timeRef = 'recent'
    } else if (TIME_KEYWORDS.classic.some(k => tokens.includes(k) || normalized.includes(k))) {
        intent.entities.timeRef = 'classic'
    }

    // ── STEP 4: Detect year in query (e.g. "anirudh 2024") ────────
    const yearMatch = normalized.match(/\b(19|20)\d{2}\b/)
    if (yearMatch) {
        intent.entities.year = parseInt(yearMatch[0])
    }

    // ── STEP 5: Check artist dictionary ───────────────────────────
    const artistMatch = findArtistMatch(normalized, tokens)
    if (artistMatch) {
        intent.entities.artist = artistMatch

        // Determine if this is recent or all
        if (intent.entities.timeRef === 'recent') {
            intent.intent = 'artist_recent'
            intent.confidence = 90
        } else {
            intent.intent = 'artist_all'
            intent.confidence = 85
        }
        intent.expandedQueries = buildArtistQueries(
            artistMatch,
            intent.entities.language,
            intent.entities.timeRef,
            intent.entities.year || currentYear
        )
        return intent
    }

    // ── STEP 6: Check mood ─────────────────────────────────────────
    for (const [mood, _] of Object.entries(MOOD_MAP)) {
        if (tokens.includes(mood) || normalized.includes(mood)) {
            intent.entities.mood = mood
            intent.intent = 'mood_search'
            intent.confidence = 80
            intent.expandedQueries = buildMoodQueries(mood, intent.entities.language)
            return intent
        }
    }

    // ── STEP 7: BGM / instrumental check ──────────────────────────
    if (tokens.includes('bgm') || tokens.includes('instrumental') || tokens.includes('theme')) {
        intent.intent = 'bgm_search'
        intent.confidence = 85
        intent.expandedQueries = buildBgmQueries(normalized)
        return intent
    }

    // ── STEP 8: Language hits (e.g. "tamil hits", "hindi trending") 
    if (intent.entities.language && tokens.some(t =>
        ['hits', 'trending', 'top', 'popular', 'best', 'songs'].includes(t)
    )) {
        intent.intent = 'language_hits'
        intent.confidence = 80
        intent.expandedQueries = buildLanguageQueries(intent.entities.language)
        return intent
    }

    // ── STEP 9: Year/decade search ─────────────────────────────────
    if (intent.entities.year || intent.entities.timeRef === 'classic') {
        intent.intent = 'year_search'
        intent.confidence = 75
        intent.expandedQueries = buildYearQueries(
            intent.entities.year,
            intent.entities.language,
            intent.entities.timeRef
        )
        return intent
    }

    intent.intent = 'song_direct'
    intent.confidence = 60
    intent.expandedQueries = buildDirectQueries(rawQuery, intent.entities.language)

    // Final Polish: Build UI metadata
    intent.displayContext = buildDisplayContext(intent)
    intent.relatedSearches = buildRelatedSearches(intent)

    return intent
}

function buildDisplayContext(intent: ParsedIntent): string {
    const { entities, intent: type } = intent
    if (entities.movie) return `Soundtrack for ${entities.movie}`
    if (entities.artist) return `Songs by ${entities.artist}`
    if (entities.mood) return `${entities.mood.charAt(0).toUpperCase() + entities.mood.slice(1)} Music`
    if (entities.language) return `Trending ${entities.language.charAt(0).toUpperCase() + entities.language.slice(1)} Hits`
    if (type === 'bgm_search') return 'Background Scores & Themes'
    return 'Search Results'
}

function buildRelatedSearches(intent: ParsedIntent): string[] {
    const { entities, intent: type } = intent
    const related: string[] = []

    if (entities.artist) {
        related.push(`${entities.artist} hits`, `best of ${entities.artist}`, `new ${entities.artist} songs`)
    }
    if (entities.movie) {
        related.push(`${entities.movie} bgm`, `${entities.movie} lyrics`, `movies like ${entities.movie}`)
    }
    if (entities.mood) {
        related.push(`chill ${entities.mood}`, `latest ${entities.mood} hits`, `relaxing music`)
    }
    if (entities.language) {
        related.push(`${entities.language} 2024 hits`, `top ${entities.language} songs`, `new ${entities.language} albums`)
    }

    return Array.from(new Set(related)).slice(0, 5)
}

// ════════════════════════════════════════════════════════════════
// MOVIE MATCHING — Handles "ranjini 173", "kgf 2", etc.
// ════════════════════════════════════════════════════════════════
function findMovieMatch(normalized: string): string | null {
    // 1. Exact match first
    if (MOVIE_PATTERNS[normalized]) return MOVIE_PATTERNS[normalized]

    // 2. Partial match — check if normalized contains any movie key
    for (const [key, name] of Object.entries(MOVIE_PATTERNS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return name
        }
    }

    // 3. Number pattern detection — "ranjini 173", "movie 2.0", etc.
    // If query has a word + number/decimal pattern → likely a movie
    const hasMoviePattern = /^[a-z\s]+ [\d]+(\.\d+)?$/.test(normalized.trim())
    if (hasMoviePattern && normalized.split(' ').length <= 4) {
        // High confidence this is a movie name with number
        // Return as potential movie (let JioSaavn album search confirm)
        return normalized
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
    }

    return null
}

// ════════════════════════════════════════════════════════════════
// ARTIST MATCHING
// ════════════════════════════════════════════════════════════════
function findArtistMatch(normalized: string, tokens: string[]): string | null {
    // Check multi-word artist names first (e.g. "ar rahman", "arijit singh")
    for (const [alias, canonical] of Object.entries(ARTIST_DICT)) {
        if (normalized.includes(alias)) return canonical
    }
    // Check single tokens
    for (const token of tokens) {
        if (ARTIST_DICT[token]) return ARTIST_DICT[token]
    }
    return null
}

// ════════════════════════════════════════════════════════════════
// QUERY BUILDERS — What actually gets sent to JioSaavn
// ════════════════════════════════════════════════════════════════

function buildMovieQueries(movie: string): QueryWithWeight[] {
    return [
        { query: `${movie} songs`, weight: 1.0, type: 'movie_songs' },
        { query: `${movie} movie songs`, weight: 0.95, type: 'movie_album' },
        { query: `${movie} audio jukebox`, weight: 0.9, type: 'jukebox' },
        { query: `${movie} full album`, weight: 0.85, type: 'full_album' },
        { query: `songs from ${movie}`, weight: 0.8, type: 'from_movie' },
        { query: movie, weight: 0.7, type: 'direct' },
    ]
}

function buildArtistQueries(
    artist: string,
    language: string | undefined,
    timeRef: string | undefined,
    year: number
): QueryWithWeight[] {
    const queries: QueryWithWeight[] = []

    if (timeRef === 'recent') {
        queries.push(
            { query: `${artist} songs ${year}`, weight: 1.0, type: 'artist_year' },
            { query: `${artist} ${year} hits`, weight: 0.95, type: 'artist_hits' },
            { query: `latest ${artist} songs`, weight: 0.9, type: 'latest' },
            { query: `${artist} songs ${year - 1}`, weight: 0.8, type: 'artist_lastyear' },
            { query: `new ${artist}`, weight: 0.75, type: 'new_artist' },
        )
    } else {
        queries.push(
            { query: `${artist} songs`, weight: 1.0, type: 'artist_songs' },
            { query: `best of ${artist}`, weight: 0.95, type: 'best_of' },
            { query: `${artist} hits`, weight: 0.9, type: 'hits' },
            { query: `${artist} popular songs`, weight: 0.85, type: 'popular' },
            { query: `top ${artist}`, weight: 0.8, type: 'top' },
        )
    }

    if (language) {
        queries.push({
            query: `${artist} ${language} songs`,
            weight: 0.85,
            type: 'artist_language'
        })
    }

    return queries
}

function buildMoodQueries(mood: string, language?: string): QueryWithWeight[] {
    const expansions = MOOD_MAP[mood] || [mood]
    const queries: QueryWithWeight[] = expansions.map((exp, i) => ({
        query: language ? `${exp} ${language}` : exp,
        weight: 1.0 - (i * 0.1),
        type: 'mood'
    }))
    return queries
}

function buildBgmQueries(normalized: string): QueryWithWeight[] {
    return [
        { query: `${normalized} bgm`, weight: 1.0, type: 'bgm' },
        { query: `${normalized} background music`, weight: 0.9, type: 'bgm_alt' },
        { query: `${normalized} instrumental`, weight: 0.85, type: 'instrumental' },
        { query: `${normalized} theme music`, weight: 0.8, type: 'theme' },
        { query: normalized, weight: 0.7, type: 'direct' },
    ]
}

function buildLanguageQueries(language: string): QueryWithWeight[] {
    const year = new Date().getFullYear()
    return [
        { query: `${language} hits ${year}`, weight: 1.0, type: 'lang_year' },
        { query: `${language} trending songs`, weight: 0.95, type: 'trending' },
        { query: `best ${language} songs`, weight: 0.9, type: 'best' },
        { query: `${language} top songs`, weight: 0.85, type: 'top' },
        { query: `${language} popular songs`, weight: 0.8, type: 'popular' },
    ]
}

function buildYearQueries(year?: number, language?: string, timeRef?: string): QueryWithWeight[] {
    if (!year && timeRef === 'classic') {
        return [
            { query: language ? `${language} classic songs` : 'classic songs', weight: 1.0, type: 'classic' },
            { query: language ? `${language} 90s songs` : '90s songs', weight: 0.9, type: 'decade' },
            { query: language ? `${language} 2000s songs` : '2000s songs', weight: 0.85, type: 'decade' },
        ]
    }
    return [
        { query: language ? `${language} songs ${year}` : `songs ${year}`, weight: 1.0, type: 'year' },
        { query: language ? `${language} hits ${year}` : `hits ${year}`, weight: 0.9, type: 'year_hits' },
        { query: `best songs of ${year}`, weight: 0.85, type: 'best_year' },
    ]
}

function buildDirectQueries(rawQuery: string, language?: string): QueryWithWeight[] {
    return [
        { query: rawQuery, weight: 1.0, type: 'direct' },
        { query: rawQuery.toLowerCase(), weight: 0.95, type: 'lower' },
        ...(language ? [{
            query: `${rawQuery} ${language}`,
            weight: 0.85,
            type: 'with_lang'
        }] : []),
    ]
}
