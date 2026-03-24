-- Drift Audit (remote DB vs local migrations)
-- Run on the remote database (Supabase SQL editor / psql).
--
-- What this script does:
-- 1) Compares local migration versions (from supabase/migrations/) vs
--    remote migration records in supabase_migrations.schema_migrations.
-- 2) Special-case check for migration 20260211000000 where the view/grants
--    exist in DB but the migration record is missing.

WITH expected_versions(version) AS (
  VALUES
    ('001'),
    ('002'),
    ('003'),
    ('004'),
    ('005'),
    ('006'),
    ('007'),
    ('008'),
    ('009'),
    ('010'),
    ('011'),
    ('012'),
    ('013'),
    ('014'),
    ('020'),
    ('20260211000000'),
    ('20260324140000')
),
remote_versions AS (
  SELECT version::text
  FROM supabase_migrations.schema_migrations
),
missing_versions AS (
  SELECT e.version
  FROM expected_versions e
  LEFT JOIN remote_versions r ON r.version = e.version
  WHERE r.version IS NULL
),
unexpected_versions AS (
  SELECT r.version
  FROM remote_versions r
  LEFT JOIN expected_versions e ON e.version = r.version
  WHERE e.version IS NULL
)
SELECT
  drift_type,
  migration_version
FROM (
  SELECT
    'MISSING_IN_SCHEMA_MIGRATIONS'::text AS drift_type,
    version AS migration_version
  FROM missing_versions

  UNION ALL

  SELECT
    'UNEXPECTED_IN_SCHEMA_MIGRATIONS'::text AS drift_type,
    version AS migration_version
  FROM unexpected_versions
) s
ORDER BY drift_type, migration_version;

-- Special-case: 20260211000000_grant_decided_billing_decisions_summary.sql
-- Local migration grants SELECT on public.decided_billing_decisions_summary to:
--   anon, authenticated, service_role
SELECT
  '20260211000000'::text AS migration_version,
  (NOT EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations
    WHERE version = '20260211000000'
  )) AS migration_record_missing,

  EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'decided_billing_decisions_summary'
  ) AS view_exists,

  EXISTS (
    SELECT 1
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'decided_billing_decisions_summary'
      AND grantee = 'anon'
      AND privilege_type = 'SELECT'
  ) AS has_anon_select,

  EXISTS (
    SELECT 1
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'decided_billing_decisions_summary'
      AND grantee = 'authenticated'
      AND privilege_type = 'SELECT'
  ) AS has_authenticated_select,

  EXISTS (
    SELECT 1
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'decided_billing_decisions_summary'
      AND grantee = 'service_role'
      AND privilege_type = 'SELECT'
  ) AS has_service_role_select;

-- Additional sanity checks (view existence vs missing migration records)
-- These are safe even when the migration record exists (they will report false).

SELECT
  '005'::text AS migration_version,
  (NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '005'
  )) AS migration_record_missing,
  EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'task_billing_summary'
  ) AS view_exists;

SELECT
  '011'::text AS migration_version,
  (NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '011'
  )) AS migration_record_missing,
  EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'pending_billing_decisions_summary'
  ) AS view_exists;

SELECT
  '012'::text AS migration_version,
  (NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '012'
  )) AS migration_record_missing,
  EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'decided_billing_decisions_summary'
  ) AS view_exists;

SELECT
  '013'::text AS migration_version,
  (NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '013'
  )) AS migration_record_missing,
  EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'decided_billing_decisions_summary'
  ) AS view_exists;

-- 深度一致（物件定義簽章）：請執行 supabase/verify/verify_signatures.sql（遠端與本地各跑一次後 diff 輸出）。

