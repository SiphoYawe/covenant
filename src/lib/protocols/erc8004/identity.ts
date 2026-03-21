import { getSDK, getReadOnlySDK } from './client';
import type { AgentProfile } from './types';
import type { DemoAgentRole } from '@/lib/agents/types';
import { AGENT_CONFIGS, generateMetadata } from '@/lib/agents/config';
import { getAddress } from '@/lib/wallets';
import { kvGet, kvSet, kvLpush } from '@/lib/storage';
import { createEventBus, EVENT_TYPES, Protocol } from '@/lib/events';
import { env } from '@/lib/config/env';

const ROLE_TO_KEY: Record<DemoAgentRole, string> = {
  researcher: 'AGENT_A_PRIVATE_KEY',
  reviewer: 'AGENT_B_PRIVATE_KEY',
  summarizer: 'AGENT_C_PRIVATE_KEY',
  malicious: 'AGENT_D_PRIVATE_KEY',
};

/**
 * Register an agent on the ERC-8004 IdentityRegistry on Base Sepolia.
 * Uses agent0-ts SDK: createAgent → registerOnChain → extract token ID.
 */
export async function registerAgent(
  role: DemoAgentRole,
): Promise<{ agentId: string; txHash: string; address: string }> {
  const config = AGENT_CONFIGS[role];
  const privateKey = env[ROLE_TO_KEY[role] as keyof typeof env] as string;
  const sdk = getSDK(privateKey);

  // Create agent with metadata
  const metadata = generateMetadata(role);
  const agent = sdk.createAgent(metadata.name, metadata.description);

  // Register on-chain (encodes registration as data URI)
  const txHandle = await agent.registerOnChain();
  const mined = await txHandle.waitMined();

  const agentId = agent.agentId;
  if (!agentId) {
    throw new Error(`Registration succeeded but no agent ID returned for role: ${role}`);
  }

  const txHash = mined.receipt.transactionHash ?? txHandle.hash;
  const address = getAddress(config.walletRole);

  // Cache agent profile in KV
  const profile: AgentProfile = {
    agentId: agentId.toString(),
    role,
    address,
    metadataURI: agent.agentURI ?? '',
    registrationTxHash: txHash as `0x${string}`,
    registeredAt: Date.now(),
  };

  await kvSet(`agent:${agentId}:profile`, profile);

  // Track registered agent in demo agents list
  await kvLpush('demo:agents', agentId.toString());

  // Emit event to bus
  const eventBus = createEventBus();
  await eventBus.emit({
    type: EVENT_TYPES.AGENT_REGISTERED,
    protocol: Protocol.Erc8004,
    agentId: agentId.toString(),
    data: {
      role,
      address,
      txHash,
      metadataURI: profile.metadataURI,
    },
  });

  return {
    agentId: agentId.toString(),
    txHash,
    address,
  };
}

/**
 * Register an agent dynamically on the ERC-8004 IdentityRegistry.
 * Unlike registerAgent(role), accepts arbitrary config instead of role-based lookup.
 * Used by the unified deploy API for provisioned and BYOW modes.
 */
export async function registerAgentDynamic(config: {
  name: string;
  description: string;
  capabilities: string[];
  privateKey: string;
  address: string;
}): Promise<{ agentId: string; txHash: string; address: string }> {
  const sdk = getSDK(config.privateKey);

  const agent = sdk.createAgent(config.name, config.description);
  const txHandle = await agent.registerOnChain();
  const mined = await txHandle.waitMined();

  const agentId = agent.agentId;
  if (!agentId) {
    throw new Error(`Registration succeeded but no agent ID returned for: ${config.name}`);
  }

  const txHash = mined.receipt.transactionHash ?? txHandle.hash;

  // Cache agent profile in KV
  const profile: AgentProfile = {
    agentId: agentId.toString(),
    role: 'dynamic',
    address: config.address as `0x${string}`,
    metadataURI: agent.agentURI ?? '',
    registrationTxHash: txHash as `0x${string}`,
    registeredAt: Date.now(),
  };

  await kvSet(`agent:${agentId}:profile`, profile);
  await kvLpush('deployed:agents', agentId.toString());

  // Emit event
  const eventBus = createEventBus();
  await eventBus.emit({
    type: EVENT_TYPES.AGENT_REGISTERED,
    protocol: Protocol.Erc8004,
    agentId: agentId.toString(),
    data: {
      name: config.name,
      capabilities: config.capabilities,
      address: config.address,
      txHash,
      metadataURI: profile.metadataURI,
    },
  });

  return {
    agentId: agentId.toString(),
    txHash,
    address: config.address,
  };
}

/**
 * Get an agent profile by ID (cache-first, then on-chain).
 */
export async function getAgent(agentId: string): Promise<AgentProfile | null> {
  // Cache-first: check KV
  const cached = await kvGet<AgentProfile>(`agent:${agentId}:profile`);
  if (cached) {
    return cached;
  }

  // Query on-chain via SDK
  try {
    const sdk = getReadOnlySDK();
    const summary = await sdk.getAgent(agentId);

    if (!summary) {
      return null;
    }

    // Build profile from on-chain data
    const profile: AgentProfile = {
      agentId,
      role: 'unknown',
      address: (summary.owners?.[0] ?? summary.walletAddress ?? '') as `0x${string}`,
      metadataURI: summary.agentURI ?? '',
    };

    // Cache the result
    await kvSet(`agent:${agentId}:profile`, profile);
    return profile;
  } catch {
    return null;
  }
}

/**
 * Get all registered agents from the current demo run.
 */
export async function getAllAgents(): Promise<AgentProfile[]> {
  const { kvLrange } = await import('@/lib/storage');
  const agentIds = await kvLrange('demo:agents', 0, -1);

  const profiles: AgentProfile[] = [];
  for (const agentId of agentIds) {
    const profile = await getAgent(agentId);
    if (profile) {
      profiles.push(profile);
    }
  }

  return profiles;
}
