import fs from 'fs';
import path from 'path';
import type {
  EngineState,
  EngineRegisteredAgent,
  SeedPhase,
  SeedInteraction,
  SeedAgentProfile,
  AgentRoster,
  SeedScenario,
  PhaseConfig,
} from './types';
import { engineStateSchema } from './types';
import { AGENT_ROSTER } from './agents';
import { SEED_SCENARIO, getPhaseConfig } from './scenarios';
import { profileToMetadata } from './metadata';
import { getPhaseInteractions } from './interactions';

// Protocol imports
import { getSDK } from '@/lib/protocols/erc8004/client';
import { giveFeedback } from '@/lib/protocols/erc8004/reputation';
import { executePayment } from '@/lib/protocols/x402/client';
import { negotiatePrice } from '@/lib/orchestrator/negotiation';
import { inspectIdentityMetadata } from '@/lib/civic/identity-inspector';
import { triggerReputationPipeline } from '@/lib/reputation/engine';
import { sendTask } from '@/lib/protocols/a2a/client';
import { createEventBus } from '@/lib/events/bus';
import { Protocol } from '@/lib/events/types';

const DEFAULT_STATE_PATH = path.join(process.cwd(), 'seed', 'engine-state.json');

// ──────────────────────────────────────────
// State Management
// ──────────────────────────────────────────

export function createEmptyEngineState(): EngineState {
  return {
    registeredAgents: {},
    completedInteractions: [],
    phasesCompleted: [],
    reputationComputed: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function loadEngineState(statePath: string = DEFAULT_STATE_PATH): EngineState | null {
  if (!fs.existsSync(statePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const result = engineStateSchema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveEngineState(state: EngineState, statePath: string = DEFAULT_STATE_PATH): void {
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// ──────────────────────────────────────────
// CLI Argument Parsing
// ──────────────────────────────────────────

export interface CliArgs {
  phases: SeedPhase[];
  resume: boolean;
  reset: boolean;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    phases: ['A', 'B'],
    resume: false,
    reset: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--phase' && i + 1 < argv.length) {
      result.phases = [argv[i + 1] as SeedPhase];
      i++;
    } else if (arg === '--resume') {
      result.resume = true;
    } else if (arg === '--reset') {
      result.reset = true;
    } else if (arg === '--all') {
      result.phases = ['A', 'B', 'C', 'D', 'E'];
    }
  }

  return result;
}

// ──────────────────────────────────────────
// Seed Engine
// ──────────────────────────────────────────

export interface SeedEngineConfig {
  statePath?: string;
  phases?: SeedPhase[];
}

export interface LoadedConfigs {
  agents: AgentRoster;
  scenario: SeedScenario;
}

export class SeedEngine {
  private statePath: string;
  private state: EngineState;
  private configs: LoadedConfigs | null = null;
  private bus: ReturnType<typeof createEventBus>;
  private targetPhases: SeedPhase[];
  private startTime: number = 0;

  constructor(config: SeedEngineConfig = {}) {
    this.statePath = config.statePath ?? DEFAULT_STATE_PATH;
    this.state = loadEngineState(this.statePath) ?? createEmptyEngineState();
    this.bus = createEventBus();
    this.targetPhases = config.phases ?? ['A', 'B'];
  }

  // ──────────────────────────────────────
  // Config Loading
  // ──────────────────────────────────────

  loadConfigs(): LoadedConfigs {
    this.configs = {
      agents: AGENT_ROSTER,
      scenario: SEED_SCENARIO,
    };
    return this.configs;
  }

  // ──────────────────────────────────────
  // Registration
  // ──────────────────────────────────────

  async registerAllAgents(): Promise<void> {
    if (!this.configs) this.loadConfigs();
    const agents = this.configs!.agents.all;

    console.log(`\nRegistering ${agents.length} agents on ERC-8004...\n`);

    for (const agent of agents) {
      const walletName = agent.walletName;

      // Skip if already registered
      if (this.state.registeredAgents[walletName]) {
        console.log(`  [skip] ${agent.name} (${walletName}) already registered`);
        continue;
      }

      try {
        const result = await this.registerSeedAgent(agent);
        this.state.registeredAgents[walletName] = result;
        saveEngineState(this.state, this.statePath);

        await this.bus.emit({
          type: 'seed:registration',
          protocol: Protocol.Erc8004,
          agentId: result.agentId,
          data: {
            name: agent.name,
            walletName,
            role: agent.role,
            txHash: result.txHash,
          },
        });

        console.log(`  [ok] ${agent.name} (${walletName}) -> agentId: ${result.agentId}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  [FAIL] ${agent.name} (${walletName}): ${msg}`);
      }
    }

    console.log(`\nRegistration complete: ${Object.keys(this.state.registeredAgents).length}/${agents.length} agents\n`);
  }

  private async registerSeedAgent(agent: SeedAgentProfile): Promise<EngineRegisteredAgent> {
    const metadata = profileToMetadata(agent);

    // Get wallet private key from env
    const envKey = `SEED_WALLET_${agent.walletName}_KEY`;
    const privateKey = process.env[envKey];
    if (!privateKey) {
      throw new Error(`Missing env var: ${envKey}`);
    }

    // Create agent with SDK
    const sdk = getSDK(privateKey);
    const sdkAgent = sdk.createAgent(metadata.name, metadata.description);

    // Register on-chain
    const txHandle = await sdkAgent.registerOnChain();
    const mined = await txHandle.waitMined();
    const txHash = mined.receipt.transactionHash ?? txHandle.hash;
    const agentId = sdkAgent.agentId?.toString() ?? `seed-${agent.walletName}`;

    // Civic Layer 1 identity inspection (best-effort)
    try {
      await inspectIdentityMetadata(agentId, {
        name: metadata.name,
        description: metadata.description,
        capabilities: metadata.capabilities,
        walletAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      });
    } catch {
      console.log(`    [warn] Civic L1 inspection failed for ${agent.name}`);
    }

    // Note: A2A Agent Card generation is skipped for seed agents.
    // generateAgentCard() is typed for DemoAgentRole (4 demo agents).
    // Seed agents rely on the ERC-8004 registration as the identity source.

    return {
      agentId,
      tokenId: agentId,
      txHash: txHash as string,
    };
  }

  // ──────────────────────────────────────
  // Phase Execution
  // ──────────────────────────────────────

  async executePhase(phase: SeedPhase): Promise<void> {
    if (!this.configs) this.loadConfigs();

    // Skip if phase already completed
    if (this.state.phasesCompleted.includes(phase)) {
      console.log(`\n[skip] Phase ${phase} already completed\n`);
      return;
    }

    const interactions = getPhaseInteractions(phase);
    const phaseConfig = getPhaseConfig(phase);

    console.log(`\nExecuting Phase ${phase}: ${phaseConfig.name} (${interactions.length} interactions)\n`);

    let completed = 0;
    let failed = 0;

    for (const interaction of interactions) {
      // Skip if already completed
      if (this.state.completedInteractions.includes(interaction.id)) {
        console.log(`  [skip] ${interaction.id}`);
        completed++;
        continue;
      }

      try {
        await this.executeInteraction(interaction, phaseConfig);
        this.state.completedInteractions.push(interaction.id);
        saveEngineState(this.state, this.statePath);
        completed++;

        await this.bus.emit({
          type: 'seed:interaction',
          protocol: Protocol.CovenantAi,
          agentId: interaction.requester,
          data: {
            id: interaction.id,
            phase,
            requester: interaction.requester,
            provider: interaction.provider,
            usdcAmount: interaction.usdcAmount,
            outcome: interaction.outcome,
          },
        });

        console.log(`  [ok] ${interaction.id}: ${interaction.requester} -> ${interaction.provider} (${interaction.usdcAmount} USDC, ${interaction.outcome})`);
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  [FAIL] ${interaction.id}: ${msg}`);
      }
    }

    // Mark phase as completed
    if (!this.state.phasesCompleted.includes(phase)) {
      this.state.phasesCompleted.push(phase);
    }
    saveEngineState(this.state, this.statePath);

    await this.bus.emit({
      type: 'seed:phase-complete',
      protocol: Protocol.CovenantAi,
      agentId: 'seed-engine',
      data: {
        phase,
        name: phaseConfig.name,
        completed,
        failed,
        total: interactions.length,
      },
    });

    console.log(`\nPhase ${phase} complete: ${completed}/${interactions.length} (${failed} failed)\n`);
  }

  private async executeInteraction(interaction: SeedInteraction, phaseConfig: PhaseConfig): Promise<void> {
    const requesterAgent = this.state.registeredAgents[interaction.requester];
    const providerAgent = this.state.registeredAgents[interaction.provider];

    if (!requesterAgent || !providerAgent) {
      throw new Error(`Agent not registered: ${interaction.requester} or ${interaction.provider}`);
    }

    // Handle rejected interactions (no payment, no delivery)
    if (interaction.outcome === 'rejected') {
      console.log(`    [rejected] ${interaction.id}: ${interaction.description}`);
      return;
    }

    // Step 1: Negotiate price
    const negotiation = await negotiatePrice({
      requesterId: requesterAgent.agentId,
      providerId: providerAgent.agentId,
      taskDescription: interaction.description,
      initialOffer: interaction.usdcAmount,
    });

    const agreedPrice = negotiation.agreedPrice ?? interaction.usdcAmount;

    // Step 2: Execute payment (real x402 USDC transfer)
    const paymentResult = await executePayment({
      payerAgentId: requesterAgent.agentId,
      payeeAgentId: providerAgent.agentId,
      amount: agreedPrice.toFixed(2),
      taskId: `seed-${interaction.id}`,
    });

    // Step 3: Task delivery (A2A)
    let deliverable = 'Task completed';
    try {
      const task = await sendTask(
        `http://localhost:3000/api/agents/${providerAgent.agentId}/a2a`,
        {
          description: interaction.description,
          capability: interaction.capabilityRequired,
          offeredPayment: agreedPrice,
          requesterId: requesterAgent.agentId,
        },
      );
      deliverable = task.artifacts?.[0]?.data
        || task.messages?.find((m: { role: string }) => m.role === 'agent')?.parts?.[0]?.text
        || deliverable;
    } catch {
      // Best-effort delivery
    }

    // Step 4: Give feedback (on-chain)
    const isPositive = interaction.outcome === 'positive';
    await giveFeedback({
      targetAgentId: providerAgent.agentId,
      isPositive,
      feedbackURI: interaction.description,
      proofOfPayment: paymentResult.txHash,
      feedbackerAgentId: requesterAgent.agentId,
    });
  }

  // ──────────────────────────────────────
  // Reputation Computation
  // ──────────────────────────────────────

  async computeReputation(phase: SeedPhase): Promise<void> {
    console.log(`\nComputing reputation after Phase ${phase}...\n`);

    const agentEntries = Object.entries(this.state.registeredAgents);
    for (const [walletName, agent] of agentEntries) {
      try {
        await triggerReputationPipeline({
          targetAgentId: agent.agentId,
          feedbackValue: 1,
          feedbackUri: '',
          proofOfPayment: '',
          sourceAgentId: 'seed-engine',
          timestamp: Date.now(),
        });
      } catch {
        console.log(`  [warn] Reputation computation failed for ${walletName}`);
      }
    }

    if (!this.state.reputationComputed.includes(phase)) {
      this.state.reputationComputed.push(phase);
    }
    saveEngineState(this.state, this.statePath);

    await this.bus.emit({
      type: 'seed:reputation-computed',
      protocol: Protocol.CovenantAi,
      agentId: 'seed-engine',
      data: { phase, agentCount: agentEntries.length },
    });

    console.log(`Reputation computed for ${agentEntries.length} agents\n`);
  }

  // ──────────────────────────────────────
  // Full Run Orchestration
  // ──────────────────────────────────────

  async run(): Promise<void> {
    this.startTime = Date.now();
    console.log('\n========================================');
    console.log('  Covenant Seed Engine');
    console.log(`  Phases: ${this.targetPhases.join(', ')}`);
    console.log('========================================\n');

    // Step 1: Load configs
    this.loadConfigs();

    // Step 2: Register all agents (idempotent)
    await this.registerAllAgents();

    // Step 3: Execute target phases
    for (const phase of this.targetPhases) {
      // Execute phase
      await this.executePhase(phase);

      // Compute reputation if phase config says to
      const phaseConfig = getPhaseConfig(phase);
      if (phaseConfig.triggerReputationCompute && !this.state.reputationComputed.includes(phase)) {
        await this.computeReputation(phase);
      }
    }

    // Step 4: Print summary
    this.printSummary();
  }

  private printSummary(): void {
    const elapsed = Date.now() - this.startTime;
    const agentCount = Object.keys(this.state.registeredAgents).length;
    const interactionCount = this.state.completedInteractions.length;
    const phaseCount = this.state.phasesCompleted.length;

    console.log('\n========================================');
    console.log('  Summary');
    console.log('========================================');
    console.log(`  Agents registered: ${agentCount}`);
    console.log(`  Interactions completed: ${interactionCount}`);
    console.log(`  Phases completed: ${this.state.phasesCompleted.join(', ') || 'none'}`);
    console.log(`  Reputation computed: ${this.state.reputationComputed.join(', ') || 'none'}`);
    console.log(`  Time elapsed: ${(elapsed / 1000).toFixed(1)}s`);
    console.log('========================================\n');
  }
}
