import { type NextRequest, NextResponse } from 'next/server';

const CIVIC_CLIENT_ID = process.env.CIVIC_CLIENT_ID;

export default async function middleware(req: NextRequest) {
  // Skip auth when Civic client ID is not configured.
  if (!CIVIC_CLIENT_ID) {
    return NextResponse.next();
  }

  const { authMiddleware } = await import('@civic/auth/nextjs/middleware');
  return authMiddleware({ clientId: CIVIC_CLIENT_ID })(req);
}

export const config = {
  matcher: ['/deploy', '/deploy/:path*'],
};
