'use client';

import { useEffect, useRef, useState } from 'react';
import type { DemoEvent } from '@/lib/events';
import { EVENT_TYPES } from '@/lib/events';
import { useDashboardStore } from '@/stores/dashboard';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const SSE_EVENT_TYPES = [
  EVENT_TYPES.AGENT_REGISTERED,
  EVENT_TYPES.AGENT_METADATA_STORED,
  EVENT_TYPES.TASK_REQUESTED,
  EVENT_TYPES.TASK_NEGOTIATED,
  EVENT_TYPES.TASK_DELIVERED,
  EVENT_TYPES.TASK_ACCEPTED,
  EVENT_TYPES.TASK_REJECTED,
  EVENT_TYPES.PAYMENT_INITIATED,
  EVENT_TYPES.PAYMENT_SETTLED,
  EVENT_TYPES.PAYMENT_FAILED,
  EVENT_TYPES.CIVIC_IDENTITY_CHECKED,
  EVENT_TYPES.CIVIC_BEHAVIORAL_CHECKED,
  EVENT_TYPES.CIVIC_FLAGGED,
  EVENT_TYPES.CIVIC_CLEARED,
  EVENT_TYPES.REPUTATION_COMPUTING,
  EVENT_TYPES.REPUTATION_UPDATED,
  EVENT_TYPES.REPUTATION_EXPLANATION_STORED,
  EVENT_TYPES.FEEDBACK_SUBMITTED,
  EVENT_TYPES.FEEDBACK_RECORDED_ONCHAIN,
  EVENT_TYPES.DEMO_ACT_CHANGED,
  EVENT_TYPES.DEMO_RESET,
  EVENT_TYPES.DEMO_COMPLETE,
  // Seed event types emitted by the seeding engine
  'seed:registration',
  'seed:interaction',
  'seed:phase-complete',
  'seed:reputation-computed',
] as const;

export function useEvents(endpoint = '/api/events/stream') {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(endpoint);
    esRef.current = es;

    es.onopen = () => {
      setStatus('connected');
    };

    es.onerror = () => {
      setStatus('disconnected');
    };

    // Listen for each event type and dispatch to store
    const handleEvent = (messageEvent: MessageEvent) => {
      const event: DemoEvent = JSON.parse(messageEvent.data);
      useDashboardStore.getState().addEvent(event);
    };

    for (const type of SSE_EVENT_TYPES) {
      es.addEventListener(type, handleEvent as EventListener);
    }

    return () => {
      for (const type of SSE_EVENT_TYPES) {
        es.removeEventListener(type, handleEvent as EventListener);
      }
      es.close();
    };
  }, [endpoint]);

  return { status };
}
