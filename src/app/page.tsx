'use client';

import { EconomicSummary } from '@/components/dashboard/economic-summary';
import { TrustGraph } from '@/components/dashboard/trust-graph';
import { ReputationCards } from '@/components/dashboard/reputation-cards';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { AgentDetail } from '@/components/dashboard/agent-detail';

export default function Home() {
  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">Covenant</h1>
          <span className="text-xs text-zinc-500">AI Economic Reputation Layer</span>
        </div>
        <span className="text-xs text-zinc-600">Base Sepolia</span>
      </header>

      {/* Economic Summary Bar */}
      <div className="px-6 py-3 border-b border-zinc-800">
        <EconomicSummary />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar: Agent Cards */}
        <aside className="w-80 border-r border-zinc-800 p-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Agents</h2>
          <ReputationCards />
        </aside>

        {/* Center: Trust Graph */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <TrustGraph />
          </div>

          {/* Bottom: Activity Feed */}
          <div className="h-48 border-t border-zinc-800 p-4">
            <h2 className="text-sm font-medium text-zinc-400 mb-2">Activity</h2>
            <div className="h-[calc(100%-28px)]">
              <ActivityFeed />
            </div>
          </div>
        </main>

        {/* Right Sidebar: Agent Detail */}
        <aside className="w-80 border-l border-zinc-800 p-4">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Details</h2>
          <AgentDetail />
        </aside>
      </div>
    </div>
  );
}
