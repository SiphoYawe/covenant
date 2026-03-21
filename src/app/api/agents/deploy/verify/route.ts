import { NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { BYOWVerifyRequestSchema } from '@/lib/deploy/types';
import { kvGet, kvDel, kvSet } from '@/lib/storage/kv';
import { registerAgentDynamic } from '@/lib/protocols/erc8004/identity';
import { generateDynamicAgentCard } from '@/lib/protocols/a2a/agent-card';
import { createEventBus, EVENT_TYPES, Protocol } from '@/lib/events';
import type { ApiError } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = BYOWVerifyRequestSchema.safeParse(body);

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

    const { address, nonce, signature } = parsed.data;

    // Step 1: Check nonce exists (read without delete)
    const storedNonce = await kvGet<string>(`deploy:nonces:${address}`);
    if (!storedNonce || storedNonce !== nonce) {
      const error: ApiError = {
        error: {
          code: 'NONCE_EXPIRED',
          message: 'Nonce has expired or has already been used',
        },
      };
      return NextResponse.json(error, { status: 410 });
    }

    // Step 2: Verify signature (do NOT consume nonce yet)
    let isValid = false;
    try {
      isValid = await verifyMessage({
        address: address as `0x${string}`,
        message: nonce,
        signature: signature as `0x${string}`,
      });
    } catch {
      isValid = false;
    }

    if (!isValid) {
      // Return 401 WITHOUT consuming the nonce
      const error: ApiError = {
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Signature verification failed',
        },
      };
      return NextResponse.json(error, { status: 401 });
    }

    // Step 3: Consume the nonce (one-time use, atomic delete)
    await kvDel(`deploy:nonces:${address}`);

    // Step 4: Retrieve stored deploy config
    const deployConfig = await kvGet<{
      name: string;
      description: string;
      capabilities: string[];
    }>(`deploy:config:${address}`);

    if (!deployConfig) {
      const error: ApiError = {
        error: {
          code: 'CONFIG_EXPIRED',
          message: 'Deploy configuration has expired. Please restart the deploy flow.',
        },
      };
      return NextResponse.json(error, { status: 410 });
    }

    // Clean up the stored config
    await kvDel(`deploy:config:${address}`);

    // Step 5: Register on ERC-8004
    // For BYOW, we don't have the private key. Use system key for registration
    // but set the owner address to the BYOW address.
    const { env } = await import('@/lib/config/env');
    const registration = await registerAgentDynamic({
      name: deployConfig.name,
      description: deployConfig.description,
      capabilities: deployConfig.capabilities,
      privateKey: env.SYSTEM_PRIVATE_KEY,
      address,
    });

    // Step 6: Generate A2A agent card
    const agentCard = generateDynamicAgentCard({
      name: deployConfig.name,
      description: deployConfig.description,
      capabilities: deployConfig.capabilities,
      agentId: registration.agentId,
      address,
    });

    // Store agent card in KV
    await kvSet(`agent:${registration.agentId}:card`, agentCard);

    // Step 7: Emit AGENT_DEPLOYED event
    const eventBus = createEventBus();
    await eventBus.emit({
      type: EVENT_TYPES.AGENT_DEPLOYED,
      protocol: Protocol.Erc8004,
      agentId: registration.agentId,
      data: {
        mode: 'byow',
        agentId: registration.agentId,
        address,
      },
    });

    return NextResponse.json({
      agentId: registration.agentId,
      address,
      agentCard,
    }, { status: 201 });
  } catch (err) {
    const error: ApiError = {
      error: {
        code: 'VERIFY_FAILED',
        message: err instanceof Error ? err.message : 'Signature verification failed',
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
