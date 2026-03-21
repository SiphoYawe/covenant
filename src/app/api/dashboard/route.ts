import { createEventBus } from '@/lib/events';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type AgentState = {
  agentId: string;
  name: string;
  role: string;
  domain?: string;
  reputationScore?: number;
  trustLevel?: string;
  civicFlagged?: boolean;
  lastUpdated: number;
  paymentVolume?: number;
};

type TrustEdge = {
  source: string;
  target: string;
  weight: number;
  protocol: string;
  txHash?: string;
};

export async function GET() {
  const bus = createEventBus();

  // Fetch ALL events from KV
  const allEvents = await bus.since(0);

  const agents: Record<string, AgentState> = {};
  const edgeMap = new Map<string, TrustEdge>();
  let totalPayments = 0;
  let totalTransactions = 0;
  let totalFeedback = 0;
  const civicInspections: typeof allEvents = [];

  for (const event of allEvents) {
    const data = event.data;

    switch (event.type) {
      case 'seed:registration':
        if (event.agentId) {
          agents[event.agentId] = {
            ...agents[event.agentId],
            agentId: event.agentId,
            name: (data.name as string) || '',
            role: (data.role as string) || '',
            lastUpdated: event.timestamp,
          };
        }
        break;

      case 'agent:registered':
        if (event.agentId) {
          agents[event.agentId] = {
            ...agents[event.agentId],
            agentId: event.agentId,
            name: (data.name as string) || '',
            role: (data.role as string) || '',
            lastUpdated: event.timestamp,
          };
        }
        break;

      case 'task:negotiated':
        if (event.agentId && event.targetAgentId) {
          const key = `${event.agentId}-${event.targetAgentId}`;
          const existing = edgeMap.get(key);
          const weight = (data.currentOffer as number) || (data.price as number) || 1;
          edgeMap.set(key, {
            source: event.agentId,
            target: event.targetAgentId,
            weight: existing ? existing.weight + weight : weight,
            protocol: event.protocol,
            txHash: (data.txHash as string) || existing?.txHash,
          });
        }
        break;

      case 'seed:interaction': {
        const usdcAmount = (data.usdcAmount as number) || 0;
        if (usdcAmount > 0) {
          totalPayments += usdcAmount;
          totalTransactions += 1;
        }
        break;
      }

      case 'payment:settled': {
        const amount = (data.amount as number) || 0;
        totalPayments += amount;
        totalTransactions += 1;
        break;
      }

      case 'feedback:submitted':
        totalFeedback += 1;
        break;

      case 'reputation:updated':
        if (event.agentId && agents[event.agentId]) {
          agents[event.agentId].reputationScore = data.reputationScore as number;
          agents[event.agentId].trustLevel = data.trustLevel as string;
        }
        break;

      case 'civic:flagged':
        if (event.agentId && agents[event.agentId]) {
          agents[event.agentId].civicFlagged = true;
        }
        civicInspections.push(event);
        break;

      case 'civic:identity-checked':
      case 'civic:behavioral-checked':
      case 'civic:tool-blocked':
      case 'civic:resolved':
        civicInspections.push(event);
        break;
    }
  }

  // Deduplicate edges: keep only unique source-target pairs
  const edges = Array.from(edgeMap.values());

  return NextResponse.json({
    agents,
    edges,
    metrics: {
      totalPayments,
      totalTransactions,
      averagePayment: totalTransactions > 0 ? totalPayments / totalTransactions : 0,
      totalFeedback,
    },
    eventCount: allEvents.length,
  });
}
