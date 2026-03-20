'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { DemoEvent } from '@/lib/events';
import { EVENT_TYPES } from '@/lib/events';

// --- Types ---

export type AgentState = {
  agentId: string;
  name: string;
  role: string;
  reputationScore?: number;
  trustLevel?: string;
  civicFlagged?: boolean;
  lastUpdated: number;
};

export type TrustEdge = {
  source: string;
  target: string;
  weight: number;
  protocol: string;
};

export type EconomicMetrics = {
  totalPayments: number;
  totalTransactions: number;
  averagePayment: number;
  totalFeedback: number;
};

export type DemoState = {
  currentAct: number;
  status: 'idle' | 'running' | 'complete';
};

export type DashboardState = {
  agents: Record<string, AgentState>;
  edges: TrustEdge[];
  events: DemoEvent[];
  metrics: EconomicMetrics;
  demoState: DemoState;
  selectedAgentId: string | null;
};

export type DashboardActions = {
  addEvent: (event: DemoEvent) => void;
  updateAgent: (agentId: string, update: Partial<Omit<AgentState, 'agentId'>>) => void;
  addEdge: (edge: TrustEdge) => void;
  updateMetrics: (partial: Partial<EconomicMetrics>) => void;
  setSelectedAgent: (agentId: string | null) => void;
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
  demoState: {
    currentAct: 0,
    status: 'idle',
  },
  selectedAgentId: null,
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
            currentAct: data.act as number,
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

  setSelectedAgent: (agentId: string | null) => {
    set({ selectedAgentId: agentId });
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

export const useSelectedAgentId = () =>
  useDashboardStore((s) => s.selectedAgentId);
