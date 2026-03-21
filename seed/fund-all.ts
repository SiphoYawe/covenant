#!/usr/bin/env bun
/**
 * Covenant Seed Funding Automation
 *
 * Funds all 33 wallets (5 core + 28 seed) with ETH (gas) and USDC.
 * Uses Playwright with persistent browser context for CAPTCHA handling.
 * Multi-source, idempotent, tracks progress in seed/funding-state.json.
 *
 * Usage:
 *   bun seed/fund-all.ts                    # Fund all wallets (USDC + ETH)
 *   bun seed/fund-all.ts --check            # Just check balances
 *   bun seed/fund-all.ts --consolidate      # Only run USDC consolidation
 *   bun seed/fund-all.ts --extra 5          # Generate 5 extra temp wallets for bonus USDC
 *   bun seed/fund-all.ts --usdc-only        # Skip ETH, only fund USDC
 *   bun seed/fund-all.ts --eth-only         # Skip USDC, only fund ETH
 *   bun seed/fund-all.ts --batch 8          # Process 8 wallets per Playwright session (default: all)
 *   bun seed/fund-all.ts --addresses        # Print all wallet addresses (for manual faucet use)
 */

import fs from 'fs';
import path from 'path';
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  USDC_CONTRACT_ADDRESS,
  ERC20_ABI,
  usdcToSmallestUnit,
  smallestUnitToUsdc,
  REQUESTER_BUDGETS,
  WALLET_NAMES,
} from './types';

// ──────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const STATE_PATH = path.join(process.cwd(), 'seed', 'funding-state.json');
const ENV_PATH = path.join(process.cwd(), '.env.local');
const COOKIE_DIR = path.join(process.cwd(), 'seed', '.browser-data');

const MIN_ETH_BALANCE = 0.0001; // Base Sepolia L2 gas is very cheap
const MIN_USDC_BALANCE = 1;
const DELAY_BETWEEN_TRANSFERS_MS = 1500;

// Randomized delays to appear human
function humanDelay(): number {
  return 4000 + Math.random() * 6000; // 4-10 seconds
}

// Core agent env key mapping
const CORE_AGENT_KEYS: Record<string, string> = {
  'CORE-researcher': 'AGENT_A_PRIVATE_KEY',
  'CORE-reviewer': 'AGENT_B_PRIVATE_KEY',
  'CORE-summarizer': 'AGENT_C_PRIVATE_KEY',
  'CORE-malicious': 'AGENT_D_PRIVATE_KEY',
  'CORE-system': 'SYSTEM_PRIVATE_KEY',
};

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

interface WalletEntry {
  name: string;
  address: string;
  privateKey: string;
  isTemp: boolean;
}

interface FundingState {
  wallets: Record<string, {
    address: string;
    ethFunded: boolean;
    usdcFunded: boolean;
    ethBalance: string;
    usdcBalance: string;
    lastAttempt: number;
    errors: string[];
  }>;
  tempWallets: Array<{ privateKey: string; address: string }>;
  lastRun: number;
}

// ──────────────────────────────────────────
// Clients
// ──────────────────────────────────────────

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

function getWalletClient(privateKey: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });
}

// ──────────────────────────────────────────
// State Management
// ──────────────────────────────────────────

function loadState(): FundingState {
  if (fs.existsSync(STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    } catch { /* corrupted state, start fresh */ }
  }
  return { wallets: {}, tempWallets: [], lastRun: 0 };
}

function saveState(state: FundingState): void {
  state.lastRun = Date.now();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function updateWalletState(state: FundingState, name: string, address: string, update: Partial<FundingState['wallets'][string]>): void {
  if (!state.wallets[name]) {
    state.wallets[name] = {
      address,
      ethFunded: false,
      usdcFunded: false,
      ethBalance: '0',
      usdcBalance: '0',
      lastAttempt: Date.now(),
      errors: [],
      ...update,
    };
  } else {
    Object.assign(state.wallets[name], update, { lastAttempt: Date.now() });
  }
}

// ──────────────────────────────────────────
// Wallet Loading
// ──────────────────────────────────────────

function loadAllWallets(): WalletEntry[] {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('ERROR: .env.local not found.');
    process.exit(1);
  }

  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  const wallets: WalletEntry[] = [];

  // Load 5 core agent wallets
  for (const [name, envKey] of Object.entries(CORE_AGENT_KEYS)) {
    const regex = new RegExp(`^${envKey}=(.+)$`, 'm');
    const match = envContent.match(regex);
    if (match) {
      const privateKey = match[1].trim();
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      wallets.push({ name, address: account.address, privateKey, isTemp: false });
    } else {
      console.warn(`  Warning: ${envKey} not found in .env.local`);
    }
  }

  // Load 28 seed wallets
  const seedNames = [
    ...WALLET_NAMES.requesters,
    ...WALLET_NAMES.providers,
    ...WALLET_NAMES.adversarial,
  ];

  for (const seedName of seedNames) {
    const envKey = `SEED_WALLET_${seedName}_KEY`;
    const regex = new RegExp(`^${envKey}=(.+)$`, 'm');
    const match = envContent.match(regex);
    if (match) {
      const privateKey = match[1].trim();
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      wallets.push({ name: `SEED-${seedName}`, address: account.address, privateKey, isTemp: false });
    }
  }

  return wallets;
}

function generateTempWallets(count: number, state: FundingState): WalletEntry[] {
  const temps: WalletEntry[] = [];
  for (let i = 0; i < count; i++) {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    temps.push({
      name: `TEMP-${i + 1}`,
      address: account.address,
      privateKey,
      isTemp: true,
    });
    state.tempWallets.push({ privateKey, address: account.address });
  }
  saveState(state);
  return temps;
}

// ──────────────────────────────────────────
// Balance Checking
// ──────────────────────────────────────────

async function getBalances(address: string): Promise<{ eth: number; usdc: number }> {
  try {
    const [ethBal, usdcBal] = await Promise.all([
      publicClient.getBalance({ address: address as `0x${string}` }),
      publicClient.readContract({
        address: USDC_CONTRACT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      }) as Promise<bigint>,
    ]);
    return {
      eth: parseFloat(formatEther(ethBal)),
      usdc: smallestUnitToUsdc(usdcBal),
    };
  } catch {
    return { eth: 0, usdc: 0 };
  }
}

async function checkAllBalances(wallets: WalletEntry[]): Promise<void> {
  console.log('\n  Checking balances for all wallets...\n');

  const header = '  | Name                  | Address      | ETH          | USDC      | Status   |';
  const sep    = '  |-----------------------|--------------|--------------|-----------|----------|';
  console.log(header);
  console.log(sep);

  let totalEth = 0;
  let totalUsdc = 0;
  let funded = 0;

  for (const wallet of wallets) {
    const { eth, usdc } = await getBalances(wallet.address);
    totalEth += eth;
    totalUsdc += usdc;
    const isFunded = eth >= MIN_ETH_BALANCE && usdc >= MIN_USDC_BALANCE;
    if (isFunded) funded++;

    const shortAddr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
    const name = wallet.name.padEnd(21);
    const ethStr = eth.toFixed(6).padEnd(12);
    const usdcStr = usdc.toFixed(2).padEnd(9);
    const status = isFunded ? 'OK' : 'NEEDS $';
    console.log(`  | ${name} | ${shortAddr} | ${ethStr} | ${usdcStr} | ${status.padEnd(8)} |`);
  }

  console.log(sep);
  console.log(`  | TOTALS                |              | ${totalEth.toFixed(6).padEnd(12)} | ${totalUsdc.toFixed(2).padEnd(9)} | ${funded}/${wallets.length}    |`);
  console.log(sep);
  console.log('');
}

function printAddresses(wallets: WalletEntry[]): void {
  console.log('\n  All wallet addresses (copy-paste for manual faucet claims):\n');
  for (const w of wallets) {
    console.log(`  ${w.name.padEnd(22)} ${w.address}`);
  }
  console.log('');
}

// ──────────────────────────────────────────
// Playwright USDC Faucet (persistent context, CAPTCHA-aware)
// ──────────────────────────────────────────

async function claimUsdcPlaywright(
  wallets: WalletEntry[],
  state: FundingState,
): Promise<void> {
  console.log('\n  Phase 1: USDC Funding via Circle Faucet (Playwright)\n');

  // Check which wallets actually need USDC
  const needsUsdc: WalletEntry[] = [];
  for (const w of wallets) {
    const { usdc } = await getBalances(w.address);
    if (usdc >= MIN_USDC_BALANCE) {
      console.log(`  [SKIP] ${w.name} already has ${usdc.toFixed(2)} USDC`);
      updateWalletState(state, w.name, w.address, { usdcFunded: true, usdcBalance: usdc.toFixed(2) });
      continue;
    }
    needsUsdc.push(w);
  }

  if (needsUsdc.length === 0) {
    console.log('  All wallets already have USDC!\n');
    return;
  }

  console.log(`\n  ${needsUsdc.length} wallets need USDC. Opening browser...\n`);
  console.log('  ============================================================');
  console.log('  INSTRUCTIONS:');
  console.log('  - Browser will open visibly. DO NOT close it.');
  console.log('  - If a CAPTCHA appears, solve it manually in the browser.');
  console.log('  - The script will wait up to 120s for you to solve it.');
  console.log('  - After solving, the script continues automatically.');
  console.log('  - Rate limited wallets are skipped and can be retried later.');
  console.log('  ============================================================\n');

  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    console.error('  Playwright not installed. Run: bunx playwright install chromium');
    console.log('  Falling back to printing addresses for manual claiming.\n');
    printAddresses(needsUsdc);
    return;
  }

  // Use persistent context to preserve cookies/sessions across runs
  if (!fs.existsSync(COOKIE_DIR)) fs.mkdirSync(COOKIE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(COOKIE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Europe/London',
    // Reduce bot detection
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
  });

  // Intercept and log API responses to verify actual drip
  let lastDripResponse: { status: number; body: string } | null = null;

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < needsUsdc.length; i++) {
    const w = needsUsdc[i];
    console.log(`  [${i + 1}/${needsUsdc.length}] ${w.name} (${w.address.slice(0, 10)}...)`);

    try {
      const page = await context.newPage();

      // Listen for API responses to verify actual drip
      lastDripResponse = null;
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/') && (url.includes('drip') || url.includes('request'))) {
          try {
            const body = await response.text();
            lastDripResponse = { status: response.status(), body };
          } catch { /* ignore */ }
        }
      });

      await page.goto('https://faucet.circle.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000 + Math.random() * 2000);

      // Dismiss cookie banner if present
      await dismissCookieBanner(page);
      await page.waitForTimeout(500);

      // Select network: Base Sepolia via the Coinbase dropdown
      await selectNetwork(page, 'Base Sepolia');
      await page.waitForTimeout(800 + Math.random() * 1000);

      // USDC is selected by default (radio button, checked). Ensure it.
      await ensureUsdcSelected(page);
      await page.waitForTimeout(500 + Math.random() * 500);

      // Fill wallet address
      const input = page.locator('input[data-testid="input"][name="address"], input[placeholder="Wallet address"]').first();
      await input.waitFor({ state: 'visible', timeout: 5000 });
      await input.click();
      await input.fill('');
      await page.waitForTimeout(300);
      await input.type(w.address, { delay: 30 + Math.random() * 50 });
      await page.waitForTimeout(500 + Math.random() * 1000);

      // Click "Send 20 USDC" submit button
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
      // Wait for button to become enabled (it may be disabled until form is valid)
      await page.waitForFunction(() => {
        const btn = document.querySelector('button[type="submit"]');
        return btn && !btn.hasAttribute('disabled');
      }, { timeout: 10000 }).catch(() => {});
      await submitBtn.click();

      // Wait for CAPTCHA or result (up to 120 seconds for human to solve CAPTCHA)
      const result = await waitForFaucetResult(page, 120_000);

      if (result === 'success') {
        // Verify the drip actually happened by checking the API response
        if (lastDripResponse && lastDripResponse.status >= 400) {
          console.log(`    WARNING: UI said success but API returned ${lastDripResponse.status}: ${lastDripResponse.body.slice(0, 100)}`);
          failCount++;
        } else {
          successCount++;
          console.log(`    OK: USDC claimed`);
          updateWalletState(state, w.name, w.address, { usdcFunded: true, usdcBalance: '20' });
        }
      } else if (result === 'rate-limited') {
        skipCount++;
        console.log(`    RATE LIMITED: Try again in ~2 hours`);
        updateWalletState(state, w.name, w.address, { errors: ['Rate limited'] });
      } else {
        failCount++;
        console.log(`    FAILED: ${result}`);
        updateWalletState(state, w.name, w.address, { errors: [result] });
      }

      saveState(state);
      await page.close();

      // Human-like delay between claims
      if (i < needsUsdc.length - 1) {
        const delay = humanDelay();
        console.log(`    Waiting ${(delay / 1000).toFixed(1)}s before next claim...`);
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (err) {
      failCount++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    ERROR: ${msg.slice(0, 200)}`);
      updateWalletState(state, w.name, w.address, { errors: [msg] });
      saveState(state);
    }
  }

  await context.close();

  console.log(`\n  USDC Results: ${successCount} succeeded, ${skipCount} rate-limited, ${failCount} failed\n`);

  // Verify actual balances after claiming
  if (successCount > 0) {
    console.log('  Verifying actual on-chain balances...\n');
    for (const w of needsUsdc) {
      const { usdc } = await getBalances(w.address);
      if (usdc >= MIN_USDC_BALANCE) {
        updateWalletState(state, w.name, w.address, { usdcFunded: true, usdcBalance: usdc.toFixed(2) });
      } else {
        // API may have returned 200 but drip didn't happen
        updateWalletState(state, w.name, w.address, { usdcFunded: false, usdcBalance: usdc.toFixed(2) });
      }
    }
    saveState(state);
  }
}

// Playwright helpers

async function dismissCookieBanner(page: any): Promise<void> {
  // Try common cookie consent button patterns
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'button:has-text("Accept Cookies")',
    'button:has-text("Accept cookies")',
    'button:has-text("Allow")',
    'button:has-text("Allow All")',
    'button:has-text("Allow all")',
    'button:has-text("Agree")',
    'button:has-text("Got it")',
    'button:has-text("OK")',
    'button:has-text("I agree")',
    'button:has-text("Consent")',
    '[data-testid="cookie-accept"]',
    '[id*="cookie"] button',
    '[class*="cookie"] button',
    '[id*="consent"] button',
    '[class*="consent"] button',
    '[id*="banner"] button:has-text("Accept")',
    '.cc-accept',
    '.cc-allow',
    '#onetrust-accept-btn-handler',
    '.otCookieAcceptButton',
  ];

  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        console.log('    Cookie banner dismissed.');
        await page.waitForTimeout(500);
        return;
      }
    } catch { /* try next selector */ }
  }
}

/**
 * Select network from Circle faucet's Coinbase dropdown.
 * The dropdown uses data-testid="network-dropdown" with a downshift toggle button.
 * Options are li[role="option"] with span.select-label[title="Base Sepolia"].
 */
async function selectNetwork(page: any, network: string): Promise<void> {
  try {
    // Check if the desired network is already selected
    const currentLabel = page.locator('[data-testid="network-dropdown"] span.select-label').first();
    if (await currentLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      const currentText = await currentLabel.textContent();
      if (currentText?.trim() === network) {
        console.log(`    Network already set to ${network}`);
        return;
      }
    }

    // Click the dropdown toggle button to open
    const toggleBtn = page.locator('[data-testid="network-dropdown"] button.field-button, [data-testid="network-dropdown"] button[aria-haspopup="listbox"]').first();
    await toggleBtn.waitFor({ state: 'visible', timeout: 5000 });
    await toggleBtn.click();
    await page.waitForTimeout(800);

    // Click the target option by its title attribute
    const option = page.locator(`li[role="option"] span.select-label[title="${network}"]`).first();
    if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
      await option.click();
      console.log(`    Network selected: ${network}`);
      return;
    }

    // Fallback: try clicking by text content
    const optionByText = page.locator(`li[role="option"]:has-text("${network}")`).first();
    if (await optionByText.isVisible({ timeout: 2000 }).catch(() => false)) {
      await optionByText.click();
      console.log(`    Network selected (by text): ${network}`);
      return;
    }

    console.log(`    WARNING: Could not find "${network}" in dropdown. Available options:`);
    const allOptions = page.locator('li[role="option"] span.select-label');
    const count = await allOptions.count();
    for (let i = 0; i < count; i++) {
      const text = await allOptions.nth(i).textContent();
      console.log(`      - ${text}`);
    }
  } catch (err) {
    console.log(`    WARNING: Network selection failed: ${err}`);
  }
}

/**
 * Ensure USDC is selected (it's the default radio, but verify).
 * Uses data-testid="select-card-USDC".
 */
async function ensureUsdcSelected(page: any): Promise<void> {
  try {
    const usdcCard = page.locator('[data-testid="select-card-USDC"]').first();
    if (await usdcCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if already selected (has "selected" class)
      const classes = await usdcCard.getAttribute('class') || '';
      if (!classes.includes('selected')) {
        await usdcCard.click();
        console.log('    USDC selected');
      }
    }
  } catch {
    // USDC is default, likely already selected
  }
}

async function waitForFaucetResult(page: any, timeoutMs: number): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const bodyText = await page.textContent('body').catch(() => '') || '';
    const lower = bodyText.toLowerCase();

    // Check for success indicators
    if (
      lower.includes('transaction sent') ||
      lower.includes('tokens sent') ||
      lower.includes('successfully') ||
      lower.includes('drip successful') ||
      lower.includes('check your wallet')
    ) {
      return 'success';
    }

    // Check for rate limiting
    if (
      lower.includes('already claimed') ||
      lower.includes('rate limit') ||
      lower.includes('too many requests') ||
      lower.includes('please wait') ||
      lower.includes('come back later') ||
      lower.includes('exceeded') ||
      lower.includes('try again later') ||
      lower.includes('limit reached')
    ) {
      return 'rate-limited';
    }

    // Check for errors (but not CAPTCHA-related)
    if (
      (lower.includes('error') || lower.includes('failed')) &&
      !lower.includes('captcha') &&
      !lower.includes('verify')
    ) {
      // Wait a bit more in case it's a transient error
      await page.waitForTimeout(2000);
      const retryText = (await page.textContent('body').catch(() => '') || '').toLowerCase();
      if (retryText.includes('error') || retryText.includes('failed')) {
        return 'error';
      }
    }

    // If CAPTCHA is visible, print a prompt and keep waiting
    const hasCaptcha = await page.locator('iframe[src*="captcha"], iframe[src*="turnstile"], iframe[src*="recaptcha"], [data-captcha], .cf-turnstile').first()
      .isVisible({ timeout: 500 }).catch(() => false);

    if (hasCaptcha) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed % 10 === 0) { // Print every ~10 seconds
        console.log(`    CAPTCHA detected. Please solve it in the browser. (${elapsed}s elapsed, ${Math.floor((timeoutMs - (Date.now() - startTime)) / 1000)}s remaining)`);
      }
    }

    await page.waitForTimeout(1000);
  }

  return 'timeout (120s)';
}

// ──────────────────────────────────────────
// ETH Funding (multi-source, Playwright fallback)
// ──────────────────────────────────────────

async function fundEthForAll(
  wallets: WalletEntry[],
  state: FundingState,
): Promise<void> {
  console.log('\n  Phase 2: ETH Funding (gas)\n');

  const needsEth: WalletEntry[] = [];
  for (const w of wallets) {
    const { eth } = await getBalances(w.address);
    if (eth >= MIN_ETH_BALANCE) {
      console.log(`  [SKIP] ${w.name} already has ${eth.toFixed(6)} ETH`);
      updateWalletState(state, w.name, w.address, { ethFunded: true, ethBalance: eth.toFixed(6) });
    } else {
      needsEth.push(w);
    }
  }

  if (needsEth.length === 0) {
    console.log('  All wallets already have ETH!\n');
    return;
  }

  console.log(`\n  ${needsEth.length} wallets need ETH for gas.\n`);

  // Strategy 1: Try API-based faucets first
  console.log('  Trying API-based ETH faucets...\n');
  const stillNeedsEth: WalletEntry[] = [];

  for (const w of needsEth) {
    const success = await tryEthFaucetApis(w.address);
    if (success) {
      console.log(`  [OK] ${w.name}: ETH claimed via API`);
      updateWalletState(state, w.name, w.address, { ethFunded: true });
    } else {
      stillNeedsEth.push(w);
    }
    saveState(state);
  }

  // Strategy 2: Distribute from system wallet if it has ETH
  if (stillNeedsEth.length > 0) {
    console.log(`\n  ${stillNeedsEth.length} wallets still need ETH. Checking system wallet...\n`);
    await distributeEthFromSystem(wallets, stillNeedsEth);
  }

  // Strategy 3: Print addresses for manual faucet use
  const finalNeedsEth: WalletEntry[] = [];
  for (const w of needsEth) {
    const { eth } = await getBalances(w.address);
    if (eth < MIN_ETH_BALANCE) finalNeedsEth.push(w);
    else updateWalletState(state, w.name, w.address, { ethFunded: true, ethBalance: eth.toFixed(6) });
  }

  if (finalNeedsEth.length > 0) {
    console.log(`\n  ${finalNeedsEth.length} wallets still need ETH. Use these faucets manually:`);
    console.log('    - https://app.optimism.io/faucet (Superchain, 0.05 ETH)');
    console.log('    - https://www.alchemy.com/faucets/base-sepolia');
    console.log('    - https://faucet.quicknode.com/base/sepolia');
    console.log('    - https://portal.cdp.coinbase.com (CDP, needs account)\n');
    console.log('  Addresses needing ETH:');
    for (const w of finalNeedsEth) {
      console.log(`    ${w.name.padEnd(22)} ${w.address}`);
    }
    console.log('');
  }
  saveState(state);
}

async function tryEthFaucetApis(address: string): Promise<boolean> {
  const faucets = [
    {
      name: 'Base Sepolia Official',
      url: 'https://faucet.sepolia.base.org',
      body: { address },
    },
  ];

  for (const faucet of faucets) {
    try {
      const res = await fetch(faucet.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        body: JSON.stringify(faucet.body),
      });
      // Verify the response actually indicates success
      if (res.ok) {
        const text = await res.text();
        // If response is empty or JSON with a tx hash, it worked
        if (!text || text.includes('tx') || text.includes('hash') || text.includes('success')) {
          return true;
        }
      }
    } catch { /* try next */ }
  }
  return false;
}

async function distributeEthFromSystem(allWallets: WalletEntry[], needsEth: WalletEntry[]): Promise<void> {
  const systemWallet = allWallets.find(w => w.name === 'CORE-system');
  if (!systemWallet) {
    console.log('  No system wallet found.');
    return;
  }

  const { eth: systemEth } = await getBalances(systemWallet.address);
  if (systemEth < 0.01) {
    console.log(`  System wallet has ${systemEth.toFixed(6)} ETH. Not enough to distribute.`);
    console.log('  Fund the system wallet first, then re-run with --eth-only\n');
    return;
  }

  const availableEth = systemEth - 0.005; // Keep reserve
  const perWallet = Math.min(availableEth / needsEth.length, 0.005);

  if (perWallet < 0.0001) {
    console.log('  Not enough ETH to distribute meaningfully.');
    return;
  }

  console.log(`  Distributing ${perWallet.toFixed(6)} ETH each to ${needsEth.length} wallets\n`);

  const client = getWalletClient(systemWallet.privateKey);
  for (const w of needsEth) {
    try {
      const hash = await client.sendTransaction({
        to: w.address as `0x${string}`,
        value: parseEther(perWallet.toFixed(18)),
      });
      console.log(`    ${w.name}: ${hash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    ${w.name}: FAILED (${msg.slice(0, 100)})`);
    }
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_TRANSFERS_MS));
  }
}

// ──────────────────────────────────────────
// Consolidation
// ──────────────────────────────────────────

async function consolidateUsdc(wallets: WalletEntry[], state: FundingState): Promise<void> {
  console.log('\n  Phase 3: USDC Consolidation\n');

  const donors: Array<{ wallet: WalletEntry; available: number }> = [];
  const recipients: Array<{ wallet: WalletEntry; needed: number }> = [];

  for (const w of wallets) {
    const { usdc } = await getBalances(w.address);

    if (w.isTemp && usdc > 0) {
      donors.push({ wallet: w, available: usdc });
      continue;
    }

    if (w.name.startsWith('SEED-S') && usdc > 5) {
      donors.push({ wallet: w, available: usdc - 5 });
      continue;
    }

    if (w.name.startsWith('SEED-R')) {
      const rName = w.name.replace('SEED-', '');
      const budget = REQUESTER_BUDGETS[rName] || 0;
      if (usdc < budget) {
        recipients.push({ wallet: w, needed: budget - usdc });
      }
    }
  }

  if (recipients.length === 0) {
    console.log('  No requester wallets need additional USDC.\n');
    return;
  }

  if (donors.length === 0) {
    console.log('  No donor wallets have surplus USDC.\n');
    return;
  }

  const totalAvailable = donors.reduce((sum, d) => sum + d.available, 0);
  const totalNeeded = recipients.reduce((sum, r) => sum + r.needed, 0);
  console.log(`  Donors: ${donors.length} wallets, ${totalAvailable.toFixed(2)} USDC available`);
  console.log(`  Recipients: ${recipients.length} wallets need ${totalNeeded.toFixed(2)} USDC\n`);

  recipients.sort((a, b) => b.needed - a.needed);

  let donorIdx = 0;
  let donorRemaining = donors[donorIdx]?.available || 0;

  for (const recipient of recipients) {
    let remaining = recipient.needed;

    while (remaining > 0.5 && donorIdx < donors.length) {
      const donor = donors[donorIdx];
      const transferAmount = Math.min(remaining, donorRemaining);

      if (transferAmount < 0.5) {
        donorIdx++;
        donorRemaining = donors[donorIdx]?.available || 0;
        continue;
      }

      const amountBigInt = usdcToSmallestUnit(Math.floor(transferAmount));
      console.log(`  ${donor.wallet.name} -> ${recipient.wallet.name}: ${transferAmount.toFixed(2)} USDC`);

      try {
        const client = getWalletClient(donor.wallet.privateKey);
        const hash = await client.writeContract({
          address: USDC_CONTRACT_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipient.wallet.address as `0x${string}`, amountBigInt],
        });
        console.log(`    tx: ${hash}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`    FAILED: ${msg.slice(0, 100)}`);
        donorIdx++;
        donorRemaining = donors[donorIdx]?.available || 0;
        continue;
      }

      donorRemaining -= transferAmount;
      remaining -= transferAmount;

      if (donorRemaining < 0.5) {
        donorIdx++;
        donorRemaining = donors[donorIdx]?.available || 0;
      }

      await new Promise(r => setTimeout(r, DELAY_BETWEEN_TRANSFERS_MS));
    }
  }

  console.log('\n  Consolidation complete.\n');
}

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const consolidateOnly = args.includes('--consolidate');
  const usdcOnly = args.includes('--usdc-only');
  const ethOnly = args.includes('--eth-only');
  const addressesOnly = args.includes('--addresses');
  const extraIdx = args.indexOf('--extra');
  const extraCount = extraIdx >= 0 ? parseInt(args[extraIdx + 1] || '5', 10) : 0;

  console.log('\n========================================');
  console.log('  Covenant Wallet Funding Automation');
  console.log('========================================\n');

  const wallets = loadAllWallets();
  console.log(`  Loaded ${wallets.length} wallets from .env.local`);

  if (addressesOnly) {
    printAddresses(wallets);
    return;
  }

  const state = loadState();

  // Generate temp wallets if requested
  let tempWallets: WalletEntry[] = [];
  if (extraCount > 0 && !checkOnly && !consolidateOnly) {
    console.log(`  Generating ${extraCount} temporary wallets for extra USDC claims...`);
    tempWallets = generateTempWallets(extraCount, state);
  }

  const allWallets = [...wallets, ...tempWallets];

  if (checkOnly) {
    await checkAllBalances(allWallets);
    return;
  }

  if (consolidateOnly) {
    await consolidateUsdc(allWallets, state);
    await checkAllBalances(wallets);
    return;
  }

  // Full funding pipeline
  if (!ethOnly) {
    await claimUsdcPlaywright(allWallets, state);
  }

  if (!usdcOnly) {
    await fundEthForAll(allWallets, state);
  }

  if (!ethOnly) {
    await consolidateUsdc(allWallets, state);
  }

  // Final report
  await checkAllBalances(wallets);

  saveState(state);
  console.log('  Done. Re-run this script to retry failed wallets.');
  console.log('  Circle faucet cooldown is ~2 hours per address.\n');
}

main().catch(err => {
  console.error(`\nFATAL: ${err}\n`);
  process.exit(1);
});
