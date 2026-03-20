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
      // cursor + 1 for exclusive lower bound (don't re-deliver the cursor event)
      const raw = await kv.zrangebyscore(EVENTS_KEY, cursor + 1, '+inf');
      return (raw as string[]).map((item) => JSON.parse(item) as DemoEvent);
    },
  };
}
