'use client';

import { CivicAuthProvider } from '@civic/auth/react';

export default function DeployLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CivicAuthProvider clientId={process.env.NEXT_PUBLIC_CIVIC_CLIENT_ID ?? ''}>
      {children}
    </CivicAuthProvider>
  );
}
