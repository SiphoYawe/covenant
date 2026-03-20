import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Protocol } from '@/lib/events';

// Mock @vercel/kv with sorted set behavior
vi.mock('@vercel/kv', () => {
  const sortedSets = new Map<string, Array<{ score: number; member: string }>>();

  return {
    kv: {
      zadd: vi.fn(async (key: string, { score, member }: { score: number; member: string }) => {
        const set = sortedSets.get(key) || [];
        set.push({ score, member });
        sortedSets.set(key, set);
        return 1;
      }),
      zrange: vi.fn(async (key: string, min: number | string, max: number | string) => {
        const set = sortedSets.get(key) || [];
        const parseMin = (v: number | string): number => {
          if (typeof v === 'string' && v.startsWith('(')) return Number(v.slice(1));
          if (typeof v === 'string') return v === '-' ? -Infinity : Number(v);
          return v;
        };
        const parseMax = (v: number | string): number => {
          if (typeof v === 'string') return v === '+' || v === '+inf' ? Infinity : Number(v);
          return v;
        };
        const minNum = parseMin(min);
        const maxNum = parseMax(max);
        const exclusive = typeof min === 'string' && min.startsWith('(');
        return set
          .filter((item) => (exclusive ? item.score > minNum : item.score >= minNum) && item.score <= maxNum)
          .sort((a, b) => a.score - b.score)
          .map((item) => item.member);
      }),
    },
    __sortedSets: sortedSets,
    __resetMock: () => {
      sortedSets.clear();
    },
  };
});

async function seedEvents(count: number) {
  const { kv } = await import('@vercel/kv');
  for (let i = 0; i < count; i++) {
    const event = {
      id: `evt-${i}`,
      timestamp: 1000 + i,
      type: 'agent:registered',
      protocol: Protocol.Erc8004,
      agentId: `0x${i}`,
      data: { index: i },
    };
    await kv.zadd('events:log', { score: event.timestamp, member: JSON.stringify(event) });
  }
}

describe('SSE Stream Route', () => {
  beforeEach(async () => {
    const { __resetMock } = await import('@vercel/kv');
    (__resetMock as () => void)();
    vi.clearAllMocks();
  });

  it('returns correct SSE headers', async () => {
    const { GET } = await import('@/app/api/events/stream/route');
    const request = new Request('http://localhost/api/events/stream');

    const response = await GET(request);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
  });

  it('streams events from KV event bus', async () => {
    await seedEvents(3);

    const { GET } = await import('@/app/api/events/stream/route');
    const request = new Request('http://localhost/api/events/stream?cursor=0');

    const response = await GET(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read the first chunk — should contain the seeded events
    const { value } = await reader.read();
    const text = decoder.decode(value);

    // Verify SSE format: event, data, id lines
    expect(text).toContain('event: agent:registered');
    expect(text).toContain('data: ');
    expect(text).toContain('id: evt-');
    expect(text).toContain('retry: 3000');

    reader.cancel();
  });

  it('SSE message format matches specification', async () => {
    await seedEvents(1);

    const { GET } = await import('@/app/api/events/stream/route');
    const request = new Request('http://localhost/api/events/stream?cursor=0');

    const response = await GET(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const { value } = await reader.read();
    const text = decoder.decode(value);

    // Each SSE message should have: event, data, id, retry, and blank line
    const lines = text.split('\n');
    const eventLine = lines.find((l: string) => l.startsWith('event:'));
    const dataLine = lines.find((l: string) => l.startsWith('data:'));
    const idLine = lines.find((l: string) => l.startsWith('id:'));
    const retryLine = lines.find((l: string) => l.startsWith('retry:'));

    expect(eventLine).toBeDefined();
    expect(dataLine).toBeDefined();
    expect(idLine).toBeDefined();
    expect(retryLine).toBe('retry: 3000');

    // Data should be valid JSON
    const jsonStr = dataLine!.replace('data: ', '');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.id).toBe('evt-0');

    reader.cancel();
  });

  it('handles empty event bus with no events to stream', async () => {
    const { GET } = await import('@/app/api/events/stream/route');
    const request = new Request('http://localhost/api/events/stream?cursor=999999');

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();

    // Should still return a valid SSE stream (just no events yet)
    const reader = response.body!.getReader();

    // The stream should be open but with no immediate data (it waits for next poll)
    // Cancel immediately — we just verify the stream is valid
    reader.cancel();
  });

  it('uses Edge runtime', async () => {
    const { runtime } = await import('@/app/api/events/stream/route');
    expect(runtime).toBe('edge');
  });

  it('uses cursor from query parameter', async () => {
    await seedEvents(5);

    const { GET } = await import('@/app/api/events/stream/route');
    // Cursor at 1002 means events with timestamp > 1002 (i.e., events 3 and 4)
    const request = new Request('http://localhost/api/events/stream?cursor=1002');

    const response = await GET(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const { value } = await reader.read();
    const text = decoder.decode(value);

    // Should contain events 3 and 4 but not 0, 1, 2
    expect(text).toContain('evt-3');
    expect(text).toContain('evt-4');
    expect(text).not.toContain('evt-0');

    reader.cancel();
  });
});
