'use client';

import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAgents, useEdges, useMetrics, useDashboardStore } from '@/stores/dashboard';
import { formatUSDCCompact } from '@/components/dashboard/metrics-utils';
import { formatTimestamp } from '@/components/dashboard/feed-utils';
import {
  truncateTxHash,
  baseScanTxUrl,
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
  status: 'Settled' | 'Rejected';
  txHash: string;
  timestamp: number;
  phase: string;
};

// --- Metric Card ---

type MetricCardProps = {
  label: string;
  value: string;
  valueColor?: string;
};

function MetricCard({ label, value, valueColor }: MetricCardProps) {
  return (
    <div className="flex-1 bg-card rounded-3xl border border-border p-5">
      <span className="text-muted-foreground text-[13px] font-medium">{label}</span>
      <div className="mt-1">
        <span className={`text-[24px] font-bold leading-tight ${valueColor ?? 'text-foreground'}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

// --- Mock tx hash generator ---

function generateTxHash(source: string, target: string, index: number): string {
  const base = `${source}${target}${index}`;
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    const charCode = base.charCodeAt(i % base.length) + i * 7 + index * 13;
    hash += (charCode % 16).toString(16);
  }
  return hash;
}

// --- Constants ---

const PAGE_SIZE = 20;

const PHASE_LABELS: Record<string, string> = {
  A: 'Phase A: Bootstrap',
  B: 'Phase B: Reputation',
  C: 'Phase C: Adversarial',
  D: 'Phase D: Detection',
  E: 'Phase E: Resolution',
};

// --- Page Component ---

export default function PaymentsPage() {
  const metrics = useMetrics();
  const agents = useAgents();
  const edges = useEdges();
  const paymentsPage = useDashboardStore((s) => s.paymentsPage);
  const setPaymentsPage = useDashboardStore((s) => s.setPaymentsPage);

  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  const getAgentName = (id: string) => agents[id]?.name || id;

  // Build list of all transactions from edges (one per edge occurrence)
  const allTransactions = useMemo<Transaction[]>(() => {
    const baseTime = Date.now();
    const txs: Transaction[] = [];

    edges.forEach((edge, i) => {
      const fromAgent = agents[edge.source];
      const isMalicious = fromAgent?.civicFlagged;

      // Determine phase from edge index distribution
      const totalEdges = edges.length;
      let phase: string;
      if (totalEdges === 0) {
        phase = 'A';
      } else {
        const ratio = i / totalEdges;
        if (ratio < 0.2) phase = 'A';
        else if (ratio < 0.4) phase = 'B';
        else if (ratio < 0.6) phase = 'C';
        else if (ratio < 0.8) phase = 'D';
        else phase = 'E';
      }

      txs.push({
        id: `${edge.source}-${edge.target}-${i}`,
        fromId: edge.source,
        fromName: getAgentName(edge.source),
        toId: edge.target,
        toName: getAgentName(edge.target),
        amount: edge.weight,
        status: isMalicious ? 'Rejected' : 'Settled',
        txHash: generateTxHash(edge.source, edge.target, i),
        timestamp: baseTime - i * 120000,
        phase,
      });
    });

    return txs;
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

  // Available phases for filter dropdown
  const phaseOptions = useMemo(() => {
    const phases = new Set<string>();
    for (const tx of allTransactions) {
      phases.add(tx.phase);
    }
    return Array.from(phases).sort();
  }, [allTransactions]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    let result = allTransactions;

    if (agentFilter !== 'all') {
      result = result.filter(
        (tx) => tx.fromId === agentFilter || tx.toId === agentFilter,
      );
    }

    if (phaseFilter !== 'all') {
      result = result.filter((tx) => tx.phase === phaseFilter);
    }

    return result;
  }, [allTransactions, agentFilter, phaseFilter]);

  // Paginate
  const paginated = useMemo(
    () => paginateItems(filteredTransactions, paymentsPage, PAGE_SIZE),
    [filteredTransactions, paymentsPage],
  );

  // Compute success rate
  const successRate = useMemo(() => {
    if (metrics.totalTransactions === 0) return 100;
    const failed = Object.values(agents).filter((a) => a.civicFlagged).length;
    return Math.max(
      0,
      ((metrics.totalTransactions - failed) / metrics.totalTransactions) * 100,
    );
  }, [metrics.totalTransactions, agents]);

  // Reset to page 1 when filters change
  const handleAgentFilter = (value: string) => {
    setAgentFilter(value);
    setPaymentsPage(1);
  };

  const handlePhaseFilter = (value: string) => {
    setPhaseFilter(value);
    setPaymentsPage(1);
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full">
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
              className="bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Agents</option>
              {agentOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="phase-filter"
              className="text-sm text-muted-foreground font-medium"
            >
              Phase
            </label>
            <select
              id="phase-filter"
              value={phaseFilter}
              onChange={(e) => handlePhaseFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Phases</option>
              {phaseOptions.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABELS[p] ?? `Phase ${p}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="flex-1 bg-card rounded-3xl border border-border overflow-hidden flex flex-col min-h-0">
          {/* Table Header */}
          <div className="flex items-center px-5 py-3 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground w-[180px] shrink-0">
              From
            </span>
            <span className="text-xs font-semibold text-muted-foreground w-[180px] shrink-0">
              To
            </span>
            <span className="text-xs font-semibold text-muted-foreground w-[120px] shrink-0">
              Amount
            </span>
            <span className="text-xs font-semibold text-muted-foreground w-[100px] shrink-0">
              Status
            </span>
            <span className="text-xs font-semibold text-muted-foreground w-[160px] shrink-0">
              Tx Hash
            </span>
            <span className="text-xs font-semibold text-muted-foreground flex-1">
              Date
            </span>
          </div>

          {/* Table Rows */}
          <div className="flex-1 overflow-y-auto">
            {paginated.items.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                {allTransactions.length === 0
                  ? 'No payment transactions yet. Run the demo to generate.'
                  : 'No transactions match the selected filters.'}
              </div>
            ) : (
              paginated.items.map((tx) => {
                const isRejected = tx.status === 'Rejected';

                return (
                  <div
                    key={tx.id}
                    className={`flex items-center px-5 py-3.5 border-b border-border transition-colors ${
                      isRejected ? 'bg-error/5' : ''
                    }`}
                  >
                    {/* From */}
                    <span
                      className={`text-sm w-[180px] shrink-0 truncate ${
                        isRejected ? 'text-score-critical' : 'text-foreground'
                      }`}
                    >
                      {tx.fromName}
                    </span>

                    {/* To */}
                    <span className="text-sm text-foreground w-[180px] shrink-0 truncate">
                      {tx.toName}
                    </span>

                    {/* Amount */}
                    <span
                      className={`text-sm font-medium w-[120px] shrink-0 ${
                        isRejected ? 'text-muted-foreground' : 'text-primary'
                      }`}
                    >
                      {formatUSDCCompact(tx.amount)} USDC
                    </span>

                    {/* Status Badge */}
                    <span className="w-[100px] shrink-0">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          isRejected
                            ? 'bg-error text-error-foreground'
                            : 'bg-success text-success-foreground'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </span>

                    {/* Tx Hash */}
                    <span className="w-[160px] shrink-0">
                      <a
                        href={baseScanTxUrl(tx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:text-primary/80 font-mono transition-colors"
                      >
                        {truncateTxHash(tx.txHash)}
                      </a>
                    </span>

                    {/* Date */}
                    <span className="text-xs text-muted-foreground flex-1">
                      {formatTimestamp(tx.timestamp)}
                    </span>
                  </div>
                );
              })
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-secondary text-foreground hover:bg-secondary/80"
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-secondary text-foreground hover:bg-secondary/80"
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
