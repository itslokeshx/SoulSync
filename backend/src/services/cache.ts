import { redisGet, redisSet, redisDel } from "./redis.js";

export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const val = await redisGet(key);
      if (!val) return null;
      try {
        return JSON.parse(val) as T;
      } catch {
        return val as unknown as T;
      }
    } catch (err) {
      console.error(`[Cache] Get error for key "${key}":`, err);
      return null;
    }
  },

  set: async <T>(key: string, value: T, ttlSeconds?: number): Promise<void> => {
    try {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      await redisSet(key, str, ttlSeconds);
    } catch (err) {
      console.error(`[Cache] Set error for key "${key}":`, err);
    }
  },

  del: async (key: string): Promise<void> => {
    try {
      await redisDel(key);
    } catch (err) {
      console.error(`[Cache] Del error for key "${key}":`, err);
    }
  }
};
