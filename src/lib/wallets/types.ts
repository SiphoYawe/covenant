import type { Address } from 'viem';

/** Agent roles that have wallets */
export type WalletRole = 'researcher' | 'reviewer' | 'summarizer' | 'malicious' | 'system';

/** Mapping from wallet role to the corresponding env var name */
export const ROLE_TO_ENV_KEY: Record<WalletRole, string> = {
  researcher: 'AGENT_A_PRIVATE_KEY',
  reviewer: 'AGENT_B_PRIVATE_KEY',
  summarizer: 'AGENT_C_PRIVATE_KEY',
  malicious: 'AGENT_D_PRIVATE_KEY',
  system: 'SYSTEM_PRIVATE_KEY',
};

/** All wallet roles */
export const WALLET_ROLES: WalletRole[] = ['researcher', 'reviewer', 'summarizer', 'malicious', 'system'];

/** Info about a wallet bound to an agent role */
export type WalletInfo = {
  role: WalletRole;
  address: Address;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
};

export type { Address };
