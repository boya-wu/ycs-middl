-- ============================================
-- time_records：匯入快照欄位（廠商編號、部門名稱）
-- billing summary views：顯示 COALESCE(import, staff) 與實際部門欄
-- ============================================
ALTER TABLE time_records
  ADD COLUMN IF NOT EXISTS import_vendor_no TEXT,
  ADD COLUMN IF NOT EXISTS department_name TEXT;

COMMENT ON COLUMN time_records.import_vendor_no IS '匯入時 Excel 廠商編號快照（優先於 staff_profiles.employee_no 顯示於裁決看板）';
COMMENT ON COLUMN time_records.department_name IS '匯入時部門名稱快照';

CREATE OR REPLACE VIEW pending_billing_decisions_summary AS
SELECT
    tr.id AS time_record_id,
    tr.staff_id,
    tr.task_id,
    tr.record_date,
    tr.factory_location,
    tr.hours_worked,
    tr.check_in_time,
    tr.check_out_time,
    bd.id AS billing_decision_id,
    bd.decision_type,
    bd.has_conflict,
    bd.is_conflict_resolved,
    bd.is_billable,
    bd.final_md,
    CASE WHEN bd.id IS NOT NULL THEN TRUE ELSE FALSE END AS has_decision,
    (
        SELECT COALESCE(SUM(tr2.hours_worked), 0)
        FROM billing_decision_records bdr2
        JOIN time_records tr2 ON bdr2.time_record_id = tr2.id
        WHERE bdr2.billing_decision_id = bd.id
    ) AS merged_total_hours,
    sp.name AS staff_name,
    COALESCE(tr.import_vendor_no, sp.employee_no) AS staff_employee_no,
    tr.department_name,
    tr.factory_location AS work_area_code
FROM time_records tr
LEFT JOIN billing_decision_records bdr ON tr.id = bdr.time_record_id AND bdr.is_active = TRUE
LEFT JOIN billing_decisions bd ON bdr.billing_decision_id = bd.id AND bd.is_active = TRUE
LEFT JOIN staff_profiles sp ON tr.staff_id = sp.id
WHERE tr.check_out_time IS NOT NULL
  AND (bd.id IS NULL OR bd.is_billable = FALSE);

CREATE OR REPLACE VIEW decided_billing_decisions_summary AS
SELECT
    tr.id AS time_record_id,
    tr.staff_id,
    tr.task_id,
    tr.record_date,
    tr.factory_location,
    tr.hours_worked,
    tr.check_in_time,
    tr.check_out_time,
    bd.id AS billing_decision_id,
    bd.decision_type,
    bd.has_conflict,
    bd.is_conflict_resolved,
    bd.is_billable,
    bd.final_md,
    TRUE AS has_decision,
    (
        SELECT COALESCE(SUM(tr2.hours_worked), 0)
        FROM billing_decision_records bdr2
        JOIN time_records tr2 ON bdr2.time_record_id = tr2.id
        WHERE bdr2.billing_decision_id = bd.id
    ) AS merged_total_hours,
    sp.name AS staff_name,
    COALESCE(tr.import_vendor_no, sp.employee_no) AS staff_employee_no,
    tr.department_name,
    tr.factory_location AS work_area_code,
    bd.reason
FROM time_records tr
JOIN billing_decision_records bdr ON tr.id = bdr.time_record_id AND bdr.is_active = TRUE
JOIN billing_decisions bd ON bdr.billing_decision_id = bd.id AND bd.is_active = TRUE
LEFT JOIN staff_profiles sp ON tr.staff_id = sp.id
WHERE tr.check_out_time IS NOT NULL;
