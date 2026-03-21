'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { TrustGraph } from '@/components/dashboard/trust-graph';
import { HugeiconsIcon } from '@hugeicons/react';
import { InformationCircleIcon } from '@hugeicons/core-free-icons';

export default function TrustGraphPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">Trust Graph</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-score-excellent" />
              <span className="text-xs text-muted-foreground">Trusted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Good</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-score-critical" />
              <span className="text-xs text-muted-foreground">Malicious</span>
            </div>
          </div>
        </div>

        {/* Full-screen graph */}
        <div className="flex-1 bg-card rounded-3xl border border-border overflow-hidden min-h-0 relative">
          <div className="absolute inset-0">
            <TrustGraph />
          </div>
          <div className="absolute top-4 left-5 flex items-center gap-1.5 pointer-events-none">
            <HugeiconsIcon icon={InformationCircleIcon} size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Node size = reputation weight. Line thickness = transaction volume.
            </span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
