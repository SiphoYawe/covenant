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
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Waiting for agent activity...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-y-auto h-full space-y-1"
    >
      {events.map((event, idx) => {
        const isCivic = isCivicFlagEvent(event);
        const proto = getProtocolConfig(event.protocol);

        return (
          <div
            key={event.id}
            className={`flex items-start gap-3 p-2 rounded text-sm transition-all ${
              idx === 0 ? 'animate-fade-in' : ''
            } ${
              isCivic
                ? 'bg-red-950/30 border-l-4 border-red-500'
                : 'hover:bg-zinc-800/50'
            }`}
          >
            <span className="text-xs text-zinc-500 whitespace-nowrap min-w-[60px]">
              {formatTimestamp(event.timestamp)}
            </span>

            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${proto.bg} ${proto.text}`}
            >
              {proto.label}
            </span>

            <span className="text-zinc-300 flex-1">
              {formatEventDescription(event)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
