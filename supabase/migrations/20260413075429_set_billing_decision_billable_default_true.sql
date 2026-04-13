-- ============================================
-- Default billable = TRUE for new decisions
-- ============================================
-- Rationale:
-- - Existing flow doesn't expose a UI toggle for billable/non-billable.
-- - Treating new claims as non-billable by default causes:
--   - pending/decided view mismatches
--   - used_md (task_billing_summary) never increasing
--
-- This migration makes "billable" the default in both:
-- 1) billing_decisions.is_billable column default
-- 2) create_billing_decision_transaction() parameter default

ALTER TABLE public.billing_decisions
  ALTER COLUMN is_billable SET DEFAULT TRUE;

-- Keep function body identical; only change p_is_billable default to TRUE.
CREATE OR REPLACE FUNCTION public.create_billing_decision_transaction(
    p_time_record_ids uuid[],
    p_decision_type text,
    p_final_md numeric,
    p_recommended_md numeric DEFAULT NULL::numeric,
    p_is_forced_md boolean DEFAULT false,
    p_reason text DEFAULT NULL::text,
    p_decision_maker_id uuid DEFAULT NULL::uuid,
    p_has_conflict boolean DEFAULT false,
    p_conflict_type text DEFAULT NULL::text,
    p_is_conflict_resolved boolean DEFAULT false,
    p_conflict_resolution_notes text DEFAULT NULL::text,
    p_is_billable boolean DEFAULT true,
    p_decision_ids_to_deactivate uuid[] DEFAULT ARRAY[]::uuid[],
    p_task_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_decision_id UUID;
    v_deactivated_count INTEGER;
    v_updated_count INTEGER;
    v_result JSONB;
BEGIN
    IF p_task_id IS NULL THEN
        RAISE EXCEPTION '請先選擇專案任務';
    END IF;

    -- 步驟 1: 停用舊的 active decisions
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

    -- 步驟 2: 更新工時認領（先入池後認領）
    UPDATE time_records
    SET task_id = p_task_id,
        updated_at = NOW()
    WHERE id = ANY(p_time_record_ids);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> array_length(p_time_record_ids, 1) THEN
        RAISE EXCEPTION '部分工時紀錄不存在或已被刪除';
    END IF;

    -- 步驟 3: 建立新的 billing_decision
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

    -- 步驟 4: 建立 billing_decision_records
    INSERT INTO billing_decision_records (
        billing_decision_id,
        time_record_id
    )
    SELECT
        v_new_decision_id,
        unnest(p_time_record_ids)
    ON CONFLICT (billing_decision_id, time_record_id) DO NOTHING;

    -- 返回結果
    v_result := jsonb_build_object(
        'billing_decision_id', v_new_decision_id,
        'deactivated_count', v_deactivated_count,
        'records_updated', v_updated_count,
        'records_created', array_length(p_time_record_ids, 1)
    );

    RETURN v_result;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION '此段工時已被其他專案認領';
    WHEN OTHERS THEN
        -- 發生錯誤時自動回滾（Postgres Transaction 特性）
        RAISE EXCEPTION '建立計費裁決時發生錯誤: %', SQLERRM;
END;
$$;
