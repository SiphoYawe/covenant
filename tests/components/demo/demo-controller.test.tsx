// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ---

const mockTriggerAct = vi.fn().mockResolvedValue({});
const mockReset = vi.fn().mockResolvedValue(undefined);
let mockDemoState = { currentAct: 0, status: 'idle' as const };

vi.mock('@/hooks/use-demo', () => ({
  useDemo: () => ({
    triggerAct: mockTriggerAct,
    reset: mockReset,
    demoState: mockDemoState,
    isResetting: false,
    resetError: null,
    currentAct: 'Idle',
    isRunning: mockDemoState.status === 'running',
    isIdle: mockDemoState.status === 'idle',
  }),
}));

vi.mock('@/stores/dashboard', () => ({
  useDemoState: () => mockDemoState,
  useDashboardStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ demoState: mockDemoState }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: (state: unknown) => unknown) => fn,
}));

describe('DemoController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDemoState = { currentAct: 0, status: 'idle' };
  });

  it('renders 5 act buttons with correct labels', async () => {
    const { DemoController } = await import('@/components/demo/demo-controller');
    render(<DemoController />);

    expect(screen.getByText('Act 1: Registration')).toBeDefined();
    expect(screen.getByText('Act 2: Economy Works')).toBeDefined();
    expect(screen.getByText('Act 3: Villain')).toBeDefined();
    expect(screen.getByText('Act 4: Consequences')).toBeDefined();
    expect(screen.getByText('Act 5: Payoff')).toBeDefined();
  });

  it('shows pending status for all acts when idle', async () => {
    const { DemoController } = await import('@/components/demo/demo-controller');
    render(<DemoController />);

    const pendingBadges = screen.getAllByText('Pending');
    expect(pendingBadges.length).toBe(5);
  });

  it('clicking an act button calls triggerAct', async () => {
    const { DemoController } = await import('@/components/demo/demo-controller');
    render(<DemoController />);

    const button = screen.getByText('Act 1: Registration').closest('button')!;
    fireEvent.click(button);

    expect(mockTriggerAct).toHaveBeenCalledWith(1);
  });

  it('shows complete status for finished acts', async () => {
    mockDemoState = { currentAct: 2, status: 'idle' };
    const { DemoController } = await import('@/components/demo/demo-controller');
    render(<DemoController />);

    const completeBadges = screen.getAllByText('Complete');
    expect(completeBadges.length).toBe(2); // Acts 1 and 2
  });

  it('renders auto-play toggle', async () => {
    const { DemoController } = await import('@/components/demo/demo-controller');
    render(<DemoController />);

    expect(screen.getByText('Auto-Play')).toBeDefined();
  });

  it('renders delay slider', async () => {
    const { DemoController } = await import('@/components/demo/demo-controller');
    render(<DemoController />);

    const slider = document.querySelector('input[type="range"]');
    expect(slider).toBeDefined();
  });
});
