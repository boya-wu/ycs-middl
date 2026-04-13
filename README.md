# YCS

## Clone 後：本機 Supabase（Docker）

本機資料庫由 [Supabase CLI](https://supabase.com/docs/guides/cli) 透過 Docker 啟動，專案根目錄已含 `supabase/config.toml` 與 `supabase/migrations/`。

### 前置條件

- **Docker Desktop** 已安裝並在執行（Windows 必須先開啟 Docker）。
- **Node.js**（建議與團隊一致版本）。

### 安裝依賴

```bash
npm install
```

### 啟動本機 Supabase

```bash
npm run supabase:start
```

等同 `npx supabase start`，會拉取映像並啟動 API、Postgres、Studio 等容器。

### 依 migrations 重建本機資料庫

```bash
npm run supabase:reset
```

等同 `npx supabase db reset`，會清空本機資料庫並依 `supabase/migrations/` 重新套用所有 migration。若 CLI 詢問確認，可改執行：

```bash
npx supabase db reset --yes
```

### 清空本機業務資料（保留 schema）

若只需刪除資料、**不**重跑 migration（表結構與 RLS 維持不變），可執行：

```bash
npm run supabase:truncate
```

等同對本機資料庫執行 [`scripts/truncate-public-data.sql`](scripts/truncate-public-data.sql)（`npx supabase db query -f … --local`）：會 `TRUNCATE` 指定的 `public` 業務表並連同 `auth.users`（`CASCADE`）。與 `supabase:reset` 的差異：`reset` 會整庫重建並重新套用 migrations；`truncate` 僅清資料，速度較快，適合本機／測試反覆灌資料。

### 環境變數

1. 複製 `.env.example` 為 `.env.local`（若尚未建立）。
2. 啟動 Supabase 後執行 `npx supabase status`，將輸出中的 **anon**、**service_role** 等金鑰填入 `.env.local`（勿將含密鑰的檔案提交至版本庫）。

`DATABASE_URL` 預設可對齊 `.env.example`（本機 Postgres 埠請以 `supabase/config.toml` 的 `[db] port` 為準，目前為 `54322`）。

### 開發伺服器

```bash
npm run dev
```

### 可選：連 Docker 狀態一併重來

若容器或本機資料異常，可先停止再啟動並 reset：

```bash
npx supabase stop
npm run supabase:start
npm run supabase:reset
```

一般情況下僅需 `npm run supabase:reset` 即可重建資料庫 schema。

### 延伸閱讀

- Supabase 工作流程（baseline、migration、簽章）：[`docs/supabase-workflow.md`](docs/supabase-workflow.md)
