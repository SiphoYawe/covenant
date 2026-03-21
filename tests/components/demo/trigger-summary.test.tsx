// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TriggerSummary } from '@/components/demo/trigger-summary';

describe('TriggerSummary', () => {
  const lifecycleResult = {
    success: true,
    requesterId: 'seed-R1',
    providerId: 'seed-S2',
    negotiatedPrice: 12,
    paymentTxHash: '0xpay123abc',
    feedbackTxHash: '0xfeedback456',
    reputationUpdated: true,
    durationMs: 23400,
    steps: [
      { name: 'Discovery', status: 'completed', protocol: 'a2a', durationMs: 2100 },
      { name: 'Payment', status: 'completed', protocol: 'x402', durationMs: 3200 },
    ],
  };

  const sybilResult = {
    success: true,
    ringMembers: ['seed-X2', 'seed-X3', 'seed-X4'],
    scoreDrops: {
      'seed-X2': { before: 7.5, after: 2.1 },
      'seed-X3': { before: 7.2, after: 2.3 },
      'seed-X4': { before: 6.8, after: 1.9 },
    },
    explanation: 'Circular payment pattern detected: X2->X3->X4->X2',
    txHashes: { 'seed-X2': '0xtx1', 'seed-X3': '0xtx2', 'seed-X4': '0xtx3' },
    durationMs: 24100,
    steps: [],
  };

  it('renders lifecycle result with agent IDs', () => {
    render(<TriggerSummary type="lifecycle" result={lifecycleResult} />);
    expect(screen.getByText(/seed-R1/)).toBeDefined();
    expect(screen.getByText(/seed-S2/)).toBeDefined();
  });

  it('displays USDC amount for lifecycle', () => {
    render(<TriggerSummary type="lifecycle" result={lifecycleResult} />);
    expect(screen.getByText(/12/)).toBeDefined();
  });

  it('renders BaseScan links for tx hashes', () => {
    render(<TriggerSummary type="lifecycle" result={lifecycleResult} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute('href')).toContain('basescan.org');
  });

  it('renders Sybil ring members', () => {
    render(<TriggerSummary type="sybil-cascade" result={sybilResult} />);
    expect(screen.getAllByText(/seed-X2/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/seed-X3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/seed-X4/).length).toBeGreaterThan(0);
  });

  it('shows score drops for Sybil cascade', () => {
    render(<TriggerSummary type="sybil-cascade" result={sybilResult} />);
    // Should show before and after scores
    expect(screen.getByText(/7\.5/)).toBeDefined();
    expect(screen.getByText(/2\.1/)).toBeDefined();
  });

  it('shows explanation text for Sybil cascade', () => {
    render(<TriggerSummary type="sybil-cascade" result={sybilResult} />);
    expect(screen.getByText(/Circular payment pattern/)).toBeDefined();
  });

  it('shows duration', () => {
    render(<TriggerSummary type="lifecycle" result={lifecycleResult} />);
    expect(screen.getByText(/23\.4s/)).toBeDefined();
  });

  it('shows success status', () => {
    render(<TriggerSummary type="lifecycle" result={lifecycleResult} />);
    expect(screen.getByText(/Success/)).toBeDefined();
  });

  it('shows failure status when not successful', () => {
    render(<TriggerSummary type="lifecycle" result={{ ...lifecycleResult, success: false, error: 'Payment failed' }} />);
    expect(screen.getByText(/Failed/)).toBeDefined();
  });
});
