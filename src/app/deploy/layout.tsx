'use client';

import { CivicAuthProvider } from '@civic/auth/nextjs';
import { AppLayout } from '@/components/layout/app-layout';

export default function DeployLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CivicAuthProvider>
      <AppLayout>{children}</AppLayout>
    </CivicAuthProvider>
  );
}
