import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionFromRequest } from '@/lib/auth/session';

const PROTECTED_PREFIXES = ['/dashboard/billing', '/api/billing'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname)) {
    const session = await verifySessionFromRequest(request);

    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: '請先登入' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, must-revalidate');
  return response;
}

export const config = {
  matcher: [
    '/dashboard/billing',
    '/dashboard/billing/(.*)',
    '/api/billing/pending',
    '/api/billing/decided',
  ],
};
