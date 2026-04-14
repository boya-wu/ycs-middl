---
description: 定義 YCS 專案的核心技術棧與開發慣例
globs:
  - "**/*"
alwaysApply: true
---
# YCS 技術棧規範

- **框架**: Next.js 14+ (App Router), TypeScript.
  - **RSC 與 client 資料同步**：Server Component 以 `initialX` 等形式將查詢結果傳入 client 時，列表／主資料應以 **props 為準**，勿用 `useState(initialX)` 將資料固定成僅首次 render 的快照而忽略後續 RSC 更新。若 client 呼叫 Server Action 且 Action 內已 `revalidatePath`，成功後應 **`router.refresh()`**（`next/navigation`）觸發當前路由 RSC 重取，使畫面與後端一致。
- **UI**: Tailwind CSS, shadcn/ui 風格元件（手動維護，無 `components.json`）, Lucide React, Sonner (Toast)。
  - 必要設定檔：`postcss.config.js` + `tailwind.config.js`（缺一不可，否則 Tailwind class 不生效）。
  - UI 依賴：`@radix-ui/react-popover`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `tailwindcss-animate`。
  - 樣式細節見 `ui-styling` skill。
- **資料庫**: Supabase (PostgreSQL, Auth, Functions).
- **PM 工作階段（過渡期，工號登入）**：
  - 辨識認領人時以 `staff_profiles.employee_no` 查詢登入；工作階段為 **簽章 JWT**（`jose`）存 HttpOnly Cookie，密鑰使用 **`YCS_SESSION_SECRET`（僅伺服端，勿加 `NEXT_PUBLIC_`）**。
  - 認領看板與 `/api/billing/*` 由 **Middleware** 驗證 Cookie；寫入認領仍須在 Server Action 內重驗工作階段。
  - 後續若改 Supabase Auth／SSO，應保留「伺服端決定 `decision_maker_id`」原則，勿改由前端指定。
- **Excel 處理**: 
  - 前端讀取：`xlsx` (SheetJS)。
  - 後端產出：`exceljs` (Node environment)。
- **開發風格**: 優先使用 Server Actions，所有業務邏輯註解使用「繁體中文」。