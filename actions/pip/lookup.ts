'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeVendorNo } from '@/lib/pip/normalize-vendor-no';

export interface StaffLookupResult {
  vendorNo: string;
  staffId: string | null;
  name: string;
  error: string | null;
}

/**
 * 依廠商編號查 staff_profiles（employee_no）
 * 找不到時 staffId/name 為空字串與 null，仍允許後續手動補姓名
 */
export async function lookupStaffByVendorNo(
  rawInput: string
): Promise<StaffLookupResult> {
  const vendorNo = normalizeVendorNo(rawInput);
  if (!vendorNo) {
    return {
      vendorNo: '',
      staffId: null,
      name: '',
      error: '請輸入或掃描工作證號碼',
    };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id, name')
    .eq('employee_no', vendorNo)
    .maybeSingle();

  if (error) {
    return {
      vendorNo,
      staffId: null,
      name: '',
      error: error.message,
    };
  }

  return {
    vendorNo,
    staffId: data?.id ?? null,
    name: data?.name ?? '',
    error: null,
  };
}

/**
 * 同廠區之工作內容歷史：最近 20 筆，去重後保留最新 10 個唯一值
 */
export async function fetchWorkHistory(
  factoryLocation: string
): Promise<{ items: string[]; error: string | null }> {
  const loc = factoryLocation.trim();
  if (!loc) {
    return { items: [], error: null };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('pip_inspection_records')
    .select('work_content')
    .eq('factory_location', loc)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return { items: [], error: error.message };
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const row of data ?? []) {
    const content = row.work_content?.trim();
    if (content && !seen.has(content)) {
      seen.add(content);
      unique.push(content);
      if (unique.length >= 10) break;
    }
  }

  return { items: unique, error: null };
}

/**
 * 廠區選項：沿用 time_records 既有 distinct factory_location
 */
export async function fetchFactoryLocations(): Promise<{
  locations: string[];
  error: string | null;
}> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('pip_distinct_factory_locations');

  if (error) {
    return { locations: [], error: error.message };
  }

  const rows = (data ?? []) as { factory_location: string }[];
  const locations = rows
    .map((r) => r.factory_location?.trim())
    .filter(Boolean) as string[];

  return { locations, error: null };
}
