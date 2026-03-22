'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { DemoEvent } from '@/lib/events';
import { EVENT_TYPES } from '@/lib/events';

// --- Types ---

export type FilterBy = 'all' | 'top-rated' | 'flagged' | 'excluded';
export type SortBy = 'score' | 'payment-volume' | 'domain';

export type AgentState = {
  agentId: string;
  name: string;
  role: string;
  domain?: string;
  reputationScore?: number;
  trustLevel?: string;
  civicFlagged?: boolean;
  lastUpdated: number;
  paymentVolume?: number;
  explanation?: string;
};

export type TrustEdge = {
  source: string;
  target: string;
  weight: number;
  protocol: string;
  txHash?: string;
};

export type EconomicMetrics = {
  totalPayments: number;
  totalTransactions: number;
  averagePayment: number;
  totalFeedback: number;
};

export type CivicMetrics = {
  totalInspections: number;
  l1Passes: number;
  l2Passes: number;
  l2Catches: number;
  criticalFlags: number;
};

export type DemoState = {
  status: 'idle' | 'seeded' | 'running' | 'complete';
};

export type DashboardState = {
  agents: Record<string, AgentState>;
  edges: TrustEdge[];
  events: DemoEvent[];
  metrics: EconomicMetrics;
  civicMetrics: CivicMetrics;
  demoState: DemoState;
  loading: boolean;
  selectedAgentId: string | null;
  filterBy: FilterBy;
  sortBy: SortBy;
  currentPage: number;
  pageSize: number;
  protocolFilter: string;
  searchQuery: string;
  paymentsPage: number;
};

export type DashboardActions = {
  addEvent: (event: DemoEvent) => void;
  updateAgent: (agentId: string, update: Partial<Omit<AgentState, 'agentId'>>) => void;
  addEdge: (edge: TrustEdge) => void;
  updateMetrics: (partial: Partial<EconomicMetrics>) => void;
  loadInitialState: () => Promise<void>;
  setSelectedAgent: (agentId: string | null) => void;
  setFilterBy: (filter: FilterBy) => void;
  setSortBy: (sort: SortBy) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setProtocolFilter: (protocol: string) => void;
  setSearchQuery: (query: string) => void;
  setPaymentsPage: (page: number) => void;
  resetDemo: () => void;
};

export type DashboardStore = DashboardState & DashboardActions;

// --- Initial State ---

const EVENTS_CAP = 50;

const initialState: DashboardState = {
  agents: {},
  edges: [],
  events: [],
  metrics: {
    totalPayments: 0,
    totalTransactions: 0,
    averagePayment: 0,
    totalFeedback: 0,
  },
  civicMetrics: {
    totalInspections: 0,
    l1Passes: 0,
    l2Passes: 0,
    l2Catches: 0,
    criticalFlags: 0,
  },
  demoState: {
    status: 'idle',
  },
  loading: true,
  selectedAgentId: null,
  filterBy: 'all',
  sortBy: 'score',
  currentPage: 1,
  pageSize: 12,
  protocolFilter: 'all',
  searchQuery: '',
  paymentsPage: 1,
};

// --- Store ---

export const useDashboardStore = create<DashboardStore>()((set, get) => ({
  ...initialState,

  addEvent: (event: DemoEvent) => {
    // Prepend event and cap at 50
    set((state) => ({
      events: [event, ...state.events].slice(0, EVENTS_CAP),
    }));

    // Route event to appropriate handler
    const { updateAgent, addEdge, updateMetrics } = get();
    const data = event.data;

    switch (event.type) {
      case EVENT_TYPES.AGENT_REGISTERED:
        if (event.agentId) {
          updateAgent(event.agentId, {
            name: data.name as string,
            role: data.role as string,
            lastUpdated: event.timestamp,
          });
        }
        break;

      case EVENT_TYPES.REPUTATION_UPDATED:
        if (event.agentId) {
          updateAgent(event.agentId, {
            reputationScore: data.reputationScore as number,
            trustLevel: data.trustLevel as string,
            lastUpdated: event.timestamp,
          });
        }
        break;

      case EVENT_TYPES.PAYMENT_SETTLED:
        updateMetrics({
          totalPayments:
            get().metrics.totalPayments + ((data.amount as number) || 0),
          totalTransactions: get().metrics.totalTransactions + 1,
        });
        break;

      case EVENT_TYPES.CIVIC_FLAGGED:
        if (event.agentId) {
          updateAgent(event.agentId, {
            civicFlagged: true,
            lastUpdated: event.timestamp,
          });
        }
        break;

      case EVENT_TYPES.DEMO_ACT_CHANGED:
        set({
          demoState: {
            status: data.status as DemoState['status'],
          },
        });
        break;

      case EVENT_TYPES.TASK_NEGOTIATED:
        if (event.agentId && event.targetAgentId) {
          addEdge({
            source: event.agentId,
            target: event.targetAgentId,
            weight: (data.price as number) || 1,
            protocol: event.protocol,
          });
        }
        break;

      case EVENT_TYPES.AGENT_DEPLOYED:
      case EVENT_TYPES.AGENT_DEPLOYED_HUMAN:
        if (event.agentId) {
          updateAgent(event.agentId, {
            name: (data.name as string) || '',
            role: (data.mode as string) || 'deployed',
            lastUpdated: event.timestamp,
          });
        }
        break;

      // --- Seed event types ---
      case 'seed:registration':
        if (event.agentId) {
          updateAgent(event.agentId, {
            name: (data.name as string) || '',
            role: (data.role as string) || '',
            lastUpdated: event.timestamp,
          });
        }
        break;

      case 'seed:interaction': {
        const requester = (data.requester as string) || event.agentId;
        const provider = (data.provider as string) || event.targetAgentId;
        const usdcAmount = (data.usdcAmount as number) || 0;
        if (requester && provider) {
          addEdge({
            source: requester,
            target: provider,
            weight: usdcAmount || 1,
            protocol: event.protocol,
            txHash: (data.txHash as string) || undefined,
          });
          if (usdcAmount > 0) {
            updateMetrics({
              totalPayments: get().metrics.totalPayments + usdcAmount,
              totalTransactions: get().metrics.totalTransactions + 1,
            });
          }
        }
        break;
      }

      case 'seed:reputation-computed':
        // Log only, no specific store mutation needed
        break;

      case 'seed:phase-complete':
        // Informational event, no store mutation needed
        break;
    }
  },

  updateAgent: (agentId: string, update: Partial<Omit<AgentState, 'agentId'>>) => {
    set((state) => {
      const existing = state.agents[agentId];
      const defaults: AgentState = {
        agentId,
        name: '',
        role: '',
        lastUpdated: Date.now(),
      };
      return {
        agents: {
          ...state.agents,
          [agentId]: { ...defaults, ...existing, ...update },
        },
      };
    });
  },

  addEdge: (edge: TrustEdge) => {
    set((state) => {
      const idx = state.edges.findIndex(
        (e) => e.source === edge.source && e.target === edge.target,
      );
      if (idx >= 0) {
        // Update existing edge
        const updated = [...state.edges];
        updated[idx] = edge;
        return { edges: updated };
      }
      return { edges: [...state.edges, edge] };
    });
  },

  updateMetrics: (partial: Partial<EconomicMetrics>) => {
    set((state) => ({
      metrics: { ...state.metrics, ...partial },
    }));
  },

  loadInitialState: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) return;
      const data = await res.json();
      // Merge civic events with any existing SSE events (dedup by id)
      const existingIds = new Set(get().events.map(e => e.id));
      const newEvents = (data.civicEvents ?? []).filter(
        (e: DemoEvent) => !existingIds.has(e.id),
      );
      const allEvents = [...newEvents, ...get().events]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, EVENTS_CAP);
      set({
        agents: data.agents ?? {},
        edges: data.edges ?? [],
        metrics: data.metrics ?? initialState.metrics,
        civicMetrics: data.civicMetrics ?? initialState.civicMetrics,
        events: allEvents,
      });
    } catch {
      // API failed, dashboard stays empty until SSE populates
    } finally {
      set({ loading: false });
    }
  },

  setSelectedAgent: (agentId: string | null) => {
    set({ selectedAgentId: agentId });
  },

  setFilterBy: (filter: FilterBy) => {
    set({ filterBy: filter, currentPage: 1 });
  },

  setSortBy: (sort: SortBy) => {
    set({ sortBy: sort, currentPage: 1 });
  },

  setCurrentPage: (page: number) => {
    set({ currentPage: page });
  },

  setPageSize: (size: number) => {
    set({ pageSize: size, currentPage: 1 });
  },

  setProtocolFilter: (protocol: string) => {
    set({ protocolFilter: protocol });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query, currentPage: 1 });
  },

  setPaymentsPage: (page: number) => {
    set({ paymentsPage: page });
  },

  resetDemo: () => {
    set({ ...initialState });
  },
}));

// --- Selector Helpers ---

export const useAgents = () =>
  useDashboardStore(useShallow((s) => s.agents));

export const useEvents = () =>
  useDashboardStore((s) => s.events);

export const useMetrics = () =>
  useDashboardStore(useShallow((s) => s.metrics));

export const useDemoState = () =>
  useDashboardStore(useShallow((s) => s.demoState));

export const useEdges = () =>
  useDashboardStore((s) => s.edges);

export const useCivicMetrics = () =>
  useDashboardStore(useShallow((s) => s.civicMetrics));

export const useLoading = () =>
  useDashboardStore((s) => s.loading);

export const useSelectedAgentId = () =>
  useDashboardStore((s) => s.selectedAgentId);
