'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeVendorNo } from '@/lib/pip/normalize-vendor-no';

export interface PipInspectionPayload {
  vendor_no: string;
  staff_id: string | null;
  staff_name: string;
  inspection_datetime: string;
  factory_location: string;
  work_content: string;
  location_tgcm: boolean;
  location_io_room: boolean;
  pip_no_phone: boolean;
  pip_no_electronic: boolean;
  pip_no_usb: boolean;
  pip_checked_upper_pocket: boolean;
  pip_checked_pants_pocket: boolean;
  pip_checked_red_card: boolean;
}

/** 寫入 PIP 自我檢查紀錄（pm_* 欄位暫不寫入，留待日後指派） */
export async function submitPipInspection(
  payload: PipInspectionPayload
): Promise<{ id: string | null; error: string | null }> {
  const vendorNo = normalizeVendorNo(payload.vendor_no);
  if (!vendorNo) {
    return { id: null, error: '廠商編號無效' };
  }

  const name = payload.staff_name.trim();
  if (!name) {
    return { id: null, error: '姓名不得為空' };
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('pip_inspection_records')
    .insert({
      vendor_no: vendorNo,
      staff_id: payload.staff_id,
      staff_name: name,
      inspection_datetime: payload.inspection_datetime,
      factory_location: payload.factory_location.trim(),
      work_content: payload.work_content.trim(),
      location_tgcm: payload.location_tgcm,
      location_io_room: payload.location_io_room,
      pip_no_phone: payload.pip_no_phone,
      pip_no_electronic: payload.pip_no_electronic,
      pip_no_usb: payload.pip_no_usb,
      pip_checked_upper_pocket: payload.pip_checked_upper_pocket,
      pip_checked_pants_pocket: payload.pip_checked_pants_pocket,
      pip_checked_red_card: payload.pip_checked_red_card,
    })
    .select('id')
    .single();

  if (error) {
    return { id: null, error: error.message };
  }

  return { id: data.id, error: null };
}
