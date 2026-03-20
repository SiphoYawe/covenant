import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CivicLayer, CivicSeverity } from '@/lib/civic/types';
import type { InspectionResult, CivicFlag } from '@/lib/civic/types';

// Mock KV
const mockLpush = vi.fn().mockResolvedValue(undefined);
const mockLrange = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/storage/kv', () => ({
  kvLpush: (...args: unknown[]) => mockLpush(...args),
  kvLrange: (...args: unknown[]) => mockLrange(...args),
}));

// Mock event bus
const mockEmit = vi.fn().mockResolvedValue({ id: 'evt-1', timestamp: Date.now() });
vi.mock('@/lib/events', () => ({
  createEventBus: () => ({ emit: mockEmit, since: vi.fn() }),
  Protocol: { Civic: 'civic' },
  EVENT_TYPES: {
    CIVIC_RESOLVED: 'civic:resolved',
    CIVIC_FLAGGED: 'civic:flagged',
  },
}));

function makeFlag(overrides?: Partial<CivicFlag>): CivicFlag {
  return {
    id: 'flag-1',
    agentId: 'malicious',
    timestamp: Date.now(),
    severity: CivicSeverity.Critical,
    layer: CivicLayer.Behavioral,
    attackType: 'prompt_injection',
    evidence: 'Detected prompt injection',
    ...overrides,
  };
}

function makeInspectionResult(overrides?: Partial<InspectionResult>): InspectionResult {
  return {
    passed: false,
    layer: CivicLayer.Behavioral,
    agentId: 'malicious',
    warnings: ['Detected prompt injection'],
    flags: [makeFlag()],
    verificationStatus: 'flagged',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('Threat Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns allowed when inspection passed', async () => {
    const { handleThreat } = await import('@/lib/civic/threat-handler');
    const result = await handleThreat(
      makeInspectionResult({ passed: true, flags: [] }),
      { agentId: 'researcher' },
    );

    expect(result.action).toBe('allowed');
    expect(result.flag).toBeNull();
    expect(mockLpush).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('blocks transaction on Critical severity, stores flag, emits event', async () => {
    const { handleThreat } = await import('@/lib/civic/threat-handler');
    const result = await handleThreat(
      makeInspectionResult({ flags: [makeFlag({ severity: CivicSeverity.Critical })] }),
      { agentId: 'malicious', targetAgentId: 'researcher', transactionId: 'tx-1' },
    );

    expect(result.action).toBe('blocked');
    expect(result.flag).not.toBeNull();
    expect(result.flag!.severity).toBe(CivicSeverity.Critical);

    expect(mockLpush).toHaveBeenCalledWith(
      'agent:malicious:civic-flags',
      expect.any(String),
    );

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'civic:resolved',
        agentId: 'malicious',
        data: expect.objectContaining({ action: 'blocked', severity: CivicSeverity.Critical }),
      }),
    );
  });

  it('blocks delivery on High severity, stores flag, emits event', async () => {
    const { handleThreat } = await import('@/lib/civic/threat-handler');
    const result = await handleThreat(
      makeInspectionResult({ flags: [makeFlag({ severity: CivicSeverity.High })] }),
      { agentId: 'malicious' },
    );

    expect(result.action).toBe('blocked');
    expect(mockLpush).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'blocked' }),
      }),
    );
  });

  it('allows but flags on Medium severity', async () => {
    const { handleThreat } = await import('@/lib/civic/threat-handler');
    const result = await handleThreat(
      makeInspectionResult({ flags: [makeFlag({ severity: CivicSeverity.Medium })] }),
      { agentId: 'malicious' },
    );

    expect(result.action).toBe('flagged');
    expect(mockLpush).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'flagged' }),
      }),
    );
  });

  it('allows and logs on Low severity', async () => {
    const { handleThreat } = await import('@/lib/civic/threat-handler');
    const result = await handleThreat(
      makeInspectionResult({ flags: [makeFlag({ severity: CivicSeverity.Low })] }),
      { agentId: 'malicious' },
    );

    expect(result.action).toBe('allowed');
    expect(mockLpush).toHaveBeenCalled();
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'allowed' }),
      }),
    );
  });

  it('attaches transactionId to flag when provided', async () => {
    const { handleThreat } = await import('@/lib/civic/threat-handler');
    const result = await handleThreat(
      makeInspectionResult(),
      { agentId: 'malicious', transactionId: 'tx-abc' },
    );

    expect(result.flag!.transactionId).toBe('tx-abc');
  });

  it('stores flag with correct shape in KV', async () => {
    const { handleThreat } = await import('@/lib/civic/threat-handler');
    await handleThreat(
      makeInspectionResult(),
      { agentId: 'malicious', transactionId: 'tx-123' },
    );

    const stored = JSON.parse(mockLpush.mock.calls[0][1]);
    expect(stored).toMatchObject({
      agentId: 'malicious',
      severity: CivicSeverity.Critical,
      layer: CivicLayer.Behavioral,
      attackType: 'prompt_injection',
      transactionId: 'tx-123',
    });
  });

  it('getFlags returns all stored flags for an agent', async () => {
    const flag1 = makeFlag({ id: 'f1', timestamp: 1000 });
    const flag2 = makeFlag({ id: 'f2', timestamp: 2000 });
    mockLrange.mockResolvedValue([JSON.stringify(flag1), JSON.stringify(flag2)]);

    const { getFlags } = await import('@/lib/civic/threat-handler');
    const flags = await getFlags('malicious');

    expect(flags).toHaveLength(2);
    expect(flags[0].id).toBe('f1');
    expect(flags[1].id).toBe('f2');
    expect(mockLrange).toHaveBeenCalledWith('agent:malicious:civic-flags', 0, -1);
  });

  it('getFlagsSince filters by timestamp', async () => {
    const flag1 = makeFlag({ id: 'f1', timestamp: 1000 });
    const flag2 = makeFlag({ id: 'f2', timestamp: 2000 });
    const flag3 = makeFlag({ id: 'f3', timestamp: 3000 });
    mockLrange.mockResolvedValue([
      JSON.stringify(flag1),
      JSON.stringify(flag2),
      JSON.stringify(flag3),
    ]);

    const { getFlagsSince } = await import('@/lib/civic/threat-handler');
    const flags = await getFlagsSince('malicious', 1500);

    expect(flags).toHaveLength(2);
    expect(flags[0].id).toBe('f2');
    expect(flags[1].id).toBe('f3');
  });

  it('civic:resolved event has correct action field', async () => {
    const { handleThreat } = await import('@/lib/civic/threat-handler');
    await handleThreat(
      makeInspectionResult({ flags: [makeFlag({ severity: CivicSeverity.Medium })] }),
      { agentId: 'malicious', transactionId: 'tx-99' },
    );

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'civic:resolved',
        data: expect.objectContaining({
          action: 'flagged',
          transactionId: 'tx-99',
          attackType: 'prompt_injection',
        }),
      }),
    );
  });
});
