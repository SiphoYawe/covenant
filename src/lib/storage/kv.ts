import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/** Typed get from KV */
export async function kvGet<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

/** Typed set to KV */
export async function kvSet<T>(key: string, value: T, options?: { ex?: number }): Promise<void> {
  if (options?.ex) {
    await redis.set(key, value, { ex: options.ex });
  } else {
    await redis.set(key, value);
  }
}

/** Delete a key from KV */
export async function kvDel(key: string): Promise<void> {
  await redis.del(key);
}

/** Push a value to the left of a list */
export async function kvLpush(key: string, value: string): Promise<void> {
  await redis.lpush(key, value);
}

/** Get a range from a list */
export async function kvLrange(key: string, start: number, end: number): Promise<string[]> {
  return redis.lrange(key, start, end);
}

/** Scan for keys matching a pattern using SCAN (non-blocking unlike KEYS) */
export async function kvScan(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const result: [string, string[]] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(result[0]);
    keys.push(...result[1]);
  } while (cursor !== 0);
  return keys;
}

/** Export the raw redis client for direct use */
export { redis as kv };
