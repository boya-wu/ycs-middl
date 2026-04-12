-- ============================================
-- pip_inspection_records：進廠 PIP 自我檢查紀錄
-- 獨立於 time_records / billing；vendor_no 為去除讀卡前綴後之廠商編號
-- 注意：版本號避開已存在之 20260412130000_billing_views_*
-- ============================================

CREATE TABLE IF NOT EXISTS pip_inspection_records (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  vendor_no                    TEXT        NOT NULL,
  staff_id                     UUID        REFERENCES staff_profiles(id) ON DELETE SET NULL,
  staff_name                   TEXT        NOT NULL,

  inspection_datetime          TIMESTAMPTZ NOT NULL,
  factory_location             TEXT        NOT NULL,
  work_content                 TEXT        NOT NULL,

  location_tgcm                BOOLEAN     NOT NULL DEFAULT FALSE,
  location_io_room             BOOLEAN     NOT NULL DEFAULT FALSE,

  pip_no_phone                 BOOLEAN     NOT NULL DEFAULT FALSE,
  pip_no_electronic            BOOLEAN     NOT NULL DEFAULT FALSE,
  pip_no_usb                   BOOLEAN     NOT NULL DEFAULT FALSE,

  pip_checked_upper_pocket     BOOLEAN     NOT NULL DEFAULT FALSE,
  pip_checked_pants_pocket     BOOLEAN     NOT NULL DEFAULT FALSE,
  pip_checked_red_card         BOOLEAN     NOT NULL DEFAULT FALSE,

  pm_staff_id                  UUID        REFERENCES staff_profiles(id) ON DELETE SET NULL,
  pm_confirmed_at              TIMESTAMPTZ,

  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pip_inspection_records IS '進廠 PIP 自我檢查紀錄（與工時／認領流程解耦）';
COMMENT ON COLUMN pip_inspection_records.vendor_no IS '去除 V001 等讀卡前綴後之廠商編號（與 Excel 廠商編號一致）';
COMMENT ON COLUMN pip_inspection_records.staff_id IS '對應 staff_profiles；查無人員時為 NULL';
COMMENT ON COLUMN pip_inspection_records.pip_no_phone IS 'TRUE = 確認身上未攜帶私人手機（X）';
COMMENT ON COLUMN pip_inspection_records.pip_no_electronic IS 'TRUE = 確認身上未攜帶電子設備（X）';
COMMENT ON COLUMN pip_inspection_records.pip_no_usb IS 'TRUE = 確認身上未攜帶隨身碟（X）';
COMMENT ON COLUMN pip_inspection_records.pm_staff_id IS '維護紀錄：指派 PM（暫留空）';
COMMENT ON COLUMN pip_inspection_records.pm_confirmed_at IS '維護紀錄：PM 確認時間（暫留空）';

CREATE INDEX IF NOT EXISTS idx_pip_vendor_no ON pip_inspection_records(vendor_no);
CREATE INDEX IF NOT EXISTS idx_pip_factory_created ON pip_inspection_records(factory_location, created_at DESC);

ALTER TABLE pip_inspection_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass pip_inspection_records"
  ON pip_inspection_records
  TO service_role
  USING (true)
  WITH CHECK (true);

-- PIP 表單廠區下拉：distinct time_records.factory_location（避免全表載入至應用層）
CREATE OR REPLACE FUNCTION public.pip_distinct_factory_locations()
RETURNS TABLE (factory_location text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT tr.factory_location
  FROM time_records tr
  WHERE tr.factory_location IS NOT NULL
    AND btrim(tr.factory_location) <> ''
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.pip_distinct_factory_locations() IS
  '供 PIP 自我檢查表單載入廠區選項（與既有工時紀錄一致）';

-- 僅供後端 service_role（Server Actions）呼叫；避免經由 anon 暴露 time_records
GRANT EXECUTE ON FUNCTION public.pip_distinct_factory_locations() TO service_role;
