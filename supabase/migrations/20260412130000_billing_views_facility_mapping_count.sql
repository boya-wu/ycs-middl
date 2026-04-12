-- ============================================
-- pending / decided billing summary views：
-- 新增 facility_mapping_count（time_record_facility_workarea 筆數）
-- 供前端在 STRING_AGG 僅單一段落時仍能辨識「多筆 mapping」（例如 DISTINCT 後字串無逗號）
-- ============================================

CREATE OR REPLACE VIEW pending_billing_decisions_summary AS
SELECT
    tr.id AS time_record_id,
    tr.staff_id,
    tr.task_id,
    tr.record_date,
    COALESCE(
      (SELECT STRING_AGG(DISTINCT m.factory_location, ', ' ORDER BY m.factory_location)
       FROM time_record_facility_workarea m
       WHERE m.time_record_id = tr.id),
      tr.factory_location
    ) AS factory_location,
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
    COALESCE(
      (SELECT STRING_AGG(DISTINCT m.work_area_code, ', ' ORDER BY m.work_area_code)
       FROM time_record_facility_workarea m
       WHERE m.time_record_id = tr.id),
      COALESCE(NULLIF(BTRIM(tr.work_area_code), ''), tr.factory_location)
    ) AS work_area_code,
    (SELECT COUNT(*)::int
     FROM time_record_facility_workarea m
     WHERE m.time_record_id = tr.id) AS facility_mapping_count
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
    COALESCE(
      (SELECT STRING_AGG(DISTINCT m.factory_location, ', ' ORDER BY m.factory_location)
       FROM time_record_facility_workarea m
       WHERE m.time_record_id = tr.id),
      tr.factory_location
    ) AS factory_location,
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
    COALESCE(
      (SELECT STRING_AGG(DISTINCT m.work_area_code, ', ' ORDER BY m.work_area_code)
       FROM time_record_facility_workarea m
       WHERE m.time_record_id = tr.id),
      COALESCE(NULLIF(BTRIM(tr.work_area_code), ''), tr.factory_location)
    ) AS work_area_code,
    bd.reason,
    (SELECT COUNT(*)::int
     FROM time_record_facility_workarea m
     WHERE m.time_record_id = tr.id) AS facility_mapping_count
FROM time_records tr
JOIN billing_decision_records bdr ON tr.id = bdr.time_record_id AND bdr.is_active = TRUE
JOIN billing_decisions bd ON bdr.billing_decision_id = bd.id AND bd.is_active = TRUE
LEFT JOIN staff_profiles sp ON tr.staff_id = sp.id
WHERE tr.check_out_time IS NOT NULL;

COMMENT ON COLUMN pending_billing_decisions_summary.facility_mapping_count IS
  'time_record_facility_workarea 對應筆數；>1 表示多組廠區／代號 mapping';

COMMENT ON COLUMN decided_billing_decisions_summary.facility_mapping_count IS
  'time_record_facility_workarea 對應筆數；>1 表示多組廠區／代號 mapping';
