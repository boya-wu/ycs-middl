-- ============================================
-- 替換匯入防重鍵：移除含 factory_location 的舊唯一鍵，
-- 建立不含廠區/代號的 logical key 唯一索引。
-- 廠區/代號多值由 time_record_facility_workarea mapping 表管理。
-- ============================================

DROP INDEX IF EXISTS uniq_time_records_import_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_time_records_logical_key
  ON time_records (staff_id, record_date, check_in_time, check_out_time);

COMMENT ON INDEX uniq_time_records_logical_key IS
  '匯入防重（logical key）：同一員工同一天同一進出場時間只有一筆，廠區/代號另存於 time_record_facility_workarea';
