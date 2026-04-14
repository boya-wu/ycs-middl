'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { signSession, COOKIE_NAME, TTL_SECONDS } from '@/lib/auth/session';

interface LoginResult {
  success: boolean;
  error?: string;
}

/**
 * 以工號 (employee_no) 登入，建立簽章 Cookie 工作階段。
 * 成功時 redirect，不回傳；失敗時回傳 error 字串。
 */
export async function loginByEmployeeNo(
  _prev: LoginResult | null,
  formData: FormData
): Promise<LoginResult> {
  const employeeNo = (formData.get('employee_no') as string)?.trim();
  const next = (formData.get('next') as string) || '/dashboard/billing';

  if (!employeeNo) {
    return { success: false, error: '請輸入工號' };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id, name, employee_no')
    .eq('employee_no', employeeNo)
    .maybeSingle();

  if (error) {
    console.error('loginByEmployeeNo 查詢錯誤:', error);
    return { success: false, error: '系統錯誤，請稍後再試' };
  }

  if (!data) {
    return { success: false, error: '查無此工號，請確認後重試' };
  }

  const token = await signSession({
    staffId: data.id,
    name: data.name,
    employeeNo: data.employee_no!,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });

  redirect(next);
}
