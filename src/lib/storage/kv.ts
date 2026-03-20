import { kv } from '@vercel/kv';

/** Typed get from Vercel KV */
export async function kvGet<T>(key: string): Promise<T | null> {
  return kv.get<T>(key);
}

/** Typed set to Vercel KV */
export async function kvSet<T>(key: string, value: T, options?: { ex?: number }): Promise<void> {
  if (options?.ex) {
    await kv.set(key, value, { ex: options.ex });
  } else {
    await kv.set(key, value);
  }
}

/** Delete a key from Vercel KV */
export async function kvDel(key: string): Promise<void> {
  await kv.del(key);
}

/** Push a value to the left of a list */
export async function kvLpush(key: string, value: string): Promise<void> {
  await kv.lpush(key, value);
}

/** Get a range from a list */
export async function kvLrange(key: string, start: number, end: number): Promise<string[]> {
  return kv.lrange(key, start, end);
}

/** Scan for keys matching a pattern using SCAN (non-blocking unlike KEYS) */
export async function kvScan(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const result: [string, string[]] = await kv.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(result[0]);
    keys.push(...result[1]);
  } while (cursor !== 0);
  return keys;
}
