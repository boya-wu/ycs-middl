#!/usr/bin/env bash
# 從「遠端」Postgres 匯出 public schema（DDL + GRANT 等），作為 baseline 真實來源。
# 用法：
#   export SUPABASE_DB_URL='postgresql://postgres.[ref]:[password]@aws-0-....pooler.supabase.com:6543/postgres'
#   ./scripts/dump-public-baseline.sh [輸出路徑]
# 預設輸出：supabase/baseline/YYYY-MM-DD_public_full.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "error: 請設定環境變數 SUPABASE_DB_URL（遠端 Postgres 連線字串）" >&2
  exit 1
fi
DEFAULT_OUT="supabase/baseline/$(date +%Y-%m-%d)_public_full.sql"
OUT="${1:-$DEFAULT_OUT}"
mkdir -p "$(dirname "$OUT")"
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "error: 找不到 pg_dump，請安裝 PostgreSQL client tools" >&2
  exit 1
fi
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --schema-only \
  --no-owner \
  -f "$OUT"
echo "Wrote $OUT"
