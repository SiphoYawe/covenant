import { createEventBus } from '@/lib/events';

export const runtime = 'edge';

const POLL_INTERVAL_MS = 1000;

function formatSSE(event: { id: string; type: string; data: string }): string {
  return `event: ${event.type}\ndata: ${event.data}\nid: ${event.id}\nretry: 3000\n\n`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let cursor = Number(url.searchParams.get('cursor') || '0');

  const bus = createEventBus();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Initial flush — only send the most recent 50 events to avoid
      // overwhelming the browser (KV has 2000+ events from seeding)
      try {
        const initial = cursor > 0
          ? await bus.since(cursor, 50)
          : await bus.recent(50);
        if (initial.length > 0) {
          let batch = '';
          for (const event of initial) {
            batch += formatSSE({
              id: event.id,
              type: event.type,
              data: JSON.stringify(event),
            });
            cursor = event.timestamp;
          }
          controller.enqueue(encoder.encode(batch));
        }
      } catch {
        // KV read failed on initial load — continue to polling
      }

      // Poll for new events
      const interval = setInterval(async () => {
        try {
          const events = await bus.since(cursor);
          for (const event of events) {
            const msg = formatSSE({
              id: event.id,
              type: event.type,
              data: JSON.stringify(event),
            });
            controller.enqueue(encoder.encode(msg));
            cursor = event.timestamp;
          }
        } catch {
          // KV read failed — skip this poll cycle
        }
      }, POLL_INTERVAL_MS);

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
