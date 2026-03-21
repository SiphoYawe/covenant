import { NextResponse } from 'next/server';
import {
  DeployRequestSchema,
  type ProvisionedDeployResponse,
  type BYOWDeployResponse,
  type HumanDeployResponse,
  type HumanDeployRequest,
} from '@/lib/deploy/types';
import { provisionWallet, fundFromPool, getSystemPoolBalance, generateNonce } from '@/lib/wallets/provisioner';
import { registerAgentDynamic } from '@/lib/protocols/erc8004/identity';
import { generateDynamicAgentCard } from '@/lib/protocols/a2a/agent-card';
import { createEventBus, EVENT_TYPES, Protocol } from '@/lib/events';
import { kvSet } from '@/lib/storage/kv';
import { requireAuth, getAuthenticatedWallets, AuthError } from '@/lib/auth/civic';
import { writeDeployerAttestation } from '@/lib/deploy/attestation';
import { addLinkedAgent } from '@/lib/deploy/deployer';
import type { ApiError } from '@/types';

const FUNDING_AMOUNT = BigInt(5_000_000); // 5 USDC (6 decimals)

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = DeployRequestSchema.safeParse(body);

    if (!parsed.success) {
      const error: ApiError = {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          details: parsed.error.issues,
        },
      };
      return NextResponse.json(error, { status: 400 });
    }

    const data = parsed.data;

    if (data.mode === 'human') {
      return await handleHuman(data);
    }

    if (data.mode === 'provisioned') {
      return await handleProvisioned(data);
    }

    return await handleBYOW(data);
  } catch (err) {
    if (err instanceof Error && err.name === 'AuthError' && 'status' in err) {
      const authErr = err as AuthError;
      const error: ApiError = {
        error: {
          code: 'AUTH_REQUIRED',
          message: authErr.message,
        },
      };
      return NextResponse.json(error, { status: authErr.status });
    }
    const error: ApiError = {
      error: {
        code: 'DEPLOY_FAILED',
        message: err instanceof Error ? err.message : 'Agent deployment failed',
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}

async function handleProvisioned(
  data: { name: string; description: string; capabilities: string[]; systemPrompt?: string }
): Promise<NextResponse> {
  // Check system pool balance before provisioning
  const poolBalance = await getSystemPoolBalance();
  if (poolBalance < FUNDING_AMOUNT) {
    const error: ApiError = {
      error: {
        code: 'INSUFFICIENT_POOL_BALANCE',
        message: `System pool has ${poolBalance.toString()} units, need ${FUNDING_AMOUNT.toString()}`,
        details: { remaining: poolBalance.toString() },
      },
    };
    return NextResponse.json(error, { status: 503 });
  }

  // Step 1: Provision wallet
  const wallet = await provisionWallet();

  // Step 2: Fund from pool
  try {
    await fundFromPool(wallet.address, FUNDING_AMOUNT);
  } catch (fundErr) {
    // Log orphaned wallet for manual recovery
    console.error(
      `[deploy] Orphaned wallet: ${wallet.address} - funding failed:`,
      fundErr instanceof Error ? fundErr.message : fundErr
    );
    throw fundErr;
  }

  // Step 3: Register on ERC-8004
  let registration;
  try {
    registration = await registerAgentDynamic({
      name: data.name,
      description: data.description,
      capabilities: data.capabilities,
      privateKey: wallet.privateKey,
      address: wallet.address,
    });
  } catch (regErr) {
    // Log orphaned funded wallet for manual recovery
    console.error(
      `[deploy] Orphaned funded wallet: ${wallet.address} (${FUNDING_AMOUNT.toString()} units) - registration failed:`,
      regErr instanceof Error ? regErr.message : regErr
    );
    throw regErr;
  }

  // Step 4: Generate A2A agent card
  const agentCard = generateDynamicAgentCard({
    name: data.name,
    description: data.description,
    capabilities: data.capabilities,
    agentId: registration.agentId,
    address: wallet.address,
  });

  // Store agent card in KV
  await kvSet(`agent:${registration.agentId}:card`, agentCard);

  // Step 5: Emit AGENT_DEPLOYED event
  const eventBus = createEventBus();
  await eventBus.emit({
    type: EVENT_TYPES.AGENT_DEPLOYED,
    protocol: Protocol.Erc8004,
    agentId: registration.agentId,
    data: {
      mode: 'provisioned',
      agentId: registration.agentId,
      address: wallet.address,
      fundedAmount: Number(FUNDING_AMOUNT),
    },
  });

  const response: ProvisionedDeployResponse = {
    agentId: registration.agentId,
    address: wallet.address,
    agentCard,
  };

  return NextResponse.json(response, { status: 201 });
}

async function handleHuman(
  data: HumanDeployRequest,
): Promise<NextResponse> {
  // Step 1: Require Civic Auth
  await requireAuth();

  // Step 2: Get human's embedded wallet
  const wallets = await getAuthenticatedWallets();
  if (wallets.length === 0) {
    const error: ApiError = {
      error: {
        code: 'NO_WALLET',
        message: 'No embedded wallet found for authenticated user',
      },
    };
    return NextResponse.json(error, { status: 400 });
  }
  const humanAddress = wallets[0];

  // Step 3: Determine agent wallet
  let agentAddress: string;
  let agentPrivateKey: string;

  if (data.useOwnWallet) {
    // Use the human's embedded wallet directly
    agentAddress = humanAddress;
    // For embedded wallets, we use the system key for registration
    // (the Civic embedded wallet signs via the SDK, not raw private key)
    const { getWallet } = await import('@/lib/wallets');
    const systemWallet = getWallet('system');
    agentPrivateKey = systemWallet.client.account.address;
  } else {
    // Provision a new wallet and fund it
    const poolBalance = await getSystemPoolBalance();
    if (poolBalance < FUNDING_AMOUNT) {
      const error: ApiError = {
        error: {
          code: 'INSUFFICIENT_POOL_BALANCE',
          message: `System pool has ${poolBalance.toString()} units, need ${FUNDING_AMOUNT.toString()}`,
        },
      };
      return NextResponse.json(error, { status: 503 });
    }

    const wallet = await provisionWallet();
    await fundFromPool(wallet.address, FUNDING_AMOUNT);
    agentAddress = wallet.address;
    agentPrivateKey = wallet.privateKey;
  }

  // Step 4: Register on ERC-8004
  const registration = await registerAgentDynamic({
    name: data.name,
    description: data.description,
    capabilities: data.capabilities,
    privateKey: agentPrivateKey,
    address: agentAddress,
  });

  // Step 5: Generate A2A agent card
  const agentCard = generateDynamicAgentCard({
    name: data.name,
    description: data.description,
    capabilities: data.capabilities,
    agentId: registration.agentId,
    address: agentAddress,
  });

  await kvSet(`agent:${registration.agentId}:card`, agentCard);

  // Step 6: Reputation linking (if requested)
  if (data.linkReputation) {
    await writeDeployerAttestation(registration.agentId, humanAddress);
    await addLinkedAgent(humanAddress, registration.agentId);
  }

  // Step 7: Emit AGENT_DEPLOYED_HUMAN event
  const eventBus = createEventBus();
  await eventBus.emit({
    type: EVENT_TYPES.AGENT_DEPLOYED_HUMAN,
    protocol: Protocol.Erc8004,
    agentId: registration.agentId,
    data: {
      mode: 'human',
      agentId: registration.agentId,
      address: agentAddress,
      humanAddress,
      linkedReputation: data.linkReputation,
    },
  });

  const response: HumanDeployResponse = {
    agentId: registration.agentId,
    address: agentAddress,
    humanAddress,
    linkedReputation: data.linkReputation,
    agentCard,
  };

  return NextResponse.json(response, { status: 201 });
}

async function handleBYOW(
  data: { address: string; name: string; description: string; capabilities: string[] }
): Promise<NextResponse> {
  // Generate nonce challenge for signature verification
  const challenge = await generateNonce(data.address);

  // Store the deploy config in KV for use during verify step
  await kvSet(`deploy:config:${data.address}`, {
    name: data.name,
    description: data.description,
    capabilities: data.capabilities,
  }, { ex: 300 }); // Same TTL as nonce (5 minutes)

  const response: BYOWDeployResponse = {
    nonce: challenge.nonce,
    expiresAt: challenge.expiresAt,
  };

  return NextResponse.json(response);
}
