import { describe, it, expect } from 'vitest';
import { AGENT_ROSTER } from '../../seed/agents';
import { SEED_SCENARIO, getPhaseConfig } from '../../seed/scenarios';
import { getPhaseInteractions, getInteractionById, ALL_INTERACTIONS } from '../../seed/interactions';
import { profileToMetadata } from '../../seed/metadata';
import { createEmptyEngineState } from '../../seed/engine';
import type { SeedAgentProfile, EngineState } from '../../seed/types';

// ──────────────────────────────────────────
// Seed Data Integrity Tests
// ──────────────────────────────────────────

describe('Seed Data: Agent Roster', () => {
  it('roster contains exactly 28 agents total', () => {
    expect(AGENT_ROSTER.all).toHaveLength(28);
  });

  it('roster has 7 requesters, 17 providers, 4 adversarial', () => {
    expect(AGENT_ROSTER.requesters).toHaveLength(7);
    expect(AGENT_ROSTER.providers).toHaveLength(17);
    expect(AGENT_ROSTER.adversarial).toHaveLength(4);
  });

  it('all agents have unique wallet names', () => {
    const walletNames = AGENT_ROSTER.all.map((a) => a.walletName);
    expect(new Set(walletNames).size).toBe(walletNames.length);
  });

  it('all agents have unique display names', () => {
    const names = AGENT_ROSTER.all.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every agent has a non-empty system prompt', () => {
    for (const agent of AGENT_ROSTER.all) {
      expect(agent.systemPrompt.length).toBeGreaterThan(10);
    }
  });

  it('every agent has at least one capability', () => {
    for (const agent of AGENT_ROSTER.all) {
      expect(agent.capabilities.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every agent has valid pricing (min <= max)', () => {
    for (const agent of AGENT_ROSTER.all) {
      expect(agent.pricing.minUsdc).toBeLessThanOrEqual(agent.pricing.maxUsdc);
    }
  });
});

describe('Seed Data: Interaction Graph', () => {
  it('scenario has 5 phases (A through E)', () => {
    expect(SEED_SCENARIO.phases).toHaveLength(5);
    const phaseIds = SEED_SCENARIO.phases.map((p) => p.phase);
    expect(phaseIds).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('total interactions count matches individual phase sums', () => {
    const phaseSum = SEED_SCENARIO.phases.reduce(
      (sum, p) => sum + p.interactionCount,
      0,
    );
    expect(SEED_SCENARIO.totalInteractions).toBe(phaseSum);
  });

  it('all interactions reference valid agent wallet names', () => {
    const validNames = new Set(AGENT_ROSTER.all.map((a) => a.walletName));
    for (const phase of SEED_SCENARIO.phases) {
      for (const ix of phase.interactions) {
        expect(validNames.has(ix.requester)).toBe(true);
        expect(validNames.has(ix.provider)).toBe(true);
      }
    }
  });

  it('all interactions have non-negative USDC amounts', () => {
    for (const phase of SEED_SCENARIO.phases) {
      for (const ix of phase.interactions) {
        expect(ix.usdcAmount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('getPhaseInteractions returns correct count for each phase', () => {
    for (const phase of SEED_SCENARIO.phases) {
      const interactions = getPhaseInteractions(phase.phase);
      expect(interactions).toHaveLength(phase.interactionCount);
    }
  });

  it('getInteractionById returns the correct interaction', () => {
    const firstIx = SEED_SCENARIO.phases[0].interactions[0];
    const found = getInteractionById(firstIx.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(firstIx.id);
  });

  it('phase prerequisites form a valid chain', () => {
    const phases = SEED_SCENARIO.phases;
    expect(phases[0].prerequisitePhase).toBeNull(); // Phase A has no prereq
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i].prerequisitePhase).toBe(phases[i - 1].phase);
    }
  });
});

describe('Seed Data: Metadata Conversion', () => {
  it('converts agent profile to ERC-8004 metadata format', () => {
    const agent = AGENT_ROSTER.all[0];
    const metadata = profileToMetadata(agent);

    expect(metadata.name).toBe(agent.name);
    expect(metadata.description).toBe(agent.description);
    expect(metadata.capabilities).toEqual(agent.capabilities);
  });

  it('all 28 agents produce valid metadata', () => {
    for (const agent of AGENT_ROSTER.all) {
      const metadata = profileToMetadata(agent);
      expect(metadata.name).toBeTruthy();
      expect(metadata.description).toBeTruthy();
      expect(metadata.capabilities.length).toBeGreaterThan(0);
    }
  });
});

describe('Seed Data: Engine State', () => {
  it('creates empty engine state with correct shape', () => {
    const state = createEmptyEngineState();

    expect(state.registeredAgents).toEqual({});
    expect(state.completedInteractions).toEqual([]);
    expect(state.phasesCompleted).toEqual([]);
    expect(state.reputationComputed).toEqual([]);
    expect(state.lastUpdated).toBeTruthy();
  });

  it('empty state has valid ISO timestamp', () => {
    const state = createEmptyEngineState();
    const parsed = new Date(state.lastUpdated);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

// ──────────────────────────────────────────
// Demo Module Cleanup Verification
// ──────────────────────────────────────────

describe('Demo Module: Cleanup Verification', () => {
  it('src/lib/demo/index.ts exports live trigger modules (not act executors)', async () => {
    const demoModule = await import('@/lib/demo');

    // New exports exist
    expect(demoModule.executeLiveLifecycle).toBeDefined();
    expect(demoModule.executeSybilCascade).toBeDefined();
    expect(demoModule.acquireLock).toBeDefined();
    expect(demoModule.releaseLock).toBeDefined();

    // Old exports do NOT exist
    expect((demoModule as Record<string, unknown>).ACT_EXECUTORS).toBeUndefined();
    expect((demoModule as Record<string, unknown>).getActExecutor).toBeUndefined();
    expect((demoModule as Record<string, unknown>).isValidActNumber).toBeUndefined();
    expect((demoModule as Record<string, unknown>).ACT_CONFIGS).toBeUndefined();
  });

  it('src/lib/demo/types.ts exports seed-based types (not act types)', async () => {
    const typesModule = await import('@/lib/demo/types');

    // Verify no act-related exports survive (these are type-only, check for value exports)
    expect((typesModule as Record<string, unknown>).VALID_ACT_NUMBERS).toBeUndefined();
    expect((typesModule as Record<string, unknown>).ACT_CONFIGS).toBeUndefined();
    expect((typesModule as Record<string, unknown>).isValidActNumber).toBeUndefined();
  });

  it('orchestrator types no longer export DemoAct enum', async () => {
    const orchTypes = await import('@/lib/orchestrator/types');

    expect(orchTypes.DemoStatus).toBeDefined();
    expect((orchTypes as Record<string, unknown>).DemoAct).toBeUndefined();
  });

  it('orchestrator index no longer exports DemoAct', async () => {
    const orchModule = await import('@/lib/orchestrator');

    expect(orchModule.DemoStatus).toBeDefined();
    expect((orchModule as Record<string, unknown>).DemoAct).toBeUndefined();
  });

  it('dashboard store demoState no longer has currentAct field', async () => {
    const { useDashboardStore } = await import('@/stores/dashboard');
    const state = useDashboardStore.getState();

    expect(state.demoState).toBeDefined();
    expect(state.demoState.status).toBe('idle');
    expect((state.demoState as Record<string, unknown>).currentAct).toBeUndefined();
  });

  it('components/demo/index.ts exports only live trigger components', async () => {
    const componentModule = await import('@/components/demo');

    expect(componentModule.LiveTriggerCard).toBeDefined();
    expect(componentModule.LiveEventStream).toBeDefined();
    expect(componentModule.TriggerSummary).toBeDefined();

    // Old components do NOT exist
    expect((componentModule as Record<string, unknown>).ActIndicator).toBeUndefined();
    expect((componentModule as Record<string, unknown>).DemoController).toBeUndefined();
    expect((componentModule as Record<string, unknown>).DemoStatus).toBeUndefined();
    expect((componentModule as Record<string, unknown>).DEMO_ACTS).toBeUndefined();
  });
});

// ──────────────────────────────────────────
// Seed + Demo Cross-Module Integration
// ──────────────────────────────────────────

describe('Integration: Seed agents feed demo trust graph', () => {
  it('all 28 seed agents would create 28 trust graph nodes', () => {
    const agentIds = AGENT_ROSTER.all.map((a) => a.walletName);
    expect(agentIds).toHaveLength(28);
    expect(new Set(agentIds).size).toBe(28);
  });

  it('interaction graph creates edges between valid agent pairs', () => {
    const agentIds = new Set(AGENT_ROSTER.all.map((a) => a.walletName));
    const edges = new Set<string>();

    for (const phase of SEED_SCENARIO.phases) {
      for (const ix of phase.interactions) {
        expect(agentIds.has(ix.requester)).toBe(true);
        expect(agentIds.has(ix.provider)).toBe(true);
        edges.add(`${ix.requester}->${ix.provider}`);
      }
    }

    // Should have a reasonable number of unique edges
    expect(edges.size).toBeGreaterThan(20);
  });

  it('adversarial agents appear in interactions as providers', () => {
    const adversarialNames = new Set(
      AGENT_ROSTER.adversarial.map((a) => a.walletName),
    );

    let adversarialInteractions = 0;
    for (const phase of SEED_SCENARIO.phases) {
      for (const ix of phase.interactions) {
        if (adversarialNames.has(ix.provider)) {
          adversarialInteractions++;
        }
      }
    }

    expect(adversarialInteractions).toBeGreaterThan(0);
  });

  it('Sybil ring interactions exist in the graph', () => {
    let sybilRingCount = 0;
    for (const phase of SEED_SCENARIO.phases) {
      for (const ix of phase.interactions) {
        if (ix.isSybilRing) sybilRingCount++;
      }
    }

    expect(sybilRingCount).toBeGreaterThan(0);
  });

  it('civic-flagged interactions exist in the graph', () => {
    let civicFlagCount = 0;
    for (const phase of SEED_SCENARIO.phases) {
      for (const ix of phase.interactions) {
        if (ix.civicFlags && ix.civicFlags.length > 0) civicFlagCount++;
      }
    }

    expect(civicFlagCount).toBeGreaterThan(0);
  });

  it('total USDC volume is positive and matches scenario', () => {
    let computedVolume = 0;
    for (const phase of SEED_SCENARIO.phases) {
      for (const ix of phase.interactions) {
        computedVolume += ix.usdcAmount;
      }
    }

    expect(computedVolume).toBeGreaterThan(0);
    expect(computedVolume).toBe(SEED_SCENARIO.totalUsdcVolume);
  });
});
