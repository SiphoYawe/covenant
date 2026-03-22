import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      // Return a noop Redis that returns empty values instead of spamming console warnings
      return {
        get: async () => null,
        set: async () => 'OK',
        del: async () => 0,
        lpush: async () => 0,
        lrange: async () => [],
        zadd: async () => 0,
        zrange: async () => [],
        scan: async () => ['0', []],
      } as unknown as Redis;
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const instance = getRedis();
    const value = instance[prop as keyof Redis];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
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
