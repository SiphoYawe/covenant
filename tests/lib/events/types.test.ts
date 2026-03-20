import { describe, it, expect } from 'vitest';
import { Protocol, type DemoEvent } from '@/lib/events/types';
import { EVENT_TYPES } from '@/lib/events/constants';

describe('Event Types', () => {
  it('Protocol enum has all 6 protocols', () => {
    expect(Object.values(Protocol)).toEqual(
      expect.arrayContaining(['a2a', 'mcp', 'x402', 'erc8004', 'covenant-ai', 'civic'])
    );
    expect(Object.values(Protocol)).toHaveLength(6);
  });

  it('DemoEvent can be constructed with required fields', () => {
    const event: DemoEvent = {
      id: 'test-uuid',
      timestamp: Date.now(),
      type: 'agent:registered',
      protocol: Protocol.Erc8004,
      agentId: '0x1234',
      data: { name: 'researcher' },
    };
    expect(event.id).toBe('test-uuid');
    expect(event.protocol).toBe('erc8004');
  });

  it('DemoEvent supports optional targetAgentId', () => {
    const event: DemoEvent = {
      id: 'test-uuid',
      timestamp: Date.now(),
      type: 'payment:settled',
      protocol: Protocol.X402,
      agentId: '0x1234',
      targetAgentId: '0x5678',
      data: { amount: '6.00' },
    };
    expect(event.targetAgentId).toBe('0x5678');
  });
});

describe('Event Constants', () => {
  it('EVENT_TYPES includes core event names', () => {
    expect(EVENT_TYPES.AGENT_REGISTERED).toBe('agent:registered');
    expect(EVENT_TYPES.PAYMENT_SETTLED).toBe('payment:settled');
    expect(EVENT_TYPES.CIVIC_FLAGGED).toBe('civic:flagged');
    expect(EVENT_TYPES.REPUTATION_UPDATED).toBe('reputation:updated');
    expect(EVENT_TYPES.DEMO_ACT_CHANGED).toBe('demo:act-changed');
  });
});
