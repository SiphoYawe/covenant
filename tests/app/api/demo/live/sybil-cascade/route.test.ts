import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockExecuteSybilCascade = vi.fn();
let lockState = false;

vi.mock('@/lib/demo/live-sybil-cascade', () => ({
  executeSybilCascade: (...args: unknown[]) => mockExecuteSybilCascade(...args),
}));

vi.mock('@/lib/demo/lock', () => ({
  acquireLock: (type: string) => {
    if (type === 'sybil-cascade' && !lockState) {
      lockState = true;
      return true;
    }
    return false;
  },
  releaseLock: (type: string) => {
    if (type === 'sybil-cascade') lockState = false;
  },
}));

describe('POST /api/demo/live/sybil-cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockState = false;
  });

  it('returns 200 with cascade result on success', async () => {
    const mockResult = {
      success: true,
      ringMembers: ['seed-X2', 'seed-X3', 'seed-X4'],
      scoreDrops: {
        'seed-X2': { before: 7.5, after: 2.1 },
        'seed-X3': { before: 7.2, after: 2.3 },
        'seed-X4': { before: 6.8, after: 1.9 },
      },
      explanation: 'Circular payment ring detected',
      txHashes: {
        'seed-X2': '0xtx1',
        'seed-X3': '0xtx2',
        'seed-X4': '0xtx3',
      },
      steps: [],
      durationMs: 24000,
    };
    mockExecuteSybilCascade.mockResolvedValue(mockResult);

    const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ringMembers).toEqual(['seed-X2', 'seed-X3', 'seed-X4']);
    expect(body.scoreDrops['seed-X2'].before).toBe(7.5);
    expect(body.scoreDrops['seed-X2'].after).toBe(2.1);
    expect(body.txHashes['seed-X2']).toBe('0xtx1');
  });

  it('calls executeSybilCascade with the correct ring agents', async () => {
    mockExecuteSybilCascade.mockResolvedValue({ success: true, ringMembers: [], steps: [], durationMs: 100, scoreDrops: {}, explanation: '', txHashes: {} });

    const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
    await POST();

    expect(mockExecuteSybilCascade).toHaveBeenCalledWith({
      ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
    });
  });

  it('returns 409 when cascade is already executing', async () => {
    lockState = true;

    const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('TRIGGER_IN_PROGRESS');
    expect(body.error.message).toContain('already executing');
  });

  it('returns 500 on execution error', async () => {
    mockExecuteSybilCascade.mockRejectedValue(new Error('Graph analysis failed'));

    const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('SYBIL_CASCADE_ERROR');
    expect(body.error.message).toBe('Graph analysis failed');
  });

  it('releases lock after successful execution', async () => {
    mockExecuteSybilCascade.mockResolvedValue({ success: true, ringMembers: [], steps: [], durationMs: 100, scoreDrops: {}, explanation: '', txHashes: {} });

    const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
    await POST();

    expect(lockState).toBe(false);
  });

  it('releases lock after failed execution', async () => {
    mockExecuteSybilCascade.mockRejectedValue(new Error('Crash'));

    const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
    await POST();

    expect(lockState).toBe(false);
  });
});
