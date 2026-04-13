---
name: ui-styling
description: >-
  YCS 專案的 UI 樣式架構：Tailwind CSS 建置管線、CSS 變數系統、components/ui 元件清單與實作方式、新增元件流程。
  觸發時機：修改或新增 components/ui/ 元件、調整 globals.css / tailwind.config.js、美化 UI、處理樣式問題。
globs:
  - "components/ui/**"
  - "app/globals.css"
  - "tailwind.config.js"
  - "postcss.config.js"
---

# UI 樣式架構

## CSS 建置管線（必要檔案）

以下兩檔**缺一不可**，刪除或遺漏會導致所有 Tailwind utility class 無法編譯：

| 檔案 | 用途 |
|------|------|
| `postcss.config.js` | 啟用 `tailwindcss` + `autoprefixer` |
| `tailwind.config.js` | `content` 掃描路徑、色彩 token 對應、插件 `tailwindcss-animate` |

`app/globals.css` 使用 `@tailwind base/components/utilities` 指令，由 PostCSS 在建置時展開。若管線未設定，CSS 產物僅含字面 `@tailwind` 文字，所有 class 皆不生效。

## CSS 變數系統

`app/globals.css` → `:root` 定義 HSL 數值（不含 `hsl()` 包裹），由 `tailwind.config.js` 以 `hsl(var(--name) / <alpha-value>)` 消費。

核心 token：

```
--background / --foreground
--card / --card-foreground
--popover / --popover-foreground
--primary / --primary-foreground
--secondary / --secondary-foreground
--muted / --muted-foreground
--accent / --accent-foreground
--destructive / --destructive-foreground
--border, --input, --ring
--radius (0.5rem)
```

修改色彩時，更新 `globals.css` 的 HSL 值即可全域生效；`tailwind.config.js` 不須重複改動。

## Dark Mode 現狀

- `tailwind.config.js` 已設定 `darkMode: ['class']`
- `globals.css` **尚無** `.dark` 變數區塊（半成品）
- 實作 dark mode 時須在 `globals.css` 新增 `.dark { ... }` 區塊覆寫全部 token

## 元件清單（`components/ui/`）

| 檔案 | Radix | 備註 |
|------|-------|------|
| `popover.tsx` | `@radix-ui/react-popover` | 唯一使用 Radix 的元件 |
| `dialog.tsx` | 否 | 自製 overlay + `DialogContext` |
| `checkbox.tsx` | 否 | 原生 `<input type="checkbox">`，包裝 `onCheckedChange` |
| `select.tsx` | 否 | 原生 `<select>` |
| `input.tsx` | 否 | 原生 `<input>` |
| `textarea.tsx` | 否 | 原生 `<textarea>` |
| `label.tsx` | 否 | 原生 `<label>` |
| `button.tsx` | 否 | 原生 `<button>`，variant/size 模式 |
| `badge.tsx` | 否 | `<div>` + variant |
| `card.tsx` | 否 | Card / CardHeader / CardTitle / CardContent / CardFooter |
| `table.tsx` | 否 | Table / TableHeader / TableBody / TableRow / TableHead / TableCell |

## 新增 UI 元件流程

1. 在 `components/ui/` 建立 `.tsx` 檔案
2. 遵循 `React.forwardRef` + `cn()` 模式
3. 使用 `@/lib/utils` 的 `cn()`（= `twMerge(clsx(...))`）合併 className
4. **不可** 使用 `npx shadcn-ui@latest add`（專案無 `components.json`）
5. 若需引入新 Radix primitive，先 `npm install @radix-ui/react-xxx`，再手動建立元件

## UI 相關依賴

| 套件 | 用途 |
|------|------|
| `@radix-ui/react-popover` | Popover primitive |
| `clsx` | className 條件組合 |
| `tailwind-merge` | 合併衝突的 Tailwind class |
| `lucide-react` | 圖示庫 |
| `sonner` | Toast 通知 |
| `tailwindcss-animate` | 動畫 utility（Tailwind 插件） |
| `autoprefixer` | PostCSS vendor prefix |
