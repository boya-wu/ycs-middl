---
description: 定義 YCS 專案的核心技術棧與開發慣例
globs:
  - "**/*"
alwaysApply: true
---
# YCS 技術棧規範

- **框架**: Next.js 14+ (App Router), TypeScript.
- **UI**: Tailwind CSS, shadcn/ui 風格元件（手動維護，無 `components.json`）, Lucide React, Sonner (Toast)。
  - 必要設定檔：`postcss.config.js` + `tailwind.config.js`（缺一不可，否則 Tailwind class 不生效）。
  - UI 依賴：`@radix-ui/react-popover`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `tailwindcss-animate`。
  - 樣式細節見 `ui-styling` skill。
- **資料庫**: Supabase (PostgreSQL, Auth, Functions).
- **Excel 處理**: 
  - 前端讀取：`xlsx` (SheetJS)。
  - 後端產出：`exceljs` (Node environment)。
- **開發風格**: 優先使用 Server Actions，所有業務邏輯註解使用「繁體中文」。