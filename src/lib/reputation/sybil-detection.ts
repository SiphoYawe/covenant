import { getClaudeClient } from '@/lib/ai/client';
import { createEventBus } from '@/lib/events/bus';
import { Protocol } from '@/lib/events/types';
import { kvGet, kvSet } from '@/lib/storage/kv';
import type {
  PaymentGraph,
  SybilAlert,
  SybilPatternType,
  TransactionRecord,
  ExtractedPatterns,
  AgentContext,
  SybilDetectionInput,
  SybilDetectionResult,
} from './types';

// --- Pattern extraction (pure, deterministic) ---

/**
 * Find circular payment cycles (A->B->C->A) in the directed graph.
 * Uses DFS-based cycle detection.
 */
export function extractCircularPayments(
  graph: PaymentGraph
): Array<{ cycle: string[]; edgeCount: number }> {
  if (graph.edges.length === 0) return [];

  // Build adjacency list
  const adj = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, new Set());
    adj.get(edge.source)!.add(edge.target);
  }

  const cycles: Array<{ cycle: string[]; edgeCount: number }> = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = adj.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        if (inStack.has(next)) {
          // Found a cycle: extract from where `next` appears in path
          const cycleStart = path.indexOf(next);
          const cycle = path.slice(cycleStart);
          if (cycle.length >= 3) {
            cycles.push({ cycle: [...cycle], edgeCount: cycle.length });
          }
        } else if (!visited.has(next)) {
          dfs(next);
        }
      }
    }

    path.pop();
    inStack.delete(node);
  }

  const agentIds = graph.nodes.map((n) => n.agentId).sort();
  for (const id of agentIds) {
    if (!visited.has(id)) {
      dfs(id);
    }
  }

  return cycles;
}

/**
 * Find agents with suspiciously uniform feedback (zero or near-zero variance).
 * Requires at least 3 feedback records per agent to flag.
 */
export function extractUniformFeedback(
  history: TransactionRecord[]
): Array<{ agentId: string; feedbackValues: number[]; variance: number }> {
  // Group by target agent (the "to" field)
  const grouped = new Map<string, number[]>();
  for (const tx of history) {
    const vals = grouped.get(tx.to) ?? [];
    vals.push(tx.feedbackValue);
    grouped.set(tx.to, vals);
  }

  const results: Array<{ agentId: string; feedbackValues: number[]; variance: number }> = [];

  for (const [agentId, values] of grouped) {
    if (values.length < 3) continue;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

    // Only flag if variance is exactly 0 (perfectly uniform)
    if (variance === 0) {
      results.push({ agentId, feedbackValues: values, variance });
    }
  }

  return results;
}

/**
 * Find agents with many tiny transactions (<0.10 USDC), indicating padding.
 * Threshold: >5 tiny transactions.
 */
export function extractTransactionPadding(
  history: TransactionRecord[]
): Array<{ agentId: string; tinyTxCount: number; totalTxCount: number }> {
  const TINY_THRESHOLD = 0.10;
  const MIN_TINY_COUNT = 5;

  // Group by target agent
  const grouped = new Map<string, { tiny: number; total: number }>();
  for (const tx of history) {
    const counts = grouped.get(tx.to) ?? { tiny: 0, total: 0 };
    counts.total++;
    if (tx.amount < TINY_THRESHOLD) counts.tiny++;
    grouped.set(tx.to, counts);
  }

  const results: Array<{ agentId: string; tinyTxCount: number; totalTxCount: number }> = [];

  for (const [agentId, counts] of grouped) {
    if (counts.tiny >= MIN_TINY_COUNT) {
      results.push({ agentId, tinyTxCount: counts.tiny, totalTxCount: counts.total });
    }
  }

  return results;
}

/**
 * Find agent pairs with rapid repeated transactions (>3 within 60 seconds).
 */
export function extractRapidRepeats(
  history: TransactionRecord[]
): Array<{ pair: [string, string]; count: number; windowMs: number }> {
  const WINDOW_MS = 60_000;
  const MIN_COUNT = 4;

  // Group by directed pair
  const pairMap = new Map<string, number[]>();
  for (const tx of history) {
    const key = `${tx.from}->${tx.to}`;
    const timestamps = pairMap.get(key) ?? [];
    timestamps.push(tx.timestamp);
    pairMap.set(key, timestamps);
  }

  const results: Array<{ pair: [string, string]; count: number; windowMs: number }> = [];

  for (const [key, timestamps] of pairMap) {
    const sorted = [...timestamps].sort((a, b) => a - b);
    if (sorted.length < MIN_COUNT) continue;

    // Sliding window check
    for (let i = 0; i <= sorted.length - MIN_COUNT; i++) {
      const windowEnd = sorted[i] + WINDOW_MS;
      let count = 0;
      for (let j = i; j < sorted.length && sorted[j] <= windowEnd; j++) {
        count++;
      }
      if (count >= MIN_COUNT) {
        const [from, to] = key.split('->');
        results.push({ pair: [from, to], count, windowMs: WINDOW_MS });
        break; // One flag per pair is enough
      }
    }
  }

  return results;
}

// --- AI reasoning layer ---

/**
 * Send extracted patterns to Claude for classification.
 * Returns SybilAlert records based on AI analysis.
 */
export async function analyzePatternsWithAI(
  patterns: ExtractedPatterns,
  agentContexts: AgentContext[]
): Promise<SybilAlert[]> {
  const claude = getClaudeClient();

  const systemPrompt = `You are analyzing an agent payment graph for Sybil attacks and adversarial behavior in an ERC-8004 agent marketplace.

Key distinction:
- Sybil = coordinated fake accounts manipulating reputation (circular payments, manufactured reputation)
- Adversarial = a single real agent behaving maliciously (e.g., prompt injection, payment failure)
- A Civic-flagged agent with payment failure is adversarial, NOT Sybil

For each suspicious pattern, classify as one of: circular_payments, uniform_feedback, reputation_farming, rapid_transactions, adversarial_behavior

Respond with a JSON object: { "alerts": [...], "reasoning": "..." }
Each alert: { "patternType": string, "involvedAgents": string[], "confidence": number (0-1), "evidence": string }`;

  const userMessage = `Extracted patterns from payment graph:
${JSON.stringify(patterns, null, 2)}

Agent context (Civic flags, feedback history):
${JSON.stringify(agentContexts, null, 2)}

Analyze these patterns. For each suspicious finding, create an alert with classification, confidence, and evidence. Note: this is a small demo dataset with 4 agents, so focus on structural patterns rather than statistical significance.`;

  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content.find((c: { type: string }) => c.type === 'text');
    if (!text || text.type !== 'text') return [];

    const parsed = JSON.parse((text as { type: 'text'; text: string }).text);
    const rawAlerts = parsed.alerts ?? [];

    return rawAlerts.map((a: { patternType: string; involvedAgents: string[]; confidence: number; evidence: string }) => ({
      id: `sybil-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      patternType: a.patternType as SybilPatternType,
      involvedAgents: a.involvedAgents,
      confidence: Math.min(1, Math.max(0, a.confidence)),
      evidence: a.evidence,
      timestamp: Date.now(),
    }));
  } catch (error) {
    // Retry once with 2s delay
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const response = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content.find((c: { type: string }) => c.type === 'text');
      if (!text || text.type !== 'text') return [];

      const parsed = JSON.parse((text as { type: 'text'; text: string }).text);
      return (parsed.alerts ?? []).map((a: { patternType: string; involvedAgents: string[]; confidence: number; evidence: string }) => ({
        id: `sybil-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        patternType: a.patternType as SybilPatternType,
        involvedAgents: a.involvedAgents,
        confidence: Math.min(1, Math.max(0, a.confidence)),
        evidence: a.evidence,
        timestamp: Date.now(),
      }));
    } catch {
      // Both attempts failed, return empty
      return [];
    }
  }
}

// --- Main orchestrator ---

function hasPatterns(patterns: ExtractedPatterns): boolean {
  return (
    patterns.circularPayments.length > 0 ||
    patterns.uniformFeedback.length > 0 ||
    patterns.transactionPadding.length > 0 ||
    patterns.rapidRepeats.length > 0
  );
}

/**
 * Main Sybil detection function. Extracts patterns, checks for agent context,
 * sends to AI for classification, and returns alerts.
 */
export async function detectSybilPatterns(
  input: SybilDetectionInput
): Promise<SybilDetectionResult> {
  const { graph, transactionHistory, agentIds } = input;

  // Step 1: Extract patterns
  const patterns: ExtractedPatterns = {
    circularPayments: extractCircularPayments(graph),
    uniformFeedback: extractUniformFeedback(transactionHistory),
    transactionPadding: extractTransactionPadding(transactionHistory),
    rapidRepeats: extractRapidRepeats(transactionHistory),
  };

  // Step 2: Check for agent context (Civic flags)
  const agentContexts: AgentContext[] = [];
  for (const agentId of agentIds) {
    const flags = await kvGet<Array<{ severity: string; attackType: string; evidence: string }>>(
      `agent:${agentId}:civic-flags`
    );
    const feedbackHistory = await kvGet<Array<{ value: number; outcome: string }>>(
      `agent:${agentId}:feedback-history`
    );

    // Include agent context if they have flags or feedback
    if ((flags && flags.length > 0) || (feedbackHistory && feedbackHistory.length > 0)) {
      agentContexts.push({
        agentId,
        civicFlags: flags ?? [],
        feedbackHistory: feedbackHistory ?? [],
      });
    }
  }

  // Check if there's anything suspicious (patterns or flagged agents)
  if (!hasPatterns(patterns) && agentContexts.length === 0) {
    return {
      alerts: [],
      analysisTimestamp: Date.now(),
      reasoning: 'No suspicious patterns detected',
    };
  }

  // Step 3: AI reasoning
  const alerts = await analyzePatternsWithAI(patterns, agentContexts);

  return {
    alerts,
    analysisTimestamp: Date.now(),
    reasoning: alerts.length > 0 ? `Detected ${alerts.length} alert(s)` : 'No confirmed threats',
  };
}

// --- KV storage and event emission ---

/**
 * Store Sybil alerts in Vercel KV and emit events.
 */
export async function storeSybilAlerts(alerts: SybilAlert[]): Promise<void> {
  if (alerts.length === 0) return;

  // Read existing alerts
  const existing = (await kvGet<SybilAlert[]>('sybil:alerts')) ?? [];
  const updated = [...existing, ...alerts];
  await kvSet('sybil:alerts', updated);

  // Store per-agent references
  for (const alert of alerts) {
    for (const agentId of alert.involvedAgents) {
      const agentAlerts =
        (await kvGet<string[]>(`agent:${agentId}:sybil-alerts`)) ?? [];
      agentAlerts.push(alert.id);
      await kvSet(`agent:${agentId}:sybil-alerts`, agentAlerts);
    }
  }

  // Emit events
  const bus = createEventBus();
  for (const alert of alerts) {
    await bus.emit({
      type: 'reputation:sybil-alert',
      protocol: Protocol.CovenantAi,
      agentId: alert.involvedAgents[0],
      data: {
        alertId: alert.id,
        patternType: alert.patternType,
        confidence: alert.confidence,
        involvedAgents: alert.involvedAgents,
        timestamp: alert.timestamp,
      },
    });
  }
}

/**
 * Read all stored Sybil alerts.
 */
export async function getSybilAlerts(): Promise<SybilAlert[]> {
  return (await kvGet<SybilAlert[]>('sybil:alerts')) ?? [];
}

/**
 * Read Sybil alerts involving a specific agent.
 */
export async function getSybilAlertsForAgent(agentId: string): Promise<SybilAlert[]> {
  const all = await getSybilAlerts();
  return all.filter((a) => a.involvedAgents.includes(agentId));
}
