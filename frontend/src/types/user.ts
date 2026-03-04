export interface User {
  _id: string;
  googleId: string;
  email: string;
  name: string;
  photoURL?: string;
  preferences: {
    languages: string[];
    eras: string[];
    moods: string[];
  };
  likedSongs: {
    songId: string;
    title: string;
    artist: string;
    albumArt: string;
    duration: number;
  }[];
  totalListeningTime: number;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  totalSongsPlayed: number;
  totalListeningTime: number;
  likedSongsCount: number;
  topArtists: { _id: string; count: number; albumArt?: string }[];
  languageBreakdown: { _id: string; count: number }[];
}
