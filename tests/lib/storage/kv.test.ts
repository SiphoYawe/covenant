import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory KV store for testing
const store = new Map<string, unknown>();
const lists = new Map<string, string[]>();

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    lpush: vi.fn(async (key: string, value: string) => {
      const list = lists.get(key) ?? [];
      list.unshift(value);
      lists.set(key, list);
    }),
    lrange: vi.fn(async (key: string, start: number, end: number) => {
      const list = lists.get(key) ?? [];
      return list.slice(start, end === -1 ? undefined : end + 1);
    }),
  },
}));

describe('KV Storage', () => {
  beforeEach(() => {
    store.clear();
    lists.clear();
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
