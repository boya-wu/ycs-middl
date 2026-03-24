-- verify_signatures.sql
-- 在遠端與本地（db reset 後）各執行一次，比對下列欄位是否完全一致。
-- 需要：CREATE EXTENSION pgcrypto（Supabase 通常已啟用）

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH
  cols AS (
    SELECT
      format(
        '%I.%I|%s|%s|%s',
        c.relname,
        a.attname,
        format_type(a.atttypid, a.atttypmod),
        a.attnotnull::text,
        COALESCE(pg_get_expr(ad.adbin, ad.adrelid), '')
      ) AS line
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE c.relkind = 'r'
  ),
  cons AS (
    SELECT
      format('%I|%I|%s', c.relname, con.conname, pg_get_constraintdef(con.oid)) AS line
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r'
  ),
  table_union AS (
    SELECT line FROM cols
    UNION ALL
    SELECT line FROM cons
  ),
  table_sig AS (
    SELECT
      encode(digest(COALESCE(string_agg(line, E'\n' ORDER BY line), ''), 'sha256'), 'hex') AS table_signature
    FROM table_union
  ),
  view_lines AS (
    SELECT
      format(
        '%I.%I|%s',
        v.schemaname,
        v.viewname,
        pg_get_viewdef((quote_ident(v.schemaname) || '.' || quote_ident(v.viewname))::regclass, true)
      ) AS line
    FROM pg_views v
    WHERE v.schemaname = 'public'
  ),
  view_sig AS (
    SELECT
      encode(digest(COALESCE(string_agg(line, E'\n' ORDER BY line), ''), 'sha256'), 'hex') AS view_signature
    FROM view_lines
  ),
  index_sig AS (
    SELECT
      encode(digest(COALESCE(string_agg(indexdef, E'\n' ORDER BY indexdef), ''), 'sha256'), 'hex') AS index_signature
    FROM pg_indexes
    WHERE schemaname = 'public'
  ),
  grant_table AS (
    SELECT
      format(
        '%s|%I.%I|%s|%s',
        grantee,
        table_schema,
        table_name,
        privilege_type,
        COALESCE(is_grantable, '')
      ) AS line
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
  ),
  grant_routine AS (
    SELECT
      format(
        '%s|%I.%I|%s|%s',
        grantee,
        specific_schema,
        specific_name,
        privilege_type,
        COALESCE(is_grantable, '')
      ) AS line
    FROM information_schema.routine_privileges
    WHERE specific_schema = 'public'
  ),
  grant_union AS (
    SELECT line FROM grant_table
    UNION ALL
    SELECT line FROM grant_routine
  ),
  grant_sig AS (
    SELECT
      encode(digest(COALESCE(string_agg(line, E'\n' ORDER BY line), ''), 'sha256'), 'hex') AS grant_signature
    FROM grant_union
  ),
  policy_lines AS (
    SELECT
      format(
        '%I|%I|%s|%s|%s|%s|%s',
        schemaname,
        tablename,
        policyname,
        COALESCE(roles::text, ''),
        cmd,
        COALESCE(qual, ''),
        COALESCE(with_check, '')
      ) AS line
    FROM pg_policies
    WHERE schemaname = 'public'
  ),
  policy_sig AS (
    SELECT
      encode(digest(COALESCE(string_agg(line, E'\n' ORDER BY line), ''), 'sha256'), 'hex') AS policy_signature
    FROM policy_lines
  ),
  func_lines AS (
    SELECT p.oid, pg_get_functiondef(p.oid) AS line
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid AND n.nspname = 'public'
    WHERE p.prokind IN ('f', 'p', 'w')
  ),
  function_sig AS (
    SELECT
      encode(digest(COALESCE(string_agg(line, E'\n' ORDER BY oid::text), ''), 'sha256'), 'hex') AS function_signature
    FROM func_lines
  ),
  trigger_lines AS (
    SELECT t.oid, pg_get_triggerdef(t.oid, true) AS line
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE NOT t.tgisinternal
  ),
  trigger_sig AS (
    SELECT
      encode(digest(COALESCE(string_agg(line, E'\n' ORDER BY oid::text), ''), 'sha256'), 'hex') AS trigger_signature
    FROM trigger_lines
  )
SELECT
  t.table_signature,
  v.view_signature,
  i.index_signature,
  g.grant_signature,
  p.policy_signature,
  f.function_signature,
  tr.trigger_signature
FROM table_sig t
CROSS JOIN view_sig v
CROSS JOIN index_sig i
CROSS JOIN grant_sig g
CROSS JOIN policy_sig p
CROSS JOIN function_sig f
CROSS JOIN trigger_sig tr;
