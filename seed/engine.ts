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
import { getPhaseInteractions, getInteractionById } from './interactions';

// Protocol imports
import { getSDK } from '@/lib/protocols/erc8004/client';
import { giveFeedback } from '@/lib/protocols/erc8004/reputation';
import { appendReputationResponse } from '@/lib/protocols/erc8004/write-back';
import { negotiatePrice } from '@/lib/orchestrator/negotiation';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { USDC_CONTRACT_ADDRESS, ERC20_ABI, envKeyForWallet } from './types';
import { getCivicGateway } from '@/lib/civic/gateway';
import { handleThreat, getFlags } from '@/lib/civic/threat-handler';
import { getCivicPenalty } from '@/lib/civic/reputation-bridge';
import { triggerReputationPipeline } from '@/lib/reputation/engine';
import { computeStakeWeights } from '@/lib/reputation/stake-weighting';
import { buildGraph, saveGraph } from '@/lib/reputation/graph';
import { computeTrustPropagation, getGlobalTrustRanking } from '@/lib/reputation/trust-propagation';
import { detectSybilPatterns, storeSybilAlerts } from '@/lib/reputation/sybil-detection';
import { synthesizeScore, classifyAgent } from '@/lib/reputation/score-synthesis';
import { generateExplanation, storeExplanation } from '@/lib/reputation/explanation';
import { sendTask } from '@/lib/protocols/a2a/client';
import { createEventBus } from '@/lib/events/bus';
import { Protocol } from '@/lib/events/types';
import type {
  FeedbackRecord,
  TransactionRecord,
  ScoreSynthesisInput,
  ExplanationInput,
} from '@/lib/reputation/types';
import { CivicLayer, CivicSeverity } from '@/lib/civic/types';

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

    // Civic Layer 1 identity inspection via gateway (emits civic:identity-checked events)
    try {
      const gateway = getCivicGateway();
      await gateway.inspectIdentity(agentId, {
        name: metadata.name,
        description: metadata.description,
        capabilities: metadata.capabilities,
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

    // Only mark phase as completed if ALL interactions succeeded
    if (failed === 0 && !this.state.phasesCompleted.includes(phase)) {
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

    const status = failed === 0 ? 'COMPLETE' : 'PARTIAL (re-run with --resume after funding)';
    console.log(`\nPhase ${phase}: ${completed}/${interactions.length} (${failed} failed) [${status}]\n`);
  }

  private async executeSeedPayment(
    payerWalletName: string,
    payeeWalletName: string,
    amount: number,
    interactionId: string,
  ): Promise<{ txHash: string; payer: string; payee: string; amount: string }> {
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
    const payerKey = process.env[envKeyForWallet(payerWalletName)];
    const payeeKey = process.env[envKeyForWallet(payeeWalletName)];
    if (!payerKey) throw new Error(`Missing env var: ${envKeyForWallet(payerWalletName)}`);
    if (!payeeKey) throw new Error(`Missing env var: ${envKeyForWallet(payeeWalletName)}`);

    const payerAccount = privateKeyToAccount(payerKey as `0x${string}`);
    const payeeAccount = privateKeyToAccount(payeeKey as `0x${string}`);

    const walletClient = createWalletClient({
      account: payerAccount,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    const amountInWei = parseUnits(amount.toFixed(2), 6);

    const txHash = await walletClient.writeContract({
      address: USDC_CONTRACT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [payeeAccount.address, amountInWei],
    });

    // Wait for confirmation
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      txHash,
      payer: payerAccount.address,
      payee: payeeAccount.address,
      amount: amount.toFixed(2),
    };
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

    // Step 1: Negotiate price (capped to interaction budget to prevent overspend)
    const negotiation = await negotiatePrice({
      requesterId: requesterAgent.agentId,
      providerId: providerAgent.agentId,
      taskDescription: interaction.description,
      initialOffer: interaction.usdcAmount,
    });

    // Cap the agreed price to the planned amount. The AI negotiation may
    // counter higher, but we enforce the budget to prevent wallet depletion.
    const agreedPrice = Math.min(
      negotiation.agreedPrice ?? interaction.usdcAmount,
      interaction.usdcAmount,
    );

    // Step 2: Execute payment (direct USDC transfer using seed wallet keys)
    const paymentResult = await this.executeSeedPayment(
      interaction.requester,
      interaction.provider,
      agreedPrice,
      interaction.id,
    );

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

    // Step 3.5: Civic L2 behavioral inspection (when enabled)
    let civicCaught = false;
    if (phaseConfig.civicCheckEnabled && deliverable) {
      try {
        const gateway = getCivicGateway();
        const inspectionResult = await gateway.inspectBehavior(
          providerAgent.agentId,
          { content: deliverable, taskDescription: interaction.description },
          'output',
          requesterAgent.agentId,
        );

        if (!inspectionResult.result.passed) {
          civicCaught = true;

          await handleThreat(
            {
              passed: false,
              layer: CivicLayer.Behavioral,
              agentId: providerAgent.agentId,
              warnings: inspectionResult.result.flags?.map((f: { evidence?: string }) => f.evidence ?? '') ?? [],
              flags: interaction.civicFlags?.map(flag => ({
                id: `civic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                agentId: providerAgent.agentId,
                severity: CivicSeverity.Critical,
                layer: CivicLayer.Behavioral,
                attackType: flag as 'prompt_injection' | 'malicious_content',
                evidence: `Detected in deliverable for task ${interaction.id}`,
                timestamp: Date.now(),
              })) ?? [],
              verificationStatus: 'flagged' as const,
              timestamp: Date.now(),
            },
            {
              agentId: providerAgent.agentId,
              targetAgentId: requesterAgent.agentId,
              transactionId: `seed-${interaction.id}`,
            },
          );

          await this.bus.emit({
            type: 'seed:civic-catch',
            protocol: Protocol.Civic,
            agentId: providerAgent.agentId,
            data: {
              interactionId: interaction.id,
              flags: interaction.civicFlags,
              action: 'blocked',
            },
          });

          console.log(`    [CIVIC L2] Caught malicious content from ${interaction.provider}: ${interaction.civicFlags?.join(', ')}`);
        }
      } catch {
        console.log(`    [warn] Civic L2 inspection failed for ${interaction.id}`);
      }
    }

    // Step 4: Give feedback (on-chain)
    const isPositive = civicCaught ? false : interaction.outcome === 'positive';
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
    console.log(`\nRunning full reputation pipeline after Phase ${phase}...\n`);

    if (!this.configs) this.loadConfigs();
    const allAgents = this.configs!.agents.all;
    const agentEntries = Object.entries(this.state.registeredAgents);

    // Step 1: Build feedback records from completed interactions
    const feedbackRecords: FeedbackRecord[] = [];
    const transactionHistory: TransactionRecord[] = [];

    for (const interactionId of this.state.completedInteractions) {
      const interaction = getInteractionById(interactionId);
      if (!interaction || interaction.outcome === 'rejected') continue;

      const providerReg = this.state.registeredAgents[interaction.provider];
      const requesterReg = this.state.registeredAgents[interaction.requester];
      if (!providerReg || !requesterReg) continue;

      feedbackRecords.push({
        agentId: providerReg.agentId,
        feedbackValue: interaction.outcome === 'positive' ? 1 : interaction.outcome === 'negative' ? -1 : 0,
        paymentAmount: interaction.usdcAmount,
        transactionHash: `seed-${interaction.id}`,
        timestamp: Date.now(),
      });

      transactionHistory.push({
        from: requesterReg.agentId,
        to: providerReg.agentId,
        amount: interaction.usdcAmount,
        feedbackValue: interaction.outcome === 'positive' ? 1 : interaction.outcome === 'negative' ? -1 : 0,
        timestamp: Date.now(),
        txHash: `seed-${interaction.id}`,
      });
    }

    console.log(`  [1/7] Stake-weighting ${feedbackRecords.length} feedback records...`);
    const stakeResults = computeStakeWeights(feedbackRecords);
    const stakeMap = new Map(stakeResults.map(r => [r.agentId, r]));

    // Step 2: Build payment graph
    console.log(`  [2/7] Building payment graph...`);
    const graph = buildGraph(
      transactionHistory.map(tx => ({
        payer: tx.from,
        payee: tx.to,
        proof: {
          txHash: tx.txHash,
          counterpartyAgentId: tx.to,
          amount: String(tx.amount),
          timestamp: tx.timestamp,
          direction: 'outgoing' as const,
        },
        outcome: tx.feedbackValue >= 0 ? 'success' as const : 'fail' as const,
      }))
    );
    await saveGraph(graph);

    // Step 3: Trust propagation
    console.log(`  [3/7] Computing trust propagation...`);
    const trustResult = computeTrustPropagation(graph);
    const ranking = getGlobalTrustRanking(trustResult);
    const trustMap = new Map(ranking.map(r => [r.agentId, r.avgTrust]));

    // Step 4: Sybil detection
    console.log(`  [4/7] Running Sybil detection...`);
    const agentIds = agentEntries.map(([, agent]) => agent.agentId);
    const sybilResult = await detectSybilPatterns({
      graph,
      transactionHistory,
      agentIds,
    });

    if (sybilResult.alerts.length > 0) {
      await storeSybilAlerts(sybilResult.alerts);
      console.log(`    Sybil alerts: ${sybilResult.alerts.length} (${sybilResult.alerts.map(a => a.patternType).join(', ')})`);
    }

    // Step 5: Score synthesis for each agent
    console.log(`  [5/7] Synthesizing scores for ${agentEntries.length} agents...`);
    const scores = new Map<string, { score: number; classification: string }>();

    for (const [walletName, agent] of agentEntries) {
      const stakeResult = stakeMap.get(agent.agentId);
      const trustScore = trustMap.get(agent.agentId) ?? 5.0;
      const agentSybilAlerts = sybilResult.alerts.filter(a => a.involvedAgents.includes(agent.agentId));
      const civicPenalty = await getCivicPenalty(agent.agentId);

      const agentFeedback = feedbackRecords.filter(f => f.agentId === agent.agentId);
      const hasNegative = agentFeedback.some(f => f.feedbackValue < 0);

      const input: ScoreSynthesisInput = {
        agentId: agent.agentId,
        stakeWeightedScore: stakeResult?.weightedAverage ?? 5.0,
        trustPropagationScore: trustScore,
        sybilAlerts: agentSybilAlerts,
        civicPenalty,
        hasNegativeFeedback: hasNegative,
      };

      const result = synthesizeScore(input);
      const classification = classifyAgent(result, input);
      scores.set(agent.agentId, { score: result.finalScore, classification });

      const profile = allAgents.find(a => a.walletName === walletName);
      console.log(`    ${walletName} (${profile?.name ?? 'unknown'}): ${result.finalScore.toFixed(1)}/10 [${classification}]`);
    }

    // Step 6: Generate explanations and store on IPFS
    console.log(`  [6/7] Generating explanations...`);
    for (const [walletName, agent] of agentEntries) {
      const profile = allAgents.find(a => a.walletName === walletName);
      if (!profile) continue;

      const scoreInfo = scores.get(agent.agentId);
      if (!scoreInfo) continue;

      const agentFeedback = feedbackRecords.filter(f => f.agentId === agent.agentId);
      const positiveCount = agentFeedback.filter(f => f.feedbackValue > 0).length;
      const negativeCount = agentFeedback.filter(f => f.feedbackValue < 0).length;
      const totalPayment = agentFeedback.reduce((sum, f) => sum + f.paymentAmount, 0);
      const civicFlags = await getFlags(agent.agentId);
      const agentSybilAlerts = sybilResult.alerts.filter(a => a.involvedAgents.includes(agent.agentId));
      const trustScore = trustMap.get(agent.agentId) ?? 5.0;
      const stakeResult = stakeMap.get(agent.agentId);

      const explanationInput: ExplanationInput = {
        agentId: agent.agentId,
        agentName: profile.name,
        agentRole: profile.role,
        score: scoreInfo.score,
        classification: scoreInfo.classification as ExplanationInput['classification'],
        jobCount: agentFeedback.length,
        successRate: agentFeedback.length > 0 ? positiveCount / agentFeedback.length : 0,
        failureRate: agentFeedback.length > 0 ? negativeCount / agentFeedback.length : 0,
        paymentVolume: totalPayment,
        civicFlags: civicFlags.map(f => ({ severity: f.severity, attackType: f.attackType, evidence: f.evidence })),
        trustGraphPosition: { inboundTrust: trustScore, outboundTrust: trustScore },
        sybilAlerts: agentSybilAlerts,
        stakeWeightedAverage: stakeResult?.weightedAverage ?? 5.0,
      };

      try {
        const explanation = await generateExplanation(explanationInput);
        const stored = await storeExplanation(agent.agentId, explanation);

        // Step 7: Write back to chain using system wallet key directly
        const systemKey = process.env.SYSTEM_PRIVATE_KEY;
        if (systemKey) {
          const systemSdk = getSDK(systemKey);
          await systemSdk.giveFeedback(
            agent.agentId,
            Math.round(scoreInfo.score),
            'covenant-reputation',
            'append-response',
            undefined,
            {
              text: `ipfs://${stored.cid ?? ''}`,
              proofOfPayment: {
                txHash: JSON.stringify({
                  stakeWeight: stakeResult?.weightedAverage ?? 5.0,
                  trustPropagation: trustScore,
                  sybilPenalty: agentSybilAlerts.length,
                  civicFlag: await getCivicPenalty(agent.agentId),
                  paymentVolume: totalPayment,
                }),
                timestamp: Date.now(),
              },
            },
          );
        }

        console.log(`    [ok] ${walletName}: score=${scoreInfo.score.toFixed(1)}, cid=${stored.cid ?? 'kv-only'}`);
      } catch (error) {
        console.log(`    [warn] Pipeline failed for ${walletName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Mark phase reputation as computed
    if (!this.state.reputationComputed.includes(phase)) {
      this.state.reputationComputed.push(phase);
    }
    saveEngineState(this.state, this.statePath);

    await this.bus.emit({
      type: 'seed:reputation-computed',
      protocol: Protocol.CovenantAi,
      agentId: 'seed-engine',
      data: { phase, agentCount: agentEntries.length, sybilAlerts: sybilResult.alerts.length },
    });

    console.log(`\nReputation pipeline complete for ${agentEntries.length} agents\n`);
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
