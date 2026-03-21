import { chromium, type Browser, type Page } from 'playwright';

const CIRCLE_FAUCET_URL = 'https://faucet.circle.com/';
const CLAIM_TIMEOUT_MS = 30_000;

export interface FaucetResult {
  success: boolean;
  error?: string;
  txHash?: string;
}

/**
 * Claim USDC from Circle faucet for a given wallet address on Base Sepolia.
 * Uses Playwright to automate the browser interaction.
 *
 * Rate limit: Circle faucet allows ~1 claim per address per 24 hours.
 * The script detects rate limit responses and returns a structured error.
 */
export async function claimUsdcFromFaucet(walletAddress: string): Promise<FaucetResult> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(CIRCLE_FAUCET_URL, { waitUntil: 'networkidle' });

    // Select Base Sepolia network if network selector is present
    await selectNetwork(page);

    // Select USDC token
    await selectToken(page);

    // Enter wallet address
    const addressInput = page.locator('input[placeholder*="address"], input[name*="address"], input[type="text"]').first();
    await addressInput.waitFor({ state: 'visible', timeout: 10_000 });
    await addressInput.fill(walletAddress);

    // Submit the claim
    const submitButton = page.locator('button[type="submit"], button:has-text("Get Tokens"), button:has-text("Send")').first();
    await submitButton.waitFor({ state: 'visible', timeout: 5_000 });
    await submitButton.click();

    // Wait for result
    const result = await waitForResult(page);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Detect rate limiting
    if (message.includes('already claimed') || message.includes('rate limit') || message.includes('too many')) {
      return { success: false, error: `Rate limited: ${message}` };
    }

    return { success: false, error: message };
  } finally {
    if (browser) await browser.close();
  }
}

async function selectNetwork(page: Page): Promise<void> {
  try {
    // Look for network selector dropdown
    const networkSelector = page.locator(
      'select:has(option:text("Base")), [data-testid="network-select"], button:has-text("Network")',
    ).first();

    const exists = await networkSelector.isVisible().catch(() => false);
    if (!exists) return;

    // Try dropdown select
    const isSelect = await networkSelector.evaluate(el => el.tagName === 'SELECT').catch(() => false);
    if (isSelect) {
      await networkSelector.selectOption({ label: 'Base Sepolia' });
    } else {
      // Click-based selector
      await networkSelector.click();
      const option = page.locator('text=Base Sepolia, [data-value*="base-sepolia"]').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }
  } catch {
    // Network might be pre-selected or selector not found. Continue.
  }
}

async function selectToken(page: Page): Promise<void> {
  try {
    const tokenSelector = page.locator(
      'select:has(option:text("USDC")), [data-testid="token-select"], button:has-text("Token")',
    ).first();

    const exists = await tokenSelector.isVisible().catch(() => false);
    if (!exists) return;

    const isSelect = await tokenSelector.evaluate(el => el.tagName === 'SELECT').catch(() => false);
    if (isSelect) {
      await tokenSelector.selectOption({ label: 'USDC' });
    } else {
      await tokenSelector.click();
      const option = page.locator('text=USDC').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }
  } catch {
    // Token might be pre-selected. Continue.
  }
}

async function waitForResult(page: Page): Promise<FaucetResult> {
  try {
    // Wait for success or error indicators
    const result = await Promise.race([
      page.locator('text=Transaction sent, text=Successfully, text=Tokens sent').first()
        .waitFor({ state: 'visible', timeout: CLAIM_TIMEOUT_MS })
        .then(() => 'success' as const),
      page.locator('text=already claimed, text=rate limit, text=Too many, text=Please wait').first()
        .waitFor({ state: 'visible', timeout: CLAIM_TIMEOUT_MS })
        .then(() => 'rate-limited' as const),
      page.locator('text=Error, text=Failed, text=Something went wrong').first()
        .waitFor({ state: 'visible', timeout: CLAIM_TIMEOUT_MS })
        .then(() => 'error' as const),
    ]);

    if (result === 'success') {
      // Try to extract tx hash from the page
      const txHash = await extractTxHash(page);
      return { success: true, txHash };
    }

    if (result === 'rate-limited') {
      return { success: false, error: 'Rate limited: already claimed for this address' };
    }

    return { success: false, error: 'Faucet returned an error' };
  } catch {
    return { success: false, error: 'Timeout waiting for faucet response' };
  }
}

async function extractTxHash(page: Page): Promise<string | undefined> {
  try {
    // Look for transaction hash link or text
    const hashLink = page.locator('a[href*="basescan"], a[href*="blockscout"]').first();
    if (await hashLink.isVisible().catch(() => false)) {
      const href = await hashLink.getAttribute('href');
      if (href) {
        const match = href.match(/0x[a-fA-F0-9]{64}/);
        return match?.[0];
      }
    }

    // Look for hash in text content
    const pageText = await page.textContent('body');
    if (pageText) {
      const match = pageText.match(/0x[a-fA-F0-9]{64}/);
      return match?.[0];
    }
  } catch {
    // No tx hash found
  }
  return undefined;
}
