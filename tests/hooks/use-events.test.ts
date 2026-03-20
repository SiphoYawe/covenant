// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { Protocol, type DemoEvent } from '@/lib/events';
import { useDashboardStore } from '@/stores/dashboard';

// --- Mock EventSource ---

type EventSourceListener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Record<string, EventSourceListener[]> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate async connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }

  addEventListener(type: string, listener: EventSourceListener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: EventSourceListener) {
    this.listeners[type] = (this.listeners[type] || []).filter((l) => l !== listener);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Test helper: simulate receiving an SSE event
  simulateEvent(type: string, data: string, lastEventId?: string) {
    const event = new MessageEvent(type, { data, lastEventId });
    (this.listeners[type] || []).forEach((fn) => fn(event));
  }

  // Test helper: simulate error
  simulateError() {
    this.readyState = 0;
    this.onerror?.();
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// Install mock
vi.stubGlobal('EventSource', MockEventSource);

describe('useEvents hook', () => {
  beforeEach(() => {
    MockEventSource.reset();
    useDashboardStore.setState(useDashboardStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
  });

  it('connects to SSE endpoint on mount', async () => {
    const { useEvents } = await import('@/hooks/use-events');

    renderHook(() => useEvents());

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/events/stream');
  });

  it('exposes connecting status initially', async () => {
    const { useEvents } = await import('@/hooks/use-events');

    const { result } = renderHook(() => useEvents());

    expect(result.current.status).toBe('connecting');
  });

  it('transitions to connected status on open', async () => {
    const { useEvents } = await import('@/hooks/use-events');

    const { result } = renderHook(() => useEvents());

    // Trigger onopen
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.status).toBe('connected');
  });

  it('parses and dispatches events to Zustand store', async () => {
    const { useEvents } = await import('@/hooks/use-events');

    renderHook(() => useEvents());

    const instance = MockEventSource.instances[0];
    const event: DemoEvent = {
      id: 'test-1',
      timestamp: Date.now(),
      type: 'agent:registered',
      protocol: Protocol.Erc8004,
      agentId: '0xabc',
      data: { name: 'Researcher', role: 'researcher' },
    };

    act(() => {
      instance.simulateEvent('agent:registered', JSON.stringify(event));
    });

    const { events, agents } = useDashboardStore.getState();
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('test-1');
    expect(agents['0xabc']).toBeDefined();
  });

  it('handles multiple event types', async () => {
    const { useEvents } = await import('@/hooks/use-events');

    renderHook(() => useEvents());

    const instance = MockEventSource.instances[0];

    act(() => {
      instance.simulateEvent(
        'agent:registered',
        JSON.stringify({
          id: 'e1',
          timestamp: Date.now(),
          type: 'agent:registered',
          protocol: Protocol.Erc8004,
          agentId: '0x1',
          data: { name: 'Agent1', role: 'researcher' },
        }),
      );

      instance.simulateEvent(
        'payment:settled',
        JSON.stringify({
          id: 'e2',
          timestamp: Date.now(),
          type: 'payment:settled',
          protocol: Protocol.X402,
          data: { amount: 6 },
        }),
      );
    });

    const state = useDashboardStore.getState();
    expect(state.events).toHaveLength(2);
    expect(state.metrics.totalTransactions).toBe(1);
  });

  it('transitions to disconnected on error', async () => {
    const { useEvents } = await import('@/hooks/use-events');

    const { result } = renderHook(() => useEvents());
    const instance = MockEventSource.instances[0];

    act(() => {
      instance.simulateError();
    });

    expect(result.current.status).toBe('disconnected');
  });

  it('cleans up EventSource on unmount', async () => {
    const { useEvents } = await import('@/hooks/use-events');

    const { unmount } = renderHook(() => useEvents());
    const instance = MockEventSource.instances[0];

    unmount();

    expect(instance.readyState).toBe(2); // CLOSED
  });
});
