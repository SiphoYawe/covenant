import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  REQUESTER_BUDGETS,
  FAUCET_AMOUNT_USDC,
  MIN_PROVIDER_BALANCE_USDC,
  WALLET_NAMES,
  type FundingStatus,
  type SeedState,
  seedStateSchema,
} from '../../seed/types';
import {
  calculateConsolidationTransfers,
  loadState,
  saveState,
  createDefaultFundingStatus,
  formatBalanceReport,
  shouldSkipFunding,
} from '../../seed/funding';

// ──────────────────────────────────────────
// Consolidation Math Tests
// ──────────────────────────────────────────

describe('calculateConsolidationTransfers', () => {
  it('returns an array of transfers', () => {
    const transfers = calculateConsolidationTransfers();
    expect(Array.isArray(transfers)).toBe(true);
    expect(transfers.length).toBeGreaterThan(0);
  });

  it('calculates correct total transfers per requester', () => {
    const transfers = calculateConsolidationTransfers();
    const totals = new Map<string, number>();
    for (const t of transfers) {
      totals.set(t.to, (totals.get(t.to) || 0) + t.amount);
    }
    // Each requester starts with FAUCET_AMOUNT_USDC (20) and needs to reach budget
    expect(totals.get('R1')).toBe(REQUESTER_BUDGETS.R1 - FAUCET_AMOUNT_USDC); // 80
    expect(totals.get('R2')).toBe(REQUESTER_BUDGETS.R2 - FAUCET_AMOUNT_USDC); // 60
    expect(totals.get('R3')).toBe(REQUESTER_BUDGETS.R3 - FAUCET_AMOUNT_USDC); // 40
    expect(totals.get('R4')).toBe(REQUESTER_BUDGETS.R4 - FAUCET_AMOUNT_USDC); // 30
    expect(totals.get('R5')).toBe(REQUESTER_BUDGETS.R5 - FAUCET_AMOUNT_USDC); // 10
    expect(totals.get('R6')).toBe(REQUESTER_BUDGETS.R6 - FAUCET_AMOUNT_USDC); // 5
    expect(totals.get('R7')).toBe(REQUESTER_BUDGETS.R7 - FAUCET_AMOUNT_USDC); // 20
  });

  it('total transferred equals 245 USDC', () => {
    const transfers = calculateConsolidationTransfers();
    const total = transfers.reduce((sum, t) => sum + t.amount, 0);
    expect(total).toBe(245);
  });

  it('only transfers from provider wallets, never adversarial', () => {
    const transfers = calculateConsolidationTransfers();
    for (const t of transfers) {
      expect(t.from).toMatch(/^S\d+$/);
    }
    const fromAdversarial = transfers.filter(t => t.from.startsWith('X'));
    expect(fromAdversarial).toHaveLength(0);
  });

  it('never takes more than (faucet - min balance) from any provider', () => {
    const transfers = calculateConsolidationTransfers();
    const maxDonation = FAUCET_AMOUNT_USDC - MIN_PROVIDER_BALANCE_USDC;
    const providerDonations = new Map<string, number>();
    for (const t of transfers) {
      providerDonations.set(t.from, (providerDonations.get(t.from) || 0) + t.amount);
    }
    for (const [provider, donated] of providerDonations) {
      expect(donated).toBeLessThanOrEqual(maxDonation);
      expect(donated).toBeGreaterThan(0);
    }
  });

  it('only transfers to requester wallets', () => {
    const transfers = calculateConsolidationTransfers();
    for (const t of transfers) {
      expect(t.to).toMatch(/^R\d+$/);
    }
  });

  it('all transfer amounts are positive', () => {
    const transfers = calculateConsolidationTransfers();
    for (const t of transfers) {
      expect(t.amount).toBeGreaterThan(0);
    }
  });
});

// ──────────────────────────────────────────
// State Management Tests
// ──────────────────────────────────────────

describe('state management', () => {
  let tmpDir: string;
  let statePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-state-'));
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadState', () => {
    it('returns null when file does not exist', () => {
      const state = loadState(path.join(tmpDir, 'nonexistent.json'));
      expect(state).toBeNull();
    });

    it('loads valid state from file', () => {
      const state: SeedState = {
        wallets: [],
        fundingStatuses: [],
        consolidationComplete: false,
        lastRun: Date.now(),
      };
      fs.writeFileSync(statePath, JSON.stringify(state));
      const loaded = loadState(statePath);
      expect(loaded).not.toBeNull();
      expect(loaded!.consolidationComplete).toBe(false);
    });

    it('returns null for invalid JSON', () => {
      fs.writeFileSync(statePath, 'not valid json');
      const state = loadState(statePath);
      expect(state).toBeNull();
    });
  });

  describe('saveState', () => {
    it('writes state to file', () => {
      const state: SeedState = {
        wallets: [],
        fundingStatuses: [],
        consolidationComplete: false,
        lastRun: Date.now(),
      };
      saveState(state, statePath);
      expect(fs.existsSync(statePath)).toBe(true);
      const loaded = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      expect(loaded.consolidationComplete).toBe(false);
    });

    it('saved state passes schema validation', () => {
      const state: SeedState = {
        wallets: [{
          name: 'R1',
          role: 'requester',
          envKeyName: 'SEED_WALLET_R1_KEY',
          address: '0x1234567890abcdef1234567890abcdef12345678',
          privateKey: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        }],
        fundingStatuses: [{
          walletName: 'R1',
          ethFunded: true,
          usdcFunded: false,
          usdcBalance: '0',
          ethBalance: '1000000000000000000',
          lastAttempt: Date.now(),
        }],
        consolidationComplete: false,
        lastRun: Date.now(),
      };
      saveState(state, statePath);
      const loaded = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      const result = seedStateSchema.safeParse(loaded);
      expect(result.success).toBe(true);
    });
  });
});

// ──────────────────────────────────────────
// Funding Status Tests
// ──────────────────────────────────────────

describe('funding status', () => {
  describe('createDefaultFundingStatus', () => {
    it('creates unfunded status for a wallet', () => {
      const status = createDefaultFundingStatus('R1');
      expect(status.walletName).toBe('R1');
      expect(status.ethFunded).toBe(false);
      expect(status.usdcFunded).toBe(false);
      expect(status.usdcBalance).toBe('0');
      expect(status.ethBalance).toBe('0');
      expect(status.lastAttempt).toBe(0);
      expect(status.error).toBeUndefined();
    });
  });

  describe('shouldSkipFunding', () => {
    it('skips wallet with both ETH and USDC funded', () => {
      const status: FundingStatus = {
        walletName: 'R1',
        ethFunded: true,
        usdcFunded: true,
        usdcBalance: '20000000',
        ethBalance: '1000000000000000000',
        lastAttempt: Date.now(),
      };
      expect(shouldSkipFunding(status)).toBe(true);
    });

    it('does not skip wallet needing ETH', () => {
      const status: FundingStatus = {
        walletName: 'R1',
        ethFunded: false,
        usdcFunded: true,
        usdcBalance: '20000000',
        ethBalance: '0',
        lastAttempt: Date.now(),
      };
      expect(shouldSkipFunding(status)).toBe(false);
    });

    it('does not skip wallet needing USDC', () => {
      const status: FundingStatus = {
        walletName: 'R1',
        ethFunded: true,
        usdcFunded: false,
        usdcBalance: '0',
        ethBalance: '1000000000000000000',
        lastAttempt: Date.now(),
      };
      expect(shouldSkipFunding(status)).toBe(false);
    });
  });
});

// ──────────────────────────────────────────
// Verification Report Tests
// ──────────────────────────────────────────

describe('verification report', () => {
  describe('formatBalanceReport', () => {
    it('formats a report with wallet balances', () => {
      const balances = [
        { name: 'R1', role: 'requester' as const, ethBalance: '0.1', usdcBalance: '100.0', funded: true },
        { name: 'S1', role: 'provider' as const, ethBalance: '0.05', usdcBalance: '5.0', funded: true },
        { name: 'X1', role: 'adversarial' as const, ethBalance: '0.0', usdcBalance: '0.0', funded: false },
      ];
      const report = formatBalanceReport(balances);
      expect(report).toContain('R1');
      expect(report).toContain('S1');
      expect(report).toContain('X1');
      expect(report).toContain('requester');
      expect(report).toContain('provider');
      expect(report).toContain('adversarial');
    });

    it('includes all wallets in the report', () => {
      const balances = Array.from({ length: 28 }, (_, i) => ({
        name: `W${i}`,
        role: 'provider' as const,
        ethBalance: '0.1',
        usdcBalance: '20.0',
        funded: true,
      }));
      const report = formatBalanceReport(balances);
      for (let i = 0; i < 28; i++) {
        expect(report).toContain(`W${i}`);
      }
    });
  });
});
