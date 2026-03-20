import { PinataSDK } from 'pinata';
import { env } from '@/lib/config/env';
import { kvSet, kvGet } from './kv';

let pinata: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!pinata) {
    pinata = new PinataSDK({ pinataJwt: env.PINATA_JWT });
  }
  return pinata;
}

/**
 * Pin JSON data to IPFS via Pinata.
 * On failure, falls back to KV storage with a retry flag.
 */
export async function pin(data: unknown): Promise<string> {
  try {
    const result = await getPinata().upload.public.json(data as object);
    return result.cid;
  } catch (error) {
    // Graceful degradation: cache in KV with retry flag
    const fallbackKey = `ipfs:pending:${Date.now()}`;
    await kvSet(fallbackKey, { data, retry: true });
    throw new Error(`IPFS pin failed, cached in KV as ${fallbackKey}: ${error}`);
  }
}

/**
 * Get content from IPFS by CID via Pinata gateway.
 * Falls back to KV cache if available.
 */
export async function get(cid: string): Promise<unknown> {
  // Check KV cache first
  const cached = await kvGet<unknown>(`ipfs:cache:${cid}`);
  if (cached !== null) {
    return cached;
  }

  try {
    const response = await getPinata().gateways.public.get(cid);
    const data = response.data;
    // Cache the result
    await kvSet(`ipfs:cache:${cid}`, data);
    return data;
  } catch (error) {
    throw new Error(`IPFS get failed for CID ${cid}: ${error}`);
  }
}
