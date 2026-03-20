import { executeLifecycle, updateDemoAct, DemoAct, DemoStatus, getDemoAgents } from '@/lib/orchestrator';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import type { ActExecutor, ActResult } from '../types';
import { ACT_CONFIGS } from '../types';

export const act2EconomyWorks: ActExecutor = {
  actNumber: 2,
  name: 'Economy Works',
  description: 'A hires B for code review (6 USDC) and C for summarization (3 USDC). Positive feedback, scores rise.',
  expectedDuration: 45,

  canExecute(currentAct: number, actResults: Record<number, ActResult>): boolean {
    return actResults[1]?.status === 'completed' || (currentAct >= 1 && actResults[2]?.status === 'completed');
  },

  async execute(actResults: Record<number, ActResult>): Promise<ActResult> {
    if (actResults[2]?.status === 'completed') {
      return actResults[2];
    }

    const bus = createEventBus();
    const startTime = Date.now();
    const events: string[] = [];
    const interactions: Record<string, unknown>[] = [];

    try {
      await updateDemoAct(DemoAct.EconomyWorks, DemoStatus.Running);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 2, status: 'running' },
      });
      events.push('demo:act-changed:running');

      const agents = await getDemoAgents();
      const researcherAgent = agents.find((a) => a.agentId.includes('researcher') || agents.indexOf(a) === 0);
      const requesterId = researcherAgent?.agentId ?? 'researcher';

      // Interaction 1: A hires B for code review
      const reviewResult = await executeLifecycle({
        requesterId,
        taskDescription: 'Review this smart contract for security vulnerabilities',
        capability: 'review_code',
        maxBudget: ACT_CONFIGS.pricing.reviewJob,
      });
      interactions.push({
        type: 'code-review',
        selectedAgent: reviewResult.selectedAgentId,
        price: reviewResult.negotiatedPrice,
        success: reviewResult.success,
        paymentTxHash: reviewResult.paymentTxHash,
      });
      events.push('lifecycle:completed:review');

      // Interaction 2: A hires C for summarization
      const summaryResult = await executeLifecycle({
        requesterId,
        taskDescription: 'Summarize this DeFi protocol whitepaper on AI safety',
        capability: 'summarize_text',
        maxBudget: ACT_CONFIGS.pricing.summaryJob,
      });
      interactions.push({
        type: 'summarization',
        selectedAgent: summaryResult.selectedAgentId,
        price: summaryResult.negotiatedPrice,
        success: summaryResult.success,
        paymentTxHash: summaryResult.paymentTxHash,
      });
      events.push('lifecycle:completed:summary');

      await updateDemoAct(DemoAct.EconomyWorks, DemoStatus.Completed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 2, status: 'completed' },
      });
      events.push('demo:act-changed:completed');

      return {
        act: 2,
        status: 'completed',
        duration: Date.now() - startTime,
        events,
        data: { interactions },
      };
    } catch (error) {
      await updateDemoAct(DemoAct.EconomyWorks, DemoStatus.Failed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 2, status: 'failed', error: error instanceof Error ? error.message : 'Unknown' },
      });

      return {
        act: 2,
        status: 'failed',
        duration: Date.now() - startTime,
        events,
        data: { interactions },
        error: { error: { code: 'ACT2_FAILED', message: error instanceof Error ? error.message : 'Economy acts failed' } },
      };
    }
  },
};
