'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface StaffImportRow {
  name: string;
  email: string;
  employee_no?: string;
  name_en?: string;
  department?: string;
  job_title?: string;
  mobile_phone?: string;
  card_no?: string;
}

export interface ImportStaffProfilesResult {
  success: boolean;
  inserted: number;
  updated: number;
  errors: Array<{ email: string; message: string }>;
}

/**
 * 批次匯入人員名冊（upsert on email）。
 * 不建立 auth.users，僅寫入 staff_profiles；user_id 保持 NULL。
 */
export async function importStaffProfiles(
  rows: StaffImportRow[]
): Promise<ImportStaffProfilesResult> {
  if (!rows.length) {
    return { success: true, inserted: 0, updated: 0, errors: [] };
  }

  const supabase = createServerSupabaseClient();
  let inserted = 0;
  let updated = 0;
  const errors: Array<{ email: string; message: string }> = [];

  for (const row of rows) {
    const email = row.email?.trim();
    const name = row.name?.trim();

    if (!email || !name) {
      errors.push({ email: email || '(empty)', message: '姓名與 Email 為必填' });
      continue;
    }

    try {
      const { data: existing } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      const payload = {
        name,
        email,
        employee_no: row.employee_no?.trim() || null,
        name_en: row.name_en?.trim() || null,
        department: row.department?.trim() || null,
        job_title: row.job_title?.trim() || null,
        mobile_phone: row.mobile_phone?.trim() || null,
        card_no: row.card_no?.trim() || null,
      };

      if (existing) {
        const { error } = await supabase
          .from('staff_profiles')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await supabase
          .from('staff_profiles')
          .insert({ ...payload, user_id: null });
        if (error) throw error;
        inserted++;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ email, message });
    }
  }

  return {
    success: errors.length === 0,
    inserted,
    updated,
    errors,
  };
}
