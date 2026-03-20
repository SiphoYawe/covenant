import { describe, it, expect, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';

const TEST_KEYS = {
  AGENT_A_PRIVATE_KEY: '0x' + '01'.repeat(32),
  AGENT_B_PRIVATE_KEY: '0x' + '02'.repeat(32),
  AGENT_C_PRIVATE_KEY: '0x' + '03'.repeat(32),
  AGENT_D_PRIVATE_KEY: '0x' + '04'.repeat(32),
  SYSTEM_PRIVATE_KEY: '0x' + '05'.repeat(32),
  BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
} as const;

vi.mock('@/lib/config/env', () => ({
  env: {
    ...TEST_KEYS,
    ANTHROPIC_API_KEY: 'test',
    PINATA_JWT: 'test',
    UPSTASH_REDIS_REST_URL: 'https://kv.test',
    UPSTASH_REDIS_REST_TOKEN: 'test',
    CIVIC_MCP_ENDPOINT: 'https://civic.test',
    X402_FACILITATOR_URL: 'https://x402.test',
    SENTRY_DSN: 'https://sentry.test',
  },
}));

describe('Agent Config', () => {
  it('defines all 4 demo agent configs with required fields', async () => {
    const { AGENT_CONFIGS, DEMO_AGENT_ROLES } = await import('@/lib/agents/config');

    expect(DEMO_AGENT_ROLES).toHaveLength(4);

    for (const role of DEMO_AGENT_ROLES) {
      const config = AGENT_CONFIGS[role];
      expect(config.role).toBe(role);
      expect(config.name).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.capabilities.length).toBeGreaterThan(0);
      expect(config.systemPrompt).toBeTruthy();
      expect(config.walletRole).toBe(role);
    }
  });

  it('malicious agent has same capabilities as reviewer (review_code)', async () => {
    const { AGENT_CONFIGS } = await import('@/lib/agents/config');
    expect(AGENT_CONFIGS.malicious.capabilities).toContain('review_code');
    expect(AGENT_CONFIGS.reviewer.capabilities).toContain('review_code');
  });

  it('generateMetadata produces valid ERC-8004 metadata', async () => {
    const { generateMetadata } = await import('@/lib/agents/config');

    const metadata = generateMetadata('researcher');
    expect(metadata.name).toBe('Covenant Researcher');
    expect(metadata.description).toBeTruthy();
    expect(metadata.capabilities).toContain('research');
    expect(metadata.walletAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('generateMetadata returns different wallet addresses for different roles', async () => {
    const { generateMetadata } = await import('@/lib/agents/config');

    const researcher = generateMetadata('researcher');
    const reviewer = generateMetadata('reviewer');
    expect(researcher.walletAddress).not.toBe(reviewer.walletAddress);
  });

  it('malicious agent description matches reviewer to appear legitimate', async () => {
    const { AGENT_CONFIGS } = await import('@/lib/agents/config');
    expect(AGENT_CONFIGS.malicious.description).toBe(AGENT_CONFIGS.reviewer.description);
  });
});
