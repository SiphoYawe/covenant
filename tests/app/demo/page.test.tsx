// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ---

const mockReset = vi.fn().mockResolvedValue(undefined);
const mockTriggerAct = vi.fn().mockResolvedValue({});

vi.mock('@/hooks/use-demo', () => ({
  useDemo: () => ({
    reset: mockReset,
    triggerAct: mockTriggerAct,
    isResetting: false,
    resetError: null,
    demoState: { currentAct: 0, status: 'idle' },
    currentAct: 'Idle',
    isRunning: false,
    isIdle: true,
  }),
}));

vi.mock('@/stores/dashboard', () => ({
  useDemoState: () => ({ currentAct: 0, status: 'idle' }),
  useDashboardStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ demoState: { currentAct: 0, status: 'idle' } }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: (state: unknown) => unknown) => fn,
}));

describe('Demo Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all three main components', async () => {
    const DemoPage = (await import('@/app/demo/page')).default;
    render(<DemoPage />);

    // Header
    expect(screen.getByText('Covenant Demo Operator')).toBeDefined();

    // DemoController renders act buttons
    expect(screen.getByText('Act 1: Registration')).toBeDefined();

    // DemoStatus renders status
    expect(screen.getByText('Ready to Demo')).toBeDefined();

    // ActIndicator renders numbers
    expect(screen.getByText('Ready to begin')).toBeDefined();
  });

  it('renders reset button', async () => {
    const DemoPage = (await import('@/app/demo/page')).default;
    render(<DemoPage />);

    expect(screen.getByText('Reset Demo')).toBeDefined();
  });

  it('reset button requires double-click confirmation', async () => {
    const DemoPage = (await import('@/app/demo/page')).default;
    render(<DemoPage />);

    const resetBtn = screen.getByText('Reset Demo');

    // First click arms it
    fireEvent.click(resetBtn);
    expect(screen.getByText('Confirm Reset?')).toBeDefined();
    expect(mockReset).not.toHaveBeenCalled();

    // Second click confirms
    fireEvent.click(screen.getByText('Confirm Reset?'));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
