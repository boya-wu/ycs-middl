'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface StaffProfileFull {
  id: string;
  name: string;
  email: string;
  employee_no: string | null;
  name_en: string | null;
  department: string | null;
  job_title: string | null;
  mobile_phone: string | null;
  card_no: string | null;
}

/**
 * 查詢所有員工完整資料（用於人員名冊匯入頁比對新增 vs 更新）。
 */
export async function getAllStaffProfilesFull(): Promise<{
  success: boolean;
  data?: StaffProfileFull[];
  error?: string;
}> {
  const supabase = createServerSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('id, name, email, employee_no, name_en, department, job_title, mobile_phone, card_no')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`查詢員工資料失敗: ${error.message}`);
    }

    return { success: true, data: (data || []) as StaffProfileFull[] };
  } catch (error) {
    console.error('getAllStaffProfilesFull 錯誤:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
    };
  }
}
