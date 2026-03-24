-- 移除舊版 create_billing_decision_transaction 重載（無 p_task_id）。
-- 後續 migration 014 已定義含 p_task_id 之版本；PostgreSQL 會保留多重重載導致
-- 與雲端單一簽章不一致，且 pg_dump 會對兩個重載分別 GRANT。

DROP FUNCTION IF EXISTS public.create_billing_decision_transaction(
  uuid[],
  text,
  numeric,
  numeric,
  boolean,
  text,
  uuid,
  boolean,
  text,
  boolean,
  text,
  boolean,
  uuid[]
);
