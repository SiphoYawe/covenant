import { CivicAuthProvider } from '@civic/auth-web3/nextjs';
import { Suspense } from 'react';
import { AppLayout } from '@/components/layout/app-layout';

export default function DeployLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppLayout><div className="flex items-center justify-center h-full text-muted-foreground">Loading auth...</div></AppLayout>}>
      <CivicAuthProvider>
        <AppLayout>{children}</AppLayout>
      </CivicAuthProvider>
    </Suspense>
  );
}
