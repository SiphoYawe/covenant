import { describe, it, expect } from 'vitest';
import {
  seedAgentProfileSchema,
  type SeedAgentProfile,
  type AgentRoster,
} from '../../seed/types';
import {
  AGENT_ROSTER,
  getAgentById,
  getAgentsByRole,
  getAgentsByCapability,
} from '../../seed/agents';
import { profileToMetadata } from '../../seed/metadata';

// ──────────────────────────────────────────
// Roster Completeness
// ──────────────────────────────────────────

describe('AGENT_ROSTER', () => {
  it('contains exactly 28 agents total', () => {
    expect(AGENT_ROSTER.all).toHaveLength(28);
  });

  it('has 7 requesters', () => {
    expect(AGENT_ROSTER.requesters).toHaveLength(7);
  });

  it('has 17 providers', () => {
    expect(AGENT_ROSTER.providers).toHaveLength(17);
  });

  it('has 4 adversarial agents', () => {
    expect(AGENT_ROSTER.adversarial).toHaveLength(4);
  });

  it('all array equals requesters + providers + adversarial', () => {
    const combined = [
      ...AGENT_ROSTER.requesters,
      ...AGENT_ROSTER.providers,
      ...AGENT_ROSTER.adversarial,
    ];
    expect(AGENT_ROSTER.all).toEqual(combined);
  });

  it('has no duplicate wallet names', () => {
    const names = AGENT_ROSTER.all.map((a) => a.walletName);
    expect(new Set(names).size).toBe(28);
  });

  it('has no duplicate agent names', () => {
    const names = AGENT_ROSTER.all.map((a) => a.name);
    expect(new Set(names).size).toBe(28);
  });
});

// ──────────────────────────────────────────
// Zod Schema Validation
// ──────────────────────────────────────────

describe('schema validation', () => {
  it('every profile passes SeedAgentProfileSchema', () => {
    for (const profile of AGENT_ROSTER.all) {
      const result = seedAgentProfileSchema.safeParse(profile);
      if (!result.success) {
        throw new Error(
          `Profile ${profile.walletName} (${profile.name}) failed validation: ${result.error.message}`
        );
      }
      expect(result.success).toBe(true);
    }
  });
});

// ──────────────────────────────────────────
// Requester Profiles (R1-R7)
// ──────────────────────────────────────────

describe('requester profiles', () => {
  it('each requester has role "requester"', () => {
    for (const r of AGENT_ROSTER.requesters) {
      expect(r.role).toBe('requester');
    }
  });

  it('each requester has a unique domain', () => {
    const domains = AGENT_ROSTER.requesters.map((r) => r.domain);
    expect(new Set(domains).size).toBe(7);
  });

  it('each requester has valid budget range (min <= max)', () => {
    for (const r of AGENT_ROSTER.requesters) {
      expect(r.pricing.minUsdc).toBeLessThanOrEqual(r.pricing.maxUsdc);
    }
  });

  it('each requester has hiring preferences', () => {
    for (const r of AGENT_ROSTER.requesters) {
      expect(r.hiringPreferences).toBeDefined();
      expect(r.hiringPreferences!.length).toBeGreaterThan(0);
    }
  });

  it('each requester has a non-empty system prompt', () => {
    for (const r of AGENT_ROSTER.requesters) {
      expect(r.systemPrompt.length).toBeGreaterThan(20);
    }
  });

  it('R1 NexusResearch has AI research domain and 10-20 USDC budget', () => {
    const r1 = getAgentById('R1');
    expect(r1.name).toBe('NexusResearch');
    expect(r1.pricing.minUsdc).toBe(10);
    expect(r1.pricing.maxUsdc).toBe(20);
  });

  it('R6 ChainBrief has lowest budget range (2-5 USDC)', () => {
    const r6 = getAgentById('R6');
    expect(r6.name).toBe('ChainBrief');
    expect(r6.pricing.minUsdc).toBe(2);
    expect(r6.pricing.maxUsdc).toBe(5);
  });
});

// ──────────────────────────────────────────
// Provider Profiles (S1-S17)
// ──────────────────────────────────────────

describe('provider profiles', () => {
  it('each provider has role "provider"', () => {
    for (const s of AGENT_ROSTER.providers) {
      expect(s.role).toBe('provider');
    }
  });

  it('each provider has 2-4 capabilities', () => {
    for (const s of AGENT_ROSTER.providers) {
      expect(s.capabilities.length).toBeGreaterThanOrEqual(2);
      expect(s.capabilities.length).toBeLessThanOrEqual(4);
    }
  });

  it('each provider has a valid pricing tier', () => {
    for (const s of AGENT_ROSTER.providers) {
      expect(['budget', 'mid', 'premium']).toContain(s.pricing.tier);
    }
  });

  it('each provider has valid pricing range (min <= max)', () => {
    for (const s of AGENT_ROSTER.providers) {
      expect(s.pricing.minUsdc).toBeLessThanOrEqual(s.pricing.maxUsdc);
    }
  });

  it('each provider has a non-empty system prompt', () => {
    for (const s of AGENT_ROSTER.providers) {
      expect(s.systemPrompt.length).toBeGreaterThan(20);
    }
  });

  it('S1 CodeSentry is premium tier with code review capabilities', () => {
    const s1 = getAgentById('S1');
    expect(s1.name).toBe('CodeSentry');
    expect(s1.pricing.tier).toBe('premium');
    expect(s1.capabilities).toContain('review_code');
  });

  it('S3 SynthMind is budget tier', () => {
    const s3 = getAgentById('S3');
    expect(s3.name).toBe('SynthMind');
    expect(s3.pricing.tier).toBe('budget');
  });

  it('S2 AuditShield is premium tier with audit capabilities', () => {
    const s2 = getAgentById('S2');
    expect(s2.name).toBe('AuditShield');
    expect(s2.pricing.tier).toBe('premium');
    expect(s2.capabilities).toContain('audit_contract');
  });

  it('budget providers have pricing under 5 USDC max', () => {
    const budgetProviders = AGENT_ROSTER.providers.filter(
      (s) => s.pricing.tier === 'budget'
    );
    for (const s of budgetProviders) {
      expect(s.pricing.maxUsdc).toBeLessThanOrEqual(5);
    }
  });

  it('premium providers have pricing at or above 8 USDC min', () => {
    const premiumProviders = AGENT_ROSTER.providers.filter(
      (s) => s.pricing.tier === 'premium'
    );
    for (const s of premiumProviders) {
      expect(s.pricing.minUsdc).toBeGreaterThanOrEqual(8);
    }
  });
});

// ──────────────────────────────────────────
// Adversarial Profiles (X1-X4)
// ──────────────────────────────────────────

describe('adversarial profiles', () => {
  it('each adversarial agent has role "adversarial"', () => {
    for (const x of AGENT_ROSTER.adversarial) {
      expect(x.role).toBe('adversarial');
    }
  });

  it('X1 ShadowReview has prompt injection attack type', () => {
    const x1 = getAgentById('X1');
    expect(x1.name).toBe('ShadowReview');
    expect(x1.attackType).toBe('prompt-injection');
  });

  it('X1 system prompt contains injection-related keywords', () => {
    const x1 = getAgentById('X1');
    const prompt = x1.systemPrompt.toLowerCase();
    // Must reference malicious behavior subtly
    expect(
      prompt.includes('security') ||
      prompt.includes('optimization') ||
      prompt.includes('hardcod') ||
      prompt.includes('remov')
    ).toBe(true);
  });

  it('X2-X4 are Sybil ring members', () => {
    const x2 = getAgentById('X2');
    const x3 = getAgentById('X3');
    const x4 = getAgentById('X4');
    expect(x2.attackType).toBe('sybil-ring');
    expect(x3.attackType).toBe('sybil-ring');
    expect(x4.attackType).toBe('sybil-ring');
  });

  it('X2-X4 system prompts reference other Sybil ring members', () => {
    const x2 = getAgentById('X2');
    const x3 = getAgentById('X3');
    const x4 = getAgentById('X4');

    // Each should reference the other ring members by name
    expect(x2.systemPrompt).toContain('MirrorBot');
    expect(x2.systemPrompt).toContain('GhostAgent');

    expect(x3.systemPrompt).toContain('EchoNode');
    expect(x3.systemPrompt).toContain('GhostAgent');

    expect(x4.systemPrompt).toContain('EchoNode');
    expect(x4.systemPrompt).toContain('MirrorBot');
  });

  it('X4 has undercutting pricing (lower than comparable legitimate providers)', () => {
    const x4 = getAgentById('X4');
    const s1 = getAgentById('S1'); // CodeSentry, premium code review
    // X4 does code review at far below market rate
    expect(x4.pricing.maxUsdc).toBeLessThan(s1.pricing.minUsdc);
  });

  it('X4 has sybil-ring attack type with undercutter strategy', () => {
    const x4 = getAgentById('X4');
    expect(x4.attackType).toBe('sybil-ring');
    expect(x4.attackStrategy).toContain('undercut');
  });
});

// ──────────────────────────────────────────
// Lookup Functions
// ──────────────────────────────────────────

describe('getAgentById', () => {
  it('returns correct profile for each requester ID', () => {
    const ids = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'];
    for (const id of ids) {
      const agent = getAgentById(id);
      expect(agent.walletName).toBe(id);
      expect(agent.role).toBe('requester');
    }
  });

  it('returns correct profile for each provider ID', () => {
    for (let i = 1; i <= 17; i++) {
      const id = `S${i}`;
      const agent = getAgentById(id);
      expect(agent.walletName).toBe(id);
      expect(agent.role).toBe('provider');
    }
  });

  it('returns correct profile for each adversarial ID', () => {
    const ids = ['X1', 'X2', 'X3', 'X4'];
    for (const id of ids) {
      const agent = getAgentById(id);
      expect(agent.walletName).toBe(id);
      expect(agent.role).toBe('adversarial');
    }
  });

  it('throws for unknown ID', () => {
    expect(() => getAgentById('Z99')).toThrow();
  });
});

describe('getAgentsByRole', () => {
  it('returns 7 requesters', () => {
    expect(getAgentsByRole('requester')).toHaveLength(7);
  });

  it('returns 17 providers', () => {
    expect(getAgentsByRole('provider')).toHaveLength(17);
  });

  it('returns 4 adversarial', () => {
    expect(getAgentsByRole('adversarial')).toHaveLength(4);
  });
});

describe('getAgentsByCapability', () => {
  it('finds providers with review_code capability', () => {
    const agents = getAgentsByCapability('review_code');
    expect(agents.length).toBeGreaterThanOrEqual(1);
    expect(agents.some((a) => a.name === 'CodeSentry')).toBe(true);
  });

  it('finds providers with summarize capability', () => {
    const agents = getAgentsByCapability('summarize');
    expect(agents.length).toBeGreaterThanOrEqual(1);
    expect(agents.some((a) => a.name === 'SynthMind')).toBe(true);
  });

  it('returns empty array for unknown capability', () => {
    expect(getAgentsByCapability('nonexistent_capability')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────
// Metadata Adapter
// ──────────────────────────────────────────

describe('profileToMetadata', () => {
  it('produces valid ERC-8004 metadata structure', () => {
    const profile = getAgentById('S1');
    const metadata = profileToMetadata(profile);

    expect(metadata.name).toBe('CodeSentry');
    expect(metadata.description).toBeDefined();
    expect(metadata.description.length).toBeGreaterThan(0);
    expect(metadata.capabilities).toEqual(profile.capabilities);
  });

  it('works for all 28 agents', () => {
    for (const profile of AGENT_ROSTER.all) {
      const metadata = profileToMetadata(profile);
      expect(metadata.name).toBe(profile.name);
      expect(metadata.capabilities).toEqual(profile.capabilities);
      expect(metadata.description).toBeTruthy();
    }
  });

  it('adversarial metadata looks legitimate (no attack keywords)', () => {
    const x1 = getAgentById('X1');
    const metadata = profileToMetadata(x1);
    const desc = metadata.description.toLowerCase();
    // Metadata should not reveal malicious intent
    expect(desc).not.toContain('malicious');
    expect(desc).not.toContain('injection');
    expect(desc).not.toContain('attack');
  });
});
