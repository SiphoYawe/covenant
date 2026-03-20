// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Protocol, type DemoEvent } from '@/lib/events';
import { useDashboardStore } from '@/stores/dashboard';
import { ActivityFeed } from '@/components/dashboard/activity-feed';

function makeEvent(overrides: Partial<DemoEvent> = {}): DemoEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'agent:registered',
    protocol: Protocol.Erc8004,
    data: {},
    ...overrides,
  };
}

describe('ActivityFeed component', () => {
  beforeEach(() => {
    useDashboardStore.setState(useDashboardStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no events exist', () => {
    render(<ActivityFeed />);
    expect(screen.getByText('Waiting for agent activity...')).toBeDefined();
  });

  it('renders events from the store', () => {
    useDashboardStore.getState().addEvent(
      makeEvent({
        type: 'agent:registered',
        agentId: '0xabc',
        data: { name: 'Researcher', role: 'researcher' },
      }),
    );

    render(<ActivityFeed />);
    expect(screen.getByText(/Researcher registered/)).toBeDefined();
  });

  it('renders protocol badges with correct labels', () => {
    useDashboardStore.getState().addEvent(
      makeEvent({
        type: 'agent:registered',
        protocol: Protocol.Erc8004,
        agentId: '0xabc',
        data: { name: 'Agent1' },
      }),
    );
    useDashboardStore.getState().addEvent(
      makeEvent({
        type: 'payment:settled',
        protocol: Protocol.X402,
        agentId: '0xaaa',
        data: { name: 'Agent A', amount: 6 },
      }),
    );

    render(<ActivityFeed />);
    expect(screen.getByText('ERC-8004')).toBeDefined();
    expect(screen.getByText('x402')).toBeDefined();
  });

  it('renders civic flag events with warning styling', () => {
    useDashboardStore.getState().addEvent(
      makeEvent({
        id: 'civic-event',
        type: 'civic:flagged',
        protocol: Protocol.Civic,
        agentId: '0xbad',
        data: { name: 'Malicious', attackType: 'prompt_injection', severity: 'critical' },
      }),
    );

    const { container } = render(<ActivityFeed />);
    const civicRow = container.querySelector('.border-red-500');
    expect(civicRow).not.toBeNull();
  });

  it('renders newest events at top', () => {
    useDashboardStore.getState().addEvent(
      makeEvent({
        type: 'agent:registered',
        agentId: '0xabc',
        data: { name: 'First' },
      }),
    );
    useDashboardStore.getState().addEvent(
      makeEvent({
        type: 'agent:registered',
        agentId: '0xdef',
        data: { name: 'Second' },
      }),
    );

    render(<ActivityFeed />);
    const items = screen.getAllByText(/registered/);
    expect(items[0].textContent).toContain('Second');
    expect(items[1].textContent).toContain('First');
  });

  it('renders up to 50 events', () => {
    const store = useDashboardStore.getState();
    for (let i = 0; i < 55; i++) {
      store.addEvent(
        makeEvent({
          id: `event-${i}`,
          type: 'agent:registered',
          agentId: `0x${i}`,
          data: { name: `Agent${i}` },
        }),
      );
    }

    const { container } = render(<ActivityFeed />);
    // The store caps at 50 events
    const rows = container.querySelectorAll('.flex.items-start');
    expect(rows.length).toBeLessThanOrEqual(50);
  });
});
