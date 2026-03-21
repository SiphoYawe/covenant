import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  // Let the deploy page render regardless of auth state.
  // The deploy page has its own CivicAuthProvider in its layout
  // which handles auth gating at the component level.
  return NextResponse.next();
}

export const config = {
  matcher: ['/deploy', '/deploy/:path*'],
};
