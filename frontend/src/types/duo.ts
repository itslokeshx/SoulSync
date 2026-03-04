export interface DuoReaction {
  id: string;
  emoji: string;
  from: string;
  at: number;
}

export interface DuoNote {
  songId: string;
  text: string;
  from: string;
}

export interface DuoMessage {
  text: string;
  from: string;
  at: number;
}

export interface DuoSessionStats {
  duration: number;
  songsPlayed: number;
  reactionsCount: number;
  messagesCount: number;
}
