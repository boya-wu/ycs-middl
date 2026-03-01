import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 對裁決看板頁面與相關 API 加上 Cache-Control: no-store，
 * 避免瀏覽器快取導致重新整理後仍顯示舊資料。
 */
export function middleware(request: NextRequest) {
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
