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

describe('DemoStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDemoState = { currentAct: 0, status: 'idle' };
  });

  it('shows "Ready to Demo" when idle', async () => {
    const { DemoStatus } = await import('@/components/demo/demo-status');
    render(<DemoStatus />);

    expect(screen.getByText('Ready to Demo')).toBeDefined();
  });

  it('shows "Act N Running..." when running', async () => {
    mockDemoState = { currentAct: 3, status: 'running' };
    const { DemoStatus } = await import('@/components/demo/demo-status');
    render(<DemoStatus />);

    expect(screen.getByText('Act 3 Running...')).toBeDefined();
  });

  it('shows "Demo Complete!" when all acts done', async () => {
    mockDemoState = { currentAct: 5, status: 'complete' };
    const { DemoStatus } = await import('@/components/demo/demo-status');
    render(<DemoStatus />);

    expect(screen.getByText('Demo Complete!')).toBeDefined();
  });

  it('shows correct completed acts count', async () => {
    mockDemoState = { currentAct: 3, status: 'idle' };
    const { DemoStatus } = await import('@/components/demo/demo-status');
    render(<DemoStatus />);

    expect(screen.getByText('3/5 acts')).toBeDefined();
  });

  it('shows partial progress status', async () => {
    mockDemoState = { currentAct: 2, status: 'idle' };
    const { DemoStatus } = await import('@/components/demo/demo-status');
    render(<DemoStatus />);

    expect(screen.getByText('2/5 acts complete')).toBeDefined();
  });
});
