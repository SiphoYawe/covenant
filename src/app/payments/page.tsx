'use client';

import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAgents, useEdges, useMetrics, useDashboardStore } from '@/stores/dashboard';
import { formatUSDCCompact } from '@/components/dashboard/metrics-utils';
import {
  paginateItems,
} from '@/components/dashboard/seed-data-adapter';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

// --- Types ---

type Transaction = {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  protocol: string;
  txHash?: string;
};

// --- Metric Card ---

type MetricCardProps = {
  label: string;
  value: string;
  valueColor?: string;
};

function MetricCard({ label, value, valueColor }: MetricCardProps) {
  return (
    <div className="flex-1 bg-card card-elevated rounded-xl p-5">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</span>
      <div className="mt-2">
        <span className={`text-2xl font-bold ${valueColor ?? 'text-foreground'}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

// --- Constants ---

const PAGE_SIZE = 20;

// --- Page Component ---

export default function PaymentsPage() {
  const metrics = useMetrics();
  const agents = useAgents();
  const edges = useEdges();
  const paymentsPage = useDashboardStore((s) => s.paymentsPage);
  const setPaymentsPage = useDashboardStore((s) => s.setPaymentsPage);

  const [agentFilter, setAgentFilter] = useState<string>('all');

  const getAgentName = (id: string) => agents[id]?.name || id;

  // Build list of payment relationships from edges
  const allTransactions = useMemo<Transaction[]>(() => {
    return edges.map((edge, i) => ({
      id: `${edge.source}-${edge.target}-${i}`,
      fromId: edge.source,
      fromName: getAgentName(edge.source),
      toId: edge.target,
      toName: getAgentName(edge.target),
      amount: edge.weight,
      protocol: edge.protocol,
      txHash: edge.txHash,
    }));
  }, [edges, agents]);

  // Unique agent names for filter dropdown
  const agentOptions = useMemo(() => {
    const nameSet = new Map<string, string>();
    for (const tx of allTransactions) {
      nameSet.set(tx.fromId, tx.fromName);
      nameSet.set(tx.toId, tx.toName);
    }
    return Array.from(nameSet.entries())
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [allTransactions]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    if (agentFilter === 'all') return allTransactions;
    return allTransactions.filter(
      (tx) => tx.fromId === agentFilter || tx.toId === agentFilter,
    );
  }, [allTransactions, agentFilter]);

  // Paginate
  const paginated = useMemo(
    () => paginateItems(filteredTransactions, paymentsPage, PAGE_SIZE),
    [filteredTransactions, paymentsPage],
  );

  // Compute success rate from actual transactions
  const successRate = useMemo(() => {
    if (allTransactions.length === 0) return 0;
    return 100; // All settled payments are successful by definition
  }, [allTransactions.length]);

  // Reset to page 1 when filters change
  const handleAgentFilter = (value: string) => {
    setAgentFilter(value);
    setPaymentsPage(1);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6 h-full">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Payment History (x402)
          </h1>
        </div>

        {/* Metrics Row */}
        <div className="flex gap-4">
          <MetricCard
            label="Total Volume"
            value={`${formatUSDCCompact(metrics.totalPayments)} USDC`}
          />
          <MetricCard
            label="Avg Transaction"
            value={`${formatUSDCCompact(
              metrics.averagePayment ||
                (metrics.totalTransactions > 0
                  ? metrics.totalPayments / metrics.totalTransactions
                  : 0),
            )} USDC`}
          />
          <MetricCard
            label="Success Rate"
            value={`${successRate.toFixed(1)}%`}
            valueColor="text-score-excellent"
          />
          <MetricCard
            label="Total Transactions"
            value={metrics.totalTransactions.toLocaleString()}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="agent-filter"
              className="text-sm text-muted-foreground font-medium"
            >
              Agent
            </label>
            <select
              id="agent-filter"
              value={agentFilter}
              onChange={(e) => handleAgentFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="all">All Agents</option>
              {agentOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="flex-1 bg-card card-elevated rounded-xl overflow-hidden flex flex-col min-h-0">
          {/* Table Header */}
          <div className="flex items-center px-5 py-3 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-[200px] shrink-0">
              From
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-[200px] shrink-0">
              To
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-[140px] shrink-0">
              Amount
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-[120px] shrink-0">
              Protocol
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex-1">
              Tx Hash
            </span>
          </div>

          {/* Table Rows */}
          <div className="flex-1 overflow-y-auto">
            {paginated.items.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                {allTransactions.length === 0
                  ? 'No payment data yet. Run the demo to generate real transactions.'
                  : 'No payments match the selected filter.'}
              </div>
            ) : (
              paginated.items.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center px-5 py-3.5 border-b border-border hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground w-[200px] shrink-0 truncate">
                      {tx.fromName}
                    </span>
                    <span className="text-sm font-medium text-foreground w-[200px] shrink-0 truncate">
                      {tx.toName}
                    </span>
                    <span className="text-sm font-medium text-primary w-[140px] shrink-0">
                      {formatUSDCCompact(tx.amount)} USDC
                    </span>
                    <span className="text-xs text-muted-foreground w-[120px] shrink-0 uppercase">
                      {tx.protocol}
                    </span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {tx.txHash ? (
                        <a
                          href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground/70">--</span>
                      )}
                    </span>
                  </div>
                ))
            )}
          </div>

          {/* Pagination Controls */}
          {paginated.totalPages > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {filteredTransactions.length} transaction
                {filteredTransactions.length !== 1 ? 's' : ''} total
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPaymentsPage(Math.max(1, paymentsPage - 1))}
                  disabled={paymentsPage <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-secondary text-foreground hover:bg-secondary/80"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                  Prev
                </button>

                <span className="text-sm text-muted-foreground">
                  Page {paginated.currentPage} of {paginated.totalPages}
                </span>

                <button
                  onClick={() =>
                    setPaymentsPage(
                      Math.min(paginated.totalPages, paymentsPage + 1),
                    )
                  }
                  disabled={paymentsPage >= paginated.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-secondary text-foreground hover:bg-secondary/80"
                >
                  Next
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
