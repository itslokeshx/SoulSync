import { DuoSession } from "../models/DuoSession.js";

export const DuoSessionService = {
  async getSessionByCode(code: string) {
    return DuoSession.findOne({ code });
  },

  async updateSession(code: string, updates: any) {
    return DuoSession.updateOne({ code }, updates);
  },

  async updateMemberConnection(
    code: string,
    role: "host" | "guest",
    updates: { name?: string; socketId: string | null; connected: boolean }
  ) {
    const setObj: any = {};
    if (updates.name !== undefined) setObj[`${role}.name`] = updates.name;
    setObj[`${role}.socketId`] = updates.socketId;
    setObj[`${role}.connected`] = updates.connected;
    return DuoSession.updateOne({ code }, { $set: setObj });
  },

  async updatePlayState(code: string, isPlaying: boolean, currentTime: number) {
    return DuoSession.updateOne({ code }, { $set: { isPlaying, currentTime } });
  },

  async changeSong(code: string, currentSong: any, historyEntry: any) {
    return DuoSession.updateOne(
      { code },
      {
        $set: { currentSong, isPlaying: true, currentTime: 0 },
        $push: { songHistory: historyEntry },
        $inc: { "stats.songsPlayed": 1 },
      }
    );
  },

  async addMessage(code: string, message: any) {
    return DuoSession.updateOne(
      { code },
      {
        $push: { messages: message },
        $inc: { "stats.messagesCount": 1 },
      }
    );
  },

  async incrementReactions(code: string) {
    return DuoSession.updateOne(
      { code },
      { $inc: { "stats.reactionsCount": 1 } }
    );
  }
};
