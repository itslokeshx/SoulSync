// Redis service using Upstash REST API with in-memory fallback

const memoryStore = new Map<
  string,
  { value: string; expiresAt: number | null }
>();

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = !!(REDIS_URL && REDIS_TOKEN);

async function redisRequest(command: string[]): Promise<unknown> {
  if (!useRedis) throw new Error("Redis not configured");

  const res = await fetch(`${REDIS_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const data = (await res.json()) as { result: unknown };
  return data.result;
}

export async function redisGet(key: string): Promise<string | null> {
  if (useRedis) {
    try {
      const result = await redisRequest(["GET", key]);
      return result as string | null;
    } catch {
      // Fallback to memory
    }
  }

  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  if (useRedis) {
    try {
      const cmd = ttlSeconds
        ? ["SET", key, value, "EX", String(ttlSeconds)]
        : ["SET", key, value];
      await redisRequest(cmd);
      return;
    } catch {
      // Fallback to memory
    }
  }

  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

export async function redisDel(key: string): Promise<void> {
  if (useRedis) {
    try {
      await redisRequest(["DEL", key]);
      return;
    } catch {
      // Fallback
    }
  }
  memoryStore.delete(key);
}

export async function redisIncr(key: string): Promise<number> {
  if (useRedis) {
    try {
      const result = await redisRequest(["INCR", key]);
      return result as number;
    } catch {
      // Fallback
    }
  }

  const entry = memoryStore.get(key);
  const val = entry ? parseInt(entry.value, 10) + 1 : 1;
  memoryStore.set(key, {
    value: String(val),
    expiresAt: entry?.expiresAt ?? null,
  });
  return val;
}

// Cleanup expired memory entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt && now > entry.expiresAt) {
      memoryStore.delete(key);
    }
  }
}, 300000);
