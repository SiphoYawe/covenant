// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useDashboardStore } from '@/stores/dashboard';
import { EconomicSummary } from '@/components/dashboard/economic-summary';

describe('EconomicSummary component', () => {
  beforeEach(() => {
    useDashboardStore.setState(useDashboardStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
  });

  it('displays all five metric labels', () => {
    render(<EconomicSummary />);
    expect(screen.getByText('Total USDC')).toBeDefined();
    expect(screen.getByText('Transactions')).toBeDefined();
    expect(screen.getByText('Avg Payment')).toBeDefined();
    expect(screen.getByText('Sybil Alerts')).toBeDefined();
    expect(screen.getByText('Network Health')).toBeDefined();
  });

  it('displays zero values initially', () => {
    render(<EconomicSummary />);
    expect(screen.getAllByText('$0.00')).toHaveLength(2); // Total USDC + Avg Payment
    expect(screen.getAllByText('0')).toHaveLength(2); // Transactions + Sybil Alerts
  });

  it('displays updated metrics from store', () => {
    useDashboardStore.getState().updateMetrics({
      totalPayments: 1234.56,
      totalTransactions: 15,
      averagePayment: 82.3,
    });

    render(<EconomicSummary />);
    expect(screen.getByText('$1,234.56')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('$82.30')).toBeDefined();
  });

  it('counts sybil alerts from flagged agents', () => {
    useDashboardStore.getState().updateAgent('0xbad', {
      name: 'Bad',
      role: 'malicious',
      civicFlagged: true,
    });

    render(<EconomicSummary />);
    expect(screen.getByText('1')).toBeDefined();
  });
});
