'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** 單筆匯入用 payload，task_id 匯入時一律不寫入（公海池） */
export interface ImportTimeRecord {
  staff_id: string;
  task_id?: string | null;
  record_date: string; // YYYY-MM-DD
  factory_location: string;
  /** Excel 工作區域代號快照（可空，未提供時回退為 factory_location） */
  work_area_code?: string | null;
  check_in_time: string; // ISO 8601
  check_out_time: string | null; // ISO 8601
  notes?: string;
  /** Excel 廠商編號快照（可空） */
  import_vendor_no?: string | null;
  /** Excel 部門名稱快照（可空） */
  department_name?: string | null;
}

const BATCH_SIZE = 150;

/**
 * 匯入防重鍵：logical key，不含廠區/代號。
 * 廠區/代號多值由 time_record_facility_workarea mapping 表管理。
 */
const IMPORT_LOGICAL_KEY = 'staff_id,record_date,check_in_time,check_out_time';

/**
 * 匯入時數紀錄（批量三階段寫入）
 * - 潔癖：duration < 5 分鐘或缺出場時間的列不寫入，計入 skipped
 * - 防重：依 uniq_time_records_logical_key 衝突則跳過 time_records 寫入，但仍補寫 mapping 配對
 * - mapping：每筆 canonical time_record 的（廠區, 工作區代號）配對寫入 time_record_facility_workarea
 * - 公海池：匯入時 task_id 一律為 null
 */
export async function importTimeRecords(
  records: ImportTimeRecord[]
): Promise<{
  success: boolean;
  data?: {
    imported: number;
    skipped: number;
    skippedNoCheckOut?: number;
    skippedDuration?: number;
    skippedDuplicates?: number;
    errors: string[];
  };
  error?: string;
}> {
  const supabase = createServerSupabaseClient();
  const errors: string[] = [];
  let imported = 0;
  let skippedDuration = 0;
  let skippedNoCheckOut = 0;

  try {
    // 1) 潔癖 + 裁決可見：僅寫入「有出場時間」且 duration >= 5 分鐘的列（task_id 強制 null）
    //    缺出場時間的列不寫入，否則裁決看板 View（pending_billing_decisions_summary）不會顯示
    const toInsert: Array<{
      staff_id: string;
      task_id: null;
      record_date: string;
      factory_location: string;
      work_area_code: string;
      check_in_time: string;
      check_out_time: string;
      notes: string | null;
      import_vendor_no: string | null;
      department_name: string | null;
    }> = [];

    for (const record of records) {
      if (!record.check_in_time || !record.check_out_time) {
        skippedNoCheckOut++;
        continue;
      }
      const checkIn = new Date(record.check_in_time);
      const checkOut = new Date(record.check_out_time);
      const durationMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
      if (durationMinutes < 5) {
        skippedDuration++;
        continue;
      }

      const vendor =
        typeof record.import_vendor_no === 'string' ? record.import_vendor_no.trim() : '';
      const dept =
        typeof record.department_name === 'string' ? record.department_name.trim() : '';
      const workArea =
        typeof record.work_area_code === 'string' ? record.work_area_code.trim() : '';
      const factoryLocation = record.factory_location.trim();

      toInsert.push({
        staff_id: record.staff_id,
        task_id: null, // 公海池：匯入時不寫入專案/任務，裁決中心再認領
        record_date: record.record_date,
        factory_location: factoryLocation,
        // 若 Excel 缺工作區域代號，回退為廠區，避免裁決看板顯示空值或錯值
        work_area_code: workArea || factoryLocation,
        check_in_time: record.check_in_time,
        check_out_time: record.check_out_time,
        notes: record.notes ?? null,
        import_vendor_no: vendor || null,
        department_name: dept || null,
      });
    }

    // 2) 分批三階段寫入
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      const batchNo = Math.floor(i / BATCH_SIZE) + 1;
      try {
        // 階段 A：upsert time_records（logical key 衝突時 DO NOTHING）
        // 只有「新插入」的列才會回傳 id；已存在的列不回傳（ignoreDuplicates: true）
        const { data: insertedData, error: upsertError } = await supabase
          .from('time_records')
          .upsert(chunk, {
            onConflict: IMPORT_LOGICAL_KEY,
            ignoreDuplicates: true,
          })
          .select('id');

        if (upsertError) {
          errors.push(`批次 ${batchNo} 寫入失敗: ${upsertError.message}`);
          continue;
        }
        imported += insertedData?.length ?? 0;

        // 階段 B：查詢本批所有 canonical time_record id
        // 使用 staff_id + record_date 範圍查詢，再以完整 logical key 在 JS 端精確比對
        const staffIds = [...new Set(chunk.map((r) => r.staff_id))];
        const dates = [...new Set(chunk.map((r) => r.record_date))];

        const { data: canonicalRows, error: selectError } = await supabase
          .from('time_records')
          .select('id, staff_id, record_date, check_in_time, check_out_time')
          .in('staff_id', staffIds)
          .in('record_date', dates);

        if (selectError || !canonicalRows) {
          errors.push(`批次 ${batchNo} canonical 查詢失敗: ${selectError?.message ?? '無資料'}`);
          continue;
        }

        // 建立 logical_key → canonical id 的映射
        const canonicalMap = new Map(
          canonicalRows.map((r) => [
            `${r.staff_id}|${r.record_date}|${r.check_in_time}|${r.check_out_time}`,
            r.id,
          ])
        );

        // 階段 C：插入 mapping 配對（ON CONFLICT DO NOTHING 防重）
        const mappingRows = chunk.flatMap((r) => {
          const key = `${r.staff_id}|${r.record_date}|${r.check_in_time}|${r.check_out_time}`;
          const canonicalId = canonicalMap.get(key);
          if (!canonicalId) return [];
          return [
            {
              time_record_id: canonicalId,
              factory_location: r.factory_location,
              work_area_code: r.work_area_code,
            },
          ];
        });

        if (mappingRows.length > 0) {
          const { error: mappingError } = await supabase
            .from('time_record_facility_workarea')
            .upsert(mappingRows, {
              onConflict: 'time_record_id,factory_location,work_area_code',
              ignoreDuplicates: true,
            });

          if (mappingError) {
            errors.push(`批次 ${batchNo} mapping 寫入失敗: ${mappingError.message}`);
          }
        }
      } catch (chunkError) {
        const msg = chunkError instanceof Error ? chunkError.message : String(chunkError);
        errors.push(`批次 ${batchNo} 例外: ${msg}`);
      }
    }

    const skippedDuplicates = toInsert.length - imported;
    const skipped = skippedNoCheckOut + skippedDuration + skippedDuplicates;

    revalidatePath('/dashboard/billing');

    return {
      success: true,
      data: {
        imported,
        skipped,
        skippedNoCheckOut,
        skippedDuration,
        skippedDuplicates,
        errors,
      },
    };
  } catch (error) {
    console.error('importTimeRecords 錯誤:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤',
    };
  }
}
