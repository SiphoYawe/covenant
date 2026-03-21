import { type NextRequest, NextResponse } from 'next/server';

export default async function middleware(req: NextRequest) {
  // Skip auth when Civic client ID is not configured.
  if (!process.env.CIVIC_CLIENT_ID) {
    return NextResponse.next();
  }

  const { authMiddleware } = await import('@civic/auth/nextjs/middleware');
  return authMiddleware()(req);
}

export const config = {
  matcher: ['/deploy', '/deploy/:path*'],
};
