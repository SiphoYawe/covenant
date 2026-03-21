import fs from 'fs';
import path from 'path';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  USDC_CONTRACT_ADDRESS,
  ERC20_ABI,
  REQUESTER_BUDGETS,
  FAUCET_AMOUNT_USDC,
  MIN_PROVIDER_BALANCE_USDC,
  WALLET_NAMES,
  ALL_WALLET_NAMES,
  usdcToSmallestUnit,
  smallestUnitToUsdc,
  type AgentRole,
  type WalletConfig,
  type FundingStatus,
  type SeedState,
  type ConsolidationTransfer,
  seedStateSchema,
} from './types';
import { claimUsdcFromFaucet } from './faucet-playwright';

const DEFAULT_STATE_PATH = path.join(process.cwd(), 'seed', 'state.json');

// ──────────────────────────────────────────
// State Management
// ──────────────────────────────────────────

export function loadState(statePath: string = DEFAULT_STATE_PATH): SeedState | null {
  if (!fs.existsSync(statePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const result = seedStateSchema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveState(state: SeedState, statePath: string = DEFAULT_STATE_PATH): void {
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// ──────────────────────────────────────────
// Funding Status Helpers
// ──────────────────────────────────────────

export function createDefaultFundingStatus(walletName: string): FundingStatus {
  return {
    walletName,
    ethFunded: false,
    usdcFunded: false,
    usdcBalance: '0',
    ethBalance: '0',
    lastAttempt: 0,
  };
}

export function shouldSkipFunding(status: FundingStatus): boolean {
  return status.ethFunded && status.usdcFunded;
}

// ──────────────────────────────────────────
// Consolidation Math (Pure Function)
// ──────────────────────────────────────────

/**
 * Calculate USDC transfers from provider wallets to requester wallets.
 * Each provider can donate up to (faucetAmount - minBalance).
 * Adversarial wallets are never touched.
 * Returns a deterministic list of transfers.
 */
export function calculateConsolidationTransfers(
  faucetAmountUsdc: number = FAUCET_AMOUNT_USDC,
  requesterBudgets: Record<string, number> = REQUESTER_BUDGETS,
  minProviderBalance: number = MIN_PROVIDER_BALANCE_USDC,
): ConsolidationTransfer[] {
  const maxDonation = faucetAmountUsdc - minProviderBalance;
  const transfers: ConsolidationTransfer[] = [];

  // Calculate additional USDC needed per requester (sorted by need descending)
  const needs = Object.entries(requesterBudgets)
    .map(([name, budget]) => ({ name, needed: budget - faucetAmountUsdc }))
    .filter(n => n.needed > 0)
    .sort((a, b) => b.needed - a.needed);

  // Track available donation capacity per provider
  const providerCapacity = new Map<string, number>();
  for (const name of WALLET_NAMES.providers) {
    providerCapacity.set(name, maxDonation);
  }

  // Assign transfers: for each requester, draw from providers sequentially
  const providerOrder = [...WALLET_NAMES.providers];
  let providerIdx = 0;

  for (const { name: requester, needed } of needs) {
    let remaining = needed;

    while (remaining > 0 && providerIdx < providerOrder.length) {
      const provider = providerOrder[providerIdx];
      const available = providerCapacity.get(provider) || 0;

      if (available <= 0) {
        providerIdx++;
        continue;
      }

      const transfer = Math.min(remaining, available);
      transfers.push({ from: provider, to: requester, amount: transfer });
      providerCapacity.set(provider, available - transfer);
      remaining -= transfer;

      if (providerCapacity.get(provider)! <= 0) {
        providerIdx++;
      }
    }
  }

  return transfers;
}

// ──────────────────────────────────────────
// Chain Operations
// ──────────────────────────────────────────

function getPublicClient(rpcUrl?: string) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl || process.env.BASE_SEPOLIA_RPC_URL),
  });
}

function getWalletClient(privateKey: string, rpcUrl?: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl || process.env.BASE_SEPOLIA_RPC_URL),
  });
}

/**
 * Fund a wallet with ETH from Base Sepolia faucets via HTTP requests.
 */
export async function fundEth(walletAddress: string): Promise<{ success: boolean; error?: string }> {
  // Base Sepolia faucets to try in order
  const faucets = [
    {
      name: 'Alchemy',
      url: 'https://faucet.sepolia.base.org',
    },
  ];

  for (const faucet of faucets) {
    try {
      const response = await fetch(faucet.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress }),
      });

      if (response.ok) {
        console.log(`  ETH funded via ${faucet.name} for ${walletAddress}`);
        return { success: true };
      }
    } catch (err) {
      console.log(`  ${faucet.name} faucet failed: ${err}`);
    }
  }

  return { success: false, error: 'All ETH faucets failed' };
}

/**
 * Fund a wallet with USDC via Playwright automation of Circle faucet.
 */
export async function fundUsdc(walletAddress: string): Promise<{ success: boolean; error?: string; txHash?: string }> {
  return claimUsdcFromFaucet(walletAddress);
}

/**
 * Fund all wallets with ETH and USDC. Tracks progress in state.
 * Skips already-funded wallets. Handles rate limits gracefully.
 */
export async function fundAllWallets(
  wallets: WalletConfig[],
  statePath: string = DEFAULT_STATE_PATH,
): Promise<SeedState> {
  let state = loadState(statePath) || {
    wallets,
    fundingStatuses: wallets.map(w => createDefaultFundingStatus(w.name)),
    consolidationComplete: false,
    lastRun: Date.now(),
  };

  for (const wallet of wallets) {
    const statusIdx = state.fundingStatuses.findIndex(s => s.walletName === wallet.name);
    let status = statusIdx >= 0
      ? state.fundingStatuses[statusIdx]
      : createDefaultFundingStatus(wallet.name);

    if (shouldSkipFunding(status)) {
      console.log(`Skipping ${wallet.name} (already funded)`);
      continue;
    }

    console.log(`Funding ${wallet.name} (${wallet.role})...`);
    status.lastAttempt = Date.now();

    // Fund ETH
    if (!status.ethFunded) {
      const ethResult = await fundEth(wallet.address);
      if (ethResult.success) {
        status.ethFunded = true;
      } else {
        status.error = ethResult.error;
        console.log(`  ETH funding failed for ${wallet.name}: ${ethResult.error}`);
      }
    }

    // Fund USDC
    if (!status.usdcFunded) {
      const usdcResult = await fundUsdc(wallet.address);
      if (usdcResult.success) {
        status.usdcFunded = true;
        status.usdcBalance = usdcToSmallestUnit(FAUCET_AMOUNT_USDC).toString();
      } else {
        status.error = usdcResult.error;
        console.log(`  USDC funding failed for ${wallet.name}: ${usdcResult.error}`);
      }
    }

    // Update state
    if (statusIdx >= 0) {
      state.fundingStatuses[statusIdx] = status;
    } else {
      state.fundingStatuses.push(status);
    }

    state.lastRun = Date.now();
    saveState(state, statePath);
  }

  return state;
}

/**
 * Execute USDC consolidation transfers on-chain.
 * Transfers USDC from provider wallets to requester wallets
 * so requesters have sufficient budgets.
 */
export async function consolidateUsdc(
  wallets: WalletConfig[],
  statePath: string = DEFAULT_STATE_PATH,
  rpcUrl?: string,
): Promise<void> {
  const transfers = calculateConsolidationTransfers();
  const walletMap = new Map(wallets.map(w => [w.name, w]));

  console.log(`\nConsolidation: ${transfers.length} transfers to execute\n`);

  for (const transfer of transfers) {
    const fromWallet = walletMap.get(transfer.from);
    const toWallet = walletMap.get(transfer.to);
    if (!fromWallet || !toWallet) {
      console.log(`Skipping transfer: wallet not found (${transfer.from} -> ${transfer.to})`);
      continue;
    }

    const amount = usdcToSmallestUnit(transfer.amount);
    console.log(`  ${transfer.from} -> ${transfer.to}: ${transfer.amount} USDC`);

    try {
      const client = getWalletClient(fromWallet.privateKey, rpcUrl);
      const hash = await client.writeContract({
        address: USDC_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [toWallet.address as `0x${string}`, amount],
      });
      console.log(`    tx: ${hash}`);
    } catch (err) {
      console.log(`    FAILED: ${err}`);
    }
  }

  // Update state
  const state = loadState(statePath);
  if (state) {
    state.consolidationComplete = true;
    state.lastRun = Date.now();
    saveState(state, statePath);
  }
}

// ──────────────────────────────────────────
// Verification
// ──────────────────────────────────────────

export interface BalanceEntry {
  name: string;
  role: AgentRole;
  ethBalance: string;
  usdcBalance: string;
  funded: boolean;
}

/**
 * Query ETH and USDC balances for all wallets and return structured data.
 */
export async function verifyBalances(
  wallets: WalletConfig[],
  rpcUrl?: string,
): Promise<BalanceEntry[]> {
  const client = getPublicClient(rpcUrl);
  const entries: BalanceEntry[] = [];

  for (const wallet of wallets) {
    const ethBalanceWei = await client.getBalance({
      address: wallet.address as `0x${string}`,
    });

    const usdcBalanceRaw = await client.readContract({
      address: USDC_CONTRACT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [wallet.address as `0x${string}`],
    }) as bigint;

    const ethBalance = formatEther(ethBalanceWei);
    const usdcBalance = smallestUnitToUsdc(usdcBalanceRaw).toFixed(2);
    const funded = ethBalanceWei > BigInt(0) && usdcBalanceRaw > BigInt(0);

    entries.push({
      name: wallet.name,
      role: wallet.role,
      ethBalance,
      usdcBalance,
      funded,
    });
  }

  return entries;
}

/**
 * Format balance data into a human-readable report table.
 */
export function formatBalanceReport(balances: BalanceEntry[]): string {
  const header = '| Wallet | Role        | ETH       | USDC      | Funded |';
  const separator = '|--------|-------------|-----------|-----------|--------|';
  const rows = balances.map(b => {
    const name = b.name.padEnd(6);
    const role = b.role.padEnd(11);
    const eth = b.ethBalance.substring(0, 9).padEnd(9);
    const usdc = b.usdcBalance.substring(0, 9).padEnd(9);
    const funded = b.funded ? 'Yes' : 'No ';
    return `| ${name} | ${role} | ${eth} | ${usdc} | ${funded}    |`;
  });

  return [
    '',
    'Seed Wallet Balance Report',
    '=' .repeat(62),
    header,
    separator,
    ...rows,
    separator,
    `Total wallets: ${balances.length}`,
    `Funded: ${balances.filter(b => b.funded).length}/${balances.length}`,
    '',
  ].join('\n');
}

/**
 * Run full verification: query balances and print report.
 */
export async function runVerification(
  wallets: WalletConfig[],
  rpcUrl?: string,
): Promise<BalanceEntry[]> {
  console.log('\nVerifying wallet balances...\n');
  const balances = await verifyBalances(wallets, rpcUrl);
  console.log(formatBalanceReport(balances));
  return balances;
}
