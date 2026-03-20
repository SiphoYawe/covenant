import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CivicLayer } from '@/lib/civic/types';
import type { InspectionResult } from '@/lib/civic/types';

// Mock identity inspector
const mockInspectIdentity = vi.fn();
vi.mock('@/lib/civic/identity-inspector', () => ({
  inspectIdentityMetadata: mockInspectIdentity,
}));

// Mock event bus
const mockEmit = vi.fn().mockResolvedValue({ id: 'evt-1', timestamp: Date.now() });
vi.mock('@/lib/events', () => ({
  createEventBus: () => ({ emit: mockEmit, since: vi.fn() }),
  Protocol: { Civic: 'civic' },
  EVENT_TYPES: { CIVIC_IDENTITY_CHECKED: 'civic:identity-checked' },
}));

// Mock env
vi.mock('@/lib/config/env', () => ({
  env: {
    CIVIC_MCP_ENDPOINT: 'https://app.civic.com/hub/mcp?profile=covenant',
    CIVIC_TOKEN: 'test-civic-token',
  },
}));

function makeInspectionResult(overrides?: Partial<InspectionResult>): InspectionResult {
  return {
    passed: true,
    layer: CivicLayer.Identity,
    agentId: 'agent-a',
    warnings: [],
    flags: [],
    verificationStatus: 'verified',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('CivicGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates identity inspection to identity-inspector', async () => {
    const expected = makeInspectionResult();
    mockInspectIdentity.mockResolvedValue(expected);

    const { CivicGateway } = await import('@/lib/civic/gateway');
    const gateway = new CivicGateway({
      endpoint: 'https://app.civic.com/hub/mcp',
      token: 'test-token',
      timeout: 10000,
    });

    const metadata = { name: 'Test', description: 'Test', capabilities: ['test'] };
    const result = await gateway.inspectIdentity('agent-a', metadata);

    expect(mockInspectIdentity).toHaveBeenCalledWith('agent-a', metadata);
    expect(result.result.passed).toBe(true);
    expect(result.result.verificationStatus).toBe('verified');
  });

  it('returns unverified result when Civic endpoint unavailable', async () => {
    mockInspectIdentity.mockRejectedValue(new Error('Connection refused'));

    const { CivicGateway } = await import('@/lib/civic/gateway');
    const gateway = new CivicGateway({
      endpoint: 'https://app.civic.com/hub/mcp',
      token: 'test-token',
      timeout: 10000,
    });

    const metadata = { name: 'Test', description: 'Test', capabilities: ['test'] };
    const result = await gateway.inspectIdentity('agent-a', metadata);

    expect(result.result.passed).toBe(true);
    expect(result.result.verificationStatus).toBe('unverified');
    expect(result.result.warnings).toContain('Civic MCP unavailable — proceeding unverified');
  });

  it('emits civic:identity-checked event after inspection', async () => {
    mockInspectIdentity.mockResolvedValue(makeInspectionResult());

    const { CivicGateway } = await import('@/lib/civic/gateway');
    const gateway = new CivicGateway({
      endpoint: 'https://app.civic.com/hub/mcp',
      token: 'test-token',
      timeout: 10000,
    });

    const metadata = { name: 'Test', description: 'Test', capabilities: ['test'] };
    await gateway.inspectIdentity('agent-a', metadata);

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'civic:identity-checked',
        protocol: 'civic',
        agentId: 'agent-a',
      }),
    );
  });

  it('emits event even on graceful degradation', async () => {
    mockInspectIdentity.mockRejectedValue(new Error('Timeout'));

    const { CivicGateway } = await import('@/lib/civic/gateway');
    const gateway = new CivicGateway({
      endpoint: 'https://app.civic.com/hub/mcp',
      token: 'test-token',
      timeout: 10000,
    });

    const metadata = { name: 'Test', description: 'Test', capabilities: ['test'] };
    await gateway.inspectIdentity('agent-a', metadata);

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'civic:identity-checked',
        agentId: 'agent-a',
        data: expect.objectContaining({
          verificationStatus: 'unverified',
        }),
      }),
    );
  });

  it('inspectBehavior returns stub result for Story 4.2', async () => {
    const { CivicGateway } = await import('@/lib/civic/gateway');
    const gateway = new CivicGateway({
      endpoint: 'https://app.civic.com/hub/mcp',
      token: 'test-token',
      timeout: 10000,
    });

    const result = await gateway.inspectBehavior('agent-a', {}, 'outbound');

    expect(result.result.passed).toBe(true);
    expect(result.result.layer).toBe(CivicLayer.Behavioral);
    expect(result.result.verificationStatus).toBe('unverified');
  });

  it('validateToolCall returns stub result for Story 4.3', async () => {
    const { CivicGateway } = await import('@/lib/civic/gateway');
    const gateway = new CivicGateway({
      endpoint: 'https://app.civic.com/hub/mcp',
      token: 'test-token',
      timeout: 10000,
    });

    const result = await gateway.validateToolCall('agent-a', 'some_tool', ['some_tool']);

    expect(result.result.passed).toBe(true);
    expect(result.result.verificationStatus).toBe('unverified');
  });
});
