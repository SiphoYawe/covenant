import { describe, it, expect } from 'vitest';
import {
  ProvisionedDeployRequestSchema,
  BYOWDeployRequestSchema,
  HumanDeployRequestSchema,
  DeployRequestSchema,
  ProvisionedWalletSchema,
  NonceChallengeSchema,
  HumanAgentLinkSchema,
  DeployerProfileSchema,
} from '@/lib/deploy/types';

describe('Deployment Types - Zod Schemas', () => {
  describe('ProvisionedDeployRequestSchema', () => {
    it('accepts valid provisioned request', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'Test Agent',
        description: 'A test agent for research tasks',
        capabilities: ['research', 'analysis'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts provisioned request with optional systemPrompt', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'Test Agent',
        description: 'A test agent for research tasks',
        capabilities: ['research'],
        systemPrompt: 'You are a research assistant.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects name shorter than 3 chars', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'AB',
        description: 'A test agent for research tasks',
        capabilities: ['research'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects name longer than 50 chars', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'A'.repeat(51),
        description: 'A test agent for research tasks',
        capabilities: ['research'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects description shorter than 10 chars', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'Test Agent',
        description: 'Short',
        capabilities: ['research'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects description longer than 500 chars', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'Test Agent',
        description: 'A'.repeat(501),
        capabilities: ['research'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty capabilities array', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'Test Agent',
        description: 'A test agent for research tasks',
        capabilities: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects more than 10 capabilities', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'Test Agent',
        description: 'A test agent for research tasks',
        capabilities: Array(11).fill('research'),
      });
      expect(result.success).toBe(false);
    });

    it('rejects systemPrompt longer than 2000 chars', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'Test Agent',
        description: 'A test agent for research tasks',
        capabilities: ['research'],
        systemPrompt: 'A'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it('rejects wrong mode value', () => {
      const result = ProvisionedDeployRequestSchema.safeParse({
        mode: 'byow',
        name: 'Test Agent',
        description: 'A test agent for research tasks',
        capabilities: ['research'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('BYOWDeployRequestSchema', () => {
    it('accepts valid BYOW request', () => {
      const result = BYOWDeployRequestSchema.safeParse({
        mode: 'byow',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        name: 'External Agent',
        description: 'An external agent with its own wallet',
        capabilities: ['code_review'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects address without 0x prefix', () => {
      const result = BYOWDeployRequestSchema.safeParse({
        mode: 'byow',
        address: '1234567890abcdef1234567890abcdef12345678',
        name: 'External Agent',
        description: 'An external agent with its own wallet',
        capabilities: ['code_review'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects address with wrong length', () => {
      const result = BYOWDeployRequestSchema.safeParse({
        mode: 'byow',
        address: '0x1234',
        name: 'External Agent',
        description: 'An external agent with its own wallet',
        capabilities: ['code_review'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('HumanDeployRequestSchema', () => {
    it('accepts valid human request', () => {
      const result = HumanDeployRequestSchema.safeParse({
        mode: 'human',
        name: 'Human Agent',
        description: 'An agent deployed by a human via Civic',
        capabilities: ['analysis', 'research'],
        linkReputation: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts human request with optional useOwnWallet', () => {
      const result = HumanDeployRequestSchema.safeParse({
        mode: 'human',
        name: 'Human Agent',
        description: 'An agent deployed by a human via Civic',
        capabilities: ['analysis'],
        linkReputation: false,
        useOwnWallet: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing linkReputation', () => {
      const result = HumanDeployRequestSchema.safeParse({
        mode: 'human',
        name: 'Human Agent',
        description: 'An agent deployed by a human via Civic',
        capabilities: ['analysis'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DeployRequestSchema (discriminated union)', () => {
    it('discriminates provisioned mode correctly', () => {
      const result = DeployRequestSchema.safeParse({
        mode: 'provisioned',
        name: 'Test Agent',
        description: 'A test agent for research tasks',
        capabilities: ['research'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('provisioned');
      }
    });

    it('discriminates byow mode correctly', () => {
      const result = DeployRequestSchema.safeParse({
        mode: 'byow',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        name: 'External Agent',
        description: 'An external agent with its own wallet',
        capabilities: ['code_review'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('byow');
      }
    });

    it('discriminates human mode correctly', () => {
      const result = DeployRequestSchema.safeParse({
        mode: 'human',
        name: 'Human Agent',
        description: 'An agent deployed by a human via Civic',
        capabilities: ['analysis'],
        linkReputation: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('human');
      }
    });

    it('rejects unknown mode', () => {
      const result = DeployRequestSchema.safeParse({
        mode: 'invalid',
        name: 'Test',
        description: 'A test agent for research tasks',
        capabilities: ['research'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ProvisionedWalletSchema', () => {
    it('accepts valid provisioned wallet', () => {
      const result = ProvisionedWalletSchema.safeParse({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        privateKey: '0x' + 'ab'.repeat(32),
        fundedAmount: 5_000_000,
        provisionedAt: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('NonceChallengeSchema', () => {
    it('accepts valid nonce challenge', () => {
      const result = NonceChallengeSchema.safeParse({
        nonce: 'ab'.repeat(32),
        address: '0x1234567890abcdef1234567890abcdef12345678',
        expiresAt: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('HumanAgentLinkSchema', () => {
    it('accepts valid human-agent link', () => {
      const result = HumanAgentLinkSchema.safeParse({
        humanAddress: '0x1234567890abcdef1234567890abcdef12345678',
        agentId: '0xabc123',
        linkedAt: new Date().toISOString(),
        reputationLinked: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('DeployerProfileSchema', () => {
    it('accepts valid deployer profile', () => {
      const result = DeployerProfileSchema.safeParse({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        linkedAgents: ['0xabc', '0xdef'],
        deployerScore: 7.5,
        totalAgentsDeployed: 3,
        flaggedAgents: 0,
      });
      expect(result.success).toBe(true);
    });

    it('rejects deployerScore above 10', () => {
      const result = DeployerProfileSchema.safeParse({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        linkedAgents: [],
        deployerScore: 11,
        totalAgentsDeployed: 0,
        flaggedAgents: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects deployerScore below 0', () => {
      const result = DeployerProfileSchema.safeParse({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        linkedAgents: [],
        deployerScore: -1,
        totalAgentsDeployed: 0,
        flaggedAgents: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});
