-- ============================================
-- time_record_facility_workarea: 記錄每筆工時的所有廠區/工作區代號配對
-- 支援同一邏輯工時段跨廠區匯出時，一筆 canonical time_record 對應多組廠區/代號
-- ============================================

CREATE TABLE IF NOT EXISTS time_record_facility_workarea (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_record_id   UUID NOT NULL REFERENCES time_records(id) ON DELETE CASCADE,
  factory_location TEXT NOT NULL,
  work_area_code   TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_trfw_record_factory_workarea
    UNIQUE (time_record_id, factory_location, work_area_code)
);

CREATE INDEX IF NOT EXISTS idx_trfw_time_record_id
  ON time_record_facility_workarea(time_record_id);

COMMENT ON TABLE time_record_facility_workarea IS
  '每筆工時的所有廠區/工作區代號配對；同一邏輯工時跨廠區時一筆 time_record 可對應多個配對';
COMMENT ON COLUMN time_record_facility_workarea.factory_location IS '所屬廠區';
COMMENT ON COLUMN time_record_facility_workarea.work_area_code IS '工作區域代號';

-- 回填：把現有 time_records 的廠區/工作區代號資料遷移到 mapping 表
-- work_area_code 欄由 20260412060340 migration 已加入，缺值時回退為 factory_location
INSERT INTO time_record_facility_workarea (time_record_id, factory_location, work_area_code)
SELECT
  id,
  factory_location,
  COALESCE(NULLIF(BTRIM(work_area_code), ''), factory_location)
FROM time_records
WHERE factory_location IS NOT NULL
  AND BTRIM(factory_location) != ''
ON CONFLICT ON CONSTRAINT uq_trfw_record_factory_workarea DO NOTHING;
