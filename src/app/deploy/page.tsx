'use client';

import { UserButton } from '@civic/auth/react';
import { DeployForm } from '@/components/deploy/deploy-form';
import { DeploymentStatus } from '@/components/deploy/deployment-status';

export default function DeployPage() {
  return (
    <div className="flex flex-col gap-6 p-8 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Deploy Agent</h1>
        <UserButton />
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto w-full space-y-8">
        <DeployForm />
        <DeploymentStatus />
      </div>
    </div>
  );
}
