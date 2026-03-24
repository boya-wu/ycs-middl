#!/usr/bin/env bash
# 將 supabase/migrations 推送到已連結的雲端專案（雲端結構以本地 migration 為準）。
# 前置：supabase login；在此 repo 根目錄 supabase link --project-ref <ref>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npx supabase db push "$@"
