'use client';

import { UserButton } from '@civic/auth/react';
import { DeployForm } from '@/components/deploy/deploy-form';
import { DeploymentStatus } from '@/components/deploy/deployment-status';

export default function DeployPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Deploy Agent</h1>
          <UserButton />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <DeployForm />
        <DeploymentStatus />
      </main>
    </div>
  );
}
