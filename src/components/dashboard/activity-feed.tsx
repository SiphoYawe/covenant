'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useDashboardStore } from '@/stores/dashboard';
import {
  formatEventDescription,
  formatTimestamp,
  getProtocolConfig,
  isCivicFlagEvent,
} from '@/components/dashboard/feed-utils';

const PROTOCOL_TABS = [
  { key: 'all', label: 'All' },
  { key: 'erc8004', label: 'ERC-8004' },
  { key: 'a2a', label: 'A2A' },
  { key: 'x402', label: 'x402' },
  { key: 'civic', label: 'Civic' },
  { key: 'covenant_ai', label: 'Covenant AI' },
];

export function ActivityFeed() {
  const events = useDashboardStore((s) => s.events);
  const protocolFilter = useDashboardStore((s) => s.protocolFilter);
  const setProtocolFilter = useDashboardStore((s) => s.setProtocolFilter);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);
  const prevLengthRef = useRef(0);

  const filteredEvents = useMemo(() => {
    if (protocolFilter === 'all') return events;
    return events.filter((e) => e.protocol === protocolFilter);
  }, [events, protocolFilter]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Protocol filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
        {PROTOCOL_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setProtocolFilter(tab.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              protocolFilter === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Events list with CSS containment for performance */}
      {filteredEvents.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          {protocolFilter === 'all'
            ? 'Waiting for agent activity...'
            : `No ${protocolFilter} events yet.`}
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="overflow-y-auto flex-1"
          style={{ contentVisibility: 'auto', containIntrinsicSize: '0 40px' }}
        >
          {filteredEvents.map((event, idx) => {
            const isCivic = isCivicFlagEvent(event);
            const proto = getProtocolConfig(event.protocol);

            return (
              <div
                key={event.id}
                className={`flex items-start gap-2 py-2.5 px-3 border-b border-border text-xs transition-all ${
                  idx === 0 ? 'animate-fade-in' : ''
                } ${
                  isCivic
                    ? 'bg-error/10 border-l-2 border-error'
                    : 'hover:bg-muted'
                }`}
                style={{ contentVisibility: 'auto', containIntrinsicSize: '0 40px' }}
              >
                <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[50px]">
                  {formatTimestamp(event.timestamp)}
                </span>

                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${proto.bg} ${proto.text}`}
                >
                  {proto.label}
                </span>

                <span className={`flex-1 ${isCivic ? 'text-error-foreground' : 'text-foreground/80'}`}>
                  {formatEventDescription(event)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
