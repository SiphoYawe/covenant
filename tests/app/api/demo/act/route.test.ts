import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockGetDemoState = vi.fn();
const mockSetDemoState = vi.fn().mockResolvedValue(undefined);
const mockKvGet = vi.fn();
const mockKvSet = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/orchestrator', () => ({
  getDemoState: (...args: unknown[]) => mockGetDemoState(...args),
  setDemoState: (...args: unknown[]) => mockSetDemoState(...args),
  DemoAct: { Idle: 'Idle', Registration: 'Registration', EconomyWorks: 'EconomyWorks', VillainAttacks: 'VillainAttacks', Consequences: 'Consequences', Payoff: 'Payoff' },
  DemoStatus: { Idle: 'Idle', Completed: 'Completed' },
}));

vi.mock('@/lib/storage', () => ({
  kvGet: (...args: unknown[]) => mockKvGet(...args),
  kvSet: (...args: unknown[]) => mockKvSet(...args),
}));

const mockCanExecute = vi.fn();
const mockExecute = vi.fn();

vi.mock('@/lib/demo', () => ({
  getActExecutor: vi.fn(() => ({
    canExecute: (...args: unknown[]) => mockCanExecute(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
    actNumber: 1,
    name: 'Registration',
  })),
  isValidActNumber: vi.fn((n: number) => n >= 1 && n <= 5),
}));

describe('POST /api/demo/[act]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDemoState.mockResolvedValue({ act: 'Idle', status: 'Idle', startedAt: null, completedAt: null });
    mockKvGet.mockResolvedValue(null); // No cached act results
    mockCanExecute.mockReturnValue(true);
    mockExecute.mockResolvedValue({ act: 1, status: 'completed', duration: 1000, events: [], data: {} });
  });

  it('returns 400 for invalid act numbers', async () => {
    const { isValidActNumber } = await import('@/lib/demo');
    (isValidActNumber as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const { POST } = await import('@/app/api/demo/[act]/route');
    const response = await POST(
      new Request('http://localhost/api/demo/99', { method: 'POST' }),
      { params: Promise.resolve({ act: '99' }) },
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_ACT');
  });

  it('returns 400 when prerequisite not met', async () => {
    mockCanExecute.mockReturnValue(false);

    const { POST } = await import('@/app/api/demo/[act]/route');
    const response = await POST(
      new Request('http://localhost/api/demo/2', { method: 'POST' }),
      { params: Promise.resolve({ act: '2' }) },
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('PREREQUISITE_MISSING');
  });

  it('returns 200 with ActResult on success', async () => {
    const { POST } = await import('@/app/api/demo/[act]/route');
    const response = await POST(
      new Request('http://localhost/api/demo/1', { method: 'POST' }),
      { params: Promise.resolve({ act: '1' }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.act).toBe(1);
    expect(body.status).toBe('completed');
  });

  it('returns 409 when act is already running', async () => {
    mockKvGet.mockResolvedValue({
      1: { act: 1, status: 'running', duration: 0, events: [], data: {} },
    });

    const { POST } = await import('@/app/api/demo/[act]/route');
    const response = await POST(
      new Request('http://localhost/api/demo/1', { method: 'POST' }),
      { params: Promise.resolve({ act: '1' }) },
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('ACT_IN_PROGRESS');
  });

  it('returns 500 on execution error', async () => {
    mockExecute.mockRejectedValue(new Error('Execution crashed'));

    const { POST } = await import('@/app/api/demo/[act]/route');
    const response = await POST(
      new Request('http://localhost/api/demo/1', { method: 'POST' }),
      { params: Promise.resolve({ act: '1' }) },
    );
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('ACT_EXECUTION_ERROR');
  });

  it('stores act result in KV after execution', async () => {
    const { POST } = await import('@/app/api/demo/[act]/route');
    await POST(
      new Request('http://localhost/api/demo/1', { method: 'POST' }),
      { params: Promise.resolve({ act: '1' }) },
    );

    expect(mockKvSet).toHaveBeenCalledWith(
      'demo:act-results',
      expect.objectContaining({ 1: expect.any(Object) }),
    );
  });
});
