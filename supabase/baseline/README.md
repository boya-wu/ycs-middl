# Supabase `public` baseline

- **`2026-03-24_public_full.sql`**：與目前 migration 鏈一致的 schema-only 快照（含 RLS、函式、觸發器、GRANT）。應以遠端真實 DB 為準時，請用 `scripts/dump-public-baseline.sh` 覆寫更新。
- **`2026-03-23_public_schema.sql`**：舊版精簡快照（僅表／視圖／索引／部分 GRANT），僅供歷史參考。

遠端匯出（需本機已安裝 `pg_dump`）：

```bash
export SUPABASE_DB_URL='postgresql://...'
./scripts/dump-public-baseline.sh supabase/baseline/2026-03-24_public_full.sql
```
