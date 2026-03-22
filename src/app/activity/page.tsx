'use client';

import { useMemo, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/app-layout';
import { useDashboardStore } from '@/stores/dashboard';
import { useEvents as useEventsHook } from '@/hooks/use-events';
import {
  formatEventDescription,
  formatTimestamp,
  getProtocolConfig,
  isCivicFlagEvent,
  PROTOCOL_COLORS,
} from '@/components/dashboard/feed-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Activity01Icon,
  Shield01Icon,
  AffiliateIcon,
} from '@hugeicons/core-free-icons';

const PROTOCOL_TABS = [
  { key: 'all', label: 'All Protocols' },
  { key: 'erc8004', label: 'ERC-8004' },
  { key: 'a2a', label: 'A2A' },
  { key: 'x402', label: 'x402' },
  { key: 'civic', label: 'Civic' },
  { key: 'covenant_ai', label: 'Covenant AI' },
];

// --- Skeleton Components ---

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-border/40 ${className ?? ''}`}
    />
  );
}

function EventSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 border-b border-border/50">
      <SkeletonPulse className="w-16 h-4 shrink-0" />
      <SkeletonPulse className="w-20 h-5 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <SkeletonPulse className="w-3/4 h-4" />
        <SkeletonPulse className="w-1/3 h-3" />
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 12 }).map((_, i) => (
        <EventSkeleton key={i} />
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card card-elevated rounded-xl p-5">
          <SkeletonPulse className="w-24 h-3 mb-3" />
          <SkeletonPulse className="w-16 h-7" />
        </div>
      ))}
    </div>
  );
}

// --- Metric Card (matches dashboard pattern) ---

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: typeof Activity01Icon;
  iconColor?: string;
  trend?: string;
  trendColor?: string;
};

function MetricCard({ label, value, icon, iconColor, trend, trendColor }: MetricCardProps) {
  return (
    <div className="bg-card card-elevated rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <HugeiconsIcon icon={icon} size={16} className={iconColor ?? 'text-primary'} />
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <motion.div
        key={String(value)}
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-baseline gap-2"
      >
        <span className="text-foreground text-2xl font-bold">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trendColor ?? 'text-score-excellent'}`}>{trend}</span>
        )}
      </motion.div>
    </div>
  );
}

// --- Main Page ---

export default function ActivityPage() {
  const { status } = useEventsHook();
  const events = useDashboardStore((s) => s.events);
  const loading = useDashboardStore((s) => s.loading);
  const protocolFilter = useDashboardStore((s) => s.protocolFilter);
  const setProtocolFilter = useDashboardStore((s) => s.setProtocolFilter);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);
  const prevLengthRef = useRef(0);

  const filteredEvents = useMemo(() => {
    if (protocolFilter === 'all') return events;
    return events.filter((e) => e.protocol === protocolFilter);
  }, [events, protocolFilter]);

  // Protocol breakdown stats
  const stats = useMemo(() => {
    const civicFlags = events.filter((e) => isCivicFlagEvent(e)).length;
    const protocols = new Set(events.map((e) => e.protocol));
    return {
      total: events.length,
      civicFlags,
      protocols: protocols.size,
    };
  }, [events]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isAtTopRef.current = el.scrollTop <= 50;
  }, []);

  useEffect(() => {
    if (events.length > prevLengthRef.current && isAtTopRef.current) {
      const el = containerRef.current;
      if (el) el.scrollTop = 0;
    }
    prevLengthRef.current = events.length;
  }, [events.length]);

  const isLoading = loading && events.length === 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6 h-full">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <HugeiconsIcon icon={Activity01Icon} size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Activity Feed</h1>
              <p className="text-sm text-muted-foreground">
                Real-time protocol events across the Covenant network
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-score-excellent'
                  : status === 'connecting'
                    ? 'bg-score-moderate animate-pulse'
                    : 'bg-score-critical'
              }`}
            />
            <span className="text-muted-foreground text-sm">
              {status === 'connected'
                ? 'Live'
                : status === 'connecting'
                  ? 'Connecting'
                  : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Stats row */}
        {isLoading ? (
          <StatsSkeleton />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <MetricCard
              label="Total Events"
              value={stats.total}
              icon={Activity01Icon}
              iconColor="text-primary"
            />
            <MetricCard
              label="Protocols Active"
              value={stats.protocols}
              icon={AffiliateIcon}
              iconColor="text-score-moderate"
            />
            <MetricCard
              label="Civic Flags"
              value={stats.civicFlags}
              icon={Shield01Icon}
              iconColor={stats.civicFlags > 0 ? 'text-score-critical' : 'text-score-excellent'}
              trend={stats.civicFlags > 0 ? 'agents flagged' : 'all clear'}
              trendColor={stats.civicFlags > 0 ? 'text-score-critical' : 'text-score-excellent'}
            />
          </div>
        )}

        {/* Feed card */}
        <div className="flex-1 bg-card card-elevated rounded-xl flex flex-col overflow-hidden min-h-0">
          {/* Protocol filter tabs */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border overflow-x-auto">
            {PROTOCOL_TABS.map((tab) => {
              const isActive = protocolFilter === tab.key;
              // Get protocol-specific color for active state
              const protoConfig = tab.key !== 'all' ? getProtocolConfig(tab.key) : null;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setProtocolFilter(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? protoConfig
                        ? `${protoConfig.bg} ${protoConfig.text} ring-1 ring-current/20`
                        : 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Events list */}
          {isLoading ? (
            <FeedSkeleton />
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 py-16">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <HugeiconsIcon icon={Activity01Icon} size={24} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                {protocolFilter === 'all'
                  ? 'Waiting for agent activity...'
                  : `No ${protocolFilter} events yet.`}
              </p>
            </div>
          ) : (
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="overflow-y-auto flex-1"
            >
              {filteredEvents.map((event, idx) => {
                const isCivic = isCivicFlagEvent(event);
                const proto = getProtocolConfig(event.protocol);

                return (
                  <motion.div
                    key={event.id}
                    initial={idx === 0 ? { opacity: 0, y: -8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex items-start gap-4 py-3.5 px-5 border-b border-border/50 text-sm transition-colors ${
                      isCivic
                        ? 'bg-error/8 border-l-2 border-l-error'
                        : 'hover:bg-muted/50'
                    }`}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '0 48px' }}
                  >
                    {/* Timestamp */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] pt-0.5 tabular-nums">
                      {formatTimestamp(event.timestamp)}
                    </span>

                    {/* Protocol badge */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${proto.bg} ${proto.text}`}
                    >
                      {proto.label}
                    </span>

                    {/* Description */}
                    <span
                      className={`flex-1 leading-relaxed ${
                        isCivic ? 'text-error-foreground font-medium' : 'text-foreground/80'
                      }`}
                    >
                      {formatEventDescription(event)}
                    </span>

                    {/* Event type tag */}
                    <span className="text-xs text-muted-foreground/60 whitespace-nowrap pt-0.5 hidden lg:block">
                      {event.type.split(':')[1] ?? event.type}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
