// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockDemoState = { currentAct: 0, status: 'idle' as const };

vi.mock('@/stores/dashboard', () => ({
  useDemoState: () => mockDemoState,
  useDashboardStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ demoState: mockDemoState }),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: (state: unknown) => unknown) => fn,
}));

describe('ActIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDemoState = { currentAct: 0, status: 'idle' };
  });

  it('renders 5 segments with act numbers', async () => {
    const { ActIndicator } = await import('@/components/demo/act-indicator');
    render(<ActIndicator />);

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeDefined();
    }
  });

  it('shows "Ready to begin" when idle', async () => {
    const { ActIndicator } = await import('@/components/demo/act-indicator');
    render(<ActIndicator />);

    expect(screen.getByText('Ready to begin')).toBeDefined();
  });

  it('shows "All 5 acts complete" on completion', async () => {
    mockDemoState = { currentAct: 5, status: 'complete' };
    const { ActIndicator } = await import('@/components/demo/act-indicator');
    render(<ActIndicator />);

    expect(screen.getByText('All 5 acts complete')).toBeDefined();
  });

  it('shows current act label when running', async () => {
    mockDemoState = { currentAct: 2, status: 'running' };
    const { ActIndicator } = await import('@/components/demo/act-indicator');
    render(<ActIndicator />);

    expect(screen.getByText(/Act 2: Economy Works/)).toBeDefined();
  });
});
