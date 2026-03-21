import { kv } from '@/lib/storage/kv';
import { createEventBus } from '@/lib/events';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type GraphNode = {
  id: string;
  agentId: string;
  role: string;
  label: string;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  amount: string;
  txHash: string;
  outcome: string;
  timestamp: number;
};

export async function GET() {
  // Primary data sources: graph:nodes and graph:edges from KV
  // These contain deduplicated, real on-chain data
  const [graphNodes, graphEdges] = await Promise.all([
    kv.get<GraphNode[]>('graph:nodes'),
    kv.get<GraphEdge[]>('graph:edges'),
  ]);

  const nodes = graphNodes ?? [];
  const edges = graphEdges ?? [];

  // Build agent name map from seed:registration events
  const bus = createEventBus();
  const allEvents = await bus.since(0);

  // Map: agentId -> { name, role, walletName }
  // Use the LATEST registration for each agentId (from token range 2522-2549)
  const nameMap = new Map<string, { name: string; role: string; walletName: string }>();
  const civicFlagged = new Set<string>();
  let totalFeedback = 0;
  // Map: "source-target" -> real 0x txHash from feedback events
  const txHashMap = new Map<string, string>();

  // Civic event types to surface to the frontend
  const civicEventTypes = [
    'civic:identity-checked',
    'civic:behavioral-checked',
    'civic:flagged',
    'civic:tool-blocked',
    'civic:resolved',
  ];
  const civicEvents: typeof allEvents = [];
  // Pre-compute civic metrics server-side (not limited by store cap)
  const civicMetrics = {
    totalInspections: 0,
    l1Passes: 0,
    l2Passes: 0,
    l2Catches: 0,
    criticalFlags: 0,
  };

  for (const event of allEvents) {
    if (event.type === 'seed:registration' && event.agentId) {
      // Only keep registrations for the 28 real agents (2522-2549)
      const tokenId = parseInt(event.agentId.split(':')[1] ?? '0');
      if (tokenId >= 2522 && tokenId <= 2549) {
        nameMap.set(event.agentId, {
          name: (event.data.name as string) || '',
          role: (event.data.role as string) || '',
          walletName: (event.data.walletName as string) || '',
        });
      }
    }
    if (event.type === 'civic:flagged' && event.agentId) {
      civicFlagged.add(event.agentId);
    }
    if (civicEventTypes.includes(event.type)) {
      civicEvents.push(event);
      civicMetrics.totalInspections++;
      if (event.type === 'civic:identity-checked' && event.data?.passed) civicMetrics.l1Passes++;
      if (event.type === 'civic:behavioral-checked') civicMetrics.l2Passes++;
      if (event.type === 'civic:flagged') { civicMetrics.l2Catches++; civicMetrics.criticalFlags++; }
      if (event.type === 'civic:tool-blocked') { civicMetrics.l2Catches++; civicMetrics.criticalFlags++; }
      if (event.type === 'civic:resolved') { civicMetrics.l2Catches++; civicMetrics.criticalFlags++; }
    }
    if (event.type === 'feedback:submitted') {
      totalFeedback++;
      // Map real tx hashes to source-target pairs
      if (event.agentId && event.targetAgentId && event.data.txHash) {
        const key = `${event.agentId}-${event.targetAgentId}`;
        txHashMap.set(key, event.data.txHash as string);
      }
    }
  }

  // Load AI explanations from KV for each agent
  const explanationMap = new Map<string, string>();
  for (const node of nodes) {
    // Try deferred KV explanation first, then cached reputation
    const deferred = await kv.get<{ explanation: string }>(`agent:${node.agentId}:explanation-deferred`);
    if (deferred?.explanation) {
      explanationMap.set(node.agentId, deferred.explanation);
    } else {
      const cached = await kv.get<{ explanationText?: string | null }>(`agent:${node.agentId}:reputation`);
      if (cached?.explanationText) {
        explanationMap.set(node.agentId, cached.explanationText);
      }
    }
  }

  // Build agents from graph nodes enriched with names + explanations
  const agents: Record<string, {
    agentId: string;
    name: string;
    role: string;
    domain?: string;
    reputationScore?: number;
    civicFlagged?: boolean;
    lastUpdated: number;
    paymentVolume?: number;
    explanation?: string;
  }> = {};

  for (const node of nodes) {
    const info = nameMap.get(node.agentId);
    // Compute payment volume from edges
    let volume = 0;
    for (const edge of edges) {
      if (edge.source === node.agentId || edge.target === node.agentId) {
        volume += parseFloat(edge.amount) || 0;
      }
    }

    // Determine role/domain from walletName prefix
    const walletName = info?.walletName ?? '';
    let role = info?.role ?? '';
    let domain = '';
    if (walletName.startsWith('R')) { role = role || 'requester'; domain = 'research'; }
    else if (walletName.startsWith('S')) { role = role || 'provider'; domain = 'services'; }
    else if (walletName.startsWith('X')) { role = role || 'adversarial'; domain = 'adversarial'; }

    // Compute a reputation score from payment outcomes
    const agentEdges = edges.filter(e => e.source === node.agentId || e.target === node.agentId);
    const successEdges = agentEdges.filter(e => e.outcome === 'success');
    const reputationScore = agentEdges.length > 0
      ? (successEdges.length / agentEdges.length) * 10
      : 5.0; // default for agents with no transactions

    agents[node.agentId] = {
      agentId: node.agentId,
      name: info?.name ?? node.label,
      role,
      domain,
      reputationScore: Math.round(reputationScore * 10) / 10,
      civicFlagged: civicFlagged.has(node.agentId),
      lastUpdated: Date.now(),
      paymentVolume: volume,
      explanation: explanationMap.get(node.agentId) || undefined,
    };
  }

  // Build trust edges from graph edges, using real tx hashes from feedback events
  const trustEdges = edges.map(edge => {
    const key = `${edge.source}-${edge.target}`;
    return {
      source: edge.source,
      target: edge.target,
      weight: parseFloat(edge.amount) || 1,
      protocol: 'a2a',
      txHash: txHashMap.get(key) || undefined,
    };
  });

  // Compute metrics from real edge data
  const successfulEdges = edges.filter(e => e.outcome === 'success');
  const totalPayments = successfulEdges.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalTransactions = edges.length;

  return NextResponse.json({
    agents,
    edges: trustEdges,
    metrics: {
      totalPayments,
      totalTransactions,
      averagePayment: totalTransactions > 0 ? totalPayments / totalTransactions : 0,
      totalFeedback,
    },
    civicEvents,
    civicMetrics,
    eventCount: allEvents.length,
  });
}
