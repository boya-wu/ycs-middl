-- YCS public full baseline (schema-only, migration-equivalent snapshot as of 2026-03-24).
-- Prefer replacing this file with output of scripts/dump-public-baseline.sh against production.

-- ============================================
-- YCS 專案：public schema snapshot（僅 DDL，不含 seeds／測試 DML）
-- SSOT 仍為 supabase/migrations/；本檔由 npm run schema:consolidated 重產，禁止手改。
-- ============================================

-- ============================================
-- Part 1: 初始資料表結構 (原 001_initial_schema)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 業務使用者資料表 (staff_profiles)
CREATE TABLE staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    employee_no TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id),
    UNIQUE(email)
);
CREATE INDEX idx_staff_profiles_user_id ON staff_profiles(user_id);
CREATE INDEX idx_staff_profiles_email ON staff_profiles(email);
COMMENT ON COLUMN staff_profiles.employee_no IS '工號（選填）';

-- staff_profiles 存取策略（與 migration 008 一致）
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_profiles_select_authenticated"
  ON staff_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_profiles_insert_service_role"
  ON staff_profiles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "staff_profiles_update_service_role"
  ON staff_profiles FOR UPDATE TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.staff_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.staff_profiles TO service_role;

ALTER TABLE staff_profiles ALTER COLUMN user_id DROP NOT NULL;

-- 2. 專案表 (projects - PY)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_projects_status ON projects(status);

-- 3. 任務表 (tasks - SR)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, code)
);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_code ON tasks(code);
CREATE INDEX idx_tasks_status ON tasks(status);

-- 4. 時數紀錄表 (time_records)
CREATE TABLE time_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    factory_location TEXT NOT NULL,
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ,
    hours_worked DECIMAL(5, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_time_records_staff_date ON time_records(staff_id, record_date);
CREATE INDEX idx_time_records_staff_date_factory ON time_records(staff_id, record_date, factory_location);
CREATE INDEX idx_time_records_task_id ON time_records(task_id);
CREATE INDEX idx_time_records_check_out ON time_records(check_out_time) WHERE check_out_time IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_time_records_import_key
ON time_records (staff_id, record_date, factory_location, check_in_time);

-- 5. 計費裁決表 (billing_decisions)
CREATE TABLE billing_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_type TEXT NOT NULL,
    is_forced_md BOOLEAN NOT NULL DEFAULT FALSE,
    recommended_md DECIMAL(3, 1),
    final_md DECIMAL(3, 1) NOT NULL,
    reason TEXT,
    decision_maker_id UUID REFERENCES staff_profiles(id),
    has_conflict BOOLEAN NOT NULL DEFAULT FALSE,
    conflict_type TEXT,
    is_conflict_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    conflict_resolution_notes TEXT,
    is_billable BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_billing_decisions_forced_md ON billing_decisions(is_forced_md);
CREATE INDEX idx_billing_decisions_decision_type ON billing_decisions(decision_type);
CREATE INDEX idx_billing_decisions_decision_maker ON billing_decisions(decision_maker_id);
CREATE INDEX idx_billing_decisions_conflict ON billing_decisions(has_conflict, is_conflict_resolved) WHERE has_conflict = TRUE;
CREATE INDEX idx_billing_decisions_billable ON billing_decisions(is_billable) WHERE is_billable = TRUE;
CREATE INDEX idx_billing_decisions_active ON billing_decisions(is_active) WHERE is_active = TRUE;

-- 6. 計費裁決關聯表 (billing_decision_records)
CREATE TABLE billing_decision_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_decision_id UUID NOT NULL REFERENCES billing_decisions(id) ON DELETE CASCADE,
    time_record_id UUID NOT NULL REFERENCES time_records(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(billing_decision_id, time_record_id)
);
CREATE INDEX idx_billing_decision_records_decision ON billing_decision_records(billing_decision_id);
CREATE INDEX idx_billing_decision_records_time_record ON billing_decision_records(time_record_id);

-- 7. 專案費率表 (project_rates)
CREATE TABLE project_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    standard_rate DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TWD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, year)
);
CREATE INDEX idx_project_rates_project ON project_rates(project_id);
CREATE INDEX idx_project_rates_year ON project_rates(year);

-- 8. 最終請款表 (final_billings)
CREATE TABLE final_billings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_decision_id UUID NOT NULL REFERENCES billing_decisions(id) ON DELETE RESTRICT,
    project_rate_id UUID NOT NULL REFERENCES project_rates(id) ON DELETE RESTRICT,
    billing_date DATE NOT NULL,
    md_amount DECIMAL(3, 1) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(billing_decision_id)
);
CREATE INDEX idx_final_billings_decision ON final_billings(billing_decision_id);
CREATE INDEX idx_final_billings_project_rate ON final_billings(project_rate_id);
CREATE INDEX idx_final_billings_date ON final_billings(billing_date);
CREATE INDEX idx_final_billings_status ON final_billings(status);

-- 觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_staff_profiles_updated_at BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_records_updated_at BEFORE UPDATE ON time_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_billing_decisions_updated_at BEFORE UPDATE ON billing_decisions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_final_billings_updated_at BEFORE UPDATE ON final_billings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_rates_updated_at BEFORE UPDATE ON project_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 觸發器：自動計算工作時數
CREATE OR REPLACE FUNCTION calculate_hours_worked()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_out_time IS NOT NULL AND NEW.check_in_time IS NOT NULL THEN
        NEW.hours_worked := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_time_record_hours
    BEFORE INSERT OR UPDATE ON time_records
    FOR EACH ROW
    EXECUTE FUNCTION calculate_hours_worked();

-- 視圖：員工每日廠區統計
CREATE OR REPLACE VIEW staff_daily_factory_summary AS
SELECT
    tr.staff_id,
    tr.record_date,
    COUNT(DISTINCT tr.factory_location) as distinct_factory_count,
    STRING_AGG(DISTINCT tr.factory_location, ', ' ORDER BY tr.factory_location) as factory_locations,
    COUNT(tr.id) as total_record_count,
    SUM(tr.hours_worked) as total_hours_worked,
    ARRAY_AGG(DISTINCT tr.id ORDER BY tr.id) as time_record_ids
FROM time_records tr
WHERE tr.check_out_time IS NOT NULL
GROUP BY tr.staff_id, tr.record_date;

-- 視圖：待裁決時數紀錄彙整（含廠商姓名、廠商編號、部門預留、工作區域代號，見 migration 011）
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
    sp.employee_no AS staff_employee_no,
    NULL::TEXT AS department_name,
    tr.factory_location AS work_area_code
FROM time_records tr
LEFT JOIN billing_decision_records bdr ON tr.id = bdr.time_record_id AND bdr.is_active = TRUE
LEFT JOIN billing_decisions bd ON bdr.billing_decision_id = bd.id AND bd.is_active = TRUE
LEFT JOIN staff_profiles sp ON tr.staff_id = sp.id
WHERE tr.check_out_time IS NOT NULL
  AND (bd.id IS NULL OR bd.is_billable = FALSE);

-- 視圖：已裁決時數紀錄彙整（裁決看板「裁決後」分頁用，與 pending 互斥）
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
    sp.employee_no AS staff_employee_no,
    NULL::TEXT AS department_name,
    tr.factory_location AS work_area_code,
    bd.reason
FROM time_records tr
JOIN billing_decision_records bdr ON tr.id = bdr.time_record_id AND bdr.is_active = TRUE
JOIN billing_decisions bd ON bdr.billing_decision_id = bd.id AND bd.is_active = TRUE
LEFT JOIN staff_profiles sp ON tr.staff_id = sp.id
WHERE tr.check_out_time IS NOT NULL;


-- ============================================
-- Part 2: 工時認領中心 (原 004_claim_center_claiming)
-- ============================================

ALTER TABLE time_records ALTER COLUMN task_id DROP NOT NULL;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS budgeted_md DECIMAL(6, 2);

CREATE OR REPLACE FUNCTION set_bdr_is_active_from_decision()
RETURNS TRIGGER AS $$
BEGIN
    SELECT is_active INTO NEW.is_active FROM billing_decisions WHERE id = NEW.billing_decision_id;
    IF NEW.is_active IS NULL THEN NEW.is_active := TRUE; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bdr_set_active_on_insert ON billing_decision_records;
CREATE TRIGGER trg_bdr_set_active_on_insert
BEFORE INSERT ON billing_decision_records
FOR EACH ROW
EXECUTE FUNCTION set_bdr_is_active_from_decision();

CREATE OR REPLACE FUNCTION sync_bdr_is_active_on_decision_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        UPDATE billing_decision_records SET is_active = NEW.is_active WHERE billing_decision_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bdr_sync_active_on_decision_update ON billing_decisions;
CREATE TRIGGER trg_bdr_sync_active_on_decision_update
AFTER UPDATE OF is_active ON billing_decisions
FOR EACH ROW
EXECUTE FUNCTION sync_bdr_is_active_on_decision_update();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bdr_active_time_record
ON billing_decision_records (time_record_id)
WHERE is_active = TRUE;

-- 計費裁決 Transaction Function（含 task_id 認領、重複 ID 去重；與 migration 014 一致）
CREATE OR REPLACE FUNCTION create_billing_decision_transaction(
    p_time_record_ids UUID[],
    p_decision_type TEXT,
    p_final_md DECIMAL(3, 1),
    p_recommended_md DECIMAL(3, 1) DEFAULT NULL,
    p_is_forced_md BOOLEAN DEFAULT FALSE,
    p_reason TEXT DEFAULT NULL,
    p_decision_maker_id UUID DEFAULT NULL,
    p_has_conflict BOOLEAN DEFAULT FALSE,
    p_conflict_type TEXT DEFAULT NULL,
    p_is_conflict_resolved BOOLEAN DEFAULT FALSE,
    p_conflict_resolution_notes TEXT DEFAULT NULL,
    p_is_billable BOOLEAN DEFAULT FALSE,
    p_decision_ids_to_deactivate UUID[] DEFAULT ARRAY[]::UUID[],
    p_task_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_decision_id UUID;
    v_deactivated_count INTEGER;
    v_updated_count INTEGER;
    v_distinct_count INTEGER;
    v_result JSONB;
BEGIN
    IF p_task_id IS NULL THEN
        RAISE EXCEPTION '請先選擇專案任務';
    END IF;

    SELECT count(*) INTO v_distinct_count
    FROM (SELECT DISTINCT unnest(p_time_record_ids) AS id) t;

    IF v_distinct_count = 0 THEN
        RAISE EXCEPTION '請至少選擇一筆工時紀錄';
    END IF;

    IF array_length(p_decision_ids_to_deactivate, 1) > 0 THEN
        UPDATE billing_decisions
        SET is_active = FALSE,
            updated_at = NOW()
        WHERE id = ANY(p_decision_ids_to_deactivate)
          AND is_active = TRUE;

        GET DIAGNOSTICS v_deactivated_count = ROW_COUNT;
    ELSE
        v_deactivated_count := 0;
    END IF;

    UPDATE time_records
    SET task_id = p_task_id,
        updated_at = NOW()
    WHERE id = ANY(p_time_record_ids);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> v_distinct_count THEN
        RAISE EXCEPTION '部分工時紀錄不存在或已被刪除（已更新 % 筆，請求 % 筆）。請重新整理頁面後再試。', v_updated_count, v_distinct_count;
    END IF;

    INSERT INTO billing_decisions (
        decision_type,
        final_md,
        recommended_md,
        is_forced_md,
        reason,
        decision_maker_id,
        has_conflict,
        conflict_type,
        is_conflict_resolved,
        conflict_resolution_notes,
        is_billable,
        is_active
    ) VALUES (
        p_decision_type,
        p_final_md,
        p_recommended_md,
        p_is_forced_md,
        p_reason,
        p_decision_maker_id,
        p_has_conflict,
        p_conflict_type,
        p_is_conflict_resolved,
        p_conflict_resolution_notes,
        p_is_billable,
        TRUE
    )
    RETURNING id INTO v_new_decision_id;

    INSERT INTO billing_decision_records (
        billing_decision_id,
        time_record_id
    )
    SELECT
        v_new_decision_id,
        unnest(p_time_record_ids)
    ON CONFLICT (billing_decision_id, time_record_id) DO NOTHING;

    v_result := jsonb_build_object(
        'billing_decision_id', v_new_decision_id,
        'deactivated_count', v_deactivated_count,
        'records_updated', v_updated_count,
        'records_created', v_distinct_count
    );

    RETURN v_result;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION '此段工時已被其他專案認領';
    WHEN OTHERS THEN
        RAISE EXCEPTION '建立計費裁決時發生錯誤: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION create_billing_decision_transaction IS
'建立計費裁決的 Transaction Function，含工時認領與排他鎖（uniq_bdr_active_time_record）';


-- ============================================
-- Part 3: 任務已用 MD 視圖 (原 005_task_billing_summary_view)
-- ============================================

CREATE OR REPLACE VIEW task_billing_summary AS
WITH decision_task AS (
    SELECT bd.id AS billing_decision_id, bd.final_md, tr.task_id
    FROM billing_decisions bd
    JOIN billing_decision_records bdr ON bdr.billing_decision_id = bd.id
    JOIN time_records tr ON tr.id = bdr.time_record_id
    WHERE bd.is_active = TRUE AND bd.is_billable = TRUE AND tr.task_id IS NOT NULL
    GROUP BY bd.id, bd.final_md, tr.task_id
)
SELECT task_id, COALESCE(SUM(final_md), 0) AS used_md
FROM decision_task
GROUP BY task_id;

-- decided_billing_decisions_summary：Data API 讀取（migration 20260211000000）
GRANT SELECT ON public.decided_billing_decisions_summary TO anon;
GRANT SELECT ON public.decided_billing_decisions_summary TO authenticated;
GRANT SELECT ON public.decided_billing_decisions_summary TO service_role;

-- 測試／演習用 DML 僅存在於 migrations（003、006），不包含於本 snapshot。
-- 重產本檔：npm run schema:consolidated
