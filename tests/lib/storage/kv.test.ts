import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore, clearKvStore } from '../../helpers/kv-mock';

// Set env vars for the Redis constructor
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    get = vi.fn(async (key: string) => {
      const entry = kvStore.get(key);
      if (!entry) return null;
      return entry.value;
    });
    set = vi.fn(async (key: string, value: unknown, options?: { ex?: number }) => {
      kvStore.set(key, { value });
      return 'OK';
    });
    del = vi.fn(async (key: string) => {
      kvStore.delete(key);
      return 1;
    });
    lpush = vi.fn(async (key: string, ...values: string[]) => {
      const existing = kvStore.get(key);
      const list = existing ? (existing.value as string[]) : [];
      list.unshift(...values);
      kvStore.set(key, { value: list });
      return list.length;
    });
    lrange = vi.fn(async (key: string, start: number, end: number) => {
      const existing = kvStore.get(key);
      const list = existing ? (existing.value as string[]) : [];
      return list.slice(start, end === -1 ? undefined : end + 1);
    });
    zadd = vi.fn(async () => 1);
    zrange = vi.fn(async () => []);
    scan = vi.fn(async () => ['0', []]);
  },
}));

describe('KV Storage', () => {
  beforeEach(() => {
    clearKvStore();
  });

  it('set and get round-trips a value', async () => {
    const { kvSet, kvGet } = await import('@/lib/storage/kv');
    await kvSet('test:key', { foo: 'bar' });
    const result = await kvGet<{ foo: string }>('test:key');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('get returns null for missing key', async () => {
    const { kvGet } = await import('@/lib/storage/kv');
    const result = await kvGet('nonexistent');
    expect(result).toBeNull();
  });

  it('del removes a key', async () => {
    const { kvSet, kvGet, kvDel } = await import('@/lib/storage/kv');
    await kvSet('del:key', 'value');
    await kvDel('del:key');
    const result = await kvGet('del:key');
    expect(result).toBeNull();
  });

  it('lpush and lrange work for append-only lists', async () => {
    const { kvLpush, kvLrange } = await import('@/lib/storage/kv');
    await kvLpush('list:key', 'item1');
    await kvLpush('list:key', 'item2');
    const result = await kvLrange('list:key', 0, -1);
    expect(result).toHaveLength(2);
    expect(result).toContain('item1');
    expect(result).toContain('item2');
  });
});
