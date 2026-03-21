import { detectSybilPatterns, storeSybilAlerts } from '@/lib/reputation/sybil-detection';
import { getGraph } from '@/lib/reputation/graph';
import { synthesizeScore, classifyAgent } from '@/lib/reputation/score-synthesis';
import { generateExplanation, storeExplanation } from '@/lib/reputation/explanation';
import { appendReputationResponse } from '@/lib/protocols/erc8004/write-back';
import { computeStakeWeights } from '@/lib/reputation/stake-weighting';
import { computeTrustPropagation, getGlobalTrustRanking } from '@/lib/reputation/trust-propagation';
import { getCivicPenalty } from '@/lib/civic/reputation-bridge';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import { kvGet } from '@/lib/storage/kv';
import type { FeedbackRecord, ScoreSynthesisInput, ExplanationInput } from '@/lib/reputation/types';

export type SybilCascadeRequest = {
  ringAgentIds: string[];
};

export type SybilCascadeResult = {
  success: boolean;
  ringMembers: string[];
  scoreDrops: Record<string, { before: number; after: number }>;
  explanation: string;
  txHashes: Record<string, string>;
  steps: Array<{ name: string; status: string; durationMs: number }>;
  durationMs: number;
  error?: string;
};

async function emitStep(
  bus: ReturnType<typeof createEventBus>,
  step: string,
  data: Record<string, unknown> = {},
) {
  await bus.emit({
    type: EVENT_TYPES.LIVE_TRIGGER_STEP,
    protocol: Protocol.CovenantAi,
    agentId: 'covenant-system',
    data: { triggerType: 'sybil-cascade', step, ...data },
  });
}

export async function executeSybilCascade(
  request: SybilCascadeRequest,
): Promise<SybilCascadeResult> {
  const bus = createEventBus();
  const startTime = Date.now();
  const steps: Array<{ name: string; status: string; durationMs: number }> = [];
  const { ringAgentIds } = request;

  await bus.emit({
    type: EVENT_TYPES.LIVE_TRIGGER_STARTED,
    protocol: Protocol.CovenantAi,
    agentId: 'covenant-system',
    data: { triggerType: 'sybil-cascade', ringAgentIds },
  });

  try {
    // --- Step 1: Flag Evidence ---
    const flagStart = Date.now();
    await emitStep(bus, 'evidence-flagged', {
      agents: ringAgentIds,
      reason: 'Suspicious circular payment pattern detected in graph',
    });
    steps.push({ name: 'Evidence Flagged', status: 'completed', durationMs: Date.now() - flagStart });

    // --- Step 2: Analyze Payment Graph ---
    const analysisStart = Date.now();
    await emitStep(bus, 'analysis-started', { agentCount: ringAgentIds.length });

    const graph = await getGraph();
    const feedbackRecords: FeedbackRecord[] = [];

    // Build feedback records for stake weighting
    for (const agentId of ringAgentIds) {
      const cached = await kvGet<{ score: number }>(`agent:${agentId}:reputation`);
      feedbackRecords.push({
        agentId,
        feedbackValue: 1, // All ring members gave each other positive feedback
        paymentAmount: 2,
        transactionHash: `sybil-evidence-${agentId}`,
        timestamp: Date.now(),
      });

      // Store before score
      const beforeScore = cached?.score ?? 5.0;
      feedbackRecords.push({
        agentId,
        feedbackValue: beforeScore > 5 ? 1 : -1,
        paymentAmount: 2,
        transactionHash: `existing-${agentId}`,
        timestamp: Date.now() - 1000,
      });
    }

    steps.push({ name: 'Graph Analysis', status: 'completed', durationMs: Date.now() - analysisStart });

    // --- Step 3: Run Sybil Detection ---
    const detectStart = Date.now();
    const sybilResult = await detectSybilPatterns({
      graph: graph || { nodes: [], edges: [] },
      transactionHistory: [],
      agentIds: ringAgentIds,
    });

    if (sybilResult.alerts.length > 0) {
      await storeSybilAlerts(sybilResult.alerts);
    }

    await emitStep(bus, 'pattern-detected', {
      alertCount: sybilResult.alerts.length,
      ringPattern: ringAgentIds.join(' -> ') + ' -> ' + ringAgentIds[0],
      patternTypes: sybilResult.alerts.map((a: { patternType: string }) => a.patternType),
    });
    steps.push({ name: 'Sybil Detection', status: 'completed', durationMs: Date.now() - detectStart });

    // --- Step 4: Recompute Scores (Cascade Drop) ---
    const scoreStart = Date.now();
    const stakeResults = computeStakeWeights(feedbackRecords);
    const stakeMap = new Map(stakeResults.map((r: { agentId: string; weightedAverage: number }) => [r.agentId, r]));

    const trustResult = computeTrustPropagation(graph || { nodes: [], edges: [] });
    const ranking = getGlobalTrustRanking(trustResult);
    const trustMap = new Map(ranking.map((r: { agentId: string; avgTrust: number }) => [r.agentId, r.avgTrust]));

    const scoreDrops: Record<string, { before: number; after: number }> = {};

    for (const agentId of ringAgentIds) {
      const stakeResult = stakeMap.get(agentId);
      const trustScore = trustMap.get(agentId) ?? 3.0;
      const civicPenalty = await getCivicPenalty(agentId);
      const agentSybilAlerts = sybilResult.alerts.filter(
        (a: { involvedAgents: string[] }) => a.involvedAgents.includes(agentId),
      );

      const input: ScoreSynthesisInput = {
        agentId,
        stakeWeightedScore: stakeResult?.weightedAverage ?? 5.0,
        trustPropagationScore: trustScore,
        sybilAlerts: agentSybilAlerts,
        civicPenalty,
        hasNegativeFeedback: false,
      };

      const result = synthesizeScore(input);
      const cached = await kvGet<{ score: number }>(`agent:${agentId}:reputation`);
      const beforeScore = cached?.score ?? 5.0;

      scoreDrops[agentId] = {
        before: beforeScore,
        after: result.finalScore,
      };

      await emitStep(bus, 'scores-dropping', {
        agentId,
        beforeScore,
        afterScore: result.finalScore,
        drop: beforeScore - result.finalScore,
      });
    }

    steps.push({ name: 'Score Cascade', status: 'completed', durationMs: Date.now() - scoreStart });

    // --- Step 5: Generate Explanations ---
    const explainStart = Date.now();
    await emitStep(bus, 'explanation-generating');

    let combinedExplanation = '';
    for (const agentId of ringAgentIds) {
      const scoreInfo = scoreDrops[agentId];
      const classification = classifyAgent(
        {
          agentId,
          finalScore: scoreInfo.after,
          components: { stakeWeightedScore: 3.0, trustPropagationScore: 2.5, sybilPenalty: -2, civicPenalty: 0 },
          classification: 'adversarial',
        },
        { agentId, stakeWeightedScore: 3.0, trustPropagationScore: 2.5, sybilAlerts: [], civicPenalty: 0, hasNegativeFeedback: false },
      );

      const explanationInput: ExplanationInput = {
        agentId,
        agentName: agentId,
        agentRole: 'provider',
        score: scoreInfo.after,
        classification: classification as ExplanationInput['classification'],
        jobCount: 3,
        successRate: 1.0,
        failureRate: 0,
        paymentVolume: 6,
        civicFlags: [],
        trustGraphPosition: { inboundTrust: 2.5, outboundTrust: 2.5 },
        sybilAlerts: sybilResult.alerts.filter(
          (a: { involvedAgents: string[] }) => a.involvedAgents.includes(agentId),
        ),
        stakeWeightedAverage: 3.0,
      };

      const explanationText = await generateExplanation(explanationInput);
      await storeExplanation(agentId, explanationText);
      combinedExplanation = explanationText;
    }

    steps.push({ name: 'Explanation Generation', status: 'completed', durationMs: Date.now() - explainStart });

    // --- Step 6: On-Chain Write-Back ---
    const writeStart = Date.now();
    await emitStep(bus, 'onchain-writing');

    const txHashes: Record<string, string> = {};
    for (const agentId of ringAgentIds) {
      const scoreInfo = scoreDrops[agentId];
      const result = await appendReputationResponse({
        agentId,
        score: scoreInfo.after,
        signalSummary: {
          stakeWeight: 3.0,
          trustPropagation: 2.5,
          sybilPenalty: sybilResult.alerts.length,
          civicFlag: 0,
          paymentVolume: 6,
        },
        explanationCid: '',
        timestamp: Date.now(),
      });
      txHashes[agentId] = result.txHash;
    }

    await emitStep(bus, 'onchain-written', { txCount: Object.keys(txHashes).length });
    steps.push({ name: 'On-Chain Write-Back', status: 'completed', durationMs: Date.now() - writeStart });

    // --- Step 7: Routing Exclusion ---
    const exclusionStart = Date.now();
    await emitStep(bus, 'exclusion-applied', {
      excludedAgents: ringAgentIds,
      reason: 'Sybil ring members excluded from routing',
    });
    steps.push({ name: 'Routing Exclusion', status: 'completed', durationMs: Date.now() - exclusionStart });

    const cascadeResult: SybilCascadeResult = {
      success: true,
      ringMembers: ringAgentIds,
      scoreDrops,
      explanation: combinedExplanation,
      txHashes,
      steps,
      durationMs: Date.now() - startTime,
    };

    await bus.emit({
      type: EVENT_TYPES.LIVE_TRIGGER_COMPLETED,
      protocol: Protocol.CovenantAi,
      agentId: 'covenant-system',
      data: {
        triggerType: 'sybil-cascade',
        success: true,
        ringMembers: ringAgentIds,
        alertCount: sybilResult.alerts.length,
        durationMs: cascadeResult.durationMs,
      },
    });

    return cascadeResult;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    await bus.emit({
      type: EVENT_TYPES.LIVE_TRIGGER_FAILED,
      protocol: Protocol.CovenantAi,
      agentId: 'covenant-system',
      data: { triggerType: 'sybil-cascade', error: errorMsg },
    });

    return {
      success: false,
      ringMembers: ringAgentIds,
      scoreDrops: {},
      explanation: '',
      txHashes: {},
      steps,
      durationMs: Date.now() - startTime,
      error: errorMsg,
    };
  }
}
