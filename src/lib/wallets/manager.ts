import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { env } from '@/lib/config/env';
import { type WalletRole, type WalletInfo, ROLE_TO_ENV_KEY, WALLET_ROLES } from './types';
import type { Address } from 'viem';

// Lazy initialization — wallets created on first access, not at import time
let wallets: Map<WalletRole, WalletInfo> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any = null;

function ensureInitialized(): Map<WalletRole, WalletInfo> {
  if (wallets) return wallets;

  wallets = new Map();
  const rpcUrl = env.BASE_SEPOLIA_RPC_URL;

  for (const role of WALLET_ROLES) {
    const envKey = ROLE_TO_ENV_KEY[role];
    const privateKey = env[envKey as keyof typeof env] as string;

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    wallets.set(role, {
      role,
      address: account.address,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
    });
  }

  return wallets;
}

function ensurePublicClient() {
  if (_publicClient) return _publicClient;
  _publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL),
  });
  return _publicClient;
}

/** Get the WalletClient for a given role */
export function getWallet(role: WalletRole) {
  const info = ensureInitialized().get(role);
  if (!info) {
    throw new Error(`Unknown wallet role: ${role}`);
  }
  return info.client;
}

/** Get the address for a given role */
export function getAddress(role: WalletRole): Address {
  const info = ensureInitialized().get(role);
  if (!info) {
    throw new Error(`Unknown wallet role: ${role}`);
  }
  return info.address;
}

/** Get full wallet info (role + address + client) */
export function getWalletInfo(role: WalletRole): WalletInfo {
  const info = ensureInitialized().get(role);
  if (!info) {
    throw new Error(`Unknown wallet role: ${role}`);
  }
  return info;
}

/** Get the shared public client for read operations on Base Sepolia */
export function getPublicClient() {
  return ensurePublicClient();
}
