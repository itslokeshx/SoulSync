// ─────────────────────────────────────────────────────────────────────────────
// Redis Service — Upstash REST or in-memory fallback
// ─────────────────────────────────────────────────────────────────────────────
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = !!(URL && TOKEN);

// In-memory fallback store
const mem = new Map();
const ttls = new Map();

async function upstashFetch(method, ...args) {
  const body = [method.toUpperCase(), ...args];
  const res = await fetch(`${URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export const redis = {
  async get(key) {
    if (useUpstash) {
      const val = await upstashFetch("GET", key);
      return val ? JSON.parse(val) : null;
    }
    const item = mem.get(key);
    if (!item) return null;
    return JSON.parse(item);
  },

  async set(key, value, ttlSeconds = 86400) {
    const json = JSON.stringify(value);
    if (useUpstash) {
      await upstashFetch("SET", key, json, "EX", String(ttlSeconds));
      return;
    }
    mem.set(key, json);
    if (ttls.has(key)) clearTimeout(ttls.get(key));
    ttls.set(
      key,
      setTimeout(() => {
        mem.delete(key);
        ttls.delete(key);
      }, ttlSeconds * 1000),
    );
  },

  async del(key) {
    if (useUpstash) {
      await upstashFetch("DEL", key);
      return;
    }
    mem.delete(key);
    if (ttls.has(key)) {
      clearTimeout(ttls.get(key));
      ttls.delete(key);
    }
  },

  get mode() {
    return useUpstash ? "upstash" : "memory";
  },
};
