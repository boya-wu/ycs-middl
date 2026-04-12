


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."calculate_hours_worked"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.check_out_time IS NOT NULL AND NEW.check_in_time IS NOT NULL THEN
        NEW.hours_worked := EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_hours_worked"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_billing_decision_transaction"("p_time_record_ids" "uuid"[], "p_decision_type" "text", "p_final_md" numeric, "p_recommended_md" numeric DEFAULT NULL::numeric, "p_is_forced_md" boolean DEFAULT false, "p_reason" "text" DEFAULT NULL::"text", "p_decision_maker_id" "uuid" DEFAULT NULL::"uuid", "p_has_conflict" boolean DEFAULT false, "p_conflict_type" "text" DEFAULT NULL::"text", "p_is_conflict_resolved" boolean DEFAULT false, "p_conflict_resolution_notes" "text" DEFAULT NULL::"text", "p_is_billable" boolean DEFAULT false, "p_decision_ids_to_deactivate" "uuid"[] DEFAULT ARRAY[]::"uuid"[], "p_task_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."create_billing_decision_transaction"("p_time_record_ids" "uuid"[], "p_decision_type" "text", "p_final_md" numeric, "p_recommended_md" numeric, "p_is_forced_md" boolean, "p_reason" "text", "p_decision_maker_id" "uuid", "p_has_conflict" boolean, "p_conflict_type" "text", "p_is_conflict_resolved" boolean, "p_conflict_resolution_notes" "text", "p_is_billable" boolean, "p_decision_ids_to_deactivate" "uuid"[], "p_task_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_bdr_is_active_from_decision"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    SELECT is_active
    INTO NEW.is_active
    FROM billing_decisions
    WHERE id = NEW.billing_decision_id;

    IF NEW.is_active IS NULL THEN
        NEW.is_active := TRUE;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_bdr_is_active_from_decision"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_bdr_is_active_on_decision_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        UPDATE billing_decision_records
        SET is_active = NEW.is_active
        WHERE billing_decision_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_bdr_is_active_on_decision_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."billing_decision_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "billing_decision_id" "uuid" NOT NULL,
    "time_record_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_decision_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "decision_type" "text" NOT NULL,
    "is_forced_md" boolean DEFAULT false NOT NULL,
    "recommended_md" numeric(3,1),
    "final_md" numeric(3,1) NOT NULL,
    "reason" "text",
    "decision_maker_id" "uuid",
    "has_conflict" boolean DEFAULT false NOT NULL,
    "conflict_type" "text",
    "is_conflict_resolved" boolean DEFAULT false NOT NULL,
    "conflict_resolution_notes" "text",
    "is_billable" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "employee_no" "text"
);


ALTER TABLE "public"."staff_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staff_profiles"."employee_no" IS '工號（選填）';



CREATE TABLE IF NOT EXISTS "public"."time_record_facility_workarea" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_record_id" "uuid" NOT NULL,
    "factory_location" "text" NOT NULL,
    "work_area_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."time_record_facility_workarea" OWNER TO "postgres";


COMMENT ON TABLE "public"."time_record_facility_workarea" IS '每筆工時的所有廠區/工作區代號配對；同一邏輯工時跨廠區時一筆 time_record 可對應多個配對';



COMMENT ON COLUMN "public"."time_record_facility_workarea"."factory_location" IS '所屬廠區';



COMMENT ON COLUMN "public"."time_record_facility_workarea"."work_area_code" IS '工作區域代號';



CREATE TABLE IF NOT EXISTS "public"."time_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "record_date" "date" NOT NULL,
    "factory_location" "text" NOT NULL,
    "check_in_time" timestamp with time zone NOT NULL,
    "check_out_time" timestamp with time zone,
    "hours_worked" numeric(5,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "import_vendor_no" "text",
    "department_name" "text",
    "work_area_code" "text"
);


ALTER TABLE "public"."time_records" OWNER TO "postgres";


COMMENT ON COLUMN "public"."time_records"."import_vendor_no" IS '匯入時 Excel 廠商編號快照（優先於 staff_profiles.employee_no 顯示於裁決看板）';



COMMENT ON COLUMN "public"."time_records"."department_name" IS '匯入時部門名稱快照';



COMMENT ON COLUMN "public"."time_records"."work_area_code" IS '匯入時 Excel 工作區域代號快照（缺值時回退為 factory_location）';



CREATE OR REPLACE VIEW "public"."decided_billing_decisions_summary" AS
 SELECT "tr"."id" AS "time_record_id",
    "tr"."staff_id",
    "tr"."task_id",
    "tr"."record_date",
    COALESCE(( SELECT "string_agg"(DISTINCT "m"."factory_location", ', '::"text" ORDER BY "m"."factory_location") AS "string_agg"
           FROM "public"."time_record_facility_workarea" "m"
          WHERE ("m"."time_record_id" = "tr"."id")), "tr"."factory_location") AS "factory_location",
    "tr"."hours_worked",
    "tr"."check_in_time",
    "tr"."check_out_time",
    "bd"."id" AS "billing_decision_id",
    "bd"."decision_type",
    "bd"."has_conflict",
    "bd"."is_conflict_resolved",
    "bd"."is_billable",
    "bd"."final_md",
    true AS "has_decision",
    ( SELECT COALESCE("sum"("tr2"."hours_worked"), (0)::numeric) AS "coalesce"
           FROM ("public"."billing_decision_records" "bdr2"
             JOIN "public"."time_records" "tr2" ON (("bdr2"."time_record_id" = "tr2"."id")))
          WHERE ("bdr2"."billing_decision_id" = "bd"."id")) AS "merged_total_hours",
    "sp"."name" AS "staff_name",
    COALESCE("tr"."import_vendor_no", "sp"."employee_no") AS "staff_employee_no",
    "tr"."department_name",
    COALESCE(( SELECT "string_agg"(DISTINCT "m"."work_area_code", ', '::"text" ORDER BY "m"."work_area_code") AS "string_agg"
           FROM "public"."time_record_facility_workarea" "m"
          WHERE ("m"."time_record_id" = "tr"."id")), COALESCE(NULLIF("btrim"("tr"."work_area_code"), ''::"text"), "tr"."factory_location")) AS "work_area_code",
    "bd"."reason"
   FROM ((("public"."time_records" "tr"
     JOIN "public"."billing_decision_records" "bdr" ON ((("tr"."id" = "bdr"."time_record_id") AND ("bdr"."is_active" = true))))
     JOIN "public"."billing_decisions" "bd" ON ((("bdr"."billing_decision_id" = "bd"."id") AND ("bd"."is_active" = true))))
     LEFT JOIN "public"."staff_profiles" "sp" ON (("tr"."staff_id" = "sp"."id")))
  WHERE ("tr"."check_out_time" IS NOT NULL);


ALTER VIEW "public"."decided_billing_decisions_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."final_billings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "billing_decision_id" "uuid" NOT NULL,
    "project_rate_id" "uuid" NOT NULL,
    "billing_date" "date" NOT NULL,
    "md_amount" numeric(3,1) NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."final_billings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."pending_billing_decisions_summary" AS
 SELECT "tr"."id" AS "time_record_id",
    "tr"."staff_id",
    "tr"."task_id",
    "tr"."record_date",
    COALESCE(( SELECT "string_agg"(DISTINCT "m"."factory_location", ', '::"text" ORDER BY "m"."factory_location") AS "string_agg"
           FROM "public"."time_record_facility_workarea" "m"
          WHERE ("m"."time_record_id" = "tr"."id")), "tr"."factory_location") AS "factory_location",
    "tr"."hours_worked",
    "tr"."check_in_time",
    "tr"."check_out_time",
    "bd"."id" AS "billing_decision_id",
    "bd"."decision_type",
    "bd"."has_conflict",
    "bd"."is_conflict_resolved",
    "bd"."is_billable",
    "bd"."final_md",
        CASE
            WHEN ("bd"."id" IS NOT NULL) THEN true
            ELSE false
        END AS "has_decision",
    ( SELECT COALESCE("sum"("tr2"."hours_worked"), (0)::numeric) AS "coalesce"
           FROM ("public"."billing_decision_records" "bdr2"
             JOIN "public"."time_records" "tr2" ON (("bdr2"."time_record_id" = "tr2"."id")))
          WHERE ("bdr2"."billing_decision_id" = "bd"."id")) AS "merged_total_hours",
    "sp"."name" AS "staff_name",
    COALESCE("tr"."import_vendor_no", "sp"."employee_no") AS "staff_employee_no",
    "tr"."department_name",
    COALESCE(( SELECT "string_agg"(DISTINCT "m"."work_area_code", ', '::"text" ORDER BY "m"."work_area_code") AS "string_agg"
           FROM "public"."time_record_facility_workarea" "m"
          WHERE ("m"."time_record_id" = "tr"."id")), COALESCE(NULLIF("btrim"("tr"."work_area_code"), ''::"text"), "tr"."factory_location")) AS "work_area_code"
   FROM ((("public"."time_records" "tr"
     LEFT JOIN "public"."billing_decision_records" "bdr" ON ((("tr"."id" = "bdr"."time_record_id") AND ("bdr"."is_active" = true))))
     LEFT JOIN "public"."billing_decisions" "bd" ON ((("bdr"."billing_decision_id" = "bd"."id") AND ("bd"."is_active" = true))))
     LEFT JOIN "public"."staff_profiles" "sp" ON (("tr"."staff_id" = "sp"."id")))
  WHERE (("tr"."check_out_time" IS NOT NULL) AND (("bd"."id" IS NULL) OR ("bd"."is_billable" = false)));


ALTER VIEW "public"."pending_billing_decisions_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "standard_rate" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'TWD'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."staff_daily_factory_summary" AS
 SELECT "staff_id",
    "record_date",
    "count"(DISTINCT "factory_location") AS "distinct_factory_count",
    "string_agg"(DISTINCT "factory_location", ', '::"text" ORDER BY "factory_location") AS "factory_locations",
    "count"("id") AS "total_record_count",
    "sum"("hours_worked") AS "total_hours_worked",
    "array_agg"(DISTINCT "id" ORDER BY "id") AS "time_record_ids"
   FROM "public"."time_records" "tr"
  WHERE ("check_out_time" IS NOT NULL)
  GROUP BY "staff_id", "record_date";


ALTER VIEW "public"."staff_daily_factory_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."task_billing_summary" AS
 WITH "decision_task" AS (
         SELECT "bd"."id" AS "billing_decision_id",
            "bd"."final_md",
            "tr"."task_id"
           FROM (("public"."billing_decisions" "bd"
             JOIN "public"."billing_decision_records" "bdr" ON (("bdr"."billing_decision_id" = "bd"."id")))
             JOIN "public"."time_records" "tr" ON (("tr"."id" = "bdr"."time_record_id")))
          WHERE (("bd"."is_active" = true) AND ("bd"."is_billable" = true) AND ("tr"."task_id" IS NOT NULL))
          GROUP BY "bd"."id", "bd"."final_md", "tr"."task_id"
        )
 SELECT "task_id",
    COALESCE("sum"("final_md"), (0)::numeric) AS "used_md"
   FROM "decision_task"
  GROUP BY "task_id";


ALTER VIEW "public"."task_billing_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "budgeted_md" numeric(6,2)
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."billing_decision_records"
    ADD CONSTRAINT "billing_decision_records_billing_decision_id_time_record_id_key" UNIQUE ("billing_decision_id", "time_record_id");



ALTER TABLE ONLY "public"."billing_decision_records"
    ADD CONSTRAINT "billing_decision_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_decisions"
    ADD CONSTRAINT "billing_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."final_billings"
    ADD CONSTRAINT "final_billings_billing_decision_id_key" UNIQUE ("billing_decision_id");



ALTER TABLE ONLY "public"."final_billings"
    ADD CONSTRAINT "final_billings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_rates"
    ADD CONSTRAINT "project_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_rates"
    ADD CONSTRAINT "project_rates_project_id_year_key" UNIQUE ("project_id", "year");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_code_key" UNIQUE ("project_id", "code");



ALTER TABLE ONLY "public"."time_record_facility_workarea"
    ADD CONSTRAINT "time_record_facility_workarea_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_records"
    ADD CONSTRAINT "time_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_record_facility_workarea"
    ADD CONSTRAINT "uq_trfw_record_factory_workarea" UNIQUE ("time_record_id", "factory_location", "work_area_code");



CREATE INDEX "idx_billing_decision_records_decision" ON "public"."billing_decision_records" USING "btree" ("billing_decision_id");



CREATE INDEX "idx_billing_decision_records_time_record" ON "public"."billing_decision_records" USING "btree" ("time_record_id");



CREATE INDEX "idx_billing_decisions_active" ON "public"."billing_decisions" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_billing_decisions_billable" ON "public"."billing_decisions" USING "btree" ("is_billable") WHERE ("is_billable" = true);



CREATE INDEX "idx_billing_decisions_conflict" ON "public"."billing_decisions" USING "btree" ("has_conflict", "is_conflict_resolved") WHERE ("has_conflict" = true);



CREATE INDEX "idx_billing_decisions_decision_maker" ON "public"."billing_decisions" USING "btree" ("decision_maker_id");



CREATE INDEX "idx_billing_decisions_decision_type" ON "public"."billing_decisions" USING "btree" ("decision_type");



CREATE INDEX "idx_billing_decisions_forced_md" ON "public"."billing_decisions" USING "btree" ("is_forced_md");



CREATE INDEX "idx_final_billings_date" ON "public"."final_billings" USING "btree" ("billing_date");



CREATE INDEX "idx_final_billings_decision" ON "public"."final_billings" USING "btree" ("billing_decision_id");



CREATE INDEX "idx_final_billings_project_rate" ON "public"."final_billings" USING "btree" ("project_rate_id");



CREATE INDEX "idx_final_billings_status" ON "public"."final_billings" USING "btree" ("status");



CREATE INDEX "idx_project_rates_project" ON "public"."project_rates" USING "btree" ("project_id");



CREATE INDEX "idx_project_rates_year" ON "public"."project_rates" USING "btree" ("year");



CREATE INDEX "idx_projects_code" ON "public"."projects" USING "btree" ("code");



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("status");



CREATE INDEX "idx_staff_profiles_email" ON "public"."staff_profiles" USING "btree" ("email");



CREATE INDEX "idx_staff_profiles_user_id" ON "public"."staff_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_code" ON "public"."tasks" USING "btree" ("code");



CREATE INDEX "idx_tasks_project_id" ON "public"."tasks" USING "btree" ("project_id");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_time_records_check_out" ON "public"."time_records" USING "btree" ("check_out_time") WHERE ("check_out_time" IS NOT NULL);



CREATE INDEX "idx_time_records_staff_date" ON "public"."time_records" USING "btree" ("staff_id", "record_date");



CREATE INDEX "idx_time_records_staff_date_factory" ON "public"."time_records" USING "btree" ("staff_id", "record_date", "factory_location");



CREATE INDEX "idx_time_records_task_id" ON "public"."time_records" USING "btree" ("task_id");



CREATE INDEX "idx_trfw_time_record_id" ON "public"."time_record_facility_workarea" USING "btree" ("time_record_id");



CREATE UNIQUE INDEX "uniq_bdr_active_time_record" ON "public"."billing_decision_records" USING "btree" ("time_record_id") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "uniq_time_records_logical_key" ON "public"."time_records" USING "btree" ("staff_id", "record_date", "check_in_time", "check_out_time");



COMMENT ON INDEX "public"."uniq_time_records_logical_key" IS '匯入防重（logical key）：同一員工同一天同一進出場時間只有一筆，廠區/代號另存於 time_record_facility_workarea';



CREATE OR REPLACE TRIGGER "calculate_time_record_hours" BEFORE INSERT OR UPDATE ON "public"."time_records" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_hours_worked"();



CREATE OR REPLACE TRIGGER "trg_bdr_set_active_on_insert" BEFORE INSERT ON "public"."billing_decision_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_bdr_is_active_from_decision"();



CREATE OR REPLACE TRIGGER "trg_bdr_sync_active_on_decision_update" AFTER UPDATE OF "is_active" ON "public"."billing_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_bdr_is_active_on_decision_update"();



CREATE OR REPLACE TRIGGER "update_billing_decisions_updated_at" BEFORE UPDATE ON "public"."billing_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_final_billings_updated_at" BEFORE UPDATE ON "public"."final_billings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_rates_updated_at" BEFORE UPDATE ON "public"."project_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_staff_profiles_updated_at" BEFORE UPDATE ON "public"."staff_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_time_records_updated_at" BEFORE UPDATE ON "public"."time_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."billing_decision_records"
    ADD CONSTRAINT "billing_decision_records_billing_decision_id_fkey" FOREIGN KEY ("billing_decision_id") REFERENCES "public"."billing_decisions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_decision_records"
    ADD CONSTRAINT "billing_decision_records_time_record_id_fkey" FOREIGN KEY ("time_record_id") REFERENCES "public"."time_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_decisions"
    ADD CONSTRAINT "billing_decisions_decision_maker_id_fkey" FOREIGN KEY ("decision_maker_id") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."final_billings"
    ADD CONSTRAINT "final_billings_billing_decision_id_fkey" FOREIGN KEY ("billing_decision_id") REFERENCES "public"."billing_decisions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."final_billings"
    ADD CONSTRAINT "final_billings_project_rate_id_fkey" FOREIGN KEY ("project_rate_id") REFERENCES "public"."project_rates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."project_rates"
    ADD CONSTRAINT "project_rates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_record_facility_workarea"
    ADD CONSTRAINT "time_record_facility_workarea_time_record_id_fkey" FOREIGN KEY ("time_record_id") REFERENCES "public"."time_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_records"
    ADD CONSTRAINT "time_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_records"
    ADD CONSTRAINT "time_records_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE "public"."staff_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_profiles_insert_service_role" ON "public"."staff_profiles" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "staff_profiles_select_authenticated" ON "public"."staff_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "staff_profiles_update_service_role" ON "public"."staff_profiles" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_hours_worked"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_hours_worked"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_hours_worked"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_billing_decision_transaction"("p_time_record_ids" "uuid"[], "p_decision_type" "text", "p_final_md" numeric, "p_recommended_md" numeric, "p_is_forced_md" boolean, "p_reason" "text", "p_decision_maker_id" "uuid", "p_has_conflict" boolean, "p_conflict_type" "text", "p_is_conflict_resolved" boolean, "p_conflict_resolution_notes" "text", "p_is_billable" boolean, "p_decision_ids_to_deactivate" "uuid"[], "p_task_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_billing_decision_transaction"("p_time_record_ids" "uuid"[], "p_decision_type" "text", "p_final_md" numeric, "p_recommended_md" numeric, "p_is_forced_md" boolean, "p_reason" "text", "p_decision_maker_id" "uuid", "p_has_conflict" boolean, "p_conflict_type" "text", "p_is_conflict_resolved" boolean, "p_conflict_resolution_notes" "text", "p_is_billable" boolean, "p_decision_ids_to_deactivate" "uuid"[], "p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_billing_decision_transaction"("p_time_record_ids" "uuid"[], "p_decision_type" "text", "p_final_md" numeric, "p_recommended_md" numeric, "p_is_forced_md" boolean, "p_reason" "text", "p_decision_maker_id" "uuid", "p_has_conflict" boolean, "p_conflict_type" "text", "p_is_conflict_resolved" boolean, "p_conflict_resolution_notes" "text", "p_is_billable" boolean, "p_decision_ids_to_deactivate" "uuid"[], "p_task_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_bdr_is_active_from_decision"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_bdr_is_active_from_decision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_bdr_is_active_from_decision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_bdr_is_active_on_decision_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_bdr_is_active_on_decision_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_bdr_is_active_on_decision_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."billing_decision_records" TO "anon";
GRANT ALL ON TABLE "public"."billing_decision_records" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_decision_records" TO "service_role";



GRANT ALL ON TABLE "public"."billing_decisions" TO "anon";
GRANT ALL ON TABLE "public"."billing_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."staff_profiles" TO "anon";
GRANT ALL ON TABLE "public"."staff_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."time_record_facility_workarea" TO "anon";
GRANT ALL ON TABLE "public"."time_record_facility_workarea" TO "authenticated";
GRANT ALL ON TABLE "public"."time_record_facility_workarea" TO "service_role";



GRANT ALL ON TABLE "public"."time_records" TO "anon";
GRANT ALL ON TABLE "public"."time_records" TO "authenticated";
GRANT ALL ON TABLE "public"."time_records" TO "service_role";



GRANT ALL ON TABLE "public"."decided_billing_decisions_summary" TO "anon";
GRANT ALL ON TABLE "public"."decided_billing_decisions_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."decided_billing_decisions_summary" TO "service_role";



GRANT ALL ON TABLE "public"."final_billings" TO "anon";
GRANT ALL ON TABLE "public"."final_billings" TO "authenticated";
GRANT ALL ON TABLE "public"."final_billings" TO "service_role";



GRANT ALL ON TABLE "public"."pending_billing_decisions_summary" TO "anon";
GRANT ALL ON TABLE "public"."pending_billing_decisions_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_billing_decisions_summary" TO "service_role";



GRANT ALL ON TABLE "public"."project_rates" TO "anon";
GRANT ALL ON TABLE "public"."project_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_rates" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."staff_daily_factory_summary" TO "anon";
GRANT ALL ON TABLE "public"."staff_daily_factory_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_daily_factory_summary" TO "service_role";



GRANT ALL ON TABLE "public"."task_billing_summary" TO "anon";
GRANT ALL ON TABLE "public"."task_billing_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."task_billing_summary" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







