import { SDK } from 'agent0-sdk';
import type { SDKConfig } from 'agent0-sdk';
import { env } from '@/lib/config/env';
import { BASE_SEPOLIA_CHAIN_ID } from '@/lib/config/constants';

let sdkInstances = new Map<string, SDK>();

/**
 * Get an agent0-ts SDK instance configured for a specific private key.
 * Caches instances per private key to avoid repeated initialization.
 */
export function getSDK(privateKey: string): SDK {
  if (sdkInstances.has(privateKey)) {
    return sdkInstances.get(privateKey)!;
  }

  const config: SDKConfig = {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    rpcUrl: env.BASE_SEPOLIA_RPC_URL,
    privateKey,
    ipfs: 'pinata',
    pinataJwt: env.PINATA_JWT,
  };

  const sdk = new SDK(config);
  sdkInstances.set(privateKey, sdk);
  return sdk;
}

/**
 * Get a read-only SDK (no signer) for querying on-chain data.
 */
export function getReadOnlySDK(): SDK {
  const key = '__readonly__';
  if (sdkInstances.has(key)) {
    return sdkInstances.get(key)!;
  }

  const config: SDKConfig = {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    rpcUrl: env.BASE_SEPOLIA_RPC_URL,
  };

  const sdk = new SDK(config);
  sdkInstances.set(key, sdk);
  return sdk;
}

/** Clear cached SDK instances (for testing) */
export function clearSDKCache(): void {
  sdkInstances = new Map();
}
