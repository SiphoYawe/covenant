import { discoverAgents, sendTask } from '@/lib/protocols/a2a/client';
import { routeTask } from './task-router';
import { negotiatePrice } from './negotiation';
import { getCivicGateway } from '@/lib/civic/gateway';
import { CivicSeverity } from '@/lib/civic/types';
import type { CivicFlag } from '@/lib/civic/types';
import { executePayment } from '@/lib/protocols/x402/client';
import { recordPaymentProofs } from '@/lib/protocols/x402/proof';
import { evaluateDeliverable, prepareFeedback } from '@/lib/agents/evaluator';
import { giveFeedback } from '@/lib/protocols/erc8004/reputation';
import { triggerReputationPipeline } from '@/lib/reputation/engine';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import { DEFAULT_REPUTATION_THRESHOLD } from '@/lib/config/constants';
import type { LifecycleRequest, LifecycleResult, LifecycleState } from './types';
import { LifecycleStep } from './types';
import type { ApiError } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Execute the full 10-step interaction lifecycle.
 * Coordinates all protocol modules from discovery through reputation update.
 * Each step accumulates state via an immutable LifecycleState pattern.
 */
export async function executeLifecycle(request: LifecycleRequest): Promise<LifecycleResult> {
  const bus = createEventBus();

  let state: LifecycleState = {
    currentStep: LifecycleStep.Discovery,
    requesterId: request.requesterId,
    civicFlags: [],
    startedAt: Date.now(),
  };

  let feedbackTxHash: string | undefined;
  let reputationUpdated = false;
  let evaluationAccepted = true;

  // Emit lifecycle:started
  await bus.emit({
    type: EVENT_TYPES.LIFECYCLE_STARTED,
    protocol: Protocol.CovenantAi,
    agentId: request.requesterId,
    data: {
      taskDescription: request.taskDescription,
      capability: request.capability,
      maxBudget: request.maxBudget,
    },
  });

  try {
    // --- Step 1: Discovery ---
    state = { ...state, currentStep: LifecycleStep.Discovery };
    const agents = await discoverAgents(request.capability);
    await emitStepCompleted(bus, 1, LifecycleStep.Discovery, state, {
      agentsFound: agents.length,
    });

    // --- Step 2: Routing ---
    state = { ...state, currentStep: LifecycleStep.Routing };
    let routing;
    try {
      routing = await routeTask({
        capability: request.capability,
        reputationThreshold: DEFAULT_REPUTATION_THRESHOLD,
      });
    } catch (routingError) {
      const msg = routingError instanceof Error ? routingError.message : 'Routing failed';
      const code = msg.startsWith('NO_QUALIFIED_AGENTS') ? 'NO_QUALIFIED_AGENTS' : 'ROUTING_FAILED';
      return buildFailure({ ...state, currentStep: LifecycleStep.Routing }, code, msg, bus);
    }
    state = { ...state, selectedAgentId: routing.selectedAgentId };
    await emitStepCompleted(bus, 2, LifecycleStep.Routing, state, {
      selectedAgentId: routing.selectedAgentId,
      candidateCount: routing.candidates.length,
      excludedCount: routing.excluded.length,
    });

    // --- Step 3: Negotiation ---
    state = { ...state, currentStep: LifecycleStep.Negotiation };
    const negotiation = await negotiatePrice({
      requesterId: request.requesterId,
      providerId: routing.selectedAgentId,
      taskDescription: request.taskDescription,
      initialOffer: request.maxBudget ?? 5,
    });

    if (negotiation.status !== 'agreed' || negotiation.agreedPrice === undefined) {
      await bus.emit({
        type: EVENT_TYPES.LIFECYCLE_NEGOTIATION_FAILED,
        protocol: Protocol.CovenantAi,
        agentId: request.requesterId,
        targetAgentId: routing.selectedAgentId,
        data: { status: negotiation.status, rounds: negotiation.rounds },
      });
      return buildFailure(state, 'NEGOTIATION_FAILED', `Negotiation ${negotiation.status} after ${negotiation.rounds} rounds`, bus);
    }

    state = { ...state, negotiatedPrice: negotiation.agreedPrice };
    await emitStepCompleted(bus, 3, LifecycleStep.Negotiation, state, {
      agreedPrice: negotiation.agreedPrice,
      rounds: negotiation.rounds,
    });

    // --- Step 4: Civic Input Inspection ---
    state = { ...state, currentStep: LifecycleStep.CivicInputInspection };
    const gateway = getCivicGateway();
    const inputInspection = await gateway.inspectBehavior(
      routing.selectedAgentId,
      { description: request.taskDescription, capability: request.capability },
      'input',
      request.requesterId,
    );

    if (!inputInspection.result.passed) {
      const criticalFlags = inputInspection.result.flags.filter(
        (f) => f.severity === CivicSeverity.Critical || f.severity === CivicSeverity.High
      );
      if (criticalFlags.length > 0) {
        await bus.emit({
          type: EVENT_TYPES.LIFECYCLE_CIVIC_BLOCKED,
          protocol: Protocol.Civic,
          agentId: routing.selectedAgentId,
          data: { direction: 'input', flags: criticalFlags },
        });
        state = { ...state, civicFlags: [...state.civicFlags, ...criticalFlags] };
        return buildFailure(state, 'CIVIC_INPUT_BLOCKED', 'Civic flagged input as critical threat', bus);
      }
    }
    state = { ...state, civicFlags: [...state.civicFlags, ...inputInspection.result.flags] };
    await emitStepCompleted(bus, 4, LifecycleStep.CivicInputInspection, state, {
      passed: inputInspection.result.passed,
      flagCount: inputInspection.result.flags.length,
    });

    // --- Step 5: Payment ---
    state = { ...state, currentStep: LifecycleStep.Payment };
    let paymentResult;
    try {
      paymentResult = await executePayment({
        payerAgentId: request.requesterId,
        payeeAgentId: routing.selectedAgentId,
        amount: negotiation.agreedPrice.toFixed(2),
        taskId: `lifecycle-${state.startedAt}`,
      });
    } catch (paymentError) {
      await bus.emit({
        type: EVENT_TYPES.LIFECYCLE_PAYMENT_FAILED,
        protocol: Protocol.X402,
        agentId: request.requesterId,
        targetAgentId: routing.selectedAgentId,
        data: {
          error: paymentError instanceof Error ? paymentError.message : 'Unknown payment error',
          amount: negotiation.agreedPrice,
        },
      });
      return buildFailure(state, 'PAYMENT_FAILED', paymentError instanceof Error ? paymentError.message : 'Payment failed', bus);
    }

    state = { ...state, paymentTxHash: paymentResult.txHash };

    // Record dual-entry payment proofs
    await recordPaymentProofs({
      txHash: paymentResult.txHash,
      payerAgentId: request.requesterId,
      payeeAgentId: routing.selectedAgentId,
      amount: paymentResult.amount,
      timestamp: paymentResult.timestamp,
      taskId: `lifecycle-${state.startedAt}`,
    });

    await emitStepCompleted(bus, 5, LifecycleStep.Payment, state, {
      txHash: paymentResult.txHash,
      amount: paymentResult.amount,
    });

    // --- Step 6: Execution ---
    state = { ...state, currentStep: LifecycleStep.Execution };
    const agentEndpoint = `${BASE_URL}/api/agents/${routing.selectedAgentId}/a2a`;
    const task = await sendTask(agentEndpoint, {
      description: request.taskDescription,
      capability: request.capability,
      offeredPayment: negotiation.agreedPrice,
      requesterId: request.requesterId,
    });

    const deliverable = task.artifacts?.[0]?.data
      || task.messages?.find((m) => m.role === 'agent')?.parts?.[0]?.text
      || 'No deliverable content';
    state = { ...state, deliverable };
    await emitStepCompleted(bus, 6, LifecycleStep.Execution, state, {
      taskId: task.id,
      deliverableLength: deliverable.length,
    });

    // --- Step 7: Civic Output Inspection ---
    state = { ...state, currentStep: LifecycleStep.CivicOutputInspection };
    const outputInspection = await gateway.inspectBehavior(
      routing.selectedAgentId,
      { deliverable, taskId: task.id },
      'output',
      request.requesterId,
    );

    let civicCriticalOutput = false;
    if (!outputInspection.result.passed) {
      const criticalFlags = outputInspection.result.flags.filter(
        (f) => f.severity === CivicSeverity.Critical
      );
      if (criticalFlags.length > 0) {
        civicCriticalOutput = true;
        state = { ...state, civicFlags: [...state.civicFlags, ...criticalFlags] };
      }
    }
    state = { ...state, civicFlags: [...state.civicFlags, ...outputInspection.result.flags.filter(
      (f) => !state.civicFlags.some((existing) => existing.id === f.id)
    )] };
    await emitStepCompleted(bus, 7, LifecycleStep.CivicOutputInspection, state, {
      passed: outputInspection.result.passed,
      flagCount: outputInspection.result.flags.length,
      criticalOutput: civicCriticalOutput,
    });

    // --- Step 8: Evaluation ---
    state = { ...state, currentStep: LifecycleStep.Evaluation };
    if (civicCriticalOutput) {
      // Auto-reject: skip evaluation, proceed to negative feedback
      evaluationAccepted = false;
      await emitStepCompleted(bus, 8, LifecycleStep.Evaluation, state, {
        decision: 'auto-reject',
        reason: 'Civic critical flag on deliverable',
      });
    } else {
      const evaluation = await evaluateDeliverable({
        evaluatorAgentId: request.requesterId,
        targetAgentId: routing.selectedAgentId,
        taskId: task.id,
        originalTask: request.taskDescription,
        deliverable,
        proofOfPayment: paymentResult.txHash,
        paymentAmount: paymentResult.amount,
      });
      evaluationAccepted = evaluation.decision === 'accept';
      await emitStepCompleted(bus, 8, LifecycleStep.Evaluation, state, {
        decision: evaluation.decision,
        reasoning: evaluation.reasoning,
      });
    }

    // --- Step 9: Feedback ---
    state = { ...state, currentStep: LifecycleStep.Feedback };
    try {
      const feedbackData = civicCriticalOutput
        ? {
            targetAgentId: routing.selectedAgentId,
            isPositive: false,
            reasoning: `Civic critical flag: ${state.civicFlags.find((f) => f.severity === CivicSeverity.Critical)?.attackType || 'unknown'}`,
            proofOfPayment: paymentResult.txHash,
            paymentAmount: paymentResult.amount,
          }
        : prepareFeedback(
            {
              decision: evaluationAccepted ? 'accept' : 'reject',
              reasoning: 'Evaluation result',
              scores: { completeness: 5, accuracy: 5, relevance: 5, quality: 5 },
              evaluatorAgentId: request.requesterId,
              targetAgentId: routing.selectedAgentId,
              taskId: task.id,
            },
            { proofOfPayment: paymentResult.txHash, paymentAmount: paymentResult.amount },
          );

      const feedbackResult = await giveFeedback({
        targetAgentId: routing.selectedAgentId,
        isPositive: feedbackData.isPositive,
        feedbackURI: feedbackData.reasoning,
        proofOfPayment: feedbackData.proofOfPayment,
        feedbackerAgentId: request.requesterId,
      });
      feedbackTxHash = feedbackResult.txHash;
      await emitStepCompleted(bus, 9, LifecycleStep.Feedback, state, {
        feedbackTxHash: feedbackResult.txHash,
        isPositive: feedbackData.isPositive,
      });
    } catch (feedbackError) {
      // Best-effort: don't fail lifecycle
      await emitStepCompleted(bus, 9, LifecycleStep.Feedback, state, {
        error: feedbackError instanceof Error ? feedbackError.message : 'Feedback failed',
      });
    }

    // --- Step 10: Reputation Update ---
    state = { ...state, currentStep: LifecycleStep.ReputationUpdate };
    try {
      await triggerReputationPipeline({
        targetAgentId: routing.selectedAgentId,
        feedbackValue: evaluationAccepted && !civicCriticalOutput ? 1 : -1,
        feedbackUri: feedbackTxHash || '',
        proofOfPayment: paymentResult.txHash,
        sourceAgentId: request.requesterId,
        timestamp: Date.now(),
      });
      reputationUpdated = true;
      await emitStepCompleted(bus, 10, LifecycleStep.ReputationUpdate, state, {
        reputationUpdated: true,
      });
    } catch (reputationError) {
      // Best-effort: don't fail lifecycle
      await emitStepCompleted(bus, 10, LifecycleStep.ReputationUpdate, state, {
        reputationUpdated: false,
        error: reputationError instanceof Error ? reputationError.message : 'Reputation update failed',
      });
    }

    // Build final result
    const success = evaluationAccepted && !civicCriticalOutput;
    const result: LifecycleResult = {
      success,
      selectedAgentId: routing.selectedAgentId,
      negotiatedPrice: negotiation.agreedPrice,
      paymentTxHash: paymentResult.txHash,
      deliverable,
      feedbackTxHash,
      reputationUpdated,
      civicFlags: state.civicFlags,
    };

    // Emit lifecycle:completed
    await bus.emit({
      type: EVENT_TYPES.LIFECYCLE_COMPLETED,
      protocol: Protocol.CovenantAi,
      agentId: request.requesterId,
      targetAgentId: routing.selectedAgentId,
      data: {
        success: result.success,
        selectedAgentId: result.selectedAgentId,
        negotiatedPrice: result.negotiatedPrice,
        paymentTxHash: result.paymentTxHash,
        reputationUpdated: result.reputationUpdated,
        civicFlagCount: result.civicFlags.length,
        durationMs: Date.now() - state.startedAt,
      },
    });

    return result;
  } catch (error) {
    // Unexpected error at any step
    return buildFailure(
      state,
      'LIFECYCLE_ERROR',
      error instanceof Error ? error.message : 'Unknown error',
      bus,
    );
  }
}

// --- Helpers ---

async function emitStepCompleted(
  bus: ReturnType<typeof createEventBus>,
  stepNumber: number,
  stepName: LifecycleStep,
  state: LifecycleState,
  result: Record<string, unknown>,
): Promise<void> {
  await bus.emit({
    type: EVENT_TYPES.LIFECYCLE_STEP_COMPLETED,
    protocol: Protocol.CovenantAi,
    agentId: state.requesterId,
    targetAgentId: state.selectedAgentId,
    data: { step: stepNumber, stepName, result },
  });
}

async function buildFailure(
  state: LifecycleState,
  code: string,
  message: string,
  bus: ReturnType<typeof createEventBus>,
): Promise<LifecycleResult> {
  const error: ApiError = {
    error: { code, message, details: { step: state.currentStep } },
  };

  await bus.emit({
    type: EVENT_TYPES.LIFECYCLE_FAILED,
    protocol: Protocol.CovenantAi,
    agentId: state.requesterId,
    targetAgentId: state.selectedAgentId,
    data: { step: state.currentStep, code, message },
  });

  return {
    success: false,
    selectedAgentId: state.selectedAgentId || '',
    negotiatedPrice: state.negotiatedPrice || 0,
    paymentTxHash: state.paymentTxHash,
    deliverable: state.deliverable,
    reputationUpdated: false,
    civicFlags: state.civicFlags,
    error,
  };
}
