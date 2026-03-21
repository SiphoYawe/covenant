import { describe, it, expect, beforeEach } from 'vitest';
import { Protocol, type DemoEvent } from '@/lib/events';

// Import store — will be created in GREEN phase
import { useDashboardStore } from '@/stores/dashboard';
import type { AgentState, TrustEdge, EconomicMetrics } from '@/stores/dashboard';

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

describe('Dashboard Store', () => {
  beforeEach(() => {
    useDashboardStore.setState(useDashboardStore.getInitialState());
  });

  describe('addEvent', () => {
    it('prepends event to events array', () => {
      const event = makeEvent({ type: 'agent:registered' });
      useDashboardStore.getState().addEvent(event);

      const { events } = useDashboardStore.getState();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('caps events array at 50 entries', () => {
      const store = useDashboardStore.getState();

      // Add 55 events
      for (let i = 0; i < 55; i++) {
        store.addEvent(makeEvent({ id: `event-${i}` }));
      }

      const { events } = useDashboardStore.getState();
      expect(events).toHaveLength(50);
      // Most recent event should be first (prepended)
      expect(events[0].id).toBe('event-54');
    });

    it('routes agent:registered to updateAgent', () => {
      const event = makeEvent({
        type: 'agent:registered',
        agentId: '0xabc',
        data: { name: 'Researcher', role: 'researcher' },
      });

      useDashboardStore.getState().addEvent(event);

      const { agents } = useDashboardStore.getState();
      expect(agents['0xabc']).toBeDefined();
      expect(agents['0xabc'].name).toBe('Researcher');
      expect(agents['0xabc'].role).toBe('researcher');
    });

    it('routes reputation:updated to updateAgent with score', () => {
      // First register the agent
      useDashboardStore.getState().addEvent(
        makeEvent({
          type: 'agent:registered',
          agentId: '0xabc',
          data: { name: 'Researcher', role: 'researcher' },
        }),
      );

      // Then update reputation
      useDashboardStore.getState().addEvent(
        makeEvent({
          type: 'reputation:updated',
          agentId: '0xabc',
          protocol: Protocol.CovenantAi,
          data: { reputationScore: 85, trustLevel: 'high' },
        }),
      );

      const agent = useDashboardStore.getState().agents['0xabc'];
      expect(agent.reputationScore).toBe(85);
      expect(agent.trustLevel).toBe('high');
    });

    it('routes payment:settled to updateMetrics', () => {
      useDashboardStore.getState().addEvent(
        makeEvent({
          type: 'payment:settled',
          protocol: Protocol.X402,
          data: { amount: 6 },
        }),
      );

      const { metrics } = useDashboardStore.getState();
      expect(metrics.totalPayments).toBe(6);
      expect(metrics.totalTransactions).toBe(1);
    });

    it('routes civic:flagged to updateAgent with flag', () => {
      useDashboardStore.getState().addEvent(
        makeEvent({
          type: 'agent:registered',
          agentId: '0xbad',
          data: { name: 'Malicious', role: 'malicious' },
        }),
      );

      useDashboardStore.getState().addEvent(
        makeEvent({
          type: 'civic:flagged',
          agentId: '0xbad',
          protocol: Protocol.Civic,
          data: { reason: 'suspicious behavior' },
        }),
      );

      expect(useDashboardStore.getState().agents['0xbad'].civicFlagged).toBe(true);
    });

    it('routes demo:act-changed to update demoState', () => {
      useDashboardStore.getState().addEvent(
        makeEvent({
          type: 'demo:act-changed',
          data: { status: 'running' },
        }),
      );

      const { demoState } = useDashboardStore.getState();
      expect(demoState.status).toBe('running');
    });

    it('routes task:negotiated to addEdge', () => {
      useDashboardStore.getState().addEvent(
        makeEvent({
          type: 'task:negotiated',
          agentId: '0xaaa',
          targetAgentId: '0xbbb',
          protocol: Protocol.A2a,
          data: { price: 6 },
        }),
      );

      const { edges } = useDashboardStore.getState();
      expect(edges).toHaveLength(1);
      expect(edges[0].source).toBe('0xaaa');
      expect(edges[0].target).toBe('0xbbb');
    });
  });

  describe('updateAgent', () => {
    it('creates new agent entry when agent does not exist', () => {
      useDashboardStore.getState().updateAgent('0x123', {
        name: 'TestAgent',
        role: 'researcher',
      });

      const agent = useDashboardStore.getState().agents['0x123'];
      expect(agent).toBeDefined();
      expect(agent.agentId).toBe('0x123');
      expect(agent.name).toBe('TestAgent');
    });

    it('updates existing agent without overwriting unset fields', () => {
      const store = useDashboardStore.getState();
      store.updateAgent('0x123', {
        name: 'TestAgent',
        role: 'researcher',
        reputationScore: 50,
      });
      store.updateAgent('0x123', { reputationScore: 90 });

      const agent = useDashboardStore.getState().agents['0x123'];
      expect(agent.name).toBe('TestAgent');
      expect(agent.reputationScore).toBe(90);
    });
  });

  describe('addEdge', () => {
    it('adds a new edge', () => {
      useDashboardStore.getState().addEdge({
        source: '0xaaa',
        target: '0xbbb',
        weight: 1,
        protocol: 'a2a',
      });

      expect(useDashboardStore.getState().edges).toHaveLength(1);
    });

    it('deduplicates edges by source+target', () => {
      const store = useDashboardStore.getState();
      store.addEdge({ source: '0xaaa', target: '0xbbb', weight: 1, protocol: 'a2a' });
      store.addEdge({ source: '0xaaa', target: '0xbbb', weight: 2, protocol: 'x402' });

      const { edges } = useDashboardStore.getState();
      expect(edges).toHaveLength(1);
      // Should update weight on dedup
      expect(edges[0].weight).toBe(2);
    });

    it('allows different source+target combinations', () => {
      const store = useDashboardStore.getState();
      store.addEdge({ source: '0xaaa', target: '0xbbb', weight: 1, protocol: 'a2a' });
      store.addEdge({ source: '0xbbb', target: '0xaaa', weight: 1, protocol: 'a2a' });

      expect(useDashboardStore.getState().edges).toHaveLength(2);
    });
  });

  describe('updateMetrics', () => {
    it('merges partial metrics into current state', () => {
      useDashboardStore.getState().updateMetrics({ totalPayments: 100 });

      const { metrics } = useDashboardStore.getState();
      expect(metrics.totalPayments).toBe(100);
      expect(metrics.totalTransactions).toBe(0); // unchanged
    });

    it('accumulates multiple updates', () => {
      const store = useDashboardStore.getState();
      store.updateMetrics({ totalPayments: 50 });
      store.updateMetrics({ totalTransactions: 3 });

      const { metrics } = useDashboardStore.getState();
      expect(metrics.totalPayments).toBe(50);
      expect(metrics.totalTransactions).toBe(3);
    });
  });

  describe('resetDemo', () => {
    it('clears all state back to initial values', () => {
      const store = useDashboardStore.getState();

      // Populate state
      store.addEvent(makeEvent());
      store.updateAgent('0x1', { name: 'Agent1', role: 'researcher' });
      store.addEdge({ source: '0xa', target: '0xb', weight: 1, protocol: 'a2a' });
      store.updateMetrics({ totalPayments: 500 });

      // Verify populated
      expect(useDashboardStore.getState().events.length).toBeGreaterThan(0);
      expect(Object.keys(useDashboardStore.getState().agents).length).toBeGreaterThan(0);

      // Reset
      store.resetDemo();

      const state = useDashboardStore.getState();
      expect(state.events).toHaveLength(0);
      expect(Object.keys(state.agents)).toHaveLength(0);
      expect(state.edges).toHaveLength(0);
      expect(state.metrics.totalPayments).toBe(0);
      expect(state.metrics.totalTransactions).toBe(0);
      expect(state.demoState.status).toBe('idle');
    });
  });

  describe('selectors', () => {
    it('getState returns all state slices', () => {
      const state = useDashboardStore.getState();
      expect(state).toHaveProperty('agents');
      expect(state).toHaveProperty('edges');
      expect(state).toHaveProperty('events');
      expect(state).toHaveProperty('metrics');
      expect(state).toHaveProperty('demoState');
    });
  });
});
