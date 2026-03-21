// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveEventStream } from '@/components/demo/live-event-stream';
import type { DemoEvent } from '@/lib/events';

describe('LiveEventStream', () => {
  const mockEvents: DemoEvent[] = [
    {
      id: 'e1',
      timestamp: 1711000000000,
      type: 'live:trigger-step',
      protocol: 'a2a' as DemoEvent['protocol'],
      agentId: 'seed-R1',
      data: { step: 'discovery-started', triggerType: 'lifecycle' },
    },
    {
      id: 'e2',
      timestamp: 1711000001000,
      type: 'live:trigger-step',
      protocol: 'x402' as DemoEvent['protocol'],
      agentId: 'seed-R1',
      data: { step: 'payment-confirmed', triggerType: 'lifecycle', txHash: '0xabc' },
    },
  ];

  it('renders event entries', () => {
    render(<LiveEventStream events={mockEvents} />);
    expect(screen.getByText(/discovery-started/)).toBeDefined();
    expect(screen.getByText(/payment-confirmed/)).toBeDefined();
  });

  it('shows protocol badges', () => {
    render(<LiveEventStream events={mockEvents} />);
    expect(screen.getByText('a2a')).toBeDefined();
    expect(screen.getByText('x402')).toBeDefined();
  });

  it('renders empty state when no events', () => {
    render(<LiveEventStream events={[]} />);
    expect(screen.getByText(/Waiting for trigger/)).toBeDefined();
  });

  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(<LiveEventStream events={mockEvents} onClear={onClear} />);
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders events in order', () => {
    render(<LiveEventStream events={mockEvents} />);
    const items = screen.getAllByTestId('event-entry');
    expect(items).toHaveLength(2);
  });
});
