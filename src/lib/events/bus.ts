import { kv } from '@/lib/storage/kv';
import type { DemoEvent } from './types';

const EVENTS_KEY = 'events:log';

type EmitInput = Omit<DemoEvent, 'id' | 'timestamp'>;

export type EventBus = {
  emit: (input: EmitInput) => Promise<DemoEvent>;
  since: (cursor: number, limit?: number) => Promise<DemoEvent[]>;
  recent: (count: number) => Promise<DemoEvent[]>;
};

export function createEventBus(): EventBus {
  return {
    async emit(input: EmitInput): Promise<DemoEvent> {
      const event: DemoEvent = {
        ...input,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      await kv.zadd(EVENTS_KEY, {
        score: event.timestamp,
        member: JSON.stringify(event),
      });

      return event;
    },

    async since(cursor: number, limit?: number): Promise<DemoEvent[]> {
      // Exclusive lower bound via `(` prefix — don't re-deliver the cursor event
      const raw = await kv.zrange(EVENTS_KEY, `(${cursor}`, '+inf', {
        byScore: true,
      });
      const items = (raw as (string | DemoEvent)[]).map((item) =>
        typeof item === 'string' ? (JSON.parse(item) as DemoEvent) : item
      );
      return limit ? items.slice(0, limit) : items;
    },

    async recent(count: number): Promise<DemoEvent[]> {
      // Get the most recent N events (reverse sorted set range)
      const raw = await kv.zrange(EVENTS_KEY, -count, -1);
      return (raw as (string | DemoEvent)[]).map((item) =>
        typeof item === 'string' ? (JSON.parse(item) as DemoEvent) : item
      );
    },
  };
}
