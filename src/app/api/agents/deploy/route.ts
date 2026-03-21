import { NextResponse } from 'next/server';
import {
  DeployRequestSchema,
  type ProvisionedDeployResponse,
  type BYOWDeployResponse,
} from '@/lib/deploy/types';
import { provisionWallet, fundFromPool, getSystemPoolBalance, generateNonce } from '@/lib/wallets/provisioner';
import { registerAgentDynamic } from '@/lib/protocols/erc8004/identity';
import { generateDynamicAgentCard } from '@/lib/protocols/a2a/agent-card';
import { createEventBus, EVENT_TYPES, Protocol } from '@/lib/events';
import { kvSet } from '@/lib/storage/kv';
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
      const error: ApiError = {
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Human deploy mode is not yet supported. See Story 10.4.',
        },
      };
      return NextResponse.json(error, { status: 501 });
    }

    if (data.mode === 'provisioned') {
      return handleProvisioned(data);
    }

    return handleBYOW(data);
  } catch (err) {
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
