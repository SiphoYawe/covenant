// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ---

const mockReset = vi.fn().mockResolvedValue(undefined);
const mockExecute = vi.fn().mockResolvedValue(undefined);
const mockTriggerReset = vi.fn();

vi.mock('@/hooks/use-demo', () => ({
  useDemo: () => ({
    reset: mockReset,
    isResetting: false,
    resetError: null,
  }),
  useLiveTrigger: () => ({
    execute: mockExecute,
    isExecuting: false,
    result: null,
    error: null,
    events: [],
    reset: mockTriggerReset,
  }),
}));

const mockStore = {
  demoState: { status: 'idle' },
  events: [],
  agents: {},
  edges: [],
  metrics: { totalPayments: 0, totalTransactions: 0, averagePayment: 0, totalFeedback: 0 },
  selectedAgentId: null,
  filterBy: 'all',
  sortBy: 'score',
  currentPage: 1,
  pageSize: 12,
  protocolFilter: 'all',
  searchQuery: '',
  paymentsPage: 1,
  addEvent: vi.fn(),
  updateAgent: vi.fn(),
  addEdge: vi.fn(),
  updateMetrics: vi.fn(),
  setSelectedAgent: vi.fn(),
  setFilterBy: vi.fn(),
  setSortBy: vi.fn(),
  setCurrentPage: vi.fn(),
  setPageSize: vi.fn(),
  setProtocolFilter: vi.fn(),
  setSearchQuery: vi.fn(),
  setPaymentsPage: vi.fn(),
  resetDemo: vi.fn(),
};

const useDashboardStoreMock = Object.assign(
  (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
  { getState: () => mockStore, subscribe: vi.fn(() => vi.fn()), setState: vi.fn(), destroy: vi.fn() },
);

vi.mock('@/stores/dashboard', () => ({
  useDemoState: () => ({ status: 'idle' }),
  useEvents: () => [],
  useAgents: () => ({}),
  useMetrics: () => ({ totalPayments: 0, totalTransactions: 0, averagePayment: 0, totalFeedback: 0 }),
  useDashboardStore: useDashboardStoreMock,
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: (state: unknown) => unknown) => fn,
}));

vi.mock('@/components/dashboard/seed-data-provider', () => ({
  SeedDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/layout/app-layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Demo Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and trigger cards', async () => {
    const DemoPage = (await import('@/app/demo/page')).default;
    render(<DemoPage />);

    // Header
    expect(screen.getByText('Live Demo Triggers')).toBeDefined();

    // Two trigger cards
    expect(screen.getByText('Live: Execute Transaction')).toBeDefined();
    expect(screen.getByText('Live: Detect Threat')).toBeDefined();
  });

  it('renders live status section with store-derived values', async () => {
    const DemoPage = (await import('@/app/demo/page')).default;
    render(<DemoPage />);

    expect(screen.getAllByText('Agents').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0); // No agents in empty mock store
    expect(screen.getAllByText('Transactions').length).toBeGreaterThan(0);
  });

  it('renders re-seed button', async () => {
    const DemoPage = (await import('@/app/demo/page')).default;
    render(<DemoPage />);

    expect(screen.getByText('Re-seed')).toBeDefined();
  });

  it('re-seed button requires double-click confirmation', async () => {
    const DemoPage = (await import('@/app/demo/page')).default;
    render(<DemoPage />);

    const resetBtn = screen.getByText('Re-seed');

    // First click arms it
    fireEvent.click(resetBtn);
    expect(screen.getByText('Confirm Reset')).toBeDefined();
    expect(mockReset).not.toHaveBeenCalled();

    // Second click confirms
    fireEvent.click(screen.getByText('Confirm Reset'));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('renders event stream with empty state', async () => {
    const DemoPage = (await import('@/app/demo/page')).default;
    render(<DemoPage />);

    expect(screen.getByText('Waiting for trigger...')).toBeDefined();
  });
});
