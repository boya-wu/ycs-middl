-- 安全清資料 migration：
-- 1) 只清 public schema 的資料，不刪除 table/view/function 結構
-- 2) 重置序號（RESTART IDENTITY）
-- 3) 透過 CASCADE 一併處理 FK 關聯
-- 4) 排除 extension 擁有的資料表，避免誤動系統物件

DO $$
DECLARE
  tables_to_truncate TEXT;
BEGIN
  SELECT string_agg(format('%I.%I', t.schemaname, t.tablename), ', ')
    INTO tables_to_truncate
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename <> 'spatial_ref_sys'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_depend d ON d.objid = c.oid
      WHERE n.nspname = t.schemaname
        AND c.relname = t.tablename
        AND d.deptype = 'e' -- extension-owned
    );

  IF tables_to_truncate IS NULL THEN
    RAISE NOTICE 'No truncatable tables found in public schema.';
    RETURN;
  END IF;

  EXECUTE 'TRUNCATE TABLE ' || tables_to_truncate || ' RESTART IDENTITY CASCADE';
  RAISE NOTICE 'Truncated tables: %', tables_to_truncate;
END
$$;
