import { kv } from '@vercel/kv';
import type { DemoEvent } from './types';

const EVENTS_KEY = 'events:log';

type EmitInput = Omit<DemoEvent, 'id' | 'timestamp'>;

export type EventBus = {
  emit: (input: EmitInput) => Promise<DemoEvent>;
  since: (cursor: number) => Promise<DemoEvent[]>;
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

    async since(cursor: number): Promise<DemoEvent[]> {
      // Exclusive lower bound via `(` prefix — don't re-deliver the cursor event
      const raw = await kv.zrange(EVENTS_KEY, `(${cursor}`, '+inf', {
        byScore: true,
      });
      return (raw as string[]).map((item) => JSON.parse(item) as DemoEvent);
    },
  };
}
