import type { JWTPayload } from 'jose';
import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';
import { cookies } from 'next/headers';

export interface SessionPayload extends JWTPayload {
  staffId: string;
  name: string;
  employeeNo: string;
}

const COOKIE_NAME = 'ycs_session';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

function getSecret(): Uint8Array {
  const raw = process.env.YCS_SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      'YCS_SESSION_SECRET 缺失或長度不足 32 字元。請在 .env.local 中設定。'
    );
  }
  return new TextEncoder().encode(raw);
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.staffId || !payload.employeeNo) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * 從 Request cookies 驗證工作階段（供 Middleware 使用，不依賴 next/headers）
 */
export async function verifySessionFromRequest(
  request: { cookies: { get(name: string): { value: string } | undefined } }
): Promise<SessionPayload | null> {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifySession(cookie.value);
}

/**
 * 從 Server Component / Server Action 的 cookies 取得工作階段
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME, TTL_SECONDS };
