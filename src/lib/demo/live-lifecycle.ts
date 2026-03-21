import { discoverAgents, sendTask } from '@/lib/protocols/a2a/client';
import { negotiatePrice } from '@/lib/orchestrator/negotiation';
import { getCivicGateway } from '@/lib/civic/gateway';
import { executePayment } from '@/lib/protocols/x402/client';
import { recordPaymentProofs } from '@/lib/protocols/x402/proof';
import { evaluateDeliverable, prepareFeedback } from '@/lib/agents/evaluator';
import { giveFeedback } from '@/lib/protocols/erc8004/reputation';
import { triggerReputationPipeline } from '@/lib/reputation/engine';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export type LiveLifecycleRequest = {
  requesterId: string;
  providerId: string;
  taskDescription: string;
  capability: string;
  maxBudget: number;
};

export type LiveStepResult = {
  name: string;
  status: 'completed' | 'failed' | 'skipped';
  protocol: string;
  durationMs: number;
  data?: Record<string, unknown>;
};

export type LiveLifecycleResult = {
  success: boolean;
  requesterId: string;
  providerId: string;
  negotiatedPrice: number;
  paymentTxHash?: string;
  feedbackTxHash?: string;
  reputationUpdated: boolean;
  deliverable?: string;
  steps: LiveStepResult[];
  durationMs: number;
  error?: string;
};

async function emitStep(
  bus: ReturnType<typeof createEventBus>,
  step: string,
  protocol: Protocol,
  requesterId: string,
  providerId: string,
  data: Record<string, unknown> = {},
) {
  await bus.emit({
    type: EVENT_TYPES.LIVE_TRIGGER_STEP,
    protocol,
    agentId: requesterId,
    targetAgentId: providerId,
    data: { triggerType: 'lifecycle', step, ...data },
  });
}

export async function executeLiveLifecycle(
  request: LiveLifecycleRequest,
): Promise<LiveLifecycleResult> {
  const bus = createEventBus();
  const startTime = Date.now();
  const steps: LiveStepResult[] = [];

  const { requesterId, providerId, taskDescription, capability, maxBudget } = request;

  // Emit trigger started
  await bus.emit({
    type: EVENT_TYPES.LIVE_TRIGGER_STARTED,
    protocol: Protocol.CovenantAi,
    agentId: requesterId,
    targetAgentId: providerId,
    data: { triggerType: 'lifecycle', taskDescription, capability, maxBudget },
  });

  try {
    // --- Step 1: Discovery ---
    const discoveryStart = Date.now();
    await emitStep(bus, 'discovery-started', Protocol.A2a, requesterId, providerId, { capability });

    const agents = await discoverAgents(capability);

    await emitStep(bus, 'discovery-matched', Protocol.A2a, requesterId, providerId, {
      agentsFound: agents.length,
      matchedProvider: providerId,
    });
    steps.push({
      name: 'Discovery',
      status: 'completed',
      protocol: 'a2a',
      durationMs: Date.now() - discoveryStart,
      data: { agentsFound: agents.length },
    });

    // --- Step 2: Negotiation ---
    const negotiationStart = Date.now();
    await emitStep(bus, 'negotiation-started', Protocol.CovenantAi, requesterId, providerId, {
      initialOffer: maxBudget,
    });

    const negotiation = await negotiatePrice({
      requesterId,
      providerId,
      taskDescription,
      initialOffer: maxBudget,
    });

    if (negotiation.rounds > 1) {
      await emitStep(bus, 'negotiation-counter', Protocol.CovenantAi, requesterId, providerId, {
        round: negotiation.rounds,
        currentOffer: negotiation.agreedPrice,
      });
    }

    await emitStep(bus, 'negotiation-agreed', Protocol.CovenantAi, requesterId, providerId, {
      agreedPrice: negotiation.agreedPrice,
      rounds: negotiation.rounds,
    });

    const agreedPrice = negotiation.agreedPrice ?? maxBudget;
    steps.push({
      name: 'Negotiation',
      status: 'completed',
      protocol: 'covenant-ai',
      durationMs: Date.now() - negotiationStart,
      data: { agreedPrice, rounds: negotiation.rounds },
    });

    // --- Step 3: Payment ---
    const paymentStart = Date.now();
    await emitStep(bus, 'payment-initiated', Protocol.X402, requesterId, providerId, {
      amount: agreedPrice,
    });

    const paymentResult = await executePayment({
      payerAgentId: requesterId,
      payeeAgentId: providerId,
      amount: agreedPrice.toFixed(2),
      taskId: `live-lifecycle-${startTime}`,
    });

    await recordPaymentProofs({
      txHash: paymentResult.txHash,
      payerAgentId: requesterId,
      payeeAgentId: providerId,
      amount: paymentResult.amount,
      timestamp: paymentResult.timestamp,
      taskId: `live-lifecycle-${startTime}`,
    });

    await emitStep(bus, 'payment-confirmed', Protocol.X402, requesterId, providerId, {
      txHash: paymentResult.txHash,
      amount: paymentResult.amount,
    });
    steps.push({
      name: 'Payment',
      status: 'completed',
      protocol: 'x402',
      durationMs: Date.now() - paymentStart,
      data: { txHash: paymentResult.txHash, amount: paymentResult.amount },
    });

    // --- Step 4: Task Delivery ---
    const deliveryStart = Date.now();
    await emitStep(bus, 'delivery-started', Protocol.A2a, requesterId, providerId, {
      taskDescription,
    });

    const agentEndpoint = `${BASE_URL}/api/agents/${providerId}/a2a`;
    const task = await sendTask(agentEndpoint, {
      description: taskDescription,
      capability,
      offeredPayment: agreedPrice,
      requesterId,
    });

    const deliverable =
      task.artifacts?.[0]?.data ||
      task.messages?.find((m: { role: string }) => m.role === 'agent')?.parts?.[0]?.text ||
      'Task completed';

    await emitStep(bus, 'delivery-complete', Protocol.A2a, requesterId, providerId, {
      deliverableLength: deliverable.length,
    });
    steps.push({
      name: 'Delivery',
      status: 'completed',
      protocol: 'a2a',
      durationMs: Date.now() - deliveryStart,
      data: { deliverableLength: deliverable.length },
    });

    // --- Step 5: Civic L2 Inspection ---
    const civicStart = Date.now();
    await emitStep(bus, 'civic-inspecting', Protocol.Civic, requesterId, providerId);

    const gateway = getCivicGateway();
    const inspection = await gateway.inspectBehavior(
      providerId,
      { deliverable, taskDescription },
      'output',
      requesterId,
    );

    const civicPassed = inspection.result.passed;
    await emitStep(
      bus,
      civicPassed ? 'civic-passed' : 'civic-flagged',
      Protocol.Civic,
      requesterId,
      providerId,
      { passed: civicPassed, flagCount: inspection.result.flags?.length ?? 0 },
    );
    steps.push({
      name: 'Civic Inspection',
      status: 'completed',
      protocol: 'civic',
      durationMs: Date.now() - civicStart,
      data: { passed: civicPassed },
    });

    // --- Step 6: Evaluation ---
    const evalStart = Date.now();
    const evaluation = await evaluateDeliverable({
      evaluatorAgentId: requesterId,
      targetAgentId: providerId,
      taskId: task.id || `live-${startTime}`,
      originalTask: taskDescription,
      deliverable,
      proofOfPayment: paymentResult.txHash,
      paymentAmount: paymentResult.amount,
    });
    const isPositive = evaluation.decision === 'accept';
    steps.push({
      name: 'Evaluation',
      status: 'completed',
      protocol: 'covenant-ai',
      durationMs: Date.now() - evalStart,
      data: { decision: evaluation.decision },
    });

    // --- Step 7: Feedback ---
    const feedbackStart = Date.now();
    await emitStep(bus, 'feedback-submitting', Protocol.Erc8004, requesterId, providerId, {
      isPositive,
    });

    let feedbackTxHash: string | undefined;
    try {
      const feedbackData = prepareFeedback(
        {
          decision: isPositive ? 'accept' : 'reject',
          reasoning: evaluation.reasoning,
          scores: evaluation.scores ?? { completeness: 5, accuracy: 5, relevance: 5, quality: 5 },
          evaluatorAgentId: requesterId,
          targetAgentId: providerId,
          taskId: task.id || `live-${startTime}`,
        },
        { proofOfPayment: paymentResult.txHash, paymentAmount: paymentResult.amount },
      );

      const feedbackResult = await giveFeedback({
        targetAgentId: providerId,
        isPositive: feedbackData.isPositive,
        feedbackURI: feedbackData.reasoning,
        proofOfPayment: feedbackData.proofOfPayment,
        feedbackerAgentId: requesterId,
      });
      feedbackTxHash = feedbackResult.txHash;
    } catch {
      // Best-effort feedback
    }

    await emitStep(bus, 'feedback-confirmed', Protocol.Erc8004, requesterId, providerId, {
      txHash: feedbackTxHash,
      isPositive,
    });
    steps.push({
      name: 'Feedback',
      status: 'completed',
      protocol: 'erc8004',
      durationMs: Date.now() - feedbackStart,
      data: { txHash: feedbackTxHash, isPositive },
    });

    // --- Step 8: Reputation Update ---
    const repStart = Date.now();
    await emitStep(bus, 'reputation-computing', Protocol.CovenantAi, requesterId, providerId);

    let reputationUpdated = false;
    try {
      await triggerReputationPipeline({
        targetAgentId: providerId,
        feedbackValue: isPositive ? 1 : -1,
        feedbackUri: feedbackTxHash || '',
        proofOfPayment: paymentResult.txHash,
        sourceAgentId: requesterId,
        timestamp: Date.now(),
      });
      reputationUpdated = true;
    } catch {
      // Best-effort reputation
    }

    await emitStep(bus, 'reputation-updated', Protocol.CovenantAi, requesterId, providerId, {
      reputationUpdated,
    });
    steps.push({
      name: 'Reputation Update',
      status: reputationUpdated ? 'completed' : 'failed',
      protocol: 'covenant-ai',
      durationMs: Date.now() - repStart,
      data: { reputationUpdated },
    });

    const result: LiveLifecycleResult = {
      success: true,
      requesterId,
      providerId,
      negotiatedPrice: agreedPrice,
      paymentTxHash: paymentResult.txHash,
      feedbackTxHash,
      reputationUpdated,
      deliverable,
      steps,
      durationMs: Date.now() - startTime,
    };

    await bus.emit({
      type: EVENT_TYPES.LIVE_TRIGGER_COMPLETED,
      protocol: Protocol.CovenantAi,
      agentId: requesterId,
      targetAgentId: providerId,
      data: {
        triggerType: 'lifecycle',
        success: true,
        negotiatedPrice: agreedPrice,
        paymentTxHash: paymentResult.txHash,
        durationMs: result.durationMs,
      },
    });

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await bus.emit({
      type: EVENT_TYPES.LIVE_TRIGGER_FAILED,
      protocol: Protocol.CovenantAi,
      agentId: requesterId,
      targetAgentId: providerId,
      data: { triggerType: 'lifecycle', error: errorMsg },
    });

    return {
      success: false,
      requesterId,
      providerId,
      negotiatedPrice: 0,
      reputationUpdated: false,
      steps,
      durationMs: Date.now() - startTime,
      error: errorMsg,
    };
  }
}
