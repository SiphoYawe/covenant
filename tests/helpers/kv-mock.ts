/**
 * Shared in-memory KV mock for tests.
 * Mocks @/lib/storage/kv at the abstraction boundary.
 */
import { vi } from 'vitest';

export const kvStore = new Map<string, { value: unknown; expiresAt?: number }>();
export const zaddCalls: Array<unknown[]> = [];

/** Clear all stored data and zadd call history */
export function clearKvStore() {
  kvStore.clear();
  zaddCalls.length = 0;
}

/** Create the mock factory for vi.mock('@/lib/storage/kv') */
export function createKvMock() {
  return {
    kvGet: vi.fn(async <T>(key: string): Promise<T | null> => {
      const entry = kvStore.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        kvStore.delete(key);
        return null;
      }
      return entry.value as T;
    }),
    kvSet: vi.fn(async <T>(key: string, value: T, options?: { ex?: number }): Promise<void> => {
      const entry: { value: unknown; expiresAt?: number } = { value };
      if (options?.ex) {
        entry.expiresAt = Date.now() + options.ex * 1000;
      }
      kvStore.set(key, entry);
    }),
    kvDel: vi.fn(async (key: string): Promise<void> => {
      kvStore.delete(key);
    }),
    kvLpush: vi.fn(async (key: string, value: string): Promise<void> => {
      const existing = kvStore.get(key);
      const list = existing ? (existing.value as string[]) : [];
      list.unshift(value);
      kvStore.set(key, { value: list });
    }),
    kvLrange: vi.fn(async (key: string, start: number, end: number): Promise<string[]> => {
      const existing = kvStore.get(key);
      const list = existing ? (existing.value as string[]) : [];
      return list.slice(start, end === -1 ? undefined : end + 1);
    }),
    kvScan: vi.fn(async (): Promise<string[]> => []),
    kv: {
      zadd: vi.fn(async (...args: unknown[]) => {
        zaddCalls.push(args);
        return 1;
      }),
      zrange: vi.fn(async () => []),
      get: vi.fn(async (key: string) => {
        const entry = kvStore.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          kvStore.delete(key);
          return null;
        }
        return entry.value;
      }),
      set: vi.fn(async (key: string, value: unknown, options?: { ex?: number }) => {
        const entry: { value: unknown; expiresAt?: number } = { value };
        if (options?.ex) {
          entry.expiresAt = Date.now() + options.ex * 1000;
        }
        kvStore.set(key, entry);
      }),
      del: vi.fn(async (key: string) => {
        kvStore.delete(key);
      }),
    },
  };
}
