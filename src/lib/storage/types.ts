/** IPFS client interface for pinning and retrieval */
export type IPFSClient = {
  pin(data: unknown): Promise<string>;
  get(cid: string): Promise<unknown>;
};

/** Typed KV client interface */
export type KVClient = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  lpush(key: string, value: string): Promise<void>;
  lrange(key: string, start: number, end: number): Promise<string[]>;
};
