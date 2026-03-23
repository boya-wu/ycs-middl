---
name: facility-merge
overview: 新增「所屬場區/工作區代號」的 mapping 結構，並把跨廠區重複匯出的同一段工時在匯入後合併為同一筆邏輯 time_record；裁決看板與 MD 計算因此不會重複計算。
todos:
  - id: db-mapping-table
    content: 新增 mapping 表 migration，並 backfill 既有 `time_records.factory_location` 到 mapping（work_area_code 先 fallback = factory_location）。
    status: pending
  - id: db-dedupe-pending-time_records
    content: 新增 migration：針對 `time_records.task_id IS NULL` 的重複 logical key（staff_id, record_date, check_in_time, check_out_time）做 canonical 合併；轉移 mapping 配對並刪除非 canonical time_records。
    status: pending
  - id: db-unique-key-update
    content: 替換舊唯一鍵：移除 `uniq_time_records_import_key`，建立新的 logical-key unique index（不含 factory_location/work_area_code）。
    status: pending
  - id: db-update-views
    content: 更新 pending/decided view：用 mapping 表聚合多值輸出 `factory_location` 與 `work_area_code`（`STRING_AGG(DISTINCT ...)`），確保前端相容。
    status: pending
  - id: import-ui-work-area-column
    content: 更新 `app/dashboard/upload/page.tsx`：擴充 header map 支援 `工作區域代號`（optional，缺失則 fallback = 廠區），並在匯入 payload 帶出 `work_area_code`。
    status: pending
  - id: import-server-action
    content: 更新 `actions/upload/import.ts`：調整 `ImportTimeRecord` 與 `IMPORT_UNIQUE_KEY` 為 logical key；匯入後插入 mapping rows（ON CONFLICT do nothing 防重），且維持 duration < 5 分鐘過濾與 task_id = null。
    status: pending
  - id: docs-and-diagnostics
    content: 更新 `docs/import-diagnostic.md`（防重/唯一鍵描述、預期筆數比對欄位），必要時調整 `data/diagnose_pending_view.sql` 採樣欄位來源。
    status: pending
  - id: smoke-test-plan
    content: 新增一組 SQL/手動測試步驟：匯入同 logical key 的兩筆、檢查 canonical time_record 與 mapping 多值、再完成裁決驗證 used_md 不重複。
    status: pending
isProject: false
---

## 目標行為

- 同一段工時（已確認相同：`staff_id + record_date + check_in_time + check_out_time`）即便 Excel 透過不同廠區匯出成兩筆，只要差異僅在「所屬場區/工作區域代號」，系統在工時裁決（看板/計費）端只算一次。
- 匯入時會把該邏輯工時的「所屬場區/工作區域代號」多值完整保存並顯示。

## 方案總覽（sB: mapping 表 + logical time_record）

```mermaid
flowchart TD
  Excel[Excel 匯出兩筆] -->|import| Import[actions/upload/import.ts]
  Import --> TR[time_records: 以 logical key 建一次]
  Import --> MAP[time_record_facility_workarea: 補上多個(所屬場區,工作區代號)配對]
  MAP --> VIEW[待裁決/已裁決 view 彙整並顯示多值]
  VIEW --> Board[/dashboard/billing 裁決看板/]
  Board --> DEC[createBillingDecision + billing_decision_records]
```



## 需要改的 DB 與程式重點

### 1) DB：新增 mapping 表並回填

- 新增 migration：`supabase/migrations/*_add_time_record_facility_workarea.sql`
- 新增表：例如 `time_record_facility_workarea`（名稱可調整）
  - 欄位：`time_record_id`, `factory_location`(所屬場區), `work_area_code`(工作區域代號)
  - unique：避免同一配對重複寫入
- 回填既有資料：從 `time_records.factory_location` 寫入 mapping（`work_area_code` 先等於 `factory_location` 作為相容起點）

### 2) DB：清理既有「待裁決重複」並建立新的唯一鍵

- 新增 migration：`supabase/migrations/*_dedupe_pending_time_records_by_logical_key.sql`
- 針對 **未認領** 的重複資料（建議範圍：`time_records.task_id IS NULL`，且最好確保未被 `billing_decision_records` 參照），依 logical key：
  - `staff_id, record_date, check_in_time, check_out_time`
- 合併策略：
  - 選定 canonical `time_record_id`
  - 把非 canonical 的 mapping 配對轉移/補齊到 canonical
  - 刪除多餘的非 canonical `time_records`
- 建立/替換 unique index：
  - 移除舊的 `uniq_time_records_import_key`（目前包含 `factory_location`）
  - 建立新的 unique index（logical key，不含廠區/工作區代號）

> 這一步是為了讓「之後匯入」真的不再插入兩筆；否則只能靠裁決端例外處理來補救。

### 3) DB：更新 pending/decided view 以顯示多值

目前 view 直接用 `time_records.factory_location` 產出 `所屬廠區` 與 `work_area_code`，需改成 mapping 聚合。

- 修改：
  - `supabase/migrations/011_pending_billing_decisions_staff_columns.sql`（或新增一個 replace view migration）
  - `supabase/migrations/012_decided_billing_decisions_summary.sql`
  - `supabase/migrations/013_decided_billing_decisions_summary_add_reason.sql`
- 新 view 欄位輸出（維持前端相容）：
  - `factory_location`：`STRING_AGG(DISTINCT mapping.factory_location, ', ' ...)`
  - `work_area_code`：`STRING_AGG(DISTINCT mapping.work_area_code, ', ' ...)`
  - 仍保留 `time_record_id`（這裡會是 canonical 時間紀錄 id）

### 4) 程式：匯入端新增工作區代號欄位支援

- 修改：`app/dashboard/upload/page.tsx`
  - 擴充 `REQUIRED_HEADER_DEFINITIONS`：新增對 `工作區域代號`（與常見同義詞）的 header map（建議設成 optional，缺失時 fallback = 廠區）
  - 預覽表格可選配一欄顯示（若你希望 PM 看得到多值，會更直觀）
- 修改：`actions/upload/import.ts`
  - 更新 `ImportTimeRecord`：新增 `work_area_code`
  - 修改 `IMPORT_UNIQUE_KEY`：改為 logical key（不再含 `factory_location`）
  - 匯入流程調整：
    1. 先 upsert `time_records`（task_id 永遠寫 `null`）
    2. 再插入 mapping row：`(time_record_id, factory_location, work_area_code)`，以 unique index 防重

> 這裡要特別確保：匯入階段只寫事實與 mapping，不做 PY/SR 認領；符合 `.cursor/rules/ycs-architect-principles.mdc` 的「流程解耦」原則。

### 5) 前端（裁決看板）

- `components/billing/decision-table.tsx` 可維持不動：因為 view 仍輸出 `factory_location` / `work_area_code` 字串。
- `components/billing/decision-board.tsx` 可維持不動：因為 canonical `time_record_id` 已確保不會因跨廠區重複而出現兩筆。

## 風險與保護

- 若資料庫內已存在「已認領/已裁決」的重複時間紀錄，migration 合併刪除可能影響既有 billing lineage。
  - 因此合併 migration 需明確限制在 `task_id IS NULL`（以及必要時排除已被 `billing_decision_records` 參照者）。
- 若你希望同步修正已裁決造成的歷史 MD double-count，這會是獨立的回溯更正需求（需要額外規則）。

## 驗證

- 匯入測試：同一 logical key 的兩筆（不同 `factory_location/work_area_code`）匯入後：
  - `COUNT(*)` 應只產生 1 筆 canonical `time_records`
  - mapping 表應有 2 筆配對
  - `/dashboard/billing` 待裁決表格應顯示一筆，但 `factory_location/work_area_code` 顯示兩個值
- 裁決測試：PM 選取該筆 canonical time_record，確認 `task_billing_summary` 的 used_md 沒有 double-count。

