export interface SongImage {
  quality: string;
  url?: string;
  link?: string;
}

export interface SongDownloadUrl {
  quality: string;
  url?: string;
  link?: string;
}

export interface SongArtist {
  id: string;
  name: string;
  image?: SongImage[];
}

export interface Song {
  id: string;
  name: string;
  type?: string;
  year?: string;
  duration: number;
  language?: string;
  image: SongImage[];
  downloadUrl?: SongDownloadUrl[];
  download_url?: SongDownloadUrl[];
  artists?: {
    primary: SongArtist[];
    featured?: SongArtist[];
    all?: SongArtist[];
  };
  artist_map?: {
    primary_artists: SongArtist[];
  };
  album?: {
    id: string;
    name: string;
    url?: string;
  };
  url?: string;
  hasLyrics?: boolean;
  label?: string;
  music?: string;
  primaryArtists?: string;
  subtitle?: string;
  // Scored fields from backend search
  relevanceScore?: number;
  matchReason?: string;
  isTopResult?: boolean;
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  year?: string;
  image: SongImage[];
  songs?: Song[];
  songCount?: number;
  artists?: { primary: SongArtist[] };
  url?: string;
}

export interface Artist {
  id: string;
  name: string;
  image: SongImage[];
  followerCount?: number;
  fanCount?: string;
  isVerified?: boolean;
  dominantLanguage?: string;
  dominantType?: string;
  bio?: string[];
  dob?: string;
  fb?: string;
  twitter?: string;
  wiki?: string;
  availableLanguages?: string[];
  isRadioPresent?: boolean;
}
