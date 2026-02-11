-- 裁決 Transaction：以「不重複的 time_record_id」檢查更新筆數，避免傳入重複 ID 時誤報「部分工時紀錄不存在」
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

    -- 傳入陣列可能含重複 ID（例如同一筆在畫面上被選兩次），以不重複數量為準
    SELECT count(*) INTO v_distinct_count
    FROM (SELECT DISTINCT unnest(p_time_record_ids) AS id) t;

    IF v_distinct_count = 0 THEN
        RAISE EXCEPTION '請至少選擇一筆工時紀錄';
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
    -- 以「不重複 ID 數量」比較，避免重複 ID 造成誤判
    IF v_updated_count <> v_distinct_count THEN
        RAISE EXCEPTION '部分工時紀錄不存在或已被刪除（已更新 % 筆，請求 % 筆）。請重新整理頁面後再試。', v_updated_count, v_distinct_count;
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

    -- 步驟 4: 建立 billing_decision_records（unnest 含重複時 ON CONFLICT DO NOTHING 會略過重複）
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
