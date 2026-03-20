import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Validation', () => {
  const VALID_ENV = {
    ANTHROPIC_API_KEY: 'sk-ant-test-key',
    AGENT_A_PRIVATE_KEY: '0xaaaa',
    AGENT_B_PRIVATE_KEY: '0xbbbb',
    AGENT_C_PRIVATE_KEY: '0xcccc',
    AGENT_D_PRIVATE_KEY: '0xdddd',
    SYSTEM_PRIVATE_KEY: '0xeeee',
    BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
    PINATA_JWT: 'eyJtest',
    KV_REST_API_URL: 'https://kv.vercel.com',
    KV_REST_API_TOKEN: 'token123',
    CIVIC_MCP_ENDPOINT: 'https://civic.example.com',
    CIVIC_TOKEN: 'civic-test-token',
    X402_FACILITATOR_URL: 'https://x402.example.com',
    SENTRY_DSN: 'https://sentry.example.com/123',
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validates successfully with all required env vars', async () => {
    Object.assign(process.env, VALID_ENV);
    const { envSchema } = await import('@/lib/config/env');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(true);
  });

  it('fails when ANTHROPIC_API_KEY is missing', async () => {
    const partial = { ...VALID_ENV };
    delete (partial as Record<string, string | undefined>).ANTHROPIC_API_KEY;
    Object.assign(process.env, partial);
    delete process.env.ANTHROPIC_API_KEY;
    const { envSchema } = await import('@/lib/config/env');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });

  it('fails when BASE_SEPOLIA_RPC_URL is not a valid URL', async () => {
    Object.assign(process.env, { ...VALID_ENV, BASE_SEPOLIA_RPC_URL: 'not-a-url' });
    const { envSchema } = await import('@/lib/config/env');
    const result = envSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });
});
