import type { NegotiationParams, NegotiationResult, NegotiationMessage } from './types';
import { getClaudeClient } from '@/lib/ai/client';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS } from '@/lib/config/constants';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import { kvGet } from '@/lib/storage/kv';

const eventBus = createEventBus();

/** Default max negotiation rounds */
const DEFAULT_MAX_ROUNDS = 3;

/**
 * Run an AI-driven price negotiation between requester and provider.
 * Each side uses Claude to reason about offers.
 */
export async function negotiatePrice(params: NegotiationParams): Promise<NegotiationResult> {
  const { requesterId, providerId, taskDescription, initialOffer } = params;
  const maxRounds = params.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const messages: NegotiationMessage[] = [];

  let currentOffer = initialOffer;
  let round = 1;
  const taskId = crypto.randomUUID();

  // Initial offer from requester
  messages.push({
    agentId: requesterId,
    action: 'offer',
    amount: currentOffer,
    reasoning: `Initial offer of ${currentOffer} USDC for: ${taskDescription}`,
  });

  await emitNegotiationEvent(taskId, round, requesterId, providerId, 'offer', currentOffer);

  while (round <= maxRounds) {
    // Provider evaluates the offer
    const providerReputation = await getReputationScore(providerId);
    const providerDecision = await getAINegotiationDecision({
      role: 'provider',
      agentId: providerId,
      taskDescription,
      reputationScore: providerReputation,
      currentOffer,
      round,
      maxRounds,
    });

    messages.push({
      agentId: providerId,
      action: providerDecision.action as 'accept' | 'reject' | 'counter',
      amount: providerDecision.amount ?? currentOffer,
      reasoning: providerDecision.reasoning,
    });

    await emitNegotiationEvent(
      taskId, round, requesterId, providerId,
      providerDecision.action, providerDecision.amount ?? currentOffer,
      providerDecision.reasoning
    );

    if (providerDecision.action === 'accept') {
      return { status: 'agreed', agreedPrice: currentOffer, rounds: round, messages };
    }

    if (providerDecision.action === 'reject') {
      return { status: 'rejected', rounds: round, messages };
    }

    // Provider countered — requester evaluates
    const counterOffer = providerDecision.amount ?? currentOffer;

    if (round >= maxRounds) {
      return { status: 'expired', rounds: round, messages };
    }

    round++;

    const requesterReputation = await getReputationScore(requesterId);
    const requesterDecision = await getAINegotiationDecision({
      role: 'requester',
      agentId: requesterId,
      taskDescription,
      reputationScore: requesterReputation,
      currentOffer: counterOffer,
      round,
      maxRounds,
    });

    messages.push({
      agentId: requesterId,
      action: requesterDecision.action as 'accept' | 'reject' | 'counter',
      amount: requesterDecision.amount ?? counterOffer,
      reasoning: requesterDecision.reasoning,
    });

    await emitNegotiationEvent(
      taskId, round, requesterId, providerId,
      requesterDecision.action, requesterDecision.amount ?? counterOffer,
      requesterDecision.reasoning
    );

    if (requesterDecision.action === 'accept') {
      return { status: 'agreed', agreedPrice: counterOffer, rounds: round, messages };
    }

    if (requesterDecision.action === 'reject') {
      return { status: 'rejected', rounds: round, messages };
    }

    // Requester countered — update current offer for next round
    currentOffer = requesterDecision.amount ?? counterOffer;
  }

  return { status: 'expired', rounds: round, messages };
}

type NegotiationDecisionInput = {
  role: 'requester' | 'provider';
  agentId: string;
  taskDescription: string;
  reputationScore: number;
  currentOffer: number;
  round: number;
  maxRounds: number;
};

type NegotiationDecision = {
  action: 'accept' | 'reject' | 'counter';
  amount?: number;
  reasoning: string;
};

async function getAINegotiationDecision(input: NegotiationDecisionInput): Promise<NegotiationDecision> {
  const claude = getClaudeClient();

  const prompt = input.role === 'provider'
    ? `You are an AI agent negotiating a task price as the SERVICE PROVIDER.

Task: ${input.taskDescription}
Your reputation score: ${input.reputationScore}/10
Offered price: ${input.currentOffer} USDC
Round: ${input.round}/${input.maxRounds}

Consider:
- Higher reputation justifies higher prices
- Don't be unreasonable — the market has alternatives
- If the offer is fair for the task complexity, accept
- If too low, counter with a reasonable increase
- Typical range: 3-10 USDC for code reviews, 1-5 for summaries

Respond with ONLY valid JSON (no markdown): { "action": "accept" | "reject" | "counter", "amount": <number if counter>, "reasoning": "<brief explanation>" }`
    : `You are an AI agent negotiating a task price as the TASK REQUESTER (buyer).

Task: ${input.taskDescription}
Your reputation score: ${input.reputationScore}/10
Current counter-offer from provider: ${input.currentOffer} USDC
Round: ${input.round}/${input.maxRounds}

Consider:
- You want quality work at a fair price
- Consider the provider's counter — if reasonable, accept
- You can counter with a compromise price
- Don't overpay but don't lowball quality providers
- Last round approaching: consider accepting if close

Respond with ONLY valid JSON (no markdown): { "action": "accept" | "reject" | "counter", "amount": <number if counter>, "reasoning": "<brief explanation>" }`;

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: 'You are a negotiation AI. Respond with ONLY valid JSON, no markdown formatting.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('');

  try {
    // Strip markdown code blocks if present
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as NegotiationDecision;

    // Validate
    if (!['accept', 'reject', 'counter'].includes(parsed.action)) {
      return { action: 'accept', reasoning: 'Failed to parse AI decision, defaulting to accept' };
    }
    if (parsed.action === 'counter' && (typeof parsed.amount !== 'number' || parsed.amount <= 0)) {
      return { action: 'accept', reasoning: 'Invalid counter amount, defaulting to accept' };
    }

    return parsed;
  } catch {
    return { action: 'accept', reasoning: 'Failed to parse AI response, defaulting to accept' };
  }
}

async function getReputationScore(agentId: string): Promise<number> {
  const reputation = await kvGet<{ score: number }>(`agent:${agentId}:reputation`);
  return reputation?.score ?? 5.0;
}

async function emitNegotiationEvent(
  taskId: string,
  round: number,
  requesterId: string,
  providerId: string,
  action: string,
  currentOffer: number,
  reasoning?: string
): Promise<void> {
  await eventBus.emit({
    type: EVENT_TYPES.TASK_NEGOTIATED,
    protocol: Protocol.A2a,
    agentId: requesterId,
    targetAgentId: providerId,
    data: { taskId, round, requesterId, providerId, action, currentOffer, reasoning },
  });
}
