import { getClaudeClient } from '@/lib/ai/client';
import { createEventBus } from '@/lib/events/bus';
import { Protocol } from '@/lib/events/types';
import { kvGet, kvSet } from '@/lib/storage/kv';
import { pin } from '@/lib/storage/ipfs';
import type {
  ExplanationInput,
  ExplanationResult,
  AgentReputationCache,
} from './types';

/**
 * Strip markdown formatting from explanation text, keeping line breaks.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')        // *italic* -> italic
    .replace(/__([^_]+)__/g, '$1')        // __bold__ -> bold
    .replace(/_([^_]+)_/g, '$1')          // _italic_ -> italic
    .replace(/^#{1,6}\s+/gm, '')          // # headers -> plain
    .replace(/^[-*+]\s+/gm, '')           // - bullet -> plain
    .replace(/^\d+\.\s+/gm, '')           // 1. numbered -> plain
    .replace(/`([^`]+)`/g, '$1')          // `code` -> code
    .replace(/^>\s+/gm, '')              // > blockquote -> plain
    .trim();
}

/**
 * Generate a natural language explanation for a reputation score using Claude.
 * Contextual, not templated: AI reasons about the specific signal combination.
 */
export async function generateExplanation(input: ExplanationInput): Promise<string> {
  const claude = getClaudeClient();

  const systemPrompt = `You are writing concise, contextual reputation explanations for AI agents in an ERC-8004 marketplace. Each explanation should reference specific signal values. Be direct and factual. Use this format: "Agent Name: score/10. Key facts about their performance." Keep it under 200 words. IMPORTANT: Do not use any markdown formatting. No asterisks, no bold, no italic, no headers, no bullet points with dashes or stars. Use plain text only. Line breaks are fine for readability.`;

  const userMessage = `Generate a reputation explanation for this agent:

Agent: ${input.agentName} (${input.agentRole})
Score: ${input.score}/10
Classification: ${input.classification}
Jobs: ${input.jobCount} total, ${(input.successRate * 100).toFixed(0)}% success, ${(input.failureRate * 100).toFixed(0)}% failure
Payment volume: $${input.paymentVolume.toFixed(2)} USDC
Stake-weighted average: ${input.stakeWeightedAverage.toFixed(2)}
Trust graph: ${input.trustGraphPosition.inboundTrust.toFixed(2)} inbound, ${input.trustGraphPosition.outboundTrust.toFixed(2)} outbound
${input.civicFlags.length > 0 ? `Civic flags: ${JSON.stringify(input.civicFlags)}` : 'No Civic flags'}
${input.sybilAlerts.length > 0 ? `Sybil alerts: ${input.sybilAlerts.map((a) => `${a.patternType} (confidence: ${a.confidence})`).join(', ')}` : 'No Sybil alerts'}`;

  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content.find((c: { type: string }) => c.type === 'text');
  if (!text || text.type !== 'text') {
    return `${input.agentName}: ${input.score}/10`;
  }

  return stripMarkdown((text as { type: 'text'; text: string }).text);
}

/**
 * Store explanation on IPFS via Pinata. Falls back to KV on failure.
 */
export async function storeExplanation(
  agentId: string,
  explanation: string
): Promise<{ cid: string | null; storedInKV: boolean }> {
  try {
    const cid = await pin({
      agentId,
      explanation,
      generatedAt: Date.now(),
      version: '1.0',
    });
    return { cid, storedInKV: false };
  } catch {
    // Graceful degradation: store in KV with retry flag
    await kvSet(`agent:${agentId}:explanation-deferred`, {
      explanation,
      timestamp: Date.now(),
    });

    const bus = createEventBus();
    await bus.emit({
      type: 'reputation:explanation-pinning-deferred',
      protocol: Protocol.CovenantAi,
      agentId,
      data: { reason: 'Pinata unavailable' },
    });

    return { cid: null, storedInKV: true };
  }
}

/**
 * Cache reputation data with explanation CID in Vercel KV.
 */
export async function cacheReputationWithExplanation(
  agentId: string,
  score: number,
  explanationCID: string | null,
  explanationText: string | null,
  retryPinning: boolean
): Promise<void> {
  const cache: AgentReputationCache = {
    score,
    explanationCID,
    explanationText,
    retryPinning,
    updatedAt: Date.now(),
  };
  await kvSet(`agent:${agentId}:reputation`, cache);
}

/**
 * Full orchestration: generate explanation, store on IPFS, cache in KV.
 */
export async function generateAndStoreExplanation(
  input: ExplanationInput
): Promise<ExplanationResult> {
  const generatedAt = Date.now();

  // Step 1: Generate explanation text
  const explanation = await generateExplanation(input);

  // Step 2: Store on IPFS (with KV fallback)
  const storage = await storeExplanation(input.agentId, explanation);

  // Step 3: Cache in KV (always keep text for dashboard display)
  const explanationText = explanation;
  const retryPinning = storage.cid === null;
  await cacheReputationWithExplanation(
    input.agentId,
    input.score,
    storage.cid,
    explanationText,
    retryPinning
  );

  // Step 4: Emit event
  const bus = createEventBus();
  await bus.emit({
    type: 'reputation:explanation-generated',
    protocol: Protocol.CovenantAi,
    agentId: input.agentId,
    data: {
      score: input.score,
      cid: storage.cid,
      classification: input.classification,
    },
  });

  return {
    agentId: input.agentId,
    explanation,
    cid: storage.cid,
    storedInKV: storage.storedInKV,
    retryPinning,
    generatedAt,
  };
}

/**
 * Retry pinning a deferred explanation to IPFS.
 */
export async function retryDeferredPinning(
  agentId: string
): Promise<{ cid: string | null; success: boolean }> {
  const cache = await kvGet<AgentReputationCache>(`agent:${agentId}:reputation`);

  if (!cache || !cache.retryPinning || !cache.explanationText) {
    return { cid: null, success: false };
  }

  try {
    const cid = await pin({
      agentId,
      explanation: cache.explanationText,
      generatedAt: cache.updatedAt,
      version: '1.0',
    });

    // Update cache
    await kvSet(`agent:${agentId}:reputation`, {
      ...cache,
      explanationCID: cid,
      explanationText: null,
      retryPinning: false,
      updatedAt: Date.now(),
    });

    return { cid, success: true };
  } catch {
    return { cid: null, success: false };
  }
}
