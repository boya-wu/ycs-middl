'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME } from '@/lib/auth/session';

/**
 * 登出：清除工作階段 Cookie 並導回登入頁。
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  redirect('/login');
}
