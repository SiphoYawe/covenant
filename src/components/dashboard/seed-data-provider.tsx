'use client';

/**
 * SeedDataProvider is a passthrough. The dashboard store is populated
 * exclusively from real backend data delivered via SSE (/api/events/stream).
 * Use the "Re-seed" button on the demo page to seed the backend, which
 * will emit real events that flow into the store.
 */
export function SeedDataProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
