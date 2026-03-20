import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Protocol, type DemoEvent } from '@/lib/events/types';

// Mock @vercel/kv before importing bus
vi.mock('@vercel/kv', () => {
  const store = new Map<string, string>();
  const sortedSets = new Map<string, Array<{ score: number; member: string }>>();

  return {
    kv: {
      zadd: vi.fn(async (key: string, { score, member }: { score: number; member: string }) => {
        const set = sortedSets.get(key) || [];
        set.push({ score, member });
        sortedSets.set(key, set);
        return 1;
      }),
      zrangebyscore: vi.fn(async (key: string, min: number | string, max: number | string) => {
        const set = sortedSets.get(key) || [];
        const minNum = typeof min === 'string' ? -Infinity : min;
        const maxNum = typeof max === 'string' ? Infinity : max;
        return set
          .filter((item) => item.score >= minNum && item.score <= maxNum)
          .sort((a, b) => a.score - b.score)
          .map((item) => item.member);
      }),
    },
    __resetMock: () => {
      store.clear();
      sortedSets.clear();
    },
  };
});

describe('Event Bus', () => {
  beforeEach(async () => {
    const { __resetMock } = await import('@vercel/kv');
    (__resetMock as () => void)();
    vi.clearAllMocks();
  });

  it('emit() stores event and returns the event with id and timestamp', async () => {
    const { createEventBus } = await import('@/lib/events/bus');
    const bus = createEventBus();

    const event = await bus.emit({
      type: 'agent:registered',
      protocol: Protocol.Erc8004,
      agentId: '0x1234',
      data: { name: 'researcher' },
    });

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.type).toBe('agent:registered');
  });

  it('since() returns events after the given cursor', async () => {
    const { createEventBus } = await import('@/lib/events/bus');
    const bus = createEventBus();

    const before = Date.now() - 1;
    await bus.emit({
      type: 'agent:registered',
      protocol: Protocol.Erc8004,
      data: { name: 'researcher' },
    });
    await bus.emit({
      type: 'payment:settled',
      protocol: Protocol.X402,
      data: { amount: '6.00' },
    });

    const events = await bus.since(before);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('agent:registered');
    expect(events[1].type).toBe('payment:settled');
  });

  it('since() returns empty array when no events after cursor', async () => {
    const { createEventBus } = await import('@/lib/events/bus');
    const bus = createEventBus();

    const events = await bus.since(Date.now() + 1000);
    expect(events).toHaveLength(0);
  });
});
