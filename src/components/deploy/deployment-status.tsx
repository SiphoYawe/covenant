'use client';

import Link from 'next/link';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Loading03Icon,
  CircleIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useDeployStore } from '@/stores/deploy-store';
import { Button } from '@/components/ui/button';
import type { DeployStep } from '@/stores/deploy-store';

function StepIcon({ status }: { status: DeployStep['status'] }) {
  switch (status) {
    case 'complete':
      return <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} className="text-score-excellent" />;
    case 'error':
      return <HugeiconsIcon icon={Cancel01Icon} size={20} className="text-score-critical" />;
    case 'in-progress':
      return <HugeiconsIcon icon={Loading03Icon} size={20} className="text-primary animate-spin" />;
    default:
      return <HugeiconsIcon icon={CircleIcon} size={20} className="text-muted-foreground" />;
  }
}

export function DeploymentStatus() {
  const status = useDeployStore((s) => s.status);
  const steps = useDeployStore((s) => s.steps);
  const result = useDeployStore((s) => s.result);
  const error = useDeployStore((s) => s.error);
  const reset = useDeployStore((s) => s.reset);

  if (status === 'idle') return null;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 animate-fade-in">
      <h3 className="text-sm font-semibold text-foreground mb-4">Deployment Progress</h3>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            <StepIcon status={step.status} />
            <div className="flex-1">
              <span
                className={`text-sm ${
                  step.status === 'error'
                    ? 'text-score-critical'
                    : step.status === 'complete'
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
              {step.error && (
                <p className="text-xs text-score-critical mt-0.5">{step.error}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Success */}
      {status === 'success' && result && (
        <div className="mt-6 rounded-2xl border border-score-excellent/30 bg-success/10 p-4 space-y-2">
          <p className="text-sm font-medium text-score-excellent">Agent deployed successfully</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Agent ID: <span className="text-foreground font-mono text-xs">{result.agentId}</span>
            </p>
            <p>
              Address: <span className="text-foreground font-mono text-xs">{result.address}</span>
            </p>
          </div>
          <Link
            href={`/?agent=${result.agentId}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
          >
            View in Dashboard
          </Link>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="mt-4 flex items-center gap-3">
          {error && !steps.some((s) => s.error) && (
            <p className="text-sm text-score-critical">{error}</p>
          )}
          <Button variant="secondary" size="sm" onClick={reset}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
