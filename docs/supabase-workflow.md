# Supabase 工作流程（Baseline + Drift Audit + Migration First）

這份文件補充你們現有的 `.cursor/rules/supabase-migration-workflow.mdc`，把「Baseline」與「Drift Audit」納入日常操作，避免 `consolidated_schema.sql` 因手動修訂而造成與真實 DB 漂移。

## 目標

1. 將「遠端 `public` 結構」固化成可重現的快照（Baseline）。
2. 當遇到「DB 物件存在但 `schema_migrations` 沒紀錄」等漂移時，能用可重複的方式定位原因（Drift Audit）。
3. 強制 `consolidated_schema.sql` 僅作為自動生成 snapshot，不允許純手動編輯。

## 檔案說明

1. `audit_drift.sql`（專案根目錄）
   - 專門用來對比遠端 `supabase_migrations.schema_migrations` 與本機 `supabase/migrations/` 的 migration 版本集合。
   - 內建特別檢查 `20260211000000`：遠端若已存在 `public.decided_billing_decisions_summary` 的 view 與對應 `GRANT SELECT`，但 migration record 缺失，會一併輸出。

2. `supabase/baseline/2026-03-23_public_schema.sql`
   - 遠端 `public` 的結構快照（**只涵蓋**：Table、View、Index、Grants）。
   - 內含 `CREATE EXTENSION`、`CREATE TABLE`、`CREATE OR REPLACE VIEW`、`CREATE INDEX`、`GRANT ...`。
   - 設計為「新環境初始化起點/比對基準」，實務上仍建議搭配 migrations 來補齊 functions/triggers/RLS 等其它內容（因為本 baseline 不包含它們）。

## Baseline 怎麼用（新環境初始化起點）

1. 建立新 DB（確保 Supabase auth/schema 已存在）。
2. 先套用 baseline：
   - 以你們熟悉的方式執行 `supabase/baseline/2026-03-23_public_schema.sql`（例如 Supabase SQL editor / psql）。
3. 再照你們現有 `Migration First` 流程跑完整 migrations（確保 functions/triggers/RLS/policies 正確）。

> 重要：baseline 不是替代 migrations，而是讓 `public` 的 Table/View/Index/Grants 有一個可驗證的「起跑點」。

## Drift Audit 怎麼用（定位 schema_migrations 漂移）

當你看到類似「`schema_migrations` 沒紀錄，但該 migration 產生的 View/GRANT 在 DB 中確實存在」時：

1. 在遠端 DB 執行 `audit_drift.sql`
2. 先看前半段：
   - `MISSING_IN_SCHEMA_MIGRATIONS`：本機 migration 存在但遠端沒紀錄
   - `UNEXPECTED_IN_SCHEMA_MIGRATIONS`：遠端有紀錄但本機 migrations 不存在
3. 再看 `20260211000000` 特別檢查輸出：
   - `migration_record_missing=true` + `view_exists=true` + `has_*_select=true`
   - 這表示：migration 的物件在 DB 已經存在，但 migration record 沒寫入（通常是落地流程不是用 `db push/reset`，或 migration 狀態被調整過）。

## Migration First（沿用既有規範 + baseline/guard 強化）

1. 資料庫結構變更（Table/Column/View/RLS/Functions）：
   - 必須先新增 migration 到 `supabase/migrations/`
2. `consolidated_schema.sql`：
   - 僅作 snapshot，不得手動編輯（若需變更，必須重新由工具生成）
3. 本 repo 新增守門機制（請見 CI/腳本章節）：
   - 若 `supabase/consolidated_schema.sql` 變更但沒有相對應的 `supabase/migrations/*` 變更，CI 會阻擋（避免單純手改 snapshot）。

## 為什麼你們現在要用它

本次 Drift Audit / baseline 取樣揭露：

- 遠端 `supabase_migrations.schema_migrations` **缺少** `20260211000000`
- 但遠端 `public.decided_billing_decisions_summary` 的 view 與 `GRANT SELECT` 實際存在

因此，把 `audit_drift.sql` 與 Baseline 檔一起納入流程，可以確保未來遇到相同狀況時能快速定位與回饋，而不是靠人工猜測。

