import fs from 'fs';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  ALL_WALLET_NAMES,
  WALLET_NAMES,
  envKeyForWallet,
  type AgentRole,
  type WalletConfig,
} from './types';

/**
 * A wallet config blueprint (before key generation).
 * Contains name, role, envKeyName but no private key or address.
 */
export interface WalletConfigBlueprint {
  name: string;
  role: AgentRole;
  envKeyName: string;
}

/**
 * Generate the 28 wallet config blueprints with names, roles, and env key names.
 * Pure function, no side effects.
 */
export function generateWalletConfigs(): WalletConfigBlueprint[] {
  const configs: WalletConfigBlueprint[] = [];

  for (const name of WALLET_NAMES.requesters) {
    configs.push({ name, role: 'requester', envKeyName: envKeyForWallet(name) });
  }
  for (const name of WALLET_NAMES.providers) {
    configs.push({ name, role: 'provider', envKeyName: envKeyForWallet(name) });
  }
  for (const name of WALLET_NAMES.adversarial) {
    configs.push({ name, role: 'adversarial', envKeyName: envKeyForWallet(name) });
  }

  return configs;
}

/**
 * Generate a new wallet using viem. Real key generation, no mocks.
 */
export function generateWallet(): { privateKey: string; address: string } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

/**
 * Load existing seed wallets from a .env.local file.
 * Returns only wallets that have keys present in the file.
 */
export function loadWalletsFromEnv(envPath: string): WalletConfig[] {
  if (!fs.existsSync(envPath)) return [];

  const content = fs.readFileSync(envPath, 'utf-8');
  const wallets: WalletConfig[] = [];
  const configs = generateWalletConfigs();

  for (const config of configs) {
    const regex = new RegExp(`^${config.envKeyName}=(.+)$`, 'm');
    const match = content.match(regex);
    if (match) {
      const privateKey = match[1].trim();
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      wallets.push({
        name: config.name,
        role: config.role,
        envKeyName: config.envKeyName,
        privateKey,
        address: account.address,
      });
    }
  }

  return wallets;
}

/**
 * Idempotent wallet creation. Loads existing wallets from .env.local,
 * generates only missing ones, and appends new keys to the file.
 */
export function getOrCreateWallets(envPath: string): WalletConfig[] {
  const allConfigs = generateWalletConfigs();
  const existingWallets = loadWalletsFromEnv(envPath);
  const existingNames = new Set(existingWallets.map(w => w.name));

  const newWallets: WalletConfig[] = [];
  const linesToAppend: string[] = [];

  for (const config of allConfigs) {
    if (existingNames.has(config.name)) continue;

    const { privateKey, address } = generateWallet();
    const wallet: WalletConfig = {
      name: config.name,
      role: config.role,
      envKeyName: config.envKeyName,
      privateKey,
      address,
    };
    newWallets.push(wallet);
    linesToAppend.push(`${config.envKeyName}=${privateKey}`);
  }

  if (linesToAppend.length > 0) {
    const existingContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    const needsNewline = existingContent.length > 0 && !existingContent.endsWith('\n');
    const prefix = needsNewline ? '\n' : '';
    const header = existingNames.size === 0 ? '# Seed Wallets (auto-generated)\n' : '';
    fs.appendFileSync(envPath, `${prefix}${header}${linesToAppend.join('\n')}\n`);
  }

  // Return all wallets in canonical order (matching ALL_WALLET_NAMES)
  const allWallets = [...existingWallets, ...newWallets];
  return ALL_WALLET_NAMES.map(name => allWallets.find(w => w.name === name)!);
}
