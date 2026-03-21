'use client';

import { useRef, useEffect } from 'react';
import type { DemoEvent } from '@/lib/events';

type LiveEventStreamProps = {
  events: DemoEvent[];
  onClear?: () => void;
};

const PROTOCOL_BADGE_COLORS: Record<string, string> = {
  a2a: 'bg-blue-500/20 text-blue-400',
  'covenant-ai': 'bg-primary/20 text-primary',
  x402: 'bg-emerald-500/20 text-emerald-400',
  civic: 'bg-amber-500/20 text-amber-400',
  erc8004: 'bg-purple-500/20 text-purple-400',
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function LiveEventStream({ events, onClear }: LiveEventStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Event Stream</h3>
        </div>
        <p className="text-xs text-muted-foreground text-center py-8">
          Waiting for trigger...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          Event Stream
          <span className="text-muted-foreground font-normal ml-2">({events.length})</span>
        </h3>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-1">
        {events.map((event) => {
          const data = event.data as Record<string, unknown>;
          const step = (data.step as string) ?? event.type;
          const protocol = event.protocol;
          const badgeClass = PROTOCOL_BADGE_COLORS[protocol] ?? 'bg-muted text-muted-foreground';

          return (
            <div
              key={event.id}
              data-testid="event-entry"
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-16">
                {formatTime(event.timestamp)}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeClass} shrink-0`}>
                {protocol}
              </span>
              <span className="text-xs text-foreground truncate">{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
