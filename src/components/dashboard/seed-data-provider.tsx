'use client';

import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboard';

/**
 * Loads the full computed dashboard state from /api/dashboard on mount.
 * SSE (/api/events/stream) then handles incremental updates on top.
 */
export function SeedDataProvider({ children }: { children: React.ReactNode }) {
  const loaded = useRef(false);
  const loadInitialState = useDashboardStore((s) => s.loadInitialState);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      loadInitialState();
    }
  }, [loadInitialState]);

  return <>{children}</>;
}
