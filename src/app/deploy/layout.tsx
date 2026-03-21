'use client';

import { CivicAuthProvider } from '@civic/auth/nextjs';

export default function DeployLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CivicAuthProvider>
      {children}
    </CivicAuthProvider>
  );
}
