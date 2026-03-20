import { getClaudeClient } from '@/lib/ai/client';
import { EVALUATION_SYSTEM_PROMPT, buildEvaluationUserPrompt } from '@/lib/ai/prompts';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS } from '@/lib/config/constants';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import type { EvaluationResult, EvaluationScores, FeedbackPreparation } from './types';

type EvaluateParams = {
  evaluatorAgentId: string;
  targetAgentId: string;
  taskId: string;
  originalTask: string;
  deliverable: string;
  proofOfPayment: string;
  paymentAmount: string;
};

type ClaudeEvaluationResponse = {
  decision: 'accept' | 'reject';
  scores: EvaluationScores;
  reasoning: string;
};

function parseEvaluationResponse(text: string): ClaudeEvaluationResponse {
  const parsed = JSON.parse(text);
  if (!parsed.decision || !parsed.scores || !parsed.reasoning) {
    throw new Error('Missing required fields in evaluation response');
  }
  return parsed as ClaudeEvaluationResponse;
}

async function callClaude(originalTask: string, deliverable: string): Promise<ClaudeEvaluationResponse> {
  const client = getClaudeClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: EVALUATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildEvaluationUserPrompt(originalTask, deliverable) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseEvaluationResponse(text);
}

/**
 * Evaluate a deliverable using Claude AI.
 * Retries once on malformed JSON response.
 */
export async function evaluateDeliverable(params: EvaluateParams): Promise<EvaluationResult> {
  const { evaluatorAgentId, targetAgentId, taskId, originalTask, deliverable, proofOfPayment, paymentAmount } = params;

  let evaluation: ClaudeEvaluationResponse;
  try {
    evaluation = await callClaude(originalTask, deliverable);
  } catch {
    // Retry once on parse failure
    evaluation = await callClaude(originalTask, deliverable);
  }

  const result: EvaluationResult = {
    decision: evaluation.decision,
    reasoning: evaluation.reasoning,
    scores: evaluation.scores,
    evaluatorAgentId,
    targetAgentId,
    taskId,
  };

  // Emit task:evaluated event
  const bus = createEventBus();
  await bus.emit({
    type: EVENT_TYPES.TASK_EVALUATED,
    protocol: Protocol.CovenantAi,
    agentId: evaluatorAgentId,
    targetAgentId,
    data: {
      taskId,
      decision: result.decision,
      reasoning: result.reasoning,
      scores: result.scores,
    },
  });

  return result;
}

/**
 * Prepare feedback data for on-chain submission (Story 3.4).
 * On accept: positive feedback with reasoning.
 * On reject: negative feedback with reasoning + dimension scores.
 */
export function prepareFeedback(
  evaluation: EvaluationResult,
  paymentData: { proofOfPayment: string; paymentAmount: string }
): FeedbackPreparation {
  const isPositive = evaluation.decision === 'accept';

  let reasoning = evaluation.reasoning;
  if (!isPositive) {
    // Include dimension scores in rejection reasoning for explainability
    const { scores } = evaluation;
    reasoning = `${evaluation.reasoning} [Scores — completeness: ${scores.completeness}, accuracy: ${scores.accuracy}, relevance: ${scores.relevance}, quality: ${scores.quality}]`;
  }

  return {
    targetAgentId: evaluation.targetAgentId,
    isPositive,
    reasoning,
    proofOfPayment: paymentData.proofOfPayment,
    paymentAmount: paymentData.paymentAmount,
  };
}
