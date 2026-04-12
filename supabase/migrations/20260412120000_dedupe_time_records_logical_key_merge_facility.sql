-- ============================================
-- 合併 time_records 重複 logical key（安全子集），並確保 uniq_time_records_logical_key
-- 適用：在已有 time_record_facility_workarea 後，仍殘留多筆相同
--       (staff_id, record_date, check_in_time, check_out_time) 的資料列。
-- 策略：僅處理「群組內 task_id 全為 NULL」且「至多一筆 time_record 被 billing_decision_records 參照」
--       的群組；其餘群組略過，若仍有重複則整個 migration 失敗（交易回滾、索引還原）。
-- ============================================

DO $$
DECLARE
  g RECORD;
  v_ids uuid[];
  v_canonical uuid;
  v_dup uuid;
  v_dup_group_count int;
  v_task_nonempty int;
  v_bdr_count int;
  v_remaining int;
BEGIN
  SELECT COUNT(*) INTO v_dup_group_count
  FROM (
    SELECT 1
    FROM time_records
    GROUP BY staff_id, record_date, check_in_time, check_out_time
    HAVING COUNT(*) > 1
  ) t;

  IF v_dup_group_count = 0 THEN
    RAISE NOTICE 'dedupe_time_records_logical_key_merge_facility: no duplicate logical-key groups';
    RETURN;
  END IF;

  RAISE NOTICE 'dedupe_time_records_logical_key_merge_facility: % duplicate group(s) detected, merging safe groups',
    v_dup_group_count;

  DROP INDEX IF EXISTS uniq_time_records_logical_key;

  FOR g IN
    SELECT staff_id, record_date, check_in_time, check_out_time
    FROM time_records
    GROUP BY staff_id, record_date, check_in_time, check_out_time
    HAVING COUNT(*) > 1
  LOOP
    SELECT COUNT(*) FILTER (WHERE task_id IS NOT NULL) INTO v_task_nonempty
    FROM time_records
    WHERE staff_id = g.staff_id
      AND record_date = g.record_date
      AND check_in_time = g.check_in_time
      AND check_out_time = g.check_out_time;

    IF v_task_nonempty > 0 THEN
      RAISE NOTICE
        'skip logical-key group (task_id IS NOT NULL present): staff_id=% record_date=%',
        g.staff_id,
        g.record_date;
      CONTINUE;
    END IF;

    SELECT COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1
      FROM billing_decision_records b
      WHERE b.time_record_id = time_records.id
    )) INTO v_bdr_count
    FROM time_records
    WHERE staff_id = g.staff_id
      AND record_date = g.record_date
      AND check_in_time = g.check_in_time
      AND check_out_time = g.check_out_time;

    IF v_bdr_count > 1 THEN
      RAISE NOTICE
        'skip logical-key group (multiple billing_decision_records refs): staff_id=% record_date=%',
        g.staff_id,
        g.record_date;
      CONTINUE;
    END IF;

    SELECT ARRAY_AGG(id ORDER BY id) INTO v_ids
    FROM time_records
    WHERE staff_id = g.staff_id
      AND record_date = g.record_date
      AND check_in_time = g.check_in_time
      AND check_out_time = g.check_out_time;

    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL OR array_length(v_ids, 1) < 2 THEN
      CONTINUE;
    END IF;

    SELECT t.id INTO v_canonical
    FROM time_records t
    WHERE t.id = ANY (v_ids)
      AND EXISTS (
        SELECT 1
        FROM billing_decision_records b
        WHERE b.time_record_id = t.id
      )
    LIMIT 1;

    IF v_canonical IS NULL THEN
      SELECT MIN(id) INTO v_canonical
      FROM time_records
      WHERE id = ANY (v_ids);
    END IF;

    FOREACH v_dup IN ARRAY v_ids
    LOOP
      IF v_dup = v_canonical THEN
        CONTINUE;
      END IF;

      INSERT INTO time_record_facility_workarea (time_record_id, factory_location, work_area_code)
      SELECT v_canonical, m.factory_location, m.work_area_code
      FROM time_record_facility_workarea m
      WHERE m.time_record_id = v_dup
      ON CONFLICT ON CONSTRAINT uq_trfw_record_factory_workarea DO NOTHING;

      INSERT INTO time_record_facility_workarea (time_record_id, factory_location, work_area_code)
      SELECT
        v_canonical,
        tr.factory_location,
        COALESCE(NULLIF(BTRIM(tr.work_area_code), ''), tr.factory_location)
      FROM time_records tr
      WHERE tr.id = v_dup
      ON CONFLICT ON CONSTRAINT uq_trfw_record_factory_workarea DO NOTHING;

      DELETE FROM time_records
      WHERE id = v_dup;
    END LOOP;
  END LOOP;

  SELECT COUNT(*) INTO v_remaining
  FROM (
    SELECT 1
    FROM time_records
    GROUP BY staff_id, record_date, check_in_time, check_out_time
    HAVING COUNT(*) > 1
  ) x;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION
      'dedupe_time_records_logical_key_merge_facility: % duplicate logical-key group(s) remain after merge; resolve task_id or billing_decision_records conflicts, then re-run',
      v_remaining;
  END IF;

  CREATE UNIQUE INDEX uniq_time_records_logical_key
    ON time_records (staff_id, record_date, check_in_time, check_out_time);

  COMMENT ON INDEX uniq_time_records_logical_key IS
    '匯入防重（logical key）：同一員工同一天同一進出場時間只有一筆，廠區/代號另存於 time_record_facility_workarea';
END $$;
