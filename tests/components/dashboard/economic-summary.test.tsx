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

  it('displays all metric labels', () => {
    render(<EconomicSummary />);
    expect(screen.getByText('Total Agents')).toBeDefined();
    expect(screen.getByText('USDC Transacted')).toBeDefined();
    expect(screen.getByText('Transactions')).toBeDefined();
    expect(screen.getByText('Sybil Alerts')).toBeDefined();
    expect(screen.getByText('Network Health')).toBeDefined();
  });

  it('displays zero values initially', () => {
    render(<EconomicSummary />);
    expect(screen.getByText('$0.00')).toBeDefined(); // USDC Transacted
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2); // Transactions + Sybil Alerts + others
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
  });

  it('counts sybil alerts from flagged agents', () => {
    useDashboardStore.getState().updateAgent('0xbad', {
      name: 'Bad',
      role: 'malicious',
      civicFlagged: true,
    });

    render(<EconomicSummary />);
    // 1 appears for both Sybil Alerts and Excluded
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });
});
