export const API = "https://jiosaavn.rajputhemant.dev";

export const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23282828'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' font-size='64' fill='%23535353'%3E%E2%99%AA%3C/text%3E%3C/svg%3E";

export const GENRE_CATEGORIES: {
  label: string;
  q: string;
  color: string;
  icon: string;
  size?: "lg" | "md";
}[] = [
  {
    label: "Fresh Drops",
    q: "latest tamil hits 2026",
    color: "#e13300",
    icon: "Flame",
    size: "lg",
  },
  {
    label: "Kollywood",
    q: "tamil movie songs 2026",
    color: "#8b5cf6",
    icon: "Clapperboard",
    size: "lg",
  },
  {
    label: "Anirudh",
    q: "anirudh ravichander songs",
    color: "#0d72ea",
    icon: "Zap",
  },
  {
    label: "Rahman",
    q: "ar rahman best songs",
    color: "#e91429",
    icon: "Piano",
  },
  {
    label: "Heartstrings",
    q: "romantic english songs chill",
    color: "#e91e8c",
    icon: "Heart",
  },
  {
    label: "Charts",
    q: "top english pop songs 2026",
    color: "#f59b23",
    icon: "TrendingUp",
    size: "lg",
  },
  {
    label: "Melody Lane",
    q: "tamil melody songs romantic",
    color: "#148a08",
    icon: "Music",
  },
  {
    label: "Reels",
    q: "viral reels songs 2026",
    color: "#d97706",
    icon: "Play",
  },
  {
    label: "Unwind",
    q: "chill english songs sad vibes",
    color: "#56688a",
    icon: "Waves",
  },
  {
    label: "Dancefloor",
    q: "party songs english dance 2026",
    color: "#dc2626",
    icon: "Disc3",
    size: "lg",
  },
  {
    label: "Sid Sriram",
    q: "sid sriram songs",
    color: "#7c3aed",
    icon: "Mic",
  },
  {
    label: "On Repeat",
    q: "tamil trending songs 2026",
    color: "#1db954",
    icon: "Repeat",
  },
];

export const HOME_SECTIONS = [
  {
    key: "tamilHeatwave",
    title: "Scorching Right Now",
    icon: "🔥",
    songs: [
      "Monica Coolie",
      "Kanimaa",
      "Oorum Blood Dude",
      "Vazhithunaiye",
      "Muththa Mazhai",
      "Sawadeeka",
      "Powerhouse Coolie",
      "Yedi",
      "Jinguchaa",
      "Pottala Muttaye",
    ],
  },
  {
    key: "tamilReplay",
    title: "Can't Stop Streaming",
    icon: "💫",
    songs: [
      "Chikitu",
      "Og Sambavam",
      "The One Retro",
      "Rise Of Dragon",
      "Vizhi Veekura",
      "God Bless U",
      "Sugar Baby",
      "Vinveli Nayaga",
      "Manasilaayo",
    ],
  },
  {
    key: "tamilAfterHours",
    title: "Late Night Feels",
    icon: "🌙",
    songs: [
      "Katchi Sera Sai Abhyankkar",
      "Aaruyire Guru AR Rahman",
      "Kannadi Poove",
      "Hey Minnale",
      "Unakku Enna Odave",
      "Yendi Vittu Pona",
      "Sithira Puthiri",
      "Enakenna Yaarum Illaye",
      "Golden Sparrow NEEK",
      "Vaa Kannamma",
      "Salambala Madharaasi Yuvan",
    ],
  },
  {
    key: "midnightLove",
    title: "Love & Longing",
    icon: "💖",
    songs: [
      "Die With A Smile",
      "I Think They Call This Love",
      "Dusk Till Dawn",
      "Heat Waves",
      "Golden Hour",
      "Until I Found You",
      "Yellow",
      "Someone You Loved",
      "Perfect",
      "Ocean Eyes",
    ],
  },
  {
    key: "globalPulse",
    title: "Worldwide Anthems",
    icon: "🌍",
    songs: [
      "Blinding Lights",
      "As It Was",
      "Flowers",
      "Cupid",
      "Stay",
      "Sunroof",
      "Industry Baby",
      "Savage Love",
      "Dance Monkey",
      "Good 4 U",
    ],
  },
];

export const POPULAR_ARTISTS = [
  "Anirudh Ravichander",
  "AR Rahman",
  "Sid Sriram",
  "The Weeknd",
  "Dua Lipa",
  "Bruno Mars",
  "Olivia Rodrigo",
  "Billie Eilish",
  "Yuvan Shankar Raja",
  "Doja Cat",
  "Ed Sheeran",
  "GV Prakash",
];
