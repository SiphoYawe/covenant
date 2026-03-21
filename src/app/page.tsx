'use client';

import Image from 'next/image';
import { EconomicSummary } from '@/components/dashboard/economic-summary';
import { TrustGraph } from '@/components/dashboard/trust-graph';
import { ReputationCards } from '@/components/dashboard/reputation-cards';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { AgentDetail } from '@/components/dashboard/agent-detail';
import { useEvents } from '@/hooks/use-events';

export default function Home() {
  const { status } = useEvents();

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Image
            src="/covenant-logo-light-text.svg"
            alt="Covenant"
            width={160}
            height={36}
            priority
          />
          <span className="text-xs text-muted-foreground">AI Economic Reputation Layer</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/demo" className="text-xs px-3 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors">
            Run Demo
          </a>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${
              status === 'connected' ? 'bg-score-excellent' :
              status === 'connecting' ? 'bg-score-moderate animate-pulse' :
              'bg-score-critical'
            }`} />
            <span className="text-xs text-muted-foreground">Base Sepolia</span>
          </div>
        </div>
      </header>

      {/* Economic Summary Bar */}
      <div className="px-6 py-3 border-b border-border">
        <EconomicSummary />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar: Agent Cards */}
        <aside className="w-80 border-r border-border p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Agents</h2>
          <ReputationCards />
        </aside>

        {/* Center: Trust Graph */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <TrustGraph />
          </div>

          {/* Bottom: Activity Feed */}
          <div className="h-48 border-t border-border p-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Activity</h2>
            <div className="h-[calc(100%-28px)]">
              <ActivityFeed />
            </div>
          </div>
        </main>

        {/* Right Sidebar: Agent Detail */}
        <aside className="w-80 border-l border-border p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Details</h2>
          <AgentDetail />
        </aside>
      </div>
    </div>
  );
}
