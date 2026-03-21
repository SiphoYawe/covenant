'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboard';
import {
  formatEventDescription,
  formatTimestamp,
  getProtocolConfig,
  isCivicFlagEvent,
} from '@/components/dashboard/feed-utils';

export function ActivityFeed() {
  const events = useDashboardStore((s) => s.events);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);
  const prevLengthRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isAtTopRef.current = el.scrollTop <= 50;
  }, []);

  useEffect(() => {
    if (events.length > prevLengthRef.current && isAtTopRef.current) {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = 0;
      }
    }
    prevLengthRef.current = events.length;
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Waiting for agent activity...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-y-auto h-full"
    >
      {events.map((event, idx) => {
        const isCivic = isCivicFlagEvent(event);
        const proto = getProtocolConfig(event.protocol);

        return (
          <div
            key={event.id}
            className={`flex items-start gap-3 py-3 px-4 border-b border-border text-sm transition-all ${
              idx === 0 ? 'animate-fade-in' : ''
            } ${
              isCivic
                ? 'bg-error/10 border-l-2 border-error text-error-foreground'
                : 'hover:bg-muted'
            }`}
          >
            <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px]">
              {formatTimestamp(event.timestamp)}
            </span>

            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${proto.bg} ${proto.text}`}
            >
              {proto.label}
            </span>

            <span className="text-foreground/80 flex-1">
              {formatEventDescription(event)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
