import { NextResponse } from 'next/server';
import { requireAuth, getAuthenticatedWallets, AuthError } from '@/lib/auth/civic';
import { kvGet } from '@/lib/storage/kv';
import type { DeployerProfile } from '@/lib/deploy/types';
import type { ApiError } from '@/types';

export async function GET() {
  try {
    await requireAuth();

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

    const address = wallets[0];
    const profile = await kvGet<DeployerProfile>(`deployer:${address}`);

    if (!profile) {
      // Return a default profile for new deployers
      const defaultProfile: DeployerProfile = {
        address,
        linkedAgents: [],
        deployerScore: 5.0,
        totalAgentsDeployed: 0,
        flaggedAgents: 0,
      };
      return NextResponse.json(defaultProfile);
    }

    return NextResponse.json(profile);
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
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch deployer profile',
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
