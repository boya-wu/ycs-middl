# 版本號與更新日誌工作流程

這份文件記錄 YCS 的版本管理三件事：**平常寫 Changelog**、**發版**、**push**。

---

## 核心三件事（最重要，每次對照這裡）

| 時機 | 做什麼 |
|------|--------|
| **每次做完功能 / 修正** | 讓 AI 讀 diff → 提案 commit 訊息 + `[Unreleased]` 描述 → 你確認 → 執行 |
| **準備發版時** | 讓 AI 判斷版本類型 → 跑發版腳本（切版 + release commit + tag） |
| **發版後** | 推 commits + tags 到遠端（`git push --follow-tags`） |

---

## 第一件事：平常寫 CHANGELOG

**原則：changelog 是功能的一部分，不是發版前才補的作業。**

> **禁止**：在功能 commit 裡手動修改 `package.json` 的 `version` 欄位。版本號的變更必須由 `npm run version:bump` 腳本統一處理，否則會導致 release commit 重複 bump 或 tag 指向錯誤的版本。

每次做完一個有意義的改動，切換到 **Agent mode** 貼下方的「完整流程 Prompt」，讓 AI 讀 `git diff` 後提案 commit 訊息與 `[Unreleased]` 描述，你確認後執行。

`CHANGELOG.md` 的 `## [Unreleased]` 結果長這樣：

```md
## [Unreleased]
### Added
- 認領看板支援依 SR 篩選

### Fixed
- 修正匯入時短於 5 分鐘資料仍會進入預覽的問題
```

### 分類規則

| 分類 | 對應 | 用途 |
|------|------|------|
| `Added` | feat | 新功能 |
| `Changed` | feat / refactor | 既有行為改變 |
| `Fixed` | fix | bug 修正 |
| `Deprecated` | — | 即將移除的功能 |
| `Removed` | — | 已移除的功能 |
| `Security` | — | 安全性修正 |

### commit 訊息 vs changelog 的差異

- **commit 訊息**：給工程師/回溯用，包含技術細節（例如 `feat(billing): 新增 SR 標題查詢邏輯`）
- **changelog**：給使用者/PM 看，只描述「行為改變 / 功能價值」（例如「SR 認領明細現在可展開查看詳情」）

AI 會自動將 commit 語意轉寫成使用者語言，你只需確認措辭即可。

---

## 第二件事：發版腳本

前提：**工作目錄必須乾淨**（所有改動都已 commit）。

```bash
npm run version:bump -- minor
```

腳本做了什麼：

1. 檢查工作目錄是否乾淨（有未 commit 的檔案就中止）
2. 用 `npm version minor` 把 `package.json` 的版本號升一格
3. 把 `CHANGELOG.md` 的 `## [Unreleased]` 下面插入 `## [新版本] - 今天日期`
4. 自動 `git add` 這三個檔案（`package.json`、`package-lock.json`、`CHANGELOG.md`）
5. 自動產生一筆 release commit（`chore(release): vX.Y.Z`）
6. 自動打一個 git tag（`vX.Y.Z`）

**你不需要手動做這些**，都是腳本一次完成。

### minor / patch / major 怎麼選？

| 情境 | 指令 |
|------|------|
| 修了 bug、小調整 | `npm run version:bump -- patch` |
| 新增功能 | `npm run version:bump -- minor` |
| 破壞性變更（不相容改動） | `npm run version:bump -- major` |

---

## 第三件事：推上去

```bash
git push --follow-tags
```

這一行等同：
- `git push`（推 commits）
- `git push --tags`（推 tags）

---

## 完整 SOP（逐步對照版）

### 平常開發（每次做完一個改動）

```
1. 寫或修改程式碼
2. 切換到 Cursor Agent mode，貼「完整流程 Prompt」（見下方）
3. AI 讀 git diff → 提案 commit 訊息 + [Unreleased] 描述 + 是否建議發版
4. 你確認或微調措辭
5. AI 執行：git add → git commit → 更新 CHANGELOG.md → git push
```

### 準備發版（累積到一個里程碑 / 一段時間後）

```
1. 切換到 Cursor Agent mode，貼「完整流程 Prompt」，並補充「這次要發版」
2. AI 確認 CHANGELOG.md Unreleased 是否齊全、git status 是否乾淨
3. AI 判斷版本類型（patch / minor / major）並說明理由，你確認
4. AI 執行：npm run version:bump -- <type> → git push --follow-tags
```

---

## 發版後的 Commit 記錄長什麼樣？

發版後 `git log` 會看到兩種 commit 交替出現：

```
chore(release): v0.6.0          ← 腳本自動產生的 release commit（打了 tag）
feat(billing): 新增 SR 明細功能  ← 你平常做的功能 commit
fix(import): 過濾短於5分鐘資料   ← 你平常做的功能 commit
chore(release): v0.5.0-beta.1   ← 上一次 release commit
```

---

## 讓 AI 幫你完成全流程的 Prompt

### Prompt A：完整流程（程式碼做完、尚未 commit）

**切換到 Agent mode，貼以下 prompt（可附上本次改動的簡短說明）：**

```
我剛完成了一個功能改動，請接手「commit + changelog + 發版判斷」流程：

1. 讀 git diff（staged 與 unstaged）了解本次改動內容
2. 提案：繁體中文 Conventional Commits 格式的 commit 訊息（feat/fix/refactor/chore）
3. 提案：對應的 CHANGELOG.md [Unreleased] 描述（使用者語言，非技術細節）
4. 判斷版本 bump 類型，依以下規則決定，並在最後一行說明「建議 patch/minor/major，因為本次包含 XXX」：

   **patch**（只動第三位，例如 0.5.0 → 0.5.1）：
   - 只有 bug 修正（fix）、文案/翻譯調整、UI 細節微修
   - 不增加任何新功能、不改變現有行為或 API

   **minor**（只動第二位，例如 0.5.0 → 0.6.0）：
   - 新增可見功能、新增頁面/元件、新增 API 欄位（但保持向下相容）
   - 既有行為有意調整（改了 UX 流程、更換技術方案但用戶感知到）

   **major**（動第一位，例如 0.5.0 → 1.0.0）：
   - 移除或重命名功能/API（破壞性改動）
   - 資料結構不相容（舊資料/流程需要手動遷移）
   - 目前版本在 0.x，**通常不升 major，除非我確認**

   **直接 push（不發版）**：
   - 只有 chore、docs、refactor（不改行為）、style 類改動
   - Unreleased 描述項目少，尚未累積到值得發版的量
5. 等我確認措辭後再執行
6. 執行順序：git add → git commit → 更新 CHANGELOG.md → git push
7. 若建議發版且我確認，接著執行：npm run version:bump -- <type> → git push --follow-tags
8. 若 scripts/version-bump.sh 有問題，請先修腳本再跑（保持 Git Bash 相容）
```

---

### Prompt B：僅發版（已手動 commit，想讓 AI 接手發版）

**當你已手動 commit、只需要讓 AI 接手「發版」時：**

```
我已經完成並 push 了功能變更的 commits，請接手「發版」流程：

- 先確認：git status 是否乾淨、目前 package.json version、現有 git tags
- 先確認：CHANGELOG.md 的 Unreleased 內容是否齊全（如果空的，請先告訴我，不要繼續）
- 版本 bump：這次做 patch / minor / major（把這個換成你想要的）
- 請更新：CHANGELOG.md，把 Unreleased 切成新版本段落（日期用今天）
- 請建立：release commit（訊息用 chore(release): vX.Y.Z）
- 請建立：git tag（格式 vX.Y.Z）
- 最後：git push --follow-tags
- 若 scripts/version-bump.sh 在過程中有問題，請先修腳本再跑（保持 Git Bash 相容）
```

---

## Commit 訊息中文化（對抗跑出英文的問題）

**在 Cursor commit generator 輸入框貼這段，再讓它生成：**

```
請用繁體中文輸出 commit 訊息，格式為 Conventional Commits：
<type>(scope): <描述>

type 選用：feat / fix / refactor / chore / docs
scope 是模組名稱（可省略）
描述限 50 字以內，說明「做了什麼」
body（選填）說明「為什麼這樣做」
```

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `CHANGELOG.md` | 版本更新日誌（唯一資料來源） |
| `package.json` | 版本號的唯一來源（SSOT） |
| `next.config.mjs` | 把版本號注入成 `NEXT_PUBLIC_APP_VERSION` |
| `scripts/version-bump.sh` | 發版腳本 |
| `app/changelog/page.tsx` | 網站的 `/changelog` 更新內容頁面 |
| `.cursor/rules/changelog-versioning.mdc` | AI 協作時遵循的版本管理規則 |
