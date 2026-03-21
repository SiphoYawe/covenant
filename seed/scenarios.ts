import type { SeedPhase, PhaseConfig, SeedScenario, SeedInteraction } from './types';
import { ALL_INTERACTIONS } from './interactions';

// ──────────────────────────────────────────
// Phase Configurations
// ──────────────────────────────────────────

function buildPhaseConfig(
  phase: SeedPhase,
  name: string,
  description: string,
  prerequisitePhase: SeedPhase | null,
  triggerReputationCompute: boolean,
  civicCheckEnabled: boolean,
  interactions: SeedInteraction[],
): PhaseConfig {
  return {
    phase,
    name,
    interactionCount: interactions.length,
    description,
    prerequisitePhase,
    triggerReputationCompute,
    civicCheckEnabled,
    interactions,
  };
}

function buildScenario(interactions: SeedInteraction[]): SeedScenario {
  const byPhase = new Map<SeedPhase, SeedInteraction[]>();
  for (const ix of interactions) {
    const list = byPhase.get(ix.phase) ?? [];
    list.push(ix);
    byPhase.set(ix.phase, list);
  }

  const phases: PhaseConfig[] = [
    buildPhaseConfig(
      'A',
      'Bootstrap',
      'All 7 requesters make initial hires across diverse providers. All positive outcomes. Establishes baseline trust graph.',
      null,
      false,
      true,
      byPhase.get('A') ?? [],
    ),
    buildPhaseConfig(
      'B',
      'Differentiation',
      'Repeat business, cross-domain hiring, quality competition, high-value audits. Reputation scores begin diverging.',
      'A',
      true,
      true,
      byPhase.get('B') ?? [],
    ),
    buildPhaseConfig(
      'C',
      'Adversarial Entry',
      'Adversarial agents enter the ecosystem. X1 builds legitimate reputation. X2-X3-X4 Sybil ring forms with circular payments. X4 undercuts legitimate providers.',
      'B',
      false,
      false,
      byPhase.get('C') ?? [],
    ),
    buildPhaseConfig(
      'D',
      'Detection',
      'X1 delivers malicious payloads caught by Civic L2. Full reputation pipeline runs. Sybil ring detected. Routing exclusion applied. Premium pricing emerges for trusted providers.',
      'C',
      true,
      true,
      byPhase.get('D') ?? [],
    ),
    buildPhaseConfig(
      'E',
      'Mature Ecosystem',
      'Rich steady-state data. Continued commerce, trust graph maturity, new agent entry. Adversarial agents receive zero new work. Final reputation snapshot.',
      'D',
      true,
      true,
      byPhase.get('E') ?? [],
    ),
  ];

  const totalInteractions = phases.reduce((sum, p) => sum + p.interactionCount, 0);
  const totalUsdcVolume = interactions.reduce((sum, ix) => sum + ix.usdcAmount, 0);

  return { phases, totalInteractions, totalUsdcVolume };
}

export const SEED_SCENARIO: SeedScenario = buildScenario(ALL_INTERACTIONS);

// ──────────────────────────────────────────
// Lookup
// ──────────────────────────────────────────

export function getPhaseConfig(phase: SeedPhase): PhaseConfig {
  const config = SEED_SCENARIO.phases.find((p) => p.phase === phase);
  if (!config) {
    throw new Error(`Phase not found: ${phase}`);
  }
  return config;
}
