import { createWalletClient, http, type WalletClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { randomBytes } from 'crypto';
import { verifyMessage } from 'viem';
import { kvGet, kvSet, kvDel } from '@/lib/storage/kv';
import { getPublicClient } from '@/lib/wallets/manager';
import { env } from '@/lib/config/env';
import type { ProvisionedWallet, NonceChallenge } from '@/lib/deploy/types';

/** USDC contract on Base Sepolia */
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const USDC_DECIMALS = 6;

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const NONCE_TTL_SECONDS = 300; // 5 minutes

/**
 * Provision a new wallet: generate key, derive address, store in KV.
 * Returns the wallet info with zero funded amount.
 */
export async function provisionWallet(): Promise<ProvisionedWallet> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const now = new Date().toISOString();

  // Store private key in KV (testnet only, production would use KMS)
  await kvSet(`wallet:${account.address}:key`, privateKey);
  await kvSet(`wallet:${account.address}:provisioned-at`, now);

  return {
    address: account.address,
    privateKey,
    fundedAmount: 0,
    provisionedAt: now,
  };
}

/**
 * Retrieve a provisioned wallet from KV and create a WalletClient for it.
 * Returns null if the wallet is not found.
 */
export async function getProvisionedWallet(
  address: string
): Promise<WalletClient | null> {
  const privateKey = await kvGet<string>(`wallet:${address}:key`);
  if (!privateKey) return null;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL),
  });
}

/**
 * Fund a wallet from the system USDC pool.
 * @param address Target wallet address
 * @param usdcAmount Amount in smallest USDC units (6 decimals). 5 USDC = 5_000_000.
 */
export async function fundFromPool(
  address: string,
  usdcAmount: bigint
): Promise<string> {
  const { getWallet } = await import('@/lib/wallets');
  const systemWallet = getWallet('system');

  const txHash = await systemWallet.writeContract({
    address: USDC_ADDRESS,
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [address as `0x${string}`, usdcAmount],
  });

  // Record funded amount in KV
  const existingFunded = (await kvGet<number>(`wallet:${address}:funded-amount`)) ?? 0;
  await kvSet(`wallet:${address}:funded-amount`, existingFunded + Number(usdcAmount));

  return txHash;
}

/**
 * Get the USDC balance of the system wallet on-chain.
 * Returns balance in smallest units (6 decimals).
 */
export async function getSystemPoolBalance(): Promise<bigint> {
  const { getAddress } = await import('@/lib/wallets');
  const systemAddress = getAddress('system');
  const publicClient = getPublicClient();

  const balance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [systemAddress],
  });

  return balance as bigint;
}

/**
 * Generate a cryptographic nonce for BYOW wallet verification.
 * Stored in KV with a 5-minute TTL.
 */
export async function generateNonce(address: string): Promise<NonceChallenge> {
  const nonce = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000).toISOString();

  await kvSet(`deploy:nonces:${address}`, nonce, { ex: NONCE_TTL_SECONDS });

  return {
    nonce,
    address,
    expiresAt,
  };
}

/**
 * Verify a nonce for a given address. One-time use: deletes the nonce on success.
 * Returns false if nonce doesn't match or doesn't exist.
 */
export async function verifyNonce(
  address: string,
  nonce: string
): Promise<boolean> {
  const stored = await kvGet<string>(`deploy:nonces:${address}`);
  if (!stored || stored !== nonce) return false;

  // Consume the nonce (one-time use)
  await kvDel(`deploy:nonces:${address}`);
  return true;
}

/**
 * Verify a wallet signature against a nonce.
 * Uses viem verifyMessage to recover the signer and compare with the claimed address.
 * Consumes the nonce on successful verification.
 */
export async function verifySignature(
  address: string,
  nonce: string,
  signature: string
): Promise<boolean> {
  // First verify the nonce exists and matches
  const nonceValid = await verifyNonce(address, nonce);
  if (!nonceValid) return false;

  try {
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message: nonce,
      signature: signature as `0x${string}`,
    });
    return isValid;
  } catch {
    return false;
  }
}

export { USDC_ADDRESS, USDC_DECIMALS };
