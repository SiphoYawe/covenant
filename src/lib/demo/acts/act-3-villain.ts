import { registerAgent } from '@/lib/protocols/erc8004';
import { generateAgentCard } from '@/lib/protocols/a2a';
import { generateMetadata } from '@/lib/agents';
import { getCivicGateway } from '@/lib/civic';
import { executeLifecycle, addDemoAgent, updateDemoAct, getDemoAgents, DemoAct, DemoStatus } from '@/lib/orchestrator';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import type { ActExecutor, ActResult } from '../types';
import { ACT_CONFIGS } from '../types';

export const act3Villain: ActExecutor = {
  actNumber: 3,
  name: 'Villain',
  description: 'Agent D registers, undercuts pricing, delivers prompt injection. Civic Layer 2 catches it.',
  expectedDuration: 45,

  canExecute(currentAct: number, actResults: Record<number, ActResult>): boolean {
    return actResults[2]?.status === 'completed' || (currentAct >= 2 && actResults[3]?.status === 'completed');
  },

  async execute(actResults: Record<number, ActResult>): Promise<ActResult> {
    if (actResults[3]?.status === 'completed') {
      return actResults[3];
    }

    const bus = createEventBus();
    const startTime = Date.now();
    const events: string[] = [];

    try {
      await updateDemoAct(DemoAct.VillainAttacks, DemoStatus.Running);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 3, status: 'running' },
      });
      events.push('demo:act-changed:running');

      // Register Agent D (malicious attacker)
      const metadata = generateMetadata('malicious');
      const regResult = await registerAgent('malicious');

      const gateway = getCivicGateway();
      await gateway.inspectIdentity(regResult.agentId, metadata);
      await generateAgentCard('malicious');

      await addDemoAgent({
        agentId: regResult.agentId,
        tokenId: regResult.agentId,
        walletAddress: metadata.walletAddress,
        registeredAt: Date.now(),
      });

      await bus.emit({
        type: EVENT_TYPES.AGENT_REGISTERED,
        protocol: Protocol.Erc8004,
        agentId: regResult.agentId,
        data: { name: metadata.name, role: 'malicious', walletAddress: metadata.walletAddress },
      });
      events.push('agent:registered:malicious');

      // Malicious interaction: A hires D (D undercuts pricing)
      const agents = await getDemoAgents();
      const researcherAgent = agents[0];
      const requesterId = researcherAgent?.agentId ?? 'researcher';

      const villainResult = await executeLifecycle({
        requesterId,
        taskDescription: 'Review this contract code for vulnerabilities',
        capability: 'review_code',
        maxBudget: ACT_CONFIGS.pricing.villainUndercut,
      });

      // The lifecycle handles Civic L2 catching the prompt injection,
      // auto-rejection, and negative feedback submission
      events.push('lifecycle:completed:villain');

      await updateDemoAct(DemoAct.VillainAttacks, DemoStatus.Completed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 3, status: 'completed' },
      });
      events.push('demo:act-changed:completed');

      return {
        act: 3,
        status: 'completed',
        duration: Date.now() - startTime,
        events,
        data: {
          villainAgentId: regResult.agentId,
          villainResult: {
            success: villainResult.success,
            paymentTxHash: villainResult.paymentTxHash,
            civicFlags: villainResult.civicFlags,
            negotiatedPrice: villainResult.negotiatedPrice,
          },
        },
      };
    } catch (error) {
      await updateDemoAct(DemoAct.VillainAttacks, DemoStatus.Failed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 3, status: 'failed', error: error instanceof Error ? error.message : 'Unknown' },
      });

      return {
        act: 3,
        status: 'failed',
        duration: Date.now() - startTime,
        events,
        data: {},
        error: { error: { code: 'ACT3_FAILED', message: error instanceof Error ? error.message : 'Villain act failed' } },
      };
    }
  },
};
