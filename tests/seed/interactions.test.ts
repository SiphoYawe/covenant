import { describe, it, expect } from 'vitest';
import {
  REQUESTER_BUDGETS,
  type SeedInteraction,
  type SeedPhase,
  seedInteractionSchema,
} from '../../seed/types';
import { AGENT_ROSTER } from '../../seed/agents';
import {
  ALL_INTERACTIONS,
  getPhaseInteractions,
  getInteractionById,
  getInteractionsByAgent,
  getInteractionCount,
  validateInteractionGraph,
} from '../../seed/interactions';
import {
  SEED_SCENARIO,
  getPhaseConfig,
} from '../../seed/scenarios';

// ──────────────────────────────────────────
// Interaction Count Tests
// ──────────────────────────────────────────

describe('interaction counts', () => {
  it('has at least 210 total interactions', () => {
    expect(ALL_INTERACTIONS.length).toBeGreaterThanOrEqual(210);
  });

  it('Phase A has exactly 40 interactions', () => {
    const phaseA = getPhaseInteractions('A');
    expect(phaseA).toHaveLength(40);
  });

  it('Phase B has exactly 50 interactions', () => {
    const phaseB = getPhaseInteractions('B');
    expect(phaseB).toHaveLength(50);
  });

  it('Phase C has exactly 30 interactions', () => {
    const phaseC = getPhaseInteractions('C');
    expect(phaseC).toHaveLength(30);
  });

  it('Phase D has exactly 40 interactions', () => {
    const phaseD = getPhaseInteractions('D');
    expect(phaseD).toHaveLength(40);
  });

  it('Phase E has exactly 50 interactions', () => {
    const phaseE = getPhaseInteractions('E');
    expect(phaseE).toHaveLength(50);
  });

  it('getInteractionCount returns correct totals', () => {
    const count = getInteractionCount();
    expect(count.total).toBeGreaterThanOrEqual(210);
    expect(count.byPhase.A).toBe(40);
    expect(count.byPhase.B).toBe(50);
    expect(count.byPhase.C).toBe(30);
    expect(count.byPhase.D).toBe(40);
    expect(count.byPhase.E).toBe(50);
  });
});

// ──────────────────────────────────────────
// ID Format Tests
// ──────────────────────────────────────────

describe('interaction ID format', () => {
  it('all IDs follow phase-NNN pattern', () => {
    for (const ix of ALL_INTERACTIONS) {
      expect(ix.id).toMatch(/^[A-E]-\d{3}$/);
    }
  });

  it('all IDs are unique', () => {
    const ids = ALL_INTERACTIONS.map((ix) => ix.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ID phase prefix matches the phase field', () => {
    for (const ix of ALL_INTERACTIONS) {
      expect(ix.id.charAt(0)).toBe(ix.phase);
    }
  });
});

// ──────────────────────────────────────────
// Sequence Number Tests
// ──────────────────────────────────────────

describe('sequence numbers', () => {
  it('are sequential within each phase', () => {
    const phases: SeedPhase[] = ['A', 'B', 'C', 'D', 'E'];
    for (const phase of phases) {
      const interactions = getPhaseInteractions(phase);
      for (let i = 0; i < interactions.length; i++) {
        expect(interactions[i].sequenceNumber).toBe(i + 1);
      }
    }
  });

  it('getPhaseInteractions returns sorted by sequenceNumber', () => {
    const phases: SeedPhase[] = ['A', 'B', 'C', 'D', 'E'];
    for (const phase of phases) {
      const interactions = getPhaseInteractions(phase);
      for (let i = 1; i < interactions.length; i++) {
        expect(interactions[i].sequenceNumber).toBeGreaterThan(
          interactions[i - 1].sequenceNumber
        );
      }
    }
  });
});

// ──────────────────────────────────────────
// Schema Validation Tests
// ──────────────────────────────────────────

describe('schema validation', () => {
  it('all interactions pass Zod schema validation', () => {
    for (const ix of ALL_INTERACTIONS) {
      const result = seedInteractionSchema.safeParse(ix);
      if (!result.success) {
        throw new Error(
          `Interaction ${ix.id} failed validation: ${result.error.message}`
        );
      }
    }
  });
});

// ──────────────────────────────────────────
// Phase A Tests (Bootstrap)
// ──────────────────────────────────────────

describe('Phase A (Bootstrap)', () => {
  it('all outcomes are positive', () => {
    const phaseA = getPhaseInteractions('A');
    for (const ix of phaseA) {
      expect(ix.outcome).toBe('positive');
    }
  });

  it('all 7 requesters are represented', () => {
    const phaseA = getPhaseInteractions('A');
    const requesters = new Set(phaseA.map((ix) => ix.requester));
    expect(requesters.size).toBe(7);
    for (let i = 1; i <= 7; i++) {
      expect(requesters.has(`R${i}`)).toBe(true);
    }
  });

  it('payment range is 1-15 USDC', () => {
    const phaseA = getPhaseInteractions('A');
    for (const ix of phaseA) {
      expect(ix.usdcAmount).toBeGreaterThanOrEqual(1);
      expect(ix.usdcAmount).toBeLessThanOrEqual(15);
    }
  });

  it('no malicious interactions', () => {
    const phaseA = getPhaseInteractions('A');
    for (const ix of phaseA) {
      expect(ix.isMalicious).toBeFalsy();
    }
  });

  it('no adversarial agents involved', () => {
    const phaseA = getPhaseInteractions('A');
    const adversarialIds = new Set(['X1', 'X2', 'X3', 'X4']);
    for (const ix of phaseA) {
      expect(adversarialIds.has(ix.requester)).toBe(false);
      expect(adversarialIds.has(ix.provider)).toBe(false);
    }
  });
});

// ──────────────────────────────────────────
// Phase B Tests (Differentiation)
// ──────────────────────────────────────────

describe('Phase B (Differentiation)', () => {
  it('R1 rehires S1 at least 3 times', () => {
    const phaseB = getPhaseInteractions('B');
    const r1s1 = phaseB.filter(
      (ix) => ix.requester === 'R1' && ix.provider === 'S1'
    );
    expect(r1s1.length).toBeGreaterThanOrEqual(3);
  });

  it('R1-S1 rehires show increasing prices', () => {
    const phaseB = getPhaseInteractions('B');
    const r1s1 = phaseB.filter(
      (ix) => ix.requester === 'R1' && ix.provider === 'S1'
    );
    for (let i = 1; i < r1s1.length; i++) {
      expect(r1s1[i].usdcAmount).toBeGreaterThan(r1s1[i - 1].usdcAmount);
    }
  });

  it('has cross-domain hiring (requesters hire outside primary domain)', () => {
    const phaseB = getPhaseInteractions('B');
    // R1 (AI research) hiring translation, content, etc.
    const r1CrossDomain = phaseB.filter(
      (ix) =>
        ix.requester === 'R1' &&
        ['S4', 'S6', 'S7', 'S11', 'S12'].includes(ix.provider)
    );
    expect(r1CrossDomain.length).toBeGreaterThanOrEqual(1);
  });

  it('has quality competition (same requester hires competing providers)', () => {
    const phaseB = getPhaseInteractions('B');
    // Check that some requester hires both S3 and S17 (competing summarizers)
    const hasS3 = phaseB.some(
      (ix) => ix.provider === 'S3'
    );
    const hasS17 = phaseB.some(
      (ix) => ix.provider === 'S17'
    );
    expect(hasS3).toBe(true);
    expect(hasS17).toBe(true);
  });
});

// ──────────────────────────────────────────
// Phase C Tests (Adversarial Entry)
// ──────────────────────────────────────────

describe('Phase C (Adversarial Entry)', () => {
  it('X1 gets 4 legitimate jobs', () => {
    const phaseC = getPhaseInteractions('C');
    const x1Jobs = phaseC.filter((ix) => ix.provider === 'X1');
    expect(x1Jobs.length).toBe(4);
    for (const ix of x1Jobs) {
      expect(ix.outcome).toBe('positive');
    }
  });

  it('Sybil ring has 9 circular payment transactions', () => {
    const phaseC = getPhaseInteractions('C');
    const sybilRing = phaseC.filter((ix) => ix.isSybilRing === true);
    expect(sybilRing.length).toBe(9);
  });

  it('Sybil ring follows X2->X3, X3->X4, X4->X2 pattern 3 times', () => {
    const phaseC = getPhaseInteractions('C');
    const sybilRing = phaseC.filter((ix) => ix.isSybilRing === true);

    // Verify the circular pattern repeats 3 times
    const expectedPattern = [
      { requester: 'X2', provider: 'X3' },
      { requester: 'X3', provider: 'X4' },
      { requester: 'X4', provider: 'X2' },
    ];

    for (let cycle = 0; cycle < 3; cycle++) {
      for (let step = 0; step < 3; step++) {
        const ix = sybilRing[cycle * 3 + step];
        expect(ix.requester).toBe(expectedPattern[step].requester);
        expect(ix.provider).toBe(expectedPattern[step].provider);
      }
    }
  });

  it('has 9 reputation farming transactions between adversarial agents', () => {
    const phaseC = getPhaseInteractions('C');
    const farming = phaseC.filter(
      (ix) =>
        !ix.isSybilRing &&
        ['X2', 'X3', 'X4'].includes(ix.requester) &&
        ['X2', 'X3', 'X4'].includes(ix.provider)
    );
    expect(farming.length).toBe(9);
  });

  it('X4 undercuts legitimate providers in 4 transactions', () => {
    const phaseC = getPhaseInteractions('C');
    const undercutting = phaseC.filter(
      (ix) =>
        ix.provider === 'X4' &&
        ['R5', 'R6'].includes(ix.requester)
    );
    expect(undercutting.length).toBe(4);
    for (const ix of undercutting) {
      expect(ix.usdcAmount).toBeLessThanOrEqual(3);
    }
  });

  it('has continued legitimate commerce', () => {
    const phaseC = getPhaseInteractions('C');
    const legit = phaseC.filter(
      (ix) =>
        ['R1', 'R2'].includes(ix.requester) &&
        !['X1', 'X2', 'X3', 'X4'].includes(ix.provider)
    );
    expect(legit.length).toBeGreaterThanOrEqual(4);
  });
});

// ──────────────────────────────────────────
// Phase D Tests (Detection)
// ──────────────────────────────────────────

describe('Phase D (Detection)', () => {
  it('has exactly 2 malicious interactions', () => {
    const phaseD = getPhaseInteractions('D');
    const malicious = phaseD.filter((ix) => ix.isMalicious === true);
    expect(malicious.length).toBe(2);
  });

  it('malicious interactions are from X1', () => {
    const phaseD = getPhaseInteractions('D');
    const malicious = phaseD.filter((ix) => ix.isMalicious === true);
    for (const ix of malicious) {
      expect(ix.provider).toBe('X1');
      expect(ix.outcome).toBe('negative');
    }
  });

  it('has routing exclusion interactions with 0 USDC', () => {
    const phaseD = getPhaseInteractions('D');
    const excluded = phaseD.filter((ix) => ix.outcome === 'rejected');
    expect(excluded.length).toBeGreaterThanOrEqual(6);
    for (const ix of excluded) {
      expect(ix.usdcAmount).toBe(0);
    }
  });

  it('has premium pricing emergence transactions', () => {
    const phaseD = getPhaseInteractions('D');
    const premium = phaseD.filter(
      (ix) =>
        ['S1', 'S2', 'S9'].includes(ix.provider) &&
        ix.usdcAmount >= 4 &&
        ix.outcome === 'positive'
    );
    expect(premium.length).toBeGreaterThanOrEqual(4);
  });

  it('has post-detection legitimate transactions', () => {
    const phaseD = getPhaseInteractions('D');
    const postDetection = phaseD.filter(
      (ix) =>
        ix.outcome === 'positive' &&
        !ix.isMalicious &&
        !['X1', 'X2', 'X3', 'X4'].includes(ix.provider)
    );
    expect(postDetection.length).toBeGreaterThanOrEqual(12);
  });

  it('no malicious interactions outside Phase D', () => {
    for (const ix of ALL_INTERACTIONS) {
      if (ix.phase !== 'D') {
        expect(ix.isMalicious).toBeFalsy();
      }
    }
  });
});

// ──────────────────────────────────────────
// Phase E Tests (Mature Ecosystem)
// ──────────────────────────────────────────

describe('Phase E (Mature Ecosystem)', () => {
  it('has at least 25 continued commerce transactions', () => {
    const phaseE = getPhaseInteractions('E');
    const commerce = phaseE.filter((ix) => ix.outcome === 'positive');
    expect(commerce.length).toBeGreaterThanOrEqual(25);
  });

  it('no adversarial agents receive new work', () => {
    const phaseE = getPhaseInteractions('E');
    const adversarial = phaseE.filter((ix) =>
      ['X1', 'X2', 'X3', 'X4'].includes(ix.provider)
    );
    expect(adversarial.length).toBe(0);
  });

  it('diverse provider engagement', () => {
    const phaseE = getPhaseInteractions('E');
    const providers = new Set(phaseE.map((ix) => ix.provider));
    expect(providers.size).toBeGreaterThanOrEqual(10);
  });
});

// ──────────────────────────────────────────
// Task Description Tests
// ──────────────────────────────────────────

describe('task descriptions', () => {
  it('all descriptions are non-empty and at least 10 chars', () => {
    for (const ix of ALL_INTERACTIONS) {
      expect(ix.description.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('descriptions are unique within each phase', () => {
    const phases: SeedPhase[] = ['A', 'B', 'C', 'D', 'E'];
    for (const phase of phases) {
      const interactions = getPhaseInteractions(phase);
      const descriptions = interactions.map((ix) => ix.description);
      const uniqueDescriptions = new Set(descriptions);
      expect(uniqueDescriptions.size).toBe(descriptions.length);
    }
  });
});

// ──────────────────────────────────────────
// Validation Tests
// ──────────────────────────────────────────

describe('validateInteractionGraph', () => {
  it('returns valid: true with no errors for the default graph', () => {
    const result = validateInteractionGraph(ALL_INTERACTIONS);
    if (!result.valid) {
      console.error('Validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('budget summary includes all requesters', () => {
    const result = validateInteractionGraph(ALL_INTERACTIONS);
    for (let i = 1; i <= 7; i++) {
      expect(result.budgetSummary[`R${i}`]).toBeDefined();
    }
  });

  it('catches unknown agent IDs', () => {
    const fakeInteraction: SeedInteraction = {
      id: 'Z-001',
      phase: 'A',
      sequenceNumber: 999,
      requester: 'R999',
      provider: 'S999',
      usdcAmount: 5,
      outcome: 'positive',
      capabilityRequired: 'test',
      description: 'This interaction references non-existent agents',
    };
    const result = validateInteractionGraph([
      ...ALL_INTERACTIONS,
      fakeInteraction,
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('R999'))).toBe(true);
  });

  it('catches budget overruns', () => {
    const overSpend: SeedInteraction = {
      id: 'Z-002',
      phase: 'E',
      sequenceNumber: 999,
      requester: 'R6',
      provider: 'S1',
      usdcAmount: 500,
      outcome: 'positive',
      capabilityRequired: 'code-review',
      description: 'This interaction would exceed the budget for R6',
    };
    const result = validateInteractionGraph([
      ...ALL_INTERACTIONS,
      overSpend,
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('budget'))).toBe(true);
  });
});

// ──────────────────────────────────────────
// Query Function Tests
// ──────────────────────────────────────────

describe('query functions', () => {
  it('getInteractionById returns correct interaction', () => {
    const ix = getInteractionById('A-001');
    expect(ix).toBeDefined();
    expect(ix!.phase).toBe('A');
    expect(ix!.sequenceNumber).toBe(1);
  });

  it('getInteractionById returns undefined for unknown ID', () => {
    const ix = getInteractionById('Z-999');
    expect(ix).toBeUndefined();
  });

  it('getInteractionsByAgent returns interactions for R1', () => {
    const interactions = getInteractionsByAgent('R1');
    expect(interactions.length).toBeGreaterThan(0);
    for (const ix of interactions) {
      expect(ix.requester === 'R1' || ix.provider === 'R1').toBe(true);
    }
  });

  it('getInteractionsByAgent returns interactions for S1', () => {
    const interactions = getInteractionsByAgent('S1');
    expect(interactions.length).toBeGreaterThan(0);
    for (const ix of interactions) {
      expect(ix.requester === 'S1' || ix.provider === 'S1').toBe(true);
    }
  });
});

// ──────────────────────────────────────────
// Scenario Tests
// ──────────────────────────────────────────

describe('seed scenario', () => {
  it('has 5 phases', () => {
    expect(SEED_SCENARIO.phases).toHaveLength(5);
  });

  it('phases are in order A through E', () => {
    const phases = SEED_SCENARIO.phases.map((p) => p.phase);
    expect(phases).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('total interactions matches sum of phase counts', () => {
    const sum = SEED_SCENARIO.phases.reduce(
      (acc, p) => acc + p.interactionCount,
      0
    );
    expect(SEED_SCENARIO.totalInteractions).toBe(sum);
  });

  it('getPhaseConfig returns correct config', () => {
    const configA = getPhaseConfig('A');
    expect(configA.phase).toBe('A');
    expect(configA.name).toBe('Bootstrap');
    expect(configA.interactionCount).toBe(40);
  });

  it('Phase A has no prerequisite', () => {
    const configA = getPhaseConfig('A');
    expect(configA.prerequisitePhase).toBeNull();
  });

  it('Phase B prerequisite is A', () => {
    const configB = getPhaseConfig('B');
    expect(configB.prerequisitePhase).toBe('A');
  });

  it('Phase C has civicCheckEnabled false', () => {
    const configC = getPhaseConfig('C');
    expect(configC.civicCheckEnabled).toBe(false);
  });

  it('Phase D has civicCheckEnabled true', () => {
    const configD = getPhaseConfig('D');
    expect(configD.civicCheckEnabled).toBe(true);
  });

  it('Phases B, D, E trigger reputation compute', () => {
    expect(getPhaseConfig('B').triggerReputationCompute).toBe(true);
    expect(getPhaseConfig('D').triggerReputationCompute).toBe(true);
    expect(getPhaseConfig('E').triggerReputationCompute).toBe(true);
  });

  it('Phase A does not trigger reputation compute', () => {
    expect(getPhaseConfig('A').triggerReputationCompute).toBe(false);
  });
});
