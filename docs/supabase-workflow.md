# Supabase 工作流程（Baseline + Drift Audit + Migration First）

這份文件補充 `.cursor/rules/supabase-migration-workflow.mdc`，納入 **Full baseline**、**簽章比對** 與 **`consolidated_schema.sql` 自動重產**，避免 snapshot 與真實 DB 漂移。

**相關**：Cursor 連本機 Supabase MCP 若出現 Streamable HTTP 失敗、SSE **405**，多為 MCP URL 設成 `54321/mcp` 所致；正確為 Studio **`54323/api/mcp`**。見 [`docs/cursor-supabase-mcp.md`](./cursor-supabase-mcp.md)。

## 目標

1. 將遠端 `public` 結構可重現地固化（Baseline，含 Function／Trigger／RLS／GRANT）。
2. 以 `audit_drift.sql` 定位 `schema_migrations` 與檔案集合不一致。
3. 以 `supabase/verify/verify_signatures.sql` 比對**物件定義簽章**（本地 reset 後 vs 遠端）。
4. **`supabase/consolidated_schema.sql` 僅能由工具重產**，禁止手改。

## 檔案說明

| 檔案 | 用途 |
|------|------|
| [`audit_drift.sql`](../audit_drift.sql) | 比對遠端 `schema_migrations` 與本機 `supabase/migrations/` 版本集合。 |
| [`supabase/verify/verify_signatures.sql`](../supabase/verify/verify_signatures.sql) | 輸出 table / view / index / grant / policy / function / trigger 的 SHA-256 簽章（單列）。 |
| [`supabase/baseline/2026-03-24_public_full.sql`](../supabase/baseline/2026-03-24_public_full.sql) | 與目前 migration 鏈一致的 **full** schema-only 快照；應以遠端為準時請用腳本覆寫。 |
| [`supabase/baseline/2026-03-23_public_schema.sql`](../supabase/baseline/2026-03-23_public_schema.sql) | 舊版精簡 baseline（僅歷史參考）。 |
| [`scripts/dump-public-baseline.sh`](../scripts/dump-public-baseline.sh) | 對遠端 `SUPABASE_DB_URL` 執行 `pg_dump --schema=public --schema-only`。 |
| [`scripts/dump-consolidated.sh`](../scripts/dump-consolidated.sh) | 本地 `db reset` + `db dump` → 更新 `consolidated_schema.sql`。 |
| [`scripts/push-remote-migrations.sh`](../scripts/push-remote-migrations.sh) | 包一層 `supabase db push`（與 `npm run schema:push` 相同）。 |

## 將雲端對齊本地（`db push`）

目標：雲端只套用 **`supabase/migrations/`** 中尚未記錄的變更，使遠端結構與本地 `db reset` 後一致。

1. **登入並連結專案**（專案根目錄）  
   `npx supabase login`  
   `npx supabase link --project-ref <你的-project-ref>`  

2. **推送 migrations**  
   `npm run schema:push`  
   （等同 `npx supabase db push`；若 CLI 詢問確認，加上 `--yes`。）

3. **驗證**  
   推送完成後，在雲端 SQL Editor 執行 `supabase/verify/verify_signatures.sql`，與本地 `db reset` 後再跑的結果比對；七個 hash 應完全一致。

**注意**

- `db push` **會在遠端執行 SQL**，正式環境請先備份並確認維護窗口。
- 若遠端 `schema_migrations` 與實際物件不同步，請用 [migration repair](https://supabase.com/docs/guides/cli/managing-environments#migration-history) 或 Supabase 支援流程修復，再執行 push。
- 新增之 migration（例如移除函式重載）應先合併進 `main` 再對雲端 push，避免遺漏檔案。

## `consolidated_schema.sql`（SSOT 流程）

1. 僅透過 **`npm run schema:consolidated`**（Docker 需啟動）重產。
2. PR 中若變更 migrations，應一併提交重產後的 `supabase/consolidated_schema.sql`。
3. CI 仍執行 [`scripts/guard-consolidated-schema.mjs`](../scripts/guard-consolidated-schema.mjs)：禁止「只改 consolidated、未改 migrations」。

## 簽章比對（遠端 vs 本地）

1. **本地**：`npx supabase db reset --local --yes` 後，對本地 DB 執行 `supabase/verify/verify_signatures.sql`，將結果存成例如 `signatures.local.txt`。
2. **遠端**：在 Supabase SQL Editor 或 `psql` 執行同一檔，存成 `signatures.remote.txt`。
3. 比對兩份輸出是否**完全一致**（七個 hash 欄位）。若不一致，常見原因：遠端尚未 `db push`、PostgreSQL 主版本不同、或 extension／預設 GRANT 與本地有差。

## Baseline 怎麼用

- **對齊遠端**：設定 `SUPABASE_DB_URL` 後執行 `./scripts/dump-public-baseline.sh`（見 [`supabase/baseline/README.md`](../supabase/baseline/README.md)）。
- **新環境**：仍以 **migrations** 為準；baseline 用於對照與除錯，不取代 migration 鏈。

## Drift Audit

見原 `audit_drift.sql` 使用方式；若需深度一致，請再跑 `verify_signatures.sql`。
