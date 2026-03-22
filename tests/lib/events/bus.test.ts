import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Protocol, type DemoEvent } from '@/lib/events/types';
import { clearKvStore } from '../../helpers/kv-mock';

// Track sorted set data for this test
const sortedSets = new Map<string, Array<{ score: number; member: string }>>();

vi.mock('@/lib/storage/kv', async () => {
  const { createKvMock } = await import('../../helpers/kv-mock');
  const mock = createKvMock();
  // Override zadd/zrange with sorted set behavior needed by event bus
  mock.kv.zadd = vi.fn(async (...args: unknown[]) => {
    const key = args[0] as string;
    const { score, member } = args[1] as { score: number; member: string };
    const set = sortedSets.get(key) || [];
    set.push({ score, member });
    sortedSets.set(key, set);
    return 1;
  });
  mock.kv.zrange = vi.fn(async (key: string, min: number | string, max: number | string, opts?: { byScore?: boolean }) => {
    const set = sortedSets.get(key) || [];
    const parseMin = (v: number | string): number => {
      if (typeof v === 'string' && v.startsWith('(')) return Number(v.slice(1));
      if (typeof v === 'string') return v === '-' ? -Infinity : Number(v);
      return v;
    };
    const parseMax = (v: number | string): number => {
      if (typeof v === 'string') return (v === '+' || v === '+inf') ? Infinity : Number(v);
      return v;
    };
    const minNum = parseMin(min);
    const maxNum = parseMax(max);
    const exclusive = typeof min === 'string' && min.startsWith('(');
    return set
      .filter((item) => (exclusive ? item.score > minNum : item.score >= minNum) && item.score <= maxNum)
      .sort((a, b) => a.score - b.score)
      .map((item) => item.member);
  });
  return mock;
});

describe('Event Bus', () => {
  beforeEach(() => {
    sortedSets.clear();
    clearKvStore();
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
