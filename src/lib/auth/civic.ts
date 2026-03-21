import { getUser } from '@civic/auth/nextjs';
import { getWallets } from '@civic/auth-web3/server';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function getAuthenticatedUser() {
  try {
    const user = await getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new AuthError('Authentication required', 401);
  }
  return user;
}

export async function getAuthenticatedWallets(): Promise<string[]> {
  try {
    const user = await getUser();
    if (!user) return [];

    const wallets = await getWallets(user as Parameters<typeof getWallets>[0]);
    return wallets.map((w) => w.walletAddress);
  } catch {
    return [];
  }
}
