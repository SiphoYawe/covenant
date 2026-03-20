import { routeTask, executeLifecycle, updateDemoAct, getDemoAgents, DemoAct, DemoStatus } from '@/lib/orchestrator';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import { kvGet } from '@/lib/storage';
import type { ActExecutor, ActResult } from '../types';
import { ACT_CONFIGS } from '../types';
import type { ReputationScore } from '@/lib/reputation';

export const act5Payoff: ActExecutor = {
  actNumber: 5,
  name: 'Payoff',
  description: 'D excluded from routing, B charges premium. Side-by-side trust comparison.',
  expectedDuration: 30,

  canExecute(currentAct: number, actResults: Record<number, ActResult>): boolean {
    return actResults[4]?.status === 'completed' || (currentAct >= 4 && actResults[5]?.status === 'completed');
  },

  async execute(actResults: Record<number, ActResult>): Promise<ActResult> {
    if (actResults[5]?.status === 'completed') {
      return actResults[5];
    }

    const bus = createEventBus();
    const startTime = Date.now();
    const events: string[] = [];

    try {
      await updateDemoAct(DemoAct.Payoff, DemoStatus.Running);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 5, status: 'running' },
      });
      events.push('demo:act-changed:running');

      const agents = await getDemoAgents();
      const requesterId = agents[0]?.agentId ?? 'researcher';

      // Routing exclusion demonstration: D is excluded
      let routingDecision;
      try {
        routingDecision = await routeTask({
          capability: 'review_code',
          reputationThreshold: ACT_CONFIGS.thresholds.exclusion,
        });
        events.push('routing:exclusion-demonstrated');
      } catch {
        // If routing fails, we still want to demonstrate the concept
        routingDecision = { selectedAgentId: agents[1]?.agentId ?? '', excluded: [], candidates: [], capability: 'review_code', reason: 'fallback' };
      }

      // Premium pricing interaction: A hires B again at higher price
      const premiumResult = await executeLifecycle({
        requesterId,
        taskDescription: 'Audit this DeFi protocol for reentrancy vulnerabilities',
        capability: 'review_code',
        maxBudget: ACT_CONFIGS.pricing.premiumJob,
      });
      events.push('lifecycle:completed:premium');

      // Explainable trust comparison: fetch explanations for B and D
      const comparisonData: Record<string, unknown> = {};
      for (const agent of agents) {
        const cached = await kvGet<ReputationScore>(`agent:${agent.agentId}:reputation`);
        if (cached) {
          comparisonData[agent.agentId] = {
            score: cached.score,
            explanationCid: cached.explanationCid,
          };
        }
      }

      // Emit comparison event for dashboard rendering
      await bus.emit({
        type: 'demo:comparison',
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { comparison: comparisonData },
      });
      events.push('demo:comparison:emitted');

      await updateDemoAct(DemoAct.Payoff, DemoStatus.Completed);

      // Emit demo:complete
      await bus.emit({
        type: EVENT_TYPES.DEMO_COMPLETE,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { totalDuration: Date.now() - startTime, actsCompleted: 5 },
      });

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 5, status: 'completed' },
      });
      events.push('demo:act-changed:completed');

      return {
        act: 5,
        status: 'completed',
        duration: Date.now() - startTime,
        events,
        data: {
          routingDecision: {
            selectedAgentId: routingDecision.selectedAgentId,
            excluded: routingDecision.excluded,
          },
          premiumResult: {
            success: premiumResult.success,
            negotiatedPrice: premiumResult.negotiatedPrice,
            paymentTxHash: premiumResult.paymentTxHash,
          },
          comparisonData,
        },
      };
    } catch (error) {
      await updateDemoAct(DemoAct.Payoff, DemoStatus.Failed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 5, status: 'failed', error: error instanceof Error ? error.message : 'Unknown' },
      });

      return {
        act: 5,
        status: 'failed',
        duration: Date.now() - startTime,
        events,
        data: {},
        error: { error: { code: 'ACT5_FAILED', message: error instanceof Error ? error.message : 'Payoff failed' } },
      };
    }
  },
};
