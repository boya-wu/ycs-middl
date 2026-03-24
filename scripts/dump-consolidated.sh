#!/usr/bin/env bash
# 以本地 Supabase（Docker）套用 migrations 後，重產 supabase/consolidated_schema.sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npx supabase db reset --local --yes
npx supabase db dump --local --schema public -f supabase/consolidated_schema.sql
echo "Updated supabase/consolidated_schema.sql"
