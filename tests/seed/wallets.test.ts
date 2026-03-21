import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ALL_WALLET_NAMES,
  WALLET_NAMES,
  envKeyForWallet,
  roleForWalletName,
  usdcToSmallestUnit,
  smallestUnitToUsdc,
  walletConfigSchema,
  agentRoleSchema,
  type WalletConfig,
} from '../../seed/types';
import {
  generateWalletConfigs,
  generateWallet,
  loadWalletsFromEnv,
  getOrCreateWallets,
} from '../../seed/wallets';

// ──────────────────────────────────────────
// Type & Helper Tests
// ──────────────────────────────────────────

describe('types and helpers', () => {
  describe('ALL_WALLET_NAMES', () => {
    it('contains exactly 28 entries', () => {
      expect(ALL_WALLET_NAMES).toHaveLength(28);
    });

    it('has 7 requesters, 17 providers, 4 adversarial', () => {
      expect(WALLET_NAMES.requesters).toHaveLength(7);
      expect(WALLET_NAMES.providers).toHaveLength(17);
      expect(WALLET_NAMES.adversarial).toHaveLength(4);
    });

    it('has no duplicate names', () => {
      const unique = new Set(ALL_WALLET_NAMES);
      expect(unique.size).toBe(28);
    });
  });

  describe('envKeyForWallet', () => {
    it('generates correct env key for requester', () => {
      expect(envKeyForWallet('R1')).toBe('SEED_WALLET_R1_KEY');
    });

    it('generates correct env key for provider', () => {
      expect(envKeyForWallet('S17')).toBe('SEED_WALLET_S17_KEY');
    });

    it('generates correct env key for adversarial', () => {
      expect(envKeyForWallet('X4')).toBe('SEED_WALLET_X4_KEY');
    });
  });

  describe('roleForWalletName', () => {
    it('returns requester for R-prefixed names', () => {
      expect(roleForWalletName('R1')).toBe('requester');
      expect(roleForWalletName('R7')).toBe('requester');
    });

    it('returns provider for S-prefixed names', () => {
      expect(roleForWalletName('S1')).toBe('provider');
      expect(roleForWalletName('S17')).toBe('provider');
    });

    it('returns adversarial for X-prefixed names', () => {
      expect(roleForWalletName('X1')).toBe('adversarial');
      expect(roleForWalletName('X4')).toBe('adversarial');
    });

    it('throws for invalid name', () => {
      expect(() => roleForWalletName('Z1')).toThrow('Invalid wallet name');
    });
  });

  describe('USDC conversion', () => {
    it('converts whole USDC to smallest unit', () => {
      expect(usdcToSmallestUnit(1)).toBe(1_000_000n);
      expect(usdcToSmallestUnit(20)).toBe(20_000_000n);
    });

    it('converts fractional USDC', () => {
      expect(usdcToSmallestUnit(0.5)).toBe(500_000n);
    });

    it('converts smallest unit back to USDC', () => {
      expect(smallestUnitToUsdc(1_000_000n)).toBe(1);
      expect(smallestUnitToUsdc(20_000_000n)).toBe(20);
    });

    it('roundtrips correctly', () => {
      const amount = 15.5;
      expect(smallestUnitToUsdc(usdcToSmallestUnit(amount))).toBe(amount);
    });
  });

  describe('Zod schemas', () => {
    it('validates AgentRole', () => {
      expect(agentRoleSchema.safeParse('requester').success).toBe(true);
      expect(agentRoleSchema.safeParse('provider').success).toBe(true);
      expect(agentRoleSchema.safeParse('adversarial').success).toBe(true);
      expect(agentRoleSchema.safeParse('unknown').success).toBe(false);
    });

    it('validates WalletConfig', () => {
      const valid: WalletConfig = {
        name: 'R1',
        role: 'requester',
        envKeyName: 'SEED_WALLET_R1_KEY',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        privateKey: '0xdeadbeef',
      };
      expect(walletConfigSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects invalid WalletConfig', () => {
      const invalid = {
        name: '',
        role: 'unknown',
        envKeyName: '',
        address: 'not-an-address',
        privateKey: 'not-a-key',
      };
      expect(walletConfigSchema.safeParse(invalid).success).toBe(false);
    });
  });
});

// ──────────────────────────────────────────
// Wallet Generation Tests
// ──────────────────────────────────────────

describe('wallet generation', () => {
  describe('generateWalletConfigs', () => {
    it('creates exactly 28 wallet configs', () => {
      const configs = generateWalletConfigs();
      expect(configs).toHaveLength(28);
    });

    it('assigns correct roles', () => {
      const configs = generateWalletConfigs();
      const requesters = configs.filter(c => c.role === 'requester');
      const providers = configs.filter(c => c.role === 'provider');
      const adversarial = configs.filter(c => c.role === 'adversarial');
      expect(requesters).toHaveLength(7);
      expect(providers).toHaveLength(17);
      expect(adversarial).toHaveLength(4);
    });

    it('uses correct naming convention', () => {
      const configs = generateWalletConfigs();
      const names = configs.map(c => c.name);
      // Check all requester names
      for (let i = 1; i <= 7; i++) {
        expect(names).toContain(`R${i}`);
      }
      // Check all provider names
      for (let i = 1; i <= 17; i++) {
        expect(names).toContain(`S${i}`);
      }
      // Check all adversarial names
      for (let i = 1; i <= 4; i++) {
        expect(names).toContain(`X${i}`);
      }
    });

    it('generates correct env key names', () => {
      const configs = generateWalletConfigs();
      const r1 = configs.find(c => c.name === 'R1');
      expect(r1?.envKeyName).toBe('SEED_WALLET_R1_KEY');
      const s17 = configs.find(c => c.name === 'S17');
      expect(s17?.envKeyName).toBe('SEED_WALLET_S17_KEY');
      const x4 = configs.find(c => c.name === 'X4');
      expect(x4?.envKeyName).toBe('SEED_WALLET_X4_KEY');
    });

    it('has no duplicate names', () => {
      const configs = generateWalletConfigs();
      const names = configs.map(c => c.name);
      expect(new Set(names).size).toBe(28);
    });

    it('has no duplicate env key names', () => {
      const configs = generateWalletConfigs();
      const keys = configs.map(c => c.envKeyName);
      expect(new Set(keys).size).toBe(28);
    });
  });

  describe('generateWallet', () => {
    it('generates a valid private key', () => {
      const { privateKey } = generateWallet();
      expect(privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it('generates a valid address', () => {
      const { address } = generateWallet();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('generates unique keys each time', () => {
      const w1 = generateWallet();
      const w2 = generateWallet();
      expect(w1.privateKey).not.toBe(w2.privateKey);
      expect(w1.address).not.toBe(w2.address);
    });
  });
});

// ──────────────────────────────────────────
// Wallet Loading & Persistence Tests
// ──────────────────────────────────────────

describe('wallet persistence', () => {
  let tmpDir: string;
  let envPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-test-'));
    envPath = path.join(tmpDir, '.env.local');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadWalletsFromEnv', () => {
    it('loads existing wallet keys from .env.local', () => {
      const { privateKey, address } = generateWallet();
      fs.writeFileSync(envPath, `SEED_WALLET_R1_KEY=${privateKey}\n`);
      const wallets = loadWalletsFromEnv(envPath);
      expect(wallets).toHaveLength(1);
      expect(wallets[0].name).toBe('R1');
      expect(wallets[0].role).toBe('requester');
      expect(wallets[0].privateKey).toBe(privateKey);
      expect(wallets[0].address).toBe(address);
    });

    it('handles missing keys gracefully', () => {
      fs.writeFileSync(envPath, 'UNRELATED_KEY=value\n');
      const wallets = loadWalletsFromEnv(envPath);
      expect(wallets).toHaveLength(0);
    });

    it('loads partial wallets', () => {
      const w1 = generateWallet();
      const w2 = generateWallet();
      fs.writeFileSync(
        envPath,
        `SEED_WALLET_R1_KEY=${w1.privateKey}\nSEED_WALLET_S5_KEY=${w2.privateKey}\n`,
      );
      const wallets = loadWalletsFromEnv(envPath);
      expect(wallets).toHaveLength(2);
      expect(wallets.map(w => w.name).sort()).toEqual(['R1', 'S5']);
    });

    it('returns empty array when file does not exist', () => {
      const wallets = loadWalletsFromEnv('/nonexistent/.env.local');
      expect(wallets).toHaveLength(0);
    });
  });

  describe('getOrCreateWallets', () => {
    it('creates all 28 wallets when none exist', () => {
      const wallets = getOrCreateWallets(envPath);
      expect(wallets).toHaveLength(28);
      // Verify env file was written
      const content = fs.readFileSync(envPath, 'utf-8');
      expect(content).toContain('SEED_WALLET_R1_KEY=');
      expect(content).toContain('SEED_WALLET_X4_KEY=');
    });

    it('does not regenerate existing wallets (idempotent)', () => {
      const firstRun = getOrCreateWallets(envPath);
      const secondRun = getOrCreateWallets(envPath);
      // Same wallets returned
      expect(secondRun).toHaveLength(28);
      for (const wallet of firstRun) {
        const match = secondRun.find(w => w.name === wallet.name);
        expect(match).toBeDefined();
        expect(match!.privateKey).toBe(wallet.privateKey);
        expect(match!.address).toBe(wallet.address);
      }
    });

    it('generates only missing wallets', () => {
      // Create partial wallets
      const existing = generateWallet();
      fs.writeFileSync(envPath, `SEED_WALLET_R1_KEY=${existing.privateKey}\n`);

      const wallets = getOrCreateWallets(envPath);
      expect(wallets).toHaveLength(28);

      // R1 should keep its original key
      const r1 = wallets.find(w => w.name === 'R1');
      expect(r1!.privateKey).toBe(existing.privateKey);

      // Other wallets should have been generated
      const r2 = wallets.find(w => w.name === 'R2');
      expect(r2!.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it('all generated wallets pass schema validation', () => {
      const wallets = getOrCreateWallets(envPath);
      for (const wallet of wallets) {
        const result = walletConfigSchema.safeParse(wallet);
        expect(result.success).toBe(true);
      }
    });
  });
});
