import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CivicLayer } from '@/lib/civic/types';
import type { AgentMetadata } from '@/lib/protocols/erc8004/types';

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

// Mock env
vi.mock('@/lib/config/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    CIVIC_MCP_ENDPOINT: 'https://app.civic.com/hub/mcp?profile=covenant',
    CIVIC_TOKEN: 'test-civic-token',
  },
}));


function makeMetadata(overrides?: Partial<AgentMetadata>): AgentMetadata {
  return {
    name: 'TestAgent',
    description: 'A legitimate test agent for code review',
    capabilities: ['review_code'],
    walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
    ...overrides,
  };
}

describe('Identity Inspector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes legitimate agent metadata (Agent A - researcher)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'No prompt injection detected. The metadata appears legitimate.' }],
      stop_reason: 'end_turn',
    });

    const { inspectIdentityMetadata } = await import('@/lib/civic/identity-inspector');
    const result = await inspectIdentityMetadata('agent-a', makeMetadata({
      name: 'Covenant Researcher',
      description: 'Discovers agents on the ERC-8004 registry',
      capabilities: ['research', 'evaluate', 'hire'],
    }));

    expect(result.passed).toBe(true);
    expect(result.layer).toBe(CivicLayer.Identity);
    expect(result.agentId).toBe('agent-a');
    expect(result.verificationStatus).toBe('verified');
    expect(result.flags).toHaveLength(0);
  });

  it('passes Agent D (looks legitimate at registration — by design)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'No prompt injection detected. Metadata is clean.' }],
      stop_reason: 'end_turn',
    });

    const { inspectIdentityMetadata } = await import('@/lib/civic/identity-inspector');
    // Agent D has same metadata structure as legitimate agents
    const result = await inspectIdentityMetadata('agent-d', makeMetadata({
      name: 'ShadowReview',
      description: 'Reviews code for quality, security vulnerabilities, and best practices.',
      capabilities: ['review_code'],
    }));

    expect(result.passed).toBe(true);
    expect(result.verificationStatus).toBe('verified');
    // Agent D passes Layer 1 — malicious behavior is only in execution
  });

  it('flags incomplete metadata (missing name)', async () => {
    const { inspectIdentityMetadata } = await import('@/lib/civic/identity-inspector');
    const result = await inspectIdentityMetadata('agent-x', makeMetadata({
      name: '',
    }));

    expect(result.passed).toBe(false);
    expect(result.verificationStatus).toBe('flagged');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('flags incomplete metadata (missing description)', async () => {
    const { inspectIdentityMetadata } = await import('@/lib/civic/identity-inspector');
    const result = await inspectIdentityMetadata('agent-x', makeMetadata({
      description: '',
    }));

    expect(result.passed).toBe(false);
    expect(result.verificationStatus).toBe('flagged');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('flags incomplete metadata (missing capabilities)', async () => {
    const { inspectIdentityMetadata } = await import('@/lib/civic/identity-inspector');
    const result = await inspectIdentityMetadata('agent-x', makeMetadata({
      capabilities: [],
    }));

    expect(result.passed).toBe(false);
    expect(result.verificationStatus).toBe('flagged');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns unverified status on Civic MCP timeout', async () => {
    mockCreate.mockRejectedValue(new Error('Connection timeout'));

    const { inspectIdentityMetadata } = await import('@/lib/civic/identity-inspector');
    const result = await inspectIdentityMetadata('agent-a', makeMetadata());

    expect(result.passed).toBe(true);
    expect(result.verificationStatus).toBe('unverified');
    expect(result.warnings).toContain('Civic MCP unavailable — proceeding unverified');
  });

  it('calls Anthropic SDK with mcp_servers config and beta header', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Clean metadata.' }],
      stop_reason: 'end_turn',
    });

    const { inspectIdentityMetadata } = await import('@/lib/civic/identity-inspector');
    await inspectIdentityMetadata('agent-a', makeMetadata());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mcp_servers: expect.arrayContaining([
          expect.objectContaining({
            type: 'url',
            url: 'https://app.civic.com/hub/mcp?profile=covenant',
            name: 'civic',
            authorization_token: 'test-civic-token',
          }),
        ]),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'anthropic-beta': 'mcp-client-2025-11-20',
        }),
      }),
    );
  });

  it('returns InspectionResult with correct timestamp', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Clean.' }],
      stop_reason: 'end_turn',
    });

    const before = Date.now();
    const { inspectIdentityMetadata } = await import('@/lib/civic/identity-inspector');
    const result = await inspectIdentityMetadata('agent-a', makeMetadata());
    const after = Date.now();

    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });
});
