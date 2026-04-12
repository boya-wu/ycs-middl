-- 本機／測試用：清空 public 業務表 + Authentication（auth.users 及其依賴列）。
-- CASCADE：一併截斷指向上述表的外鍵子表（如 auth.identities、sessions 等）。
-- 不加 RESTART IDENTITY：否則會碰 auth schema 內建 sequence 的 owner 權限而失敗；本專案主鍵為 UUID，無需重設序號。
-- 若 migration 新增表且有外鍵，請同步調整此清單。
-- 執行：npm run supabase:truncate（預設連本機 Supabase；單一陳述式以配合 supabase db query）

TRUNCATE TABLE
  public.billing_decision_records,
  public.final_billings,
  public.billing_decisions,
  public.time_records,
  public.project_rates,
  public.tasks,
  public.projects,
  public.staff_profiles,
  auth.users
CASCADE;
