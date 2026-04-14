# Changelog

格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/)，版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [Unreleased]

### Added
- 新增「版本更新內容」頁面（/changelog），可直接查看各版本更新摘要
- Dashboard 側欄新增「更新內容」入口，並顯示目前版本號
- 建立版本管理與發版流程（文件與工具），讓更新內容可持續維護

### Changed
- 登入頁的工號欄位文案調整（更明確的 YCS 工號提示）

## [0.5.0-beta.1] - 2026-04-14
### Added
- SR 標題與已認領明細功能
- 以員工工號登入並加入 Session 管理
- 引入最短匯入時長設定以過濾短時段資料
- 人員名冊匯入功能及相關查詢

## [0.4.0-beta.1] - 2026-04-13
### Added
- 整合 Tailwind CSS 與 PostCSS 以進行樣式處理
- 新增 PY 與 SR 維護功能
- 增強專案任務維護功能與資料同步
- 整合 Radix UI 的 Select 元件並更新相依套件
- 將新建計費決策的「可計費」狀態預設為 true

### Changed
- 將「裁決」相關術語統一為「認領」

## [0.3.0-beta.1] - 2026-03-24
### Added
- 建立 public baseline + 漂移稽核 + consolidated_schema 防手改
- 更新 audit_drift.sql 與 package.json 以支援新功能

### Changed
- 更新標題與描述以反映系統功能變更

## [0.2.0-beta.1] - 2026-02-11
### Added
- 裁決彙整視圖加入 reason、transaction 去重與 API 權限
- 增加頁面可見性監聽以自動重拉資料
- 新增「已裁定」分頁與摘要檢視（含重構與遷移修正）

### Fixed
- 修復 migration 同步與裁決/匯入相關變更

## [0.1.0-beta.1] - 2026-01-25
### Added
- 初版上傳頁面與相關元件
- 加入 Supabase 依賴與開發基礎設定

### Changed
- 更新 createBillingDecision 的 revalidation path

