import { triggerReputationPipeline } from '@/lib/reputation';
import { detectSybilPatterns, storeSybilAlerts } from '@/lib/reputation';
import { generateAndStoreExplanation } from '@/lib/reputation';
import { appendReputationResponse } from '@/lib/protocols/erc8004';
import { updateDemoAct, getDemoAgents, DemoAct, DemoStatus } from '@/lib/orchestrator';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import { kvGet } from '@/lib/storage';
import type { ActExecutor, ActResult } from '../types';
import type { ReputationScore } from '@/lib/reputation';

export const act4Consequences: ActExecutor = {
  actNumber: 4,
  name: 'Consequences',
  description: 'Reputation recomputation: D craters to ~1.2/10, B solidifies at ~9.1/10. On-chain write-back.',
  expectedDuration: 30,

  canExecute(currentAct: number, actResults: Record<number, ActResult>): boolean {
    return actResults[3]?.status === 'completed' || (currentAct >= 3 && actResults[4]?.status === 'completed');
  },

  async execute(actResults: Record<number, ActResult>): Promise<ActResult> {
    if (actResults[4]?.status === 'completed') {
      return actResults[4];
    }

    const bus = createEventBus();
    const startTime = Date.now();
    const events: string[] = [];
    const reputationScores: Record<string, number> = {};
    const explanations: Record<string, string> = {};
    const txHashes: Record<string, string> = {};

    try {
      await updateDemoAct(DemoAct.Consequences, DemoStatus.Running);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 4, status: 'running' },
      });
      events.push('demo:act-changed:running');

      const agents = await getDemoAgents();

      // Trigger reputation recomputation for all agents
      for (const agent of agents) {
        try {
          await triggerReputationPipeline({
            targetAgentId: agent.agentId,
            feedbackValue: 0, // Recompute based on all existing feedback
            feedbackUri: '',
            proofOfPayment: '',
            sourceAgentId: 'system',
            timestamp: Date.now(),
          });

          // Read computed score from KV cache
          const cached = await kvGet<ReputationScore>(`agent:${agent.agentId}:reputation`);
          if (cached) {
            reputationScores[agent.agentId] = cached.score;
          }

          events.push(`reputation:updated:${agent.agentId}`);
        } catch {
          // Continue with other agents even if one fails
        }
      }

      // Sybil detection on malicious agent (Agent D = last registered)
      const villainAgent = agents[agents.length - 1];
      if (villainAgent) {
        try {
          const sybilResult = await detectSybilPatterns({
            graph: { nodes: [], edges: [] },
            transactionHistory: [],
            agentIds: [villainAgent.agentId],
          });
          if (sybilResult.alerts.length > 0) {
            await storeSybilAlerts(sybilResult.alerts);
          }
          events.push('sybil:detection:complete');
        } catch {
          // Sybil detection is best-effort
        }
      }

      // Generate explanations for key agents
      for (const agent of agents) {
        try {
          const cached = await kvGet<ReputationScore>(`agent:${agent.agentId}:reputation`);
          const score = cached?.score ?? 5.0;
          const result = await generateAndStoreExplanation({
            agentId: agent.agentId,
            agentName: agent.agentId,
            agentRole: 'agent',
            score,
            classification: score < 3 ? 'adversarial' : score < 5 ? 'suspicious' : score < 7 ? 'neutral' : 'trusted',
            jobCount: 0,
            successRate: 0,
            failureRate: 0,
            paymentVolume: 0,
            civicFlags: [],
            trustGraphPosition: { inboundTrust: 0, outboundTrust: 0 },
            sybilAlerts: [],
            stakeWeightedAverage: score,
          });
          explanations[agent.agentId] = result.explanation;
          events.push(`explanation:generated:${agent.agentId}`);
        } catch {
          // Explanation generation is best-effort
        }
      }

      // On-chain write-back for key agents
      for (const agent of agents) {
        try {
          const cached = await kvGet<ReputationScore>(`agent:${agent.agentId}:reputation`);
          const score = cached?.score ?? 5.0;
          const result = await appendReputationResponse({
            agentId: agent.agentId,
            score,
            explanationCid: cached?.explanationCid ?? '',
            timestamp: Date.now(),
            signalSummary: {
              stakeWeight: score,
              trustPropagation: 0,
              sybilPenalty: 0,
              civicFlag: 0,
              paymentVolume: 0,
            },
          });
          txHashes[agent.agentId] = result.txHash;
          events.push(`appendResponse:${agent.agentId}`);
        } catch {
          // On-chain write-back is best-effort
        }
      }

      // Emit reputation:updated events for all agents
      for (const agent of agents) {
        const score = reputationScores[agent.agentId] ?? 5.0;
        await bus.emit({
          type: EVENT_TYPES.REPUTATION_UPDATED,
          protocol: Protocol.CovenantAi,
          agentId: agent.agentId,
          data: {
            reputationScore: score,
            trustLevel: score < 3 ? 'adversarial' : score < 5 ? 'suspicious' : score < 7 ? 'neutral' : 'trusted',
            explanation: explanations[agent.agentId],
            txHash: txHashes[agent.agentId],
          },
        });
      }

      await updateDemoAct(DemoAct.Consequences, DemoStatus.Completed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 4, status: 'completed' },
      });
      events.push('demo:act-changed:completed');

      return {
        act: 4,
        status: 'completed',
        duration: Date.now() - startTime,
        events,
        data: { reputationScores, explanations, txHashes },
      };
    } catch (error) {
      await updateDemoAct(DemoAct.Consequences, DemoStatus.Failed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 4, status: 'failed', error: error instanceof Error ? error.message : 'Unknown' },
      });

      return {
        act: 4,
        status: 'failed',
        duration: Date.now() - startTime,
        events,
        data: { reputationScores, explanations, txHashes },
        error: { error: { code: 'ACT4_FAILED', message: error instanceof Error ? error.message : 'Consequences failed' } },
      };
    }
  },
};
