'use client';

import { Sidebar } from './sidebar';
import { SeedDataProvider } from '@/components/dashboard/seed-data-provider';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SeedDataProvider>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </SeedDataProvider>
  );
}
