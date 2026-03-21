'use client';

import { CivicAuthProvider } from '@civic/auth/react';
import { Sidebar } from './sidebar';
import { SeedDataProvider } from '@/components/dashboard/seed-data-provider';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <CivicAuthProvider clientId={process.env.NEXT_PUBLIC_CIVIC_CLIENT_ID ?? ''}>
      <SeedDataProvider>
        <div className="flex h-screen bg-background">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </SeedDataProvider>
    </CivicAuthProvider>
  );
}
