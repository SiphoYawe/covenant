import { registerAgent } from '@/lib/protocols/erc8004';
import { generateAgentCard } from '@/lib/protocols/a2a';
import { generateMetadata } from '@/lib/agents';
import { getCivicGateway } from '@/lib/civic';
import { addDemoAgent, updateDemoAct, DemoAct, DemoStatus } from '@/lib/orchestrator';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import type { ActExecutor, ActResult } from '../types';
import type { DemoAgentRole } from '@/lib/agents';

const HERO_ROLES: DemoAgentRole[] = ['researcher', 'reviewer', 'summarizer'];

export const act1Registration: ActExecutor = {
  actNumber: 1,
  name: 'Registration',
  description: 'Agents A (researcher), B (code reviewer), C (summarizer) register with Civic Layer 1 inspection',
  expectedDuration: 30,

  canExecute(currentAct: number, actResults: Record<number, ActResult>): boolean {
    // Act 1 requires clean state or already completed (idempotent)
    return currentAct === 0 || actResults[1]?.status === 'completed';
  },

  async execute(actResults: Record<number, ActResult>): Promise<ActResult> {
    // Idempotency: return cached result if already completed
    if (actResults[1]?.status === 'completed') {
      return actResults[1];
    }

    const bus = createEventBus();
    const startTime = Date.now();
    const events: string[] = [];
    const registeredAgents: Record<string, string> = {};

    try {
      await updateDemoAct(DemoAct.Registration, DemoStatus.Running);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 1, status: 'running' },
      });
      events.push('demo:act-changed:running');

      const gateway = getCivicGateway();

      for (const role of HERO_ROLES) {
        // Generate metadata and register on IdentityRegistry
        const metadata = generateMetadata(role);
        const regResult = await registerAgent(role);

        // Civic Layer 1 identity inspection
        await gateway.inspectIdentity(regResult.agentId, metadata);

        // Publish A2A Agent Card
        await generateAgentCard(role);

        // Track in demo agents
        await addDemoAgent({
          agentId: regResult.agentId,
          tokenId: regResult.agentId,
          walletAddress: metadata.walletAddress,
          registeredAt: Date.now(),
        });

        registeredAgents[role] = regResult.agentId;

        // Emit agent:registered event
        await bus.emit({
          type: EVENT_TYPES.AGENT_REGISTERED,
          protocol: Protocol.Erc8004,
          agentId: regResult.agentId,
          data: { name: metadata.name, role, walletAddress: metadata.walletAddress },
        });
        events.push(`agent:registered:${role}`);
      }

      await updateDemoAct(DemoAct.Registration, DemoStatus.Completed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 1, status: 'completed' },
      });
      events.push('demo:act-changed:completed');

      return {
        act: 1,
        status: 'completed',
        duration: Date.now() - startTime,
        events,
        data: { registeredAgents },
      };
    } catch (error) {
      await updateDemoAct(DemoAct.Registration, DemoStatus.Failed);

      await bus.emit({
        type: EVENT_TYPES.DEMO_ACT_CHANGED,
        protocol: Protocol.CovenantAi,
        agentId: 'system',
        data: { act: 1, status: 'failed', error: error instanceof Error ? error.message : 'Unknown' },
      });

      return {
        act: 1,
        status: 'failed',
        duration: Date.now() - startTime,
        events,
        data: { registeredAgents },
        error: { error: { code: 'ACT1_FAILED', message: error instanceof Error ? error.message : 'Registration failed' } },
      };
    }
  },
};
